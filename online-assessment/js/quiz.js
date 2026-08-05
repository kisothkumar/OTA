/* ============================================================
   quiz.js — the student's live view: question in, answer out,
   feedback flash, then a pulse-orb hold until the next question
   arrives from the teacher's dashboard.
   ============================================================ */

(function () {
  const { db, utils, effects } = OA;
  effects.mountDustField(16);

  const code = new URLSearchParams(window.location.search).get("code");
  const sid = sessionStorage.getItem("oa_sid");
  const name = sessionStorage.getItem("oa_name");

  if (!code || !sid) {
    window.location.href = "student.html";
    return;
  }
  document.getElementById("playerName").textContent = name || "Player";

  let session = null;
  let renderedIndex = -1;
  let timerInterval = null;
  let locked = false;

  const qBlock = document.getElementById("qBlock");
  const qText = document.getElementById("qText");
  const optionsWrap = document.getElementById("optionsWrap");
  const waitingBlock = document.getElementById("waitingBlock");
  const timerRing = document.getElementById("timerRing");
  const timerNum = document.getElementById("timerNum");

  db.onChange(code, (data) => {
    if (!data) return;
    session = data;

    const me = (session.students || {})[sid];
    if (me) document.getElementById("scoreLive").textContent = me.score || 0;

    if (session.status === "ended") {
      window.location.href = `results.html?code=${code}`;
      return;
    }
    if (session.status !== "question") return;

    if (session.currentIndex !== renderedIndex) {
      renderQuestion(session.currentIndex);
    } else {
      updateLiveState();
    }
  });

  function renderQuestion(index) {
    renderedIndex = index;
    locked = false;
    const q = session.questions[index];

    // slide-out / slide-in transition
    qBlock.classList.add("leaving");
    setTimeout(() => {
      qBlock.classList.remove("leaving");
      qText.textContent = q.text;
      document.getElementById("qIndex").textContent = index + 1;
      document.getElementById("qTotal").textContent = session.questions.length;

      const dots = document.getElementById("progressDots");
      dots.innerHTML = session.questions.map((_, i) =>
        `<i class="${i < index ? "done" : (i === index ? "active" : "")}"></i>`
      ).join("");

      optionsWrap.innerHTML = q.options.map((opt, oi) => `
        <button type="button" class="opt" data-oi="${oi}">
          <span class="tag">${String.fromCharCode(65 + oi)}</span>
          <span style="flex:1; text-align:left;">${opt}</span>
        </button>
      `).join("");

      [...optionsWrap.children].forEach(btn => {
        btn.addEventListener("click", () => submitAnswer(q, parseInt(btn.dataset.oi, 10)));
      });

      waitingBlock.classList.add("hidden");
      qBlock.classList.remove("hidden");

      startTimer(q);
    }, session.currentIndex === 0 && renderedIndex === 0 ? 0 : 200);
  }

  function startTimer(q) {
    clearInterval(timerInterval);
    const circumference = 2 * Math.PI * 48;
    const bar = timerRing.querySelector(".bar");
    bar.style.strokeDasharray = circumference;

    function tick() {
      const elapsed = (Date.now() - session.questionStartedAt) / 1000;
      const remaining = Math.max(0, Math.ceil(q.time - elapsed));
      timerNum.textContent = remaining;
      const frac = Math.max(0, (q.time - elapsed) / q.time);
      bar.style.strokeDashoffset = circumference * (1 - frac);
      timerRing.classList.toggle("urgent", remaining <= 5);
      if (remaining <= 0) {
        clearInterval(timerInterval);
        if (!locked) autoLockTimeout(q);
      }
    }
    tick();
    timerInterval = setInterval(tick, 200);
  }

  function autoLockTimeout(q) {
    locked = true;
    [...optionsWrap.children].forEach(el => el.classList.add("locked"));
    const correctEl = optionsWrap.children[q.correct];
    if (correctEl) correctEl.classList.add("correct");
    showWaiting("Time's up!", "The correct answer is highlighted above.");
  }

  async function submitAnswer(q, optionIndex) {
    if (locked) return;
    locked = true;

    const elapsedMs = Date.now() - session.questionStartedAt;
    const correct = optionIndex === q.correct;
    const timeFrac = Math.max(0, 1 - elapsedMs / (q.time * 1000));
    const points = correct ? Math.round(500 + 500 * timeFrac) : 0;

    [...optionsWrap.children].forEach(el => el.classList.add("locked"));
    const chosenEl = optionsWrap.children[optionIndex];
    chosenEl.classList.add(correct ? "correct" : "wrong");
    if (!correct) {
      const correctEl = optionsWrap.children[q.correct];
      if (correctEl) setTimeout(() => correctEl.classList.add("correct"), 250);
    }

    // persist to session
    const fresh = await db.get(code);
    const students = { ...(fresh.students || {}) };
    const me = { ...(students[sid] || { name, score: 0, streak: 0, answers: {} }) };
    me.answers = { ...(me.answers || {}), [q.id]: { optionIndex, correct, timeMs: elapsedMs } };
    me.streak = correct ? (me.streak || 0) + 1 : 0;
    me.score = (me.score || 0) + points;
    students[sid] = me;
    await db.update(code, { students });

    document.getElementById("scoreLive").textContent = me.score;

    setTimeout(() => {
      showWaiting(
        correct ? `+${points} points!` : "Not quite.",
        correct ? "Nice — locked in ahead of the pack." : "Hang tight for the next question."
      );
    }, 700);
  }

  function showWaiting(title, sub) {
    document.getElementById("waitTitle").textContent = title;
    document.getElementById("waitSub").textContent = sub;
    setTimeout(() => {
      qBlock.classList.add("hidden");
      waitingBlock.classList.remove("hidden");
    }, 550);
  }

  function updateLiveState() {
    // no-op placeholder for future live tweaks between polls
  }
})();
