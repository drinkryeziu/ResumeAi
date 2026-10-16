import type { ProfileSnapshot } from "@/server/domain/profile";

/**
 * Profile Analyzer, deterministic part: completeness score + the next thing to add.
 * No model call — this runs on every dashboard load, so it must be free and instant.
 */
export function profileStrength(p: ProfileSnapshot): { score: number; nextSteps: string[] } {
  const checks: Array<[boolean, number, string]> = [
    [Boolean(p.firstName && p.lastName && p.email), 10, "Add your name and email"],
    [Boolean(p.phone && (p.city || p.country)), 5, "Add a phone number and location"],
    [Boolean(p.headline), 5, "Add a professional title"],
    [(p.summary ?? "").split(/\s+/).length >= 30, 10, "Write a professional summary (3–4 sentences)"],
    [p.experiences.length >= 1, 20, "Add your work experience"],
    [p.experiences.length > 0 && p.experiences.every((e) => e.achievements.length >= 2), 15, "Add at least two achievements to each role"],
    [p.skills.length >= 8, 10, "List at least 8 skills"],
    [p.education.length >= 1, 10, "Add your education"],
    [Object.values(p.links).some(Boolean), 5, "Add LinkedIn or a portfolio link"],
    [p.projects.length + p.certifications.length >= 1, 10, "Add a project or certification"],
  ];
  const score = checks.reduce((s, [ok, w]) => s + (ok ? w : 0), 0);
  return { score, nextSteps: checks.filter(([ok]) => !ok).map(([, , label]) => label) };
}
