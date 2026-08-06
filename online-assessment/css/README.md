# Online Assessment — Live Classroom Quiz Platform

A real-time quiz tool: a teacher builds a quiz, generates a room code, and
students join from any device. Questions, timers, and the leaderboard all
move in sync — with an animation layer built specifically for that feeling
of *live*.

```
online-assessment/
│
├── index.html          → Home page
├── teacher.html         → Teacher dashboard (build quiz → room code → live monitor)
├── student.html         → Student joining page (code + name → lobby)
├── quiz.html            → Live quiz page (student view)
├── results.html         → Results and leaderboard
├── bank.html             → Question bank (save questions by subject, reuse anytime)
│
├── css/
│   └── style.css        → Design system + all animations
│
├── js/
│   ├── firebase-config.js → Real-time data layer + shared effects  ← edit this to go live
│   ├── teacher.js         → Quiz builder, roster, live monitor, bank import
│   ├── student.js         → Join flow + lobby
│   ├── quiz.js             → Live question rendering, timer, scoring
│   ├── results.js         → Leaderboard + podium rendering
│   └── bank.js             → Question bank CRUD + import/export
│
└── README.md
```

## Question bank — build once, reuse every time

Previously every quiz had to be typed fresh. Now:

1. Open **`bank.html`** → add a subject (e.g. "Physics", "Grade 10 English")
   → add questions to it once.
2. Next time you build a quiz in **`teacher.html`**, scroll to **"Load from
   question bank"**, pick the subject, tick the questions you want, and
   click **"Add selected to quiz"**. They drop straight into the quiz
   builder — edit wording or the time limit per-quiz without touching the
   saved bank copy.
3. Use **Export / Import (.json)** on the bank page to back up your
   questions or move them between accounts.

The bank is stored under one fixed key through the same `OA.db` sync layer
the live quizzes use, so it follows the same rule as everything else in
this app: **same-device by default, or cross-device once Firebase is
configured** (see below).

## Where to make changes for cross-device access (your "anywhere, anytime" ask)

**Only one file needs editing: `js/firebase-config.js`.** Everything else
already talks to `OA.db`, so once Firebase is wired up there, the question
bank, live quizzes, and results all sync across every device automatically
— no other code changes needed.

Steps (free, no credit card, ~3 minutes):

1. Go to **[console.firebase.google.com](https://console.firebase.google.com)**
   → **Add project** → name it anything → finish the wizard.
2. In the left sidebar: **Build → Realtime Database → Create Database** →
   pick a location → start in **test mode** for now.
3. In the left sidebar: **Project settings** (gear icon) → **General** →
   scroll to **"Your apps"** → click the **`</>`** (web) icon → register
   the app (nickname doesn't matter, skip hosting). Firebase will show you
   a config object.
4. Open **`js/firebase-config.js`** in this repo and paste those real
   values into the `FIREBASE_CONFIG` object near the top of the file,
   replacing the `YOUR_...` placeholders. Save.

That's it — the app detects real config values automatically and switches
from same-device sync to Firebase. Every page already loads the Firebase
SDK `<script>` tags it needs. You'll see **"Synced across devices"** in
the header instead of **"Synced on this device"** once it's connected.

### Locking down the database (recommended once it's working)

Test mode leaves the database open to anyone with your URL. Once you've
confirmed everything syncs, go to **Realtime Database → Rules** in the
Firebase console and tighten them, for example:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

is fine for a class project with no sensitive data, but if you want to
restrict writes, look into Firebase Authentication (e.g. anonymous auth)
and scope rules to authenticated users — that's a bigger change than this
app currently needs for 100 students taking a quiz, but worth knowing
about if you outgrow the open-rules setup.

## What's new: the animation layer

This pass adds a full motion system on top of the original structure —
every screen now visibly reacts to something happening in real time.

| Where | Animation |
|---|---|
| Every page | Ambient chalk-dust particle field drifting upward (`dust-field`) |
| Every page | Pulse-orb "broadcast" rings — the app's signature live indicator |
| Buttons | Ripple-on-click micro-interaction |
| Room code | Characters flip in one-by-one on generation |
| Teacher: waiting room | Student chips pop in as each person joins |
| Teacher: live monitor | Answer bars fill live as students respond; countdown ring syncs to the same clock the students see |
| Quiz page | Question slide-out/slide-in transitions, progress dots, circular countdown that turns red + pulses under 5s, correct/wrong flash + shake feedback |
| Results page | Staggered leaderboard reveal, animated score bars, bouncing trophy for 1st place, confetti burst |

All animations respect `prefers-reduced-motion`.

## How live sync works (no backend required)

`js/firebase-config.js` exposes a single `OA.db` interface with
`get / set / update / onChange`. Two implementations sit behind it:

1. **LocalSync (default)** — uses `localStorage` + `BroadcastChannel` +
   `storage` events, so the teacher dashboard and student views sync
   instantly across browser tabs with zero setup. This is what makes the
   whole flow (including every animation above) work immediately when you
   open the files or host them on GitHub Pages.
2. **Firebase Realtime Database (optional)** — fill in `FIREBASE_CONFIG`
   in `js/firebase-config.js`, flip `USE_FIREBASE = true`, and include the
   Firebase SDK `<script>` tags before `firebase-config.js`. Every other
   file already talks only to `OA.db`, so nothing else needs to change.

## Try it locally

Open `index.html` in a browser, then open `teacher.html` and `student.html`
in two more tabs (same browser) to see the live sync and animations in
action — no server or build step needed.

## Data model

```js
session = {
  code, title,
  questions: [{ id, text, options: [4 strings], correct: index, time: seconds }],
  status: "waiting" | "question" | "ended",
  currentIndex: number,
  questionStartedAt: timestamp,
  students: {
    [studentId]: { name, score, streak, answers: { [questionId]: { optionIndex, correct, timeMs } } }
  }
}
```

Scoring rewards both correctness and speed: a correct answer earns
500–1000 points depending on how quickly it was submitted relative to the
question's time limit.
