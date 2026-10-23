/**
 * Turns an answer into what is nicer to hear. A voice reading a whole paragraph in one go runs the sentences together and says
 * "ATS" or "CV" as a word, which is the most robotic part. So letters are spelled out where people say them that way, and the
 * answer is cut into sentences so the voice can be given a small breath between them.
 */
const SAY: Array<[RegExp, string]> = [
  [/\bResumeAi\b/g, "Resume A I"],
  [/\bATS\b/g, "A T S"],
  [/\bCV\b/g, "C V"],
  [/\bPDF\b/g, "P D F"],
  [/\(\.docx\)/g, ""],
  [/\.docx\b/g, "docx"],
  [/\/month\b/g, " a month"],
  [/\s&\s/g, " and "],
  [/\be\.g\.\s?/gi, "for example, "],
];

export function spokenForm(text: string): string {
  return SAY.reduce((t, [from, to]) => t.replace(from, to), text)
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Longest phrase handed to the voice at once: long enough to flow like speech, short enough that no browser cuts it off. */
const PHRASE_MAX = 170;

/**
 * The answer in phrases of one or two sentences. Every phrase is a separate utterance and the voice pauses between them, so too many
 * short ones sound chopped; very short sentences are joined to the next and neighbours are merged up to a comfortable length.
 */
export function sentences(text: string): string[] {
  const merged: string[] = [];
  for (const piece of pieces(text)) {
    const last = merged[merged.length - 1];
    if (last !== undefined && last.length + 1 + piece.length <= PHRASE_MAX) merged[merged.length - 1] = `${last} ${piece}`;
    else merged.push(piece);
  }
  return merged;
}

function pieces(text: string): string[] {
  const parts = spokenForm(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  let carry = "";
  for (const p of parts) {
    const joined = carry ? `${carry} ${p}` : p;
    if (joined.length < 28 && p !== parts[parts.length - 1]) carry = joined;
    else {
      out.push(joined);
      carry = "";
    }
  }
  if (carry) out.push(carry);
  return out;
}
