/* ============================================================
   bank.js — the reusable question bank: subjects on the left,
   questions on the right. Everything here is stored under a
   single well-known key ("QBANK") through the same OA.db sync
   layer the live quizzes use — so once Firebase is configured
   in firebase-config.js, this bank is available on any device.
   ============================================================ */

(function () {
  const { db, utils, effects } = OA;
  effects.mountDustField(16);

  document.getElementById("syncChipText").textContent =
    OA.mode === "firebase" ? "Synced across devices" : "Synced on this device";

  const BANK_KEY = "BANK__QUESTIONS"; // namespaced so it can never collide with a 5-char room code
  let bank = { subjects: [] };
  let activeSubjectId = null;

  const subjectList = document.getElementById("subjectList");
  const noSubject = document.getElementById("noSubject");
  const subjectPanel = document.getElementById("subjectPanel");
  const subjectNameEl = document.getElementById("subjectName");
  const questionCards = document.getElementById("questionCards");
  const noQuestions = document.getElementById("noQuestions");
  const searchInput = document.getElementById("searchInput");
  const optionInputs = document.getElementById("optionInputs");

  /* ---------------- load + live sync ---------------- */

  db.onChange(BANK_KEY, (data) => {
    bank = data || { subjects: [] };
    renderSubjects();
    if (activeSubjectId) renderQuestions();
  });

  async function save() {
    await db.set(BANK_KEY, bank);
  }

  /* ---------------- subjects ---------------- */

  function renderSubjects() {
    subjectList.innerHTML = bank.subjects.map(s => `
      <button type="button" class="subjectBtn" data-id="${s.id}" style="
        display:flex; justify-content:space-between; align-items:center;
        width:100%; text-align:left; padding:10px 12px; border-radius:8px;
        background:${s.id === activeSubjectId ? "var(--ink-700)" : "transparent"};
        border:1px solid ${s.id === activeSubjectId ? "var(--amber)" : "transparent"};
        color:var(--chalk-100); font-size:.9rem;">
        <span>${s.name}</span>
        <span class="small muted">${s.questions.length}</span>
      </button>
    `).join("");

    subjectList.querySelectorAll(".subjectBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        activeSubjectId = btn.dataset.id;
        renderSubjects();
        openSubjectPanel();
      });
    });

    if (activeSubjectId && !bank.subjects.find(s => s.id === activeSubjectId)) {
      activeSubjectId = null;
      noSubject.classList.remove("hidden");
      subjectPanel.classList.add("hidden");
    }
  }

  document.getElementById("addSubjectBtn").addEventListener("click", async () => {
    const input = document.getElementById("newSubjectInput");
    const name = input.value.trim();
    if (!name) { effects.toast("Give the subject a name first."); return; }
    const subject = { id: utils.genId(), name, questions: [] };
    bank.subjects.push(subject);
    await save();
    input.value = "";
    activeSubjectId = subject.id;
    renderSubjects();
    openSubjectPanel();
    effects.toast(`"${name}" added.`);
  });

  document.getElementById("deleteSubjectBtn").addEventListener("click", async () => {
    const subject = bank.subjects.find(s => s.id === activeSubjectId);
    if (!subject) return;
    if (!confirm(`Delete "${subject.name}" and all ${subject.questions.length} saved question(s)? This can't be undone.`)) return;
    bank.subjects = bank.subjects.filter(s => s.id !== activeSubjectId);
    activeSubjectId = null;
    await save();
    renderSubjects();
    noSubject.classList.remove("hidden");
    subjectPanel.classList.add("hidden");
  });

  function openSubjectPanel() {
    const subject = bank.subjects.find(s => s.id === activeSubjectId);
    if (!subject) return;
    noSubject.classList.add("hidden");
    subjectPanel.classList.remove("hidden");
    subjectNameEl.textContent = subject.name;
    searchInput.value = "";
    renderQuestions();
  }

  /* ---------------- questions ---------------- */

  function buildOptionInputs() {
    optionInputs.innerHTML = [0, 1, 2, 3].map(i => `
      <div class="field" style="margin-bottom:6px;">
        <label class="row gap-8">
          <input type="radio" name="newQCorrect" class="qCorrectNew" value="${i}" ${i === 0 ? "checked" : ""} style="width:16px;height:16px;" />
          Option ${String.fromCharCode(65 + i)}
        </label>
        <input type="text" class="qOptionNew" placeholder="Answer option ${String.fromCharCode(65 + i)}" />
      </div>
    `).join("");
  }
  buildOptionInputs();

  document.getElementById("saveQBtn").addEventListener("click", async () => {
    const subject = bank.subjects.find(s => s.id === activeSubjectId);
    if (!subject) return;
    const text = document.getElementById("qTextInput").value.trim();
    const options = [...optionInputs.querySelectorAll(".qOptionNew")].map(i => i.value.trim());
    const correctRadio = optionInputs.querySelector(".qCorrectNew:checked");
    const time = parseInt(document.getElementById("qTimeInput").value, 10);

    if (!text || options.some(o => !o)) {
      effects.toast("Fill in the question and all four options.");
      return;
    }

    subject.questions.push({
      id: utils.genId(),
      text, options,
      correct: correctRadio ? parseInt(correctRadio.value, 10) : 0,
      time
    });
    await save();

    document.getElementById("qTextInput").value = "";
    buildOptionInputs();
    renderSubjects();
    renderQuestions();
    effects.toast("Question saved to bank.");
  });

  function renderQuestions() {
    const subject = bank.subjects.find(s => s.id === activeSubjectId);
    if (!subject) return;
    const term = searchInput.value.trim().toLowerCase();
    const list = subject.questions.filter(q => !term || q.text.toLowerCase().includes(term));

    noQuestions.classList.toggle("hidden", list.length > 0);
    questionCards.innerHTML = list.map(q => `
      <div class="card" style="padding:18px;" data-qid="${q.id}">
        <div class="row" style="justify-content:space-between; align-items:flex-start; gap:10px;">
          <strong style="font-size:.95rem; max-width:80%;">${q.text}</strong>
          <button type="button" class="btn btn-ghost deleteQBtn" style="padding:6px 12px; font-size:.75rem; flex:0 0 auto;">Delete</button>
        </div>
        <div class="mt-16" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          ${q.options.map((opt, oi) => `
            <div class="small ${oi === q.correct ? "text-teal" : "muted"}">
              ${String.fromCharCode(65 + oi)}. ${opt} ${oi === q.correct ? "✓" : ""}
            </div>
          `).join("")}
        </div>
        <div class="small muted mt-8">${q.time}s time limit</div>
      </div>
    `).join("");

    questionCards.querySelectorAll(".deleteQBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const qid = btn.closest("[data-qid]").dataset.qid;
        subject.questions = subject.questions.filter(q => q.id !== qid);
        await save();
        renderSubjects();
        renderQuestions();
      });
    });
  }

  searchInput.addEventListener("input", renderQuestions);

  /* ---------------- import / export ---------------- */

  document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(bank, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "question-bank.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  const importFile = document.getElementById("importFile");
  document.getElementById("importBtn").addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", async () => {
    const file = importFile.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const incoming = JSON.parse(text);
      if (!incoming || !Array.isArray(incoming.subjects)) throw new Error("bad shape");

      // merge by subject name; append questions with fresh ids to avoid collisions
      incoming.subjects.forEach(inSub => {
        let target = bank.subjects.find(s => s.name.toLowerCase() === inSub.name.toLowerCase());
        if (!target) {
          target = { id: utils.genId(), name: inSub.name, questions: [] };
          bank.subjects.push(target);
        }
        (inSub.questions || []).forEach(q => {
          target.questions.push({
            id: utils.genId(),
            text: q.text, options: q.options, correct: q.correct, time: q.time || 20
          });
        });
      });

      await save();
      renderSubjects();
      if (activeSubjectId) renderQuestions();
      effects.toast("Bank imported.");
    } catch (e) {
      effects.toast("That file doesn't look like a valid bank export.");
    }
    importFile.value = "";
  });
})();
