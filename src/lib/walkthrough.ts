/**
 * The tour on the first page: a short conversation, one person asking and the guide explaining, one scene per step of the app.
 * Everything the player shows and reads comes from here, so the words and the timing live in one tested place.
 * Keep it true to the app: plain words, no promises the product doesn't keep.
 */
export type Speaker = "asks" | "explains";
export type SceneId = "about" | "signup" | "profile" | "career" | "directions" | "job" | "match" | "questions" | "documents" | "download";

export interface Line {
  speaker: Speaker;
  text: string;
}
export interface Scene {
  id: SceneId;
  title: string;
  lines: Line[];
}

export const SCENES: readonly Scene[] = [
  {
    id: "about",
    title: "What ResumeAi is",
    lines: [
      { speaker: "asks", text: "Hey, what is this app about?" },
      {
        speaker: "explains",
        text: "Glad you asked. ResumeAi helps you apply for jobs without starting from scratch every time. For each job, it writes a resume and a cover letter that fit it, using only what's true about you.",
      },
    ],
  },
  {
    id: "signup",
    title: "Sign up",
    lines: [
      { speaker: "asks", text: "Okay, that sounds useful. How do I use it?" },
      { speaker: "explains", text: "It's pretty simple. First, you sign up for a free account. After that it's just a few steps, and I'll walk you through them." },
    ],
  },
  {
    id: "profile",
    title: "Create your profile once",
    lines: [
      { speaker: "asks", text: "Alright, I'm signed up. Now what?" },
      { speaker: "explains", text: "Now you tell us about yourself, once. Type it in, or upload your CV and we'll read it for you. That's your profile, and you won't have to redo it for every job." },
    ],
  },
  {
    id: "career",
    title: "See your career at a glance",
    lines: [
      { speaker: "asks", text: "And then?" },
      {
        speaker: "explains",
        text: "Then we read your career for you: what you've done, for how long, and where you're strongest. You'll find it on your profile page, and it's free.",
      },
    ],
  },
  {
    id: "directions",
    title: "See which jobs fit you",
    lines: [
      { speaker: "asks", text: "How do I know which jobs to look for?" },
      {
        speaker: "explains",
        text: "Your profile page shows Jobs to look for. It splits your work history by kind of work, like UX design or graphic design, so you search where your experience really fits. It's a guide, not a promise.",
      },
    ],
  },
  {
    id: "job",
    title: "Add a job",
    lines: [
      { speaker: "asks", text: "Okay. And when I find a job I like?" },
      { speaker: "explains", text: "Paste in the job description, or upload it as a file. Then press Tailor your resume to a job." },
    ],
  },
  {
    id: "match",
    title: "See how you match",
    lines: [
      { speaker: "asks", text: "Can I tell if I'm actually a good fit?" },
      { speaker: "explains", text: "Yes. You get a Job Match Score, and you can see which requirements you cover and which ones you don't." },
    ],
  },
  {
    id: "questions",
    title: "Answer, never invent",
    lines: [
      { speaker: "asks", text: "What if the job asks for something I've never listed?" },
      { speaker: "explains", text: "Then we ask you, and you decide. If you've done it, tell us in your own words. If not, we leave it out. We never make anything up." },
    ],
  },
  {
    id: "documents",
    title: "Review your documents",
    lines: [
      { speaker: "asks", text: "So what do I get at the end?" },
      { speaker: "explains", text: "A resume and a cover letter written for that job. Read them, change anything you want, and you can always go back to an earlier version." },
    ],
  },
  {
    id: "download",
    title: "Download and apply",
    lines: [
      { speaker: "asks", text: "Last thing. How do I actually send it?" },
      { speaker: "explains", text: "Download it as a PDF or Word file, then apply on the company's own site. We never apply for you. Tick Applied to remember where you've sent it." },
      { speaker: "explains", text: "And that's it. Create your free profile and give it a try." },
    ],
  },
];

/** How long a line stays up when nobody is reading it aloud: reading time plus a short pause. */
export const lineMs = (text: string) => Math.max(2600, Math.round(text.length * 62) + 900);

export interface Step extends Line {
  /** Position in `SCENES`, and in that scene's lines. */
  scene: number;
  line: number;
  /** Where this line starts on the whole timeline, and how long it lasts, in milliseconds. */
  start: number;
  ms: number;
}

export const STEPS: readonly Step[] = (() => {
  let start = 0;
  return SCENES.flatMap((scene, s) =>
    scene.lines.map((l, i) => {
      const step: Step = { ...l, scene: s, line: i, start, ms: lineMs(l.text) };
      start += step.ms;
      return step;
    }),
  );
})();

export const TOTAL_MS = STEPS.reduce((a, s) => a + s.ms, 0);

/** Index in `STEPS` of the first line of a scene. */
export const firstStepOf = (scene: number) => Math.max(0, STEPS.findIndex((s) => s.scene === scene));

/** The lines of the scene that are on screen once step `i` has started (the conversation so far). */
export const shownLines = (i: number): Step[] => {
  const cur = STEPS[i];
  return cur ? STEPS.filter((s) => s.scene === cur.scene && s.line <= cur.line) : [];
};

/** How full scene `scene`'s segment is (0 to 1) while step `i` plays and has run for `elapsed` ms. */
export function sceneProgress(scene: number, i: number, elapsed: number): number {
  const cur = STEPS[i];
  if (!cur) return 0;
  if (scene < cur.scene) return 1;
  if (scene > cur.scene) return 0;
  const sceneSteps = STEPS.filter((s) => s.scene === scene);
  const total = sceneSteps.reduce((a, s) => a + s.ms, 0);
  const done = sceneSteps.filter((s) => s.line < cur.line).reduce((a, s) => a + s.ms, 0);
  return Math.min(1, (done + Math.min(elapsed, cur.ms)) / total);
}

/** "About 1 min 30 s", for the poster. */
export const tourLength = () => {
  const s = Math.round(TOTAL_MS / 10_000) * 10;
  return `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}`;
};
