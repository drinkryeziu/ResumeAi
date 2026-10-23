import { askDrinFacts } from "@/server/ask-drin-facts";
import { AskDrin } from "./AskDrin";

/** Puts Ask Drin on every page, with the current price list for the numbers he quotes. */
export function AskDrinLoader() {
  return <AskDrin facts={askDrinFacts()} />;
}
