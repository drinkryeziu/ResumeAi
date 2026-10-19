import type { ProfileSnapshot } from "@/server/domain/profile";
import type { AppStore } from "@/server/store/types";

/** Fictional test data (a complete profile and a job posting). Used by the tests only. */

export const TEST_PROFILE: ProfileSnapshot = {
  id: "prof_test",
  firstName: "Alex",
  lastName: "Rivera",
  headline: "Senior Product Designer",
  email: "alex.rivera@example.com",
  phone: "(704) 555-0142",
  city: "Charlotte",
  state: "NC",
  country: "USA",
  summary:
    "Product designer with 8 years of experience shaping web and mobile products in financial services and B2B SaaS. I lead projects from user research through prototyping and visual design, and I build design systems that help engineering teams ship consistent interfaces faster. I work closely with product managers and engineers and enjoy mentoring designers.",
  links: { linkedin: "https://www.linkedin.com/in/alex-rivera", portfolio: "https://alexrivera.example.com" },
  experiences: [
    {
      id: "exp_harbor",
      company: "Harbor Credit Union",
      title: "Senior Product Designer",
      location: "Charlotte, NC",
      startDate: "2021-03",
      endDate: null,
      isCurrent: true,
      responsibilities: [
        "Lead design for the member mobile banking app and online account opening",
        "Run user research and usability testing sessions with members each quarter",
        "Partner with product managers and engineers in a cross-functional agile team",
        "Mentor two mid-level designers through weekly critiques",
      ],
      achievements: [
        "Redesigned online account opening, raising completion from 41% to 63%",
        "Built and maintained the Harbor design system in Figma, now used by 4 product teams",
        "Cut support calls about card controls by 30% after a usability-led redesign",
      ],
      tools: ["Figma", "Miro", "Jira", "Amplitude"],
    },
    {
      id: "exp_lumen",
      company: "Lumen Analytics",
      title: "Product Designer",
      location: "Remote",
      startDate: "2018-01",
      endDate: "2021-02",
      isCurrent: false,
      responsibilities: [
        "Designed dashboards and reporting workflows for a B2B SaaS analytics product",
        "Created wireframes and interactive prototypes for new features",
        "Worked with engineering to define interaction patterns for data tables and charts",
      ],
      achievements: [
        "Launched a self-serve report builder adopted by 1,200 customer accounts in its first year",
        "Introduced a shared component library that reduced design-to-development handoff time",
      ],
      tools: ["Sketch", "Figma", "Google Analytics"],
    },
    {
      id: "exp_bright",
      company: "Brightline Studio",
      title: "UX/UI Designer",
      location: "Raleigh, NC",
      startDate: "2016-06",
      endDate: "2017-12",
      isCurrent: false,
      responsibilities: ["Designed marketing websites and e-commerce storefronts for small-business clients", "Produced visual design and responsive layouts"],
      achievements: ["Delivered 15 client websites on schedule"],
      tools: ["Sketch", "Adobe XD", "HTML", "CSS"],
    },
  ],
  education: [{ id: "edu_unc", school: "University of North Carolina at Charlotte", degree: "B.A.", field: "Graphic Design", startDate: "2012-08", endDate: "2016-05", description: null }],
  skills: [
    { id: "sk_research", name: "User research", category: "PROFESSIONAL" },
    { id: "sk_usability", name: "Usability testing", category: "PROFESSIONAL" },
    { id: "sk_ds", name: "Design systems", category: "PROFESSIONAL" },
    { id: "sk_proto", name: "Prototyping", category: "PROFESSIONAL" },
    { id: "sk_ixd", name: "Interaction design", category: "PROFESSIONAL" },
    { id: "sk_visual", name: "Visual design", category: "PROFESSIONAL" },
    { id: "sk_wire", name: "Wireframing", category: "PROFESSIONAL" },
    { id: "sk_figma", name: "Figma", category: "TOOL" },
    { id: "sk_miro", name: "Miro", category: "TOOL" },
    { id: "sk_html", name: "HTML", category: "TECHNICAL" },
    { id: "sk_css", name: "CSS", category: "TECHNICAL" },
    { id: "sk_fin", name: "Financial services", category: "DOMAIN" },
    { id: "sk_saas", name: "SaaS", category: "DOMAIN" },
    { id: "sk_mentor", name: "Mentoring", category: "SOFT" },
    { id: "sk_comm", name: "Communication", category: "SOFT" },
  ],
  certifications: [{ id: "cert_nng", name: "UX Certification", issuer: "Nielsen Norman Group", issueDate: "2020-09", expiryDate: null, credentialId: null, url: null }],
  projects: [
    {
      id: "proj_cards",
      name: "Card controls redesign",
      description: "Usability-led redesign of card lock, travel notices and spending limits in the Harbor mobile app.",
      role: "Lead designer",
      tools: ["Figma"],
      results: "Support calls about card controls dropped 30%.",
    },
  ],
  extras: [{ id: "x_es", kind: "LANGUAGE", title: "Spanish", detail: "Professional working proficiency" }],
  approvedFacts: [],
};

export const TEST_JOB = {
  title: "Senior UX Designer",
  company: "Northwind Financial",
  location: "Charlotte, NC (Hybrid)",
  url: "",
  description: `Northwind Financial is looking for a Senior UX Designer to shape digital banking experiences for millions of customers.

Responsibilities:
- Lead end-to-end design for mobile and web banking features, from discovery to launch
- Plan and run user research and usability testing to inform product decisions
- Contribute to and evolve our design system in Figma
- Collaborate with product managers, engineers and compliance partners
- Mentor junior designers and run design critiques

Requirements:
- 6+ years of experience in UX or product design
- Strong portfolio showing interaction design and visual design for web and mobile
- Expert in Figma and prototyping
- Experience with design systems at scale
- Experience with accessibility and WCAG 2.1 AA standards
- Bachelor's degree in design, HCI or a related field
- Excellent communication and stakeholder management skills

Nice to have:
- Experience in financial services or banking
- Familiarity with HTML and CSS
- Experience with A/B testing and analytics tools like Amplitude`,
};

/** A user with the full test profile and a starting balance, made through the public store interface. Returns the user id. */
export async function seedTestUser(store: AppStore): Promise<string> {
  const u = await store.createUser({ email: "alex.rivera@example.com", name: "Alex Rivera", passwordHash: null });
  await store.saveProfile(u.id, { ...structuredClone(TEST_PROFILE), id: `prof_${u.id}`, approvedFacts: [] });
  await store.credits.grant(u.id, 1840, "GRANT", "test-grant", "Test starting balance");
  return u.id;
}
