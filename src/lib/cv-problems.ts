/**
 * Everything that can go wrong when someone uploads or pastes a CV, said in plain words: what happened, how to fix it,
 * and which next step to offer first. The server picks a `CvProblem`, the pop-up shows the guide for it.
 */
export type CvProblem = "no_file" | "too_short" | "too_big" | "empty" | "unsupported" | "scanned" | "no_content" | "unreadable" | "ai_busy" | "ai_off" | "too_fast" | "network";

/** What the pop-up's main button does: switch to pasting the text, pick another file, try the same again, or just close. */
export type CvNext = "paste" | "choose" | "retry" | "close";

export interface CvGuide {
  title: string;
  /** One or two sentences: what happened and why. */
  reason: string;
  /** Things to try, best first. */
  steps: string[];
  next: CvNext;
  nextLabel: string;
}

export const CV_MAX_MB = 4;
const BY_HAND = "Or fill in your details by hand in the form below. Nothing you typed is lost.";

export function guideFor(problem: CvProblem, opts: { sizeMb?: number } = {}): CvGuide {
  switch (problem) {
    case "too_big":
      return {
        title: "That file is too big",
        reason: `${opts.sizeMb ? `Your file is ${opts.sizeMb.toFixed(1)} MB. ` : ""}The most we can read is ${CV_MAX_MB} MB.`,
        steps: [
          "Save or export your CV again as a PDF and choose the smallest size (or turn off high-quality images).",
          "Take out photos and big pictures, then save it again.",
          "Or open your CV, select all the text, copy it and use Paste text.",
        ],
        next: "paste",
        nextLabel: "Paste my CV text",
      };
    case "empty":
      return {
        title: "That file is empty",
        reason: "There is nothing in the file to read. It may not have finished saving or downloading.",
        steps: ["Open the file on your computer and check it shows your CV.", "Save or download it again, then choose it here."],
        next: "choose",
        nextLabel: "Choose another file",
      };
    case "unsupported":
      return {
        title: "We can't read that kind of file",
        reason: "We can read PDF and Word (.docx) files.",
        steps: [
          "In Word, Pages or Google Docs, choose Save As or Download and pick PDF or Word (.docx).",
          "Older .doc files, photos and images can't be read.",
          "Or open your CV, copy the text and use Paste text.",
        ],
        next: "choose",
        nextLabel: "Choose another file",
      };
    case "scanned":
      return {
        title: "We couldn't find any text in that file",
        reason: "It looks like a scan or a photo of a page. The words are a picture, so there is no text to read.",
        steps: [
          "Save your CV as a PDF straight from Word, Google Docs, Pages or Canva, instead of scanning or photographing it.",
          "Or copy the text you can see and use Paste text.",
          BY_HAND,
        ],
        next: "paste",
        nextLabel: "Paste my CV text",
      };
    case "no_content":
      return {
        title: "We couldn't find your jobs, education or skills",
        reason: "We read the file, but it didn't look like a CV: we found no jobs, schools or skills in it.",
        steps: [
          "Check you chose your CV and not another document.",
          "CVs laid out in columns, tables or text boxes can come out jumbled. A plain version with headings like Experience, Education and Skills works best.",
          "Or paste the text, or fill in your details by hand.",
        ],
        next: "paste",
        nextLabel: "Paste my CV text",
      };
    case "unreadable":
      return {
        title: "We couldn't read your CV reliably",
        reason: "We read the text, but couldn't match what we found to your CV closely enough to be sure it's right. We'd rather stop than guess.",
        steps: [
          "Try once more. It sometimes works the second time.",
          "Paste the text instead: select all in your CV, copy it and use Paste text. That is often cleaner than a PDF.",
          BY_HAND,
        ],
        next: "paste",
        nextLabel: "Paste my CV text",
      };
    case "ai_busy":
      return {
        title: "The reading service is busy",
        reason: "Our AI service didn't answer just now. Nothing was saved and nothing was used up.",
        steps: ["Wait a minute, then press Read my CV again.", BY_HAND],
        next: "retry",
        nextLabel: "Try again",
      };
    case "ai_off":
      return {
        title: "Reading CVs isn't available right now",
        reason: "The AI that reads CVs isn't switched on, or its account is out of credit, on this site.",
        steps: [BY_HAND, "Everything else in ResumeAi works as usual. If you run this site, check the AI key and its billing."],
        next: "close",
        nextLabel: "Fill it in by hand",
      };
    case "too_fast":
      return {
        title: "Please wait a moment",
        reason: "You've read several CVs in a short time, so we paused for a few minutes.",
        steps: ["Wait a few minutes, then try again.", BY_HAND],
        next: "close",
        nextLabel: "OK",
      };
    case "too_short":
      return {
        title: "That's too short to be a CV",
        reason: "We need a few lines to work with.",
        steps: ["Paste your whole CV, with headings such as Experience, Education and Skills."],
        next: "paste",
        nextLabel: "Paste my CV text",
      };
    case "network":
      return {
        title: "The upload didn't go through",
        reason: "The connection dropped, or the file was too large for the server to accept.",
        steps: ["Check your internet connection and try again.", `If your file is over ${CV_MAX_MB} MB, make it smaller or paste the text instead.`],
        next: "retry",
        nextLabel: "Try again",
      };
    case "no_file":
      return {
        title: "Choose your CV first",
        reason: "No file was chosen.",
        steps: ["Press Choose your CV and pick a PDF or Word (.docx) file."],
        next: "choose",
        nextLabel: "Choose a file",
      };
  }
}
