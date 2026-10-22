/**
 * Choosing the voices for "Read aloud". Every device has different ones, and the built-in default is usually the stiffest.
 * This ranks what is there, favoring the neural / premium / online voices that sound most like a person, avoids novelty voices,
 * and picks a woman's voice for the person asking and a man's for the guide when both exist. Pure, so it is tested.
 */
export interface VoiceInfo {
  name: string;
  lang: string;
}

/** Voices made for effects and jokes, and the oldest synthetic ones. */
const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|princess|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|compact/i;
/** Marks of the modern, more human voices. */
const NATURAL = /natural|neural|premium|enhanced|siri|online|wavenet|studio/i;
const FEMALE = /samantha|ava|allison|susan|zoe|karen|tessa|moira|serena|fiona|aria|jenny|zira|joanna|salli|emma|libby|sonia|female|catherine|nicky|victoria|google us english/i;
const MALE = /daniel|alex|tom|oliver|guy|davis|aaron|arthur|ryan|brian|matthew|male|james|george|google uk english male/i;

export function score(v: VoiceInfo): number {
  const lang = v.lang.toLowerCase().replace("_", "-");
  if (!lang.startsWith("en")) return -1000;
  let s = 0;
  if (lang === "en-us") s += 6;
  else if (lang === "en-gb" || lang === "en-au" || lang === "en-ca") s += 4;
  else s += 1;
  if (NATURAL.test(v.name)) s += 12;
  if (/google/i.test(v.name)) s += 5;
  if (FEMALE.test(v.name) || MALE.test(v.name)) s += 2;
  if (NOVELTY.test(v.name)) s -= 50;
  return s;
}

const isFemale = (v: VoiceInfo) => FEMALE.test(v.name) && !MALE.test(v.name);
const isMale = (v: VoiceInfo) => MALE.test(v.name) && !FEMALE.test(v.name);

export interface VoicePick<T extends VoiceInfo> {
  asks: T | undefined;
  explains: T | undefined;
  /** True when the two speakers got different voices, so no pitch trick is needed to tell them apart. */
  distinct: boolean;
}

export function pickVoices<T extends VoiceInfo>(all: readonly T[]): VoicePick<T> {
  const ranked = all.filter((v) => score(v) > -10).sort((a, b) => score(b) - score(a));
  if (!ranked.length) return { asks: undefined, explains: undefined, distinct: false };
  const woman = ranked.find(isFemale);
  const man = ranked.find(isMale);
  if (woman && man) return { asks: woman, explains: man, distinct: true };
  const first = ranked[0]!;
  const second = ranked.find((v) => v.name !== first.name);
  return { asks: first, explains: second ?? first, distinct: Boolean(second) };
}
