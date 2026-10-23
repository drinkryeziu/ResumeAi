import type { Facts } from "./facts";
import { byId, ENTRIES, type Entry } from "./knowledge";

/**
 * Finds the entry that answers a question: a plain, repeatable match on the words people use (no guessing, no AI), so it can only
 * ever say what the app's own information says. Nothing close enough means an honest "I don't know that one".
 */
const STOP = new Set(
  "a an the and or of to in on at for with from by is are was were be been am do does did can could will would should may might i me my we our you your it its this that these those there here what which whom how why when where about as if so than then just please tell show give want need like get got have has had into out up any some also not no yes ok hi hello hey thanks thank".split(
    " ",
  ),
);

/** Lower case, letters and digits only, no apostrophes ("don't" is "dont"), and a light stem so "uploading" meets "upload". */
function stem(word: string): string {
  let w = word;
  for (const end of ["ing", "ed", "es", "s"]) if (w.length > end.length + 2 && w.endsWith(end)) return w.slice(0, -end.length);
  return w;
}
export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w))
    .map(stem);
}

function score(q: string[], e: Entry): number {
  const qs = new Set(q);
  let s = 0;
  const asked = tokens(e.question);
  for (const w of qs) {
    if (e.words.some((x) => stem(x) === w)) s += 2;
    if (asked.includes(w)) s += 1;
  }
  // The way a person would put it: share of a known phrasing that this question covers.
  for (const phrase of e.ask) {
    const p = tokens(phrase);
    if (!p.length) continue;
    const hit = p.filter((w) => qs.has(w)).length;
    if (hit === p.length) s += 6;
    else if (hit >= 2) s += (hit / p.length) * 4;
  }
  return s;
}

/** A question needs at least this much before an answer is given; below it Drin says he doesn't know. */
export const MIN_SCORE = 3;

export interface Reply {
  /** The entry answered, or null when nothing matched. */
  id: string | null;
  text: string;
  link?: { href: string; label: string };
  /** Other things worth asking, as entries. */
  related: Array<{ id: string; question: string }>;
}

const OTHER = ["account", "cost", "profile", "job"] as const;

export function reply(question: string, facts: Facts): Reply {
  const q = tokens(question.slice(0, 300));
  const ranked = ENTRIES.map((e) => ({ e, s: q.length ? score(q, e) : 0 })).sort((a, b) => b.s - a.s);
  const best = ranked[0];
  if (!best || best.s < MIN_SCORE) {
    return {
      id: null,
      text: "I don't have an answer for that one. I can tell you about signing up, your profile, how matching works, what things cost, downloading and privacy. Try one of these:",
      related: OTHER.map((id) => ({ id, question: byId(id)!.question })),
    };
  }
  const related = (
    best.e.next ??
    ranked
      .slice(1)
      .filter((r) => r.s >= MIN_SCORE / 2)
      .slice(0, 2)
      .map((r) => r.e.id)
  ).flatMap((id) => {
    const e = byId(id);
    return e ? [{ id: e.id, question: e.question }] : [];
  });
  return { id: best.e.id, text: best.e.answer(facts), link: best.e.link, related };
}
