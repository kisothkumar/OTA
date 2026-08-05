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
│
├── css/
│   └── style.css        → Design system + all animations
│
├── js/
│   ├── firebase-config.js → Real-time data layer + shared effects
│   ├── teacher.js         → Quiz builder, roster, live monitor logic
│   ├── student.js         → Join flow + lobby
│   ├── quiz.js             → Live question rendering, timer, scoring
│   └── results.js         → Leaderboard + podium rendering
│
└── README.md
```

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
