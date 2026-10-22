/** Which profile sections are open. Pure functions so the rules are easy to test; the page keeps the result in state. */
export type OpenSections = ReadonlySet<string>;

/** On load only the first section is open. */
export const initialOpen = (ids: readonly string[]): OpenSections => new Set(ids.slice(0, 1));

export const toggleSection = (open: OpenSections, id: string): OpenSections => {
  const next = new Set(open);
  if (!next.delete(id)) next.add(id);
  return next;
};

export const setAllSections = (ids: readonly string[], expanded: boolean): OpenSections => new Set(expanded ? ids : []);

export const allOpen = (open: OpenSections, ids: readonly string[]) => ids.length > 0 && ids.every((id) => open.has(id));
export const noneOpen = (open: OpenSections, ids: readonly string[]) => ids.every((id) => !open.has(id));
