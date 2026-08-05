/* ============================================================
   firebase-config.js
   ------------------------------------------------------------
   1) Real Firebase hookup — fill in FIREBASE_CONFIG below and
      flip USE_FIREBASE to true to sync teacher/student/live
      quiz state through Firebase Realtime Database.
   2) LocalSync fallback — when Firebase isn't configured, the
      app runs on a zero-setup "LiveSync" engine (localStorage +
      BroadcastChannel + storage events) so the whole flow —
      including the live animations — works instantly across
      browser tabs with no backend. Swap in Firebase any time;
      every other file talks only to the OA.db interface below,
      so nothing else needs to change.
   3) OA.effects / OA.utils — shared animation helpers (chalk
      dust ambience, confetti bursts, toasts, button ripples,
      staggered character reveals) used across every page.
   ============================================================ */

const USE_FIREBASE = false; // flip to true once FIREBASE_CONFIG is filled in

const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

window.OA = (function () {

  /* ---------------- storage engine ---------------- */

  const LS_PREFIX = "oa_session_";
  const channel = ("BroadcastChannel" in window) ? new BroadcastChannel("oa_live") : null;
  const listeners = {}; // code -> [callbacks]

  function notify(code, data) {
    (listeners[code] || []).forEach((cb) => cb(data));
  }

  function readLocal(code) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + code);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeLocal(code, data) {
    localStorage.setItem(LS_PREFIX + code, JSON.stringify(data));
    if (channel) channel.postMessage({ code });
    notify(code, data);
  }

  if (channel) {
    channel.onmessage = (ev) => {
      const { code } = ev.data || {};
      if (code) notify(code, readLocal(code));
    };
  }
  window.addEventListener("storage", (ev) => {
    if (!ev.key || !ev.key.startsWith(LS_PREFIX)) return;
    const code = ev.key.slice(LS_PREFIX.length);
    notify(code, readLocal(code));
  });

  const LocalSync = {
    async get(code) { return readLocal(code); },
    async set(code, data) { writeLocal(code, data); return data; },
    async update(code, patch) {
      const cur = readLocal(code) || {};
      const merged = { ...cur, ...patch };
      writeLocal(code, merged);
      return merged;
    },
    onChange(code, cb) {
      listeners[code] = listeners[code] || [];
      listeners[code].push(cb);
      // fire immediately with current state
      cb(readLocal(code));
      return () => {
        listeners[code] = (listeners[code] || []).filter((f) => f !== cb);
      };
    }
  };

  /* ---------------- firebase engine (optional) ---------------- */

  let FirebaseSync = null;
  if (USE_FIREBASE && window.firebase) {
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
      const rtdb = firebase.database();
      FirebaseSync = {
        async get(code) {
          const snap = await rtdb.ref("sessions/" + code).once("value");
          return snap.val();
        },
        async set(code, data) {
          await rtdb.ref("sessions/" + code).set(data);
          return data;
        },
        async update(code, patch) {
          await rtdb.ref("sessions/" + code).update(patch);
          const snap = await rtdb.ref("sessions/" + code).once("value");
          return snap.val();
        },
        onChange(code, cb) {
          const ref = rtdb.ref("sessions/" + code);
          const handler = (snap) => cb(snap.val());
          ref.on("value", handler);
          return () => ref.off("value", handler);
        }
      };
    } catch (e) {
      console.warn("Firebase init failed, falling back to LocalSync:", e);
      FirebaseSync = null;
    }
  }

  const db = FirebaseSync || LocalSync;

  /* ---------------- utils ---------------- */

  const utils = {
    genCode(len = 5) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let out = "";
      for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
      return out;
    },
    genId() {
      return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    },
    formatTime(sec) {
      const m = Math.floor(sec / 60), s = sec % 60;
      return `${m}:${String(s).padStart(2, "0")}`;
    },
    avatarColor(seed) {
      const colors = ["#F2C94C", "#4ECDC4", "#9B8CFF", "#FF6B6B", "#6FCF97", "#56CCF2"];
      let h = 0;
      for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % colors.length;
      return colors[h];
    },
    initials(name) {
      return (name || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "?";
    }
  };

  /* ---------------- ambient / motion effects ---------------- */

  const effects = {
    mountDustField(count = 22) {
      if (document.querySelector(".dust-field")) return;
      const field = document.createElement("div");
      field.className = "dust-field";
      field.setAttribute("aria-hidden", "true");
      for (let i = 0; i < count; i++) {
        const d = document.createElement("span");
        d.className = "dust";
        const size = (Math.random() * 3 + 1.5).toFixed(1);
        const left = (Math.random() * 100).toFixed(1);
        const dur = (Math.random() * 10 + 10).toFixed(1);
        const delay = (Math.random() * 14).toFixed(1);
        const drift = (Math.random() * 80 - 40).toFixed(0);
        d.style.setProperty("--s", size + "px");
        d.style.left = left + "vw";
        d.style.setProperty("--dur", dur + "s");
        d.style.setProperty("--delay", delay + "s");
        d.style.setProperty("--x", drift + "px");
        field.appendChild(d);
      }
      document.body.prepend(field);
    },

    rippleButtons() {
      document.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn");
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        const r = document.createElement("span");
        const size = Math.max(rect.width, rect.height) * 1.6;
        r.className = "ripple";
        r.style.width = r.style.height = size + "px";
        r.style.left = (e.clientX - rect.left - size / 2) + "px";
        r.style.top = (e.clientY - rect.top - size / 2) + "px";
        btn.style.position = btn.style.position || "relative";
        btn.appendChild(r);
        setTimeout(() => r.remove(), 650);
      });
    },

    toast(msg, ms = 2600) {
      let t = document.querySelector(".toast");
      if (!t) {
        t = document.createElement("div");
        t.className = "toast";
        document.body.appendChild(t);
      }
      t.textContent = msg;
      requestAnimationFrame(() => t.classList.add("show"));
      clearTimeout(t._hideTimer);
      t._hideTimer = setTimeout(() => t.classList.remove("show"), ms);
    },

    animateCode(el, code) {
      el.innerHTML = "";
      [...code].forEach((ch, i) => {
        const span = document.createElement("span");
        span.className = "char";
        span.textContent = ch;
        span.style.animationDelay = (i * 0.06) + "s";
        el.appendChild(span);
      });
    },

    confetti(durationMs = 2600) {
      const colors = ["#F2C94C", "#4ECDC4", "#9B8CFF", "#FF6B6B", "#6FCF97"];
      const layer = document.createElement("div");
      layer.className = "confetti-layer";
      document.body.appendChild(layer);
      const count = 70;
      for (let i = 0; i < count; i++) {
        const c = document.createElement("span");
        c.className = "confetto";
        c.style.left = Math.random() * 100 + "vw";
        c.style.background = colors[i % colors.length];
        c.style.setProperty("--dur", (2 + Math.random() * 1.8) + "s");
        c.style.setProperty("--rot", (Math.random() * 720 - 360) + "deg");
        c.style.animationDelay = (Math.random() * 0.6) + "s";
        c.style.borderRadius = Math.random() > .5 ? "50%" : "2px";
        layer.appendChild(c);
      }
      setTimeout(() => layer.remove(), durationMs + 800);
    }
  };

  effects.rippleButtons();

  return { db, utils, effects, USE_FIREBASE };
})();
