/**
 * "Classic" — a single-column, ATS-safe template. Colors come from the KRZ Resume AI design system
 * (navy-900 ink, blue-700 accents) but documents stay mostly black-on-white for printing and parsing.
 * Helvetica is used because it is built into PDF readers and Word on every platform.
 */
export const classicTheme = {
  id: "classic",
  name: "Classic",
  ink: "#17233c",
  accent: "#0a4195",
  muted: "#4a4f5a",
  rule: "#c9d3e3",
  font: "Helvetica",
  fontBold: "Helvetica-Bold",
  size: { name: 20, headline: 11.5, section: 10.5, body: 10, small: 9 },
  margin: 44,
} as const;
