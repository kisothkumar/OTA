/* ============================================================
   results.js — final leaderboard: podium reveal, staggered bar
   growth, and a confetti burst for whoever's on top.
   ============================================================ */

(function () {
  const { db, utils, effects } = OA;
  effects.mountDustField(20);

  const code = new URLSearchParams(window.location.search).get("code");
  if (!code) {
    window.location.href = "index.html";
    return;
  }

  db.get(code).then((session) => {
    if (!session) {
      document.querySelector("main").innerHTML = `
        <div class="card" style="padding:40px; text-align:center;">
          <h2>No results found</h2>
          <p class="mt-8">This room code doesn't have a saved session on this device.</p>
        </div>`;
      return;
    }
    render(session);
  });

  function render(session) {
    document.getElementById("quizTitle").textContent = session.title || "Quiz results";
    const qCount = (session.questions || []).length;
    const sCount = Object.keys(session.students || {}).length;
    document.getElementById("quizMeta").textContent = `${qCount} question${qCount === 1 ? "" : "s"} · ${sCount} student${sCount === 1 ? "" : "s"}`;

    const ranked = Object.entries(session.students || {})
      .map(([sid, s]) => ({ sid, name: s.name || "Anonymous", score: s.score || 0 }))
      .sort((a, b) => b.score - a.score);

    renderPodium(ranked.slice(0, 3));
    renderList(ranked);

    if (ranked.length) {
      setTimeout(() => effects.confetti(), 500);
    }
  }

  function renderPodium(top3) {
    const podium = document.getElementById("podium");
    if (top3.length === 0) return;
    const order = top3.length === 3 ? [1, 0, 2] : top3.map((_, i) => i); // 2nd,1st,3rd visually
    const heights = { 0: 150, 1: 110, 2: 90 };
    podium.innerHTML = order.map((rankIdx, visualIdx) => {
      const p = top3[rankIdx];
      if (!p) return "";
      const color = utils.avatarColor(p.name);
      const isFirst = rankIdx === 0;
      return `
        <div class="stack" style="align-items:center; animation:reveal-up .6s var(--ease-out) both; animation-delay:${.15 * visualIdx}s;">
          ${isFirst ? '<span class="trophy" style="font-size:1.6rem;">🏆</span>' : `<span style="font-size:1.1rem; opacity:.6;">#${rankIdx + 1}</span>`}
          <span class="avatar" style="width:44px;height:44px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--ink-950); margin-top:6px;">${utils.initials(p.name)}</span>
          <span class="small mt-8" style="max-width:90px; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p.name}</span>
          <div class="card mt-8" style="width:78px; height:${heights[rankIdx] || 70}px; display:flex; align-items:flex-start; justify-content:center; padding-top:10px; border-color:${isFirst ? "var(--amber)" : "var(--ink-600)"};">
            <span style="font-family:var(--font-mono); font-weight:700; color:${isFirst ? "var(--amber)" : "var(--chalk-300)"};">${p.score}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderList(ranked) {
    const maxScore = Math.max(1, ...ranked.map(r => r.score));
    const board = document.getElementById("leaderboard");
    board.innerHTML = ranked.map((r, i) => {
      const rankClass = i === 0 ? "rank-1" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : "";
      const color = utils.avatarColor(r.name);
      return `
        <div class="lb-row ${rankClass}" style="animation-delay:${i * 0.07}s;">
          <div class="lb-rank">${i === 0 ? '<span class="trophy">🏆</span>' : "#" + (i + 1)}</div>
          <div>
            <div class="row gap-8">
              <span class="avatar" style="width:22px;height:22px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;color:var(--ink-950);">${utils.initials(r.name)}</span>
              <strong style="font-size:.95rem;">${r.name}</strong>
            </div>
            <div class="lb-bar-track"><div class="lb-bar-fill" data-w="${(r.score / maxScore) * 100}"></div></div>
          </div>
          <div class="lb-score">${r.score}</div>
        </div>
      `;
    }).join("");

    // trigger width transitions after paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        board.querySelectorAll(".lb-bar-fill").forEach(el => {
          el.style.width = el.dataset.w + "%";
        });
      });
    });
  }
})();
