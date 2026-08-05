/* ============================================================
   student.js — join a room, sit in the lobby, get pushed into
   the live quiz the moment the teacher starts it.
   ============================================================ */

(function () {
  const { db, utils, effects } = OA;
  effects.mountDustField(18);

  const joinPanel = document.getElementById("joinPanel");
  const lobbyPanel = document.getElementById("lobbyPanel");
  const codeInput = document.getElementById("codeInput");
  const nameInput = document.getElementById("nameInput");
  const joinBtn = document.getElementById("joinBtn");
  const joinError = document.getElementById("joinError");

  codeInput.addEventListener("input", () => {
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  });

  function showError(msg) {
    joinError.textContent = msg;
    joinError.classList.remove("hidden");
  }

  // support ?code=XXXXX in the URL (e.g. shared link/QR)
  const params = new URLSearchParams(window.location.search);
  if (params.get("code")) codeInput.value = params.get("code").toUpperCase();

  joinBtn.addEventListener("click", async () => {
    const code = codeInput.value.trim().toUpperCase();
    const name = nameInput.value.trim();
    joinError.classList.add("hidden");

    if (code.length < 4) return showError("Enter the full room code.");
    if (!name) return showError("Tell us what to call you.");

    joinBtn.disabled = true;
    joinBtn.textContent = "Connecting…";

    const session = await db.get(code);
    if (!session) {
      joinBtn.disabled = false;
      joinBtn.textContent = "Join quiz →";
      return showError("No live quiz found for that code. Double-check with your teacher.");
    }
    if (session.status !== "waiting") {
      joinBtn.disabled = false;
      joinBtn.textContent = "Join quiz →";
      return showError("This quiz has already started or ended.");
    }

    const sid = utils.genId();
    const students = { ...(session.students || {}) };
    students[sid] = { name, joinedAt: Date.now(), score: 0, streak: 0, answers: {} };
    await db.update(code, { students });

    sessionStorage.setItem("oa_sid", sid);
    sessionStorage.setItem("oa_code", code);
    sessionStorage.setItem("oa_name", name);

    joinPanel.classList.add("hidden");
    lobbyPanel.classList.remove("hidden");
    document.getElementById("lobbyName").textContent = name;
    document.getElementById("lobbyCode").textContent = code;

    db.onChange(code, (data) => {
      if (data && data.status === "question") {
        window.location.href = `quiz.html?code=${code}`;
      }
      if (data && data.status === "ended") {
        window.location.href = `results.html?code=${code}`;
      }
    });
  });

  codeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") nameInput.focus(); });
  nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") joinBtn.click(); });
})();
