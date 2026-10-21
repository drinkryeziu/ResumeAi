import { z } from "zod/v4";
import { normalizeUrl } from "@/lib/url";

/** Server-side validation for profile saves. Ids are generated client-side but must be safe evidence ids. */
// Any short id without "#" — "#" is reserved for evidence references like "exp_1#a0". Accepts DB cuids too.
const id = z.string().regex(/^[A-Za-z0-9_-]{2,40}$/, "Invalid item id");
const month = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}$/)]).optional();
const text = (max: number) => z.string().trim().max(max);
const lines = z.array(text(400)).max(30).transform((a) => a.filter(Boolean));
// "linkedin.com/in/alex" is accepted and saved as a full address.
const url = z.string().transform(normalizeUrl).pipe(z.union([z.literal(""), z.url().max(500)])).optional();

export const ProfileInputSchema = z.object({
  firstName: text(80).min(1, "Add your first name."),
  lastName: text(80).min(1, "Add your last name."),
  headline: text(120).min(1, "Add your professional title."),
  email: z.email("Add a valid email address."),
  phone: text(40).optional(),
  city: text(80).optional(),
  state: text(80).optional(),
  country: text(80).optional(),
  summary: text(2000).optional(),
  links: z.object({ linkedin: url, portfolio: url, github: url, behance: url, dribbble: url, website: url }),
  experiences: z
    .array(
      z
        .object({
          id,
          company: text(120).min(1, "Each job needs a company."),
          title: text(120).min(1, "Each job needs a job title."),
          location: text(120).optional(),
          startDate: z.string().regex(/^\d{4}-\d{2}$/, "Each job needs a start month."),
          endDate: month,
          isCurrent: z.boolean(),
          responsibilities: lines,
          achievements: lines,
          tools: lines,
        })
        .refine((e) => e.isCurrent || Boolean(e.endDate), "Add an end month, or tick “I currently work here”."),
    )
    .max(25),
  education: z.array(z.object({ id, school: text(160).min(1, "Each education entry needs a school."), degree: text(120).optional(), field: text(120).optional(), startDate: month, endDate: month, description: text(1000).optional() })).max(10),
  skills: z.object({ PROFESSIONAL: lines, TECHNICAL: lines, TOOL: lines, DOMAIN: lines, SOFT: lines }),
  certifications: z.array(z.object({ id, name: text(160).min(1, "Each certification needs a name."), issuer: text(160).optional(), issueDate: month, expiryDate: month, credentialId: text(120).optional(), url })).max(20),
  projects: z.array(z.object({ id, name: text(160).min(1, "Each project needs a name."), description: text(1500).optional(), role: text(120).optional(), tools: lines, results: text(1000).optional() })).max(15),
  extras: z.object({ LANGUAGE: lines, AWARD: lines, PUBLICATION: lines, VOLUNTEER: lines }),
});

export type ProfileInput = z.input<typeof ProfileInputSchema>;
