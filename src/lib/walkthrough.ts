/**
 * The tour on the first page: a short conversation, one person asking and the guide explaining, one scene per step of the app.
 * Everything the player shows and reads comes from here, so the words and the timing live in one tested place.
 * Keep it true to the app: plain words, no promises the product doesn't keep.
 */
export type Speaker = "asks" | "explains";
export type SceneId = "about" | "signup" | "profile" | "masters" | "job" | "match" | "questions" | "documents" | "download";

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
      { speaker: "asks", text: "What is this app about?" },
      {
        speaker: "explains",
        text: "ResumeAi writes a resume and a cover letter for each job you apply to, using only what's true about you. It also shows you how well you match the job before you apply.",
      },
    ],
  },
  {
    id: "signup",
    title: "Sign up",
    lines: [
      { speaker: "asks", text: "How do I use it?" },
      { speaker: "explains", text: "First, sign up for a free account. From there it works in a few simple steps, and I'll walk you through them." },
    ],
  },
  {
    id: "profile",
    title: "Create your profile once",
    lines: [
      { speaker: "asks", text: "What do I do once I'm signed up?" },
      { speaker: "explains", text: "You create your professional profile once, by typing it in or uploading your CV. It stays your single source of truth, so you never rewrite it for every job." },
    ],
  },
  {
    id: "masters",
    title: "Get your master documents",
    lines: [
      { speaker: "asks", text: "And then what happens?" },
      { speaker: "explains", text: "We write your Master Resume and Master Cover Letter from your profile. Creating them is free, and every application starts from them." },
    ],
  },
  {
    id: "job",
    title: "Add a job",
    lines: [
      { speaker: "asks", text: "How do I go for a specific job?" },
      { speaker: "explains", text: "Paste the job description, or upload it as a file, then press Tailor your resume to a job." },
    ],
  },
  {
    id: "match",
    title: "See how you match",
    lines: [
      { speaker: "asks", text: "Will I know if I'm a good fit?" },
      { speaker: "explains", text: "Yes. You get a Job Match Score, and you see which requirements your profile covers and which ones it doesn't." },
    ],
  },
  {
    id: "questions",
    title: "Answer, never invent",
    lines: [
      { speaker: "asks", text: "What if the job asks for something I never listed?" },
      { speaker: "explains", text: "We ask you, and you decide. We only use what's true about you. Nothing is made up: not a job, not a skill, not a number." },
    ],
  },
  {
    id: "documents",
    title: "Review your documents",
    lines: [
      { speaker: "asks", text: "What do I get at the end?" },
      { speaker: "explains", text: "A resume and a cover letter written for that job. Read them, change anything you like, and go back to an earlier version at any time." },
    ],
  },
  {
    id: "download",
    title: "Download and apply",
    lines: [
      { speaker: "asks", text: "How do I send it?" },
      { speaker: "explains", text: "Download it as PDF or Word, then apply on the company's own site. We never apply for you. Tick Applied to keep track of where you've sent it." },
      { speaker: "explains", text: "That's all there is to it. Create your free profile to try it." },
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
