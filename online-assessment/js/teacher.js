/* ============================================================
   teacher.js — quiz builder, room-code broadcast, live roster,
   and the live per-question monitor.
   ============================================================ */

(function () {
  const { db, utils, effects } = OA;
  effects.mountDustField(18);

  let questionRows = []; // {id, textEl, optionEls[4], correctRadios[4], timeSel}
  let code = null;
  let session = null;
  let unsub = null;
  let timerInterval = null;
  let lastRenderedIndex = -1;

  const buildPanel = document.getElementById("buildPanel");
  const waitPanel = document.getElementById("waitPanel");
  const livePanel = document.getElementById("livePanel");
  const questionsList = document.getElementById("questionsList");
  const statusChip = document.getElementById("statusChip");
  const statusText = document.getElementById("statusText");

  /* ---------------- question builder UI ---------------- */

  function addQuestionRow() {
    const idx = questionRows.length;
    const wrap = document.createElement("div");
    wrap.className = "card reveal mt-24";
    wrap.style.padding = "20px";
    wrap.style.borderColor = "var(--ink-600)";
    wrap.innerHTML = `
      <div class="row" style="justify-content:space-between;">
        <span class="small muted" style="text-transform:uppercase; letter-spacing:.08em;">Question ${idx + 1}</span>
        <button type="button" class="btn btn-ghost removeQ" style="padding:6px 14px; font-size:.8rem;">Remove</button>
      </div>
      <div class="field mt-16">
        <label>Question text</label>
        <input type="text" class="qText" placeholder="What powers the light-independent reactions?" />
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
        ${[0, 1, 2, 3].map(i => `
          <div class="field" style="margin-bottom:6px;">
            <label class="row gap-8">
              <input type="radio" name="correct-${idx}" class="qCorrect" value="${i}" ${i === 0 ? "checked" : ""} style="width:16px;height:16px;" />
              Option ${String.fromCharCode(65 + i)}
            </label>
            <input type="text" class="qOption" placeholder="Answer option ${String.fromCharCode(65 + i)}" />
          </div>
        `).join("")}
      </div>
      <div class="field" style="max-width:200px;">
        <label>Time limit</label>
        <select class="qTime">
          <option value="15">15 seconds</option>
          <option value="20" selected>20 seconds</option>
          <option value="30">30 seconds</option>
          <option value="45">45 seconds</option>
          <option value="60">60 seconds</option>
        </select>
      </div>
    `;
    questionsList.appendChild(wrap);
    wrap.querySelector(".removeQ").addEventListener("click", () => {
      wrap.remove();
      questionRows = questionRows.filter(r => r.wrap !== wrap);
      renumber();
    });
    questionRows.push({ wrap });
  }

  function renumber() {
    questionsList.querySelectorAll(".card").forEach((el, i) => {
      el.querySelector("span.muted").textContent = `Question ${i + 1}`;
    });
  }

  document.getElementById("addQuestionBtn").addEventListener("click", addQuestionRow);
  addQuestionRow(); // start with one

  /* ---------------- session creation ---------------- */

  function collectQuestions() {
    const out = [];
    questionsList.querySelectorAll(".card").forEach((el) => {
      const text = el.querySelector(".qText").value.trim();
      const options = [...el.querySelectorAll(".qOption")].map(i => i.value.trim());
      const correctRadio = el.querySelector(".qCorrect:checked");
      const time = parseInt(el.querySelector(".qTime").value, 10);
      if (!text || options.some(o => !o)) return;
      out.push({
        id: utils.genId(),
        text,
        options,
        correct: correctRadio ? parseInt(correctRadio.value, 10) : 0,
        time
      });
    });
    return out;
  }

  document.getElementById("createSessionBtn").addEventListener("click", async () => {
    const title = document.getElementById("quizTitle").value.trim() || "Untitled quiz";
    const questions = collectQuestions();
    if (questions.length === 0) {
      effects.toast("Add at least one complete question first.");
      return;
    }
    code = utils.genCode(5);
    session = {
      code, title, questions,
      status: "waiting",
      currentIndex: -1,
      questionStartedAt: null,
      students: {},
      createdAt: Date.now()
    };
    await db.set(code, session);

    buildPanel.classList.add("hidden");
    waitPanel.classList.remove("hidden");
    statusChip.classList.remove("hidden");
    statusText.textContent = "Waiting for students";

    const codeEl = document.getElementById("roomCodeDisplay");
    effects.animateCode(codeEl, code);

    subscribe();
  });

  /* ---------------- live subscription ---------------- */

  function subscribe() {
    if (unsub) unsub();
    unsub = db.onChange(code, (data) => {
      if (!data) return;
      session = data;
      if (session.status === "waiting") renderWaiting();
      else if (session.status === "question" || session.status === "between") renderLive();
      else if (session.status === "ended") {
        window.location.href = `results.html?code=${code}`;
      }
    });
  }

  /* ---------------- waiting room render ---------------- */

  function renderWaiting() {
    const students = Object.entries(session.students || {});
    const grid = document.getElementById("studentGrid");
    const count = document.getElementById("joinCount");
    const empty = document.getElementById("emptyJoin");
    count.innerHTML = `<span class="ld"></span> ${students.length} joined`;
    empty.classList.toggle("hidden", students.length > 0);

    const existingIds = new Set([...grid.children].map(c => c.dataset.sid));
    students.forEach(([sid, s]) => {
      if (existingIds.has(sid)) return;
      const chip = document.createElement("div");
      chip.className = "student-chip";
      chip.dataset.sid = sid;
      const color = utils.avatarColor(s.name || sid);
      chip.innerHTML = `<span class="avatar" style="background:${color}">${utils.initials(s.name)}</span> ${s.name}`;
      grid.appendChild(chip);
    });

    document.getElementById("startQuizBtn").disabled = students.length === 0;
  }

  document.getElementById("startQuizBtn").addEventListener("click", async () => {
    await advanceQuestion(0);
    waitPanel.classList.add("hidden");
    livePanel.classList.remove("hidden");
    statusText.textContent = "Live";
  });

  /* ---------------- question control ---------------- */

  async function advanceQuestion(index) {
    if (index >= session.questions.length) {
      await db.update(code, { status: "ended" });
      return;
    }
    await db.update(code, {
      status: "question",
      currentIndex: index,
      questionStartedAt: Date.now()
    });
  }

  document.getElementById("nextQBtn").addEventListener("click", () => {
    advanceQuestion((session.currentIndex ?? -1) + 1);
  });

  document.getElementById("endQuizBtn").addEventListener("click", async () => {
    await db.update(code, { status: "ended" });
  });

  /* ---------------- live monitor render ---------------- */

  function renderLive() {
    const qi = session.currentIndex;
    const q = session.questions[qi];
    if (!q) return;

    document.getElementById("qIndex").textContent = qi + 1;
    document.getElementById("qTotal").textContent = session.questions.length;
    document.getElementById("qTextLive").textContent = q.text;

    // progress dots
    const dots = document.getElementById("progressDots");
    if (dots.children.length !== session.questions.length) {
      dots.innerHTML = session.questions.map(() => "<i></i>").join("");
    }
    [...dots.children].forEach((d, i) => {
      d.className = i < qi ? "done" : (i === qi ? "active" : "");
    });

    const students = Object.values(session.students || {});
    const total = students.length;
    const counts = q.options.map((_, oi) =>
      students.filter(s => s.answers && s.answers[q.id] && s.answers[q.id].optionIndex === oi).length
    );
    const answered = counts.reduce((a, b) => a + b, 0);
    document.getElementById("answeredCount").textContent = `${answered} / ${total}`;

    const optsWrap = document.getElementById("liveOptions");
    if (qi !== lastRenderedIndex) {
      optsWrap.innerHTML = q.options.map((opt, oi) => `
        <div class="opt" style="cursor:default;">
          <span class="fill"></span>
          <span class="tag">${String.fromCharCode(65 + oi)}</span>
          <span style="flex:1;">${opt}</span>
          <span class="small muted voteCount">0</span>
        </div>
      `).join("");
      lastRenderedIndex = qi;
    }
    [...optsWrap.children].forEach((el, oi) => {
      const pct = total ? Math.round((counts[oi] / total) * 100) : 0;
      el.querySelector(".fill").style.width = pct + "%";
      el.querySelector(".voteCount").textContent = `${counts[oi]} (${pct}%)`;
    });

    // timer (teacher view mirrors student countdown)
    clearInterval(timerInterval);
    const ring = document.getElementById("teacherTimer");
    const numEl = document.getElementById("teacherTimerNum");
    const bar = ring.querySelector(".bar");
    const circumference = 2 * Math.PI * 48;
    bar.style.strokeDasharray = circumference;

    function tick() {
      const elapsed = (Date.now() - session.questionStartedAt) / 1000;
      const remaining = Math.max(0, Math.ceil(q.time - elapsed));
      numEl.textContent = remaining;
      const frac = Math.max(0, (q.time - elapsed) / q.time);
      bar.style.strokeDashoffset = circumference * (1 - frac);
      ring.classList.toggle("urgent", remaining <= 5);
      if (remaining <= 0) clearInterval(timerInterval);
    }
    tick();
    timerInterval = setInterval(tick, 250);
  }

})();
