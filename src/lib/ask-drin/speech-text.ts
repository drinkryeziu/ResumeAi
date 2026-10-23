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

/** The answer in sentences, with very short ones joined to the next so the voice doesn't stop after every few words. */
export function sentences(text: string): string[] {
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
