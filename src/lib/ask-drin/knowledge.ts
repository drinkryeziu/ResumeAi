import type { Facts } from "./facts";

/**
 * What Ask Drin knows: one entry per thing people ask about the app, written from how the app really works. Plain words, no
 * promise the product doesn't keep. Numbers come from `Facts` (the price list), never typed in here.
 * `ask` are the ways people put the question; `words` are extra words that point to it.
 */
export interface Entry {
  id: string;
  /** The question as the chat shows it, for the buttons and for "you might also ask". */
  question: string;
  ask: string[];
  words: string[];
  answer: (f: Facts) => string;
  link?: { href: string; label: string };
  /** What a person usually asks next, shown after this answer. */
  next?: string[];
}

const credits = (n: number) => `${n} credit${n === 1 ? "" : "s"}`;

export const ENTRIES: Entry[] = [
  {
    id: "about",
    next: ["account", "cost"],
    question: "What is ResumeAi?",
    ask: ["what is resumeai", "what is this app about", "what does this app do", "what is this", "tell me about the app", "how does it work"],
    words: ["about", "app", "resumeai", "do", "purpose", "tailor", "work"],
    answer: () =>
      "ResumeAi helps you apply for jobs without starting from scratch every time. You make your profile once. For each job you paste in, it shows how well you match and writes a resume and a cover letter that fit that job, using only what's true about you. You always apply yourself.",
    link: { href: "/#how-it-works", label: "See how it works" },
  },
  {
    id: "account",
    next: ["profile", "free-credits"],
    question: "How do I create an account?",
    ask: ["how do i create an account", "how do i sign up", "how to register", "make an account", "create account", "join"],
    words: ["account", "sign", "signup", "register", "create", "join", "start", "new", "email", "password"],
    answer: (f) =>
      `Press Get started at the top of the page, then fill in your name, email and a password of at least 8 characters, and choose Create account. It's free, and you start with ${f.signupCredits} credits. After that the app walks you through making your profile.`,
    link: { href: "/sign-up", label: "Create your free account" },
  },
  {
    id: "signin",
    next: ["account"],
    question: "How do I sign in, or reset my password?",
    ask: ["how do i sign in", "how do i log in", "i forgot my password", "reset my password", "can't sign in", "cannot log in", "login problem"],
    words: ["sign", "signin", "login", "log", "forgot", "password", "reset", "locked", "access", "cannot", "cant"],
    answer: () =>
      "Use Sign in at the top right. If you forgot your password, choose Forgot password? under the password box, type your email and we send a link to choose a new one. The link works once and expires in an hour. If nothing arrives, look in your spam folder or wait a minute and ask again.",
    link: { href: "/forgot-password", label: "Reset my password" },
  },
  {
    id: "profile",
    next: ["masters", "upload-problem"],
    question: "How do I create my profile?",
    ask: [
      "how do i create my profile",
      "how do i set up my profile",
      "what is the profile",
      "build my profile",
      "fill in my profile",
      "upload my cv",
      "import my cv",
      "add my experience",
    ],
    words: ["profile", "cv", "resume", "upload", "import", "experience", "education", "skills", "fill", "setup", "paste", "once"],
    answer: () =>
      "After you sign up you tell us about your work once. You can type it in, paste the text of your CV, or upload it as a PDF, Word (.docx) or text file up to 4 MB, and we read it for you. You check each step, fix anything we read wrong, and nothing is saved until you create your profile. You never have to redo it for every job.",
    link: { href: "/onboarding", label: "Go to profile setup" },
  },
  {
    id: "upload-problem",
    next: ["profile"],
    question: "My CV won't upload. What can I do?",
    ask: ["my cv won't upload", "upload failed", "can't upload my pdf", "pdf not working", "it can't read my file", "scanned cv", "file too big"],
    words: ["upload", "fail", "failed", "error", "pdf", "word", "docx", "scanned", "image", "big", "large", "read", "problem", "wont", "cant", "broken"],
    answer: () =>
      "A window tells you why. The usual causes are a file over 4 MB, a file that is not a PDF, Word (.docx) or text, or a scanned CV that is only a picture, which has no text for us to read. The quickest fix is to paste the text of your CV into the box instead (the Paste link is right there), or choose another file.",
  },
  {
    id: "masters",
    next: ["job"],
    question: "What are the Master Resume and Master Cover Letter?",
    ask: ["what are the master documents", "what is a master resume", "what is the master cover letter", "what do i get after my profile"],
    words: ["master", "masters", "documents", "documentation", "base", "starting", "point", "general"],
    answer: () =>
      "Once your profile is saved we write your Master Resume and Master Cover Letter from it. This part is free, and every application starts from them. Tailoring to a job never changes them. If you update your profile, you can recreate both from the Master page, and your earlier versions stay in history.",
    link: { href: "/master", label: "Open my master documents" },
  },
  {
    id: "job",
    next: ["score", "cost"],
    question: "How do I add a job and tailor my resume?",
    ask: [
      "how do i add a job",
      "how do i tailor my resume",
      "how do i apply to a job",
      "paste a job description",
      "upload a job description",
      "how do i use it",
    ],
    words: ["job", "description", "paste", "tailor", "add", "posting", "upload", "apply", "new", "application", "use"],
    answer: (f) =>
      `On your dashboard, paste the job description (or choose to upload it as a file), then press Tailor your resume to a job. That reads the job and shows how you match, and it uses ${credits(f.tailorCredits)}. When you're happy, you create the application, which writes a resume and a cover letter for that job (${credits(f.createCredits)}).`,
    link: { href: "/dashboard", label: "Go to my dashboard" },
  },
  {
    id: "score",
    next: ["invent", "job"],
    question: "How does the Job Match Score work?",
    ask: [
      "how does the job match score work",
      "what is the match score",
      "what does the score mean",
      "how do you calculate the score",
      "am i a good fit",
      "what is the percentage",
    ],
    words: ["score", "match", "fit", "percent", "percentage", "calculate", "requirements", "gaps", "covered", "missing", "rating"],
    answer: () =>
      "The Job Match Score shows how much of what the job asks for your profile covers. Each requirement gets a label from strong to none, based on evidence in your profile, and you can see which ones you cover and which you don't. Years of experience are added up from the dates in your profile, so you're never asked about them. It's a guide to your fit, not a prediction of what an employer's system will do.",
  },
  {
    id: "invent",
    next: ["download", "apply"],
    question: "Will it make things up about me?",
    ask: [
      "will it make things up",
      "does it invent experience",
      "is it honest",
      "does the ai lie",
      "does it lie about my experience",
      "does it exaggerate",
      "does it add fake skills",
      "is it true",
      "what if the job asks for something i don't have",
    ],
    words: [
      "invent",
      "fake",
      "lie",
      "exaggerate",
      "embellish",
      "inflate",
      "true",
      "honest",
      "made",
      "up",
      "false",
      "fabricate",
      "truth",
      "ask",
      "missing",
      "never",
    ],
    answer: () =>
      "No. ResumeAi only rewords and reorders what is in your profile. It never adds experience, skills, schools, dates or results you didn't give it. If a job asks for something we can't find, we ask you, and you decide: tell us in your own words if you've done it, or we leave it out.",
  },
  {
    id: "cost",
    next: ["plans", "free-credits"],
    question: "How much does it cost?",
    ask: [
      "how much does it cost",
      "what does it cost",
      "is it free",
      "how much is an application",
      "what is the price",
      "how many credits does it use",
      "how much is one application",
    ],
    words: ["cost", "price", "pay", "free", "credits", "credit", "much", "expensive", "cheap", "money", "dollar", "fee"],
    answer: (f) =>
      `Reading your CV, making your profile and creating your Master documents are free. AI actions use credits, and the price is on the button before you click. Tailoring to a job is ${credits(f.tailorCredits)}, creating the application is ${credits(f.createCredits)}, so one full application is ${credits(f.fullApplicationCredits)}. A new account starts with ${f.signupCredits} free credits.`,
    link: { href: "/pricing", label: "See the full price list" },
  },
  {
    id: "plans",
    next: ["free-credits", "out-of-credits"],
    question: "What plans are there?",
    ask: [
      "what plans are there",
      "what are the plans",
      "how much is pro",
      "what is the difference between plans",
      "can i buy more credits",
      "subscription",
      "monthly price",
    ],
    words: ["plan", "plans", "starter", "pro", "premium", "subscription", "monthly", "month", "pack", "buy", "upgrade", "tier", "pricing"],
    answer: (f) =>
      `${f.plans.map((p) => `${p.name} is ${p.price} for ${p.credits} credits a month (about ${p.applications} full applications)`).join("; ")}. You can also buy extra credits: ${f.packs.map((k) => `${k.name} for ${k.price}`).join(" or ")}. Paid checkout isn't open yet, so for now everyone works with their free credits.`,
    link: { href: "/pricing", label: "See pricing details" },
  },
  {
    id: "free-credits",
    next: ["cost"],
    question: "How many free credits do I get?",
    ask: ["how many free credits do i get", "do i get free credits", "what do i get for free", "free trial", "free plan"],
    words: ["free", "credits", "trial", "start", "signup", "bonus", "gift", "launch", "offer"],
    answer: (f) =>
      `Every new account starts with ${f.signupCredits} free credits, enough for your first tailored application${f.launchCredits ? `, and right now there is a launch offer of ${f.launchCredits} more credits for everyone, added the next time you open the app` : ""}. Reading your CV and creating your Master documents don't use any.`,
  },
  {
    id: "out-of-credits",
    next: ["plans"],
    question: "What happens if I run out of credits?",
    ask: ["what happens if i run out of credits", "i have no credits left", "not enough credits", "credits ran out", "refund"],
    words: ["run", "out", "credits", "enough", "none", "left", "empty", "stop", "refund", "refunded", "failed", "balance"],
    answer: () =>
      "Running out is a pause, not a loss. A window shows what is already saved, and you pick up where you stopped; steps already done are never charged twice. If an AI action fails, its credits are refunded automatically. You can see your balance in the account menu at the top right.",
    link: { href: "/credits", label: "See my credits" },
  },
  {
    id: "download",
    next: ["apply", "edit"],
    question: "How do I download my resume?",
    ask: [
      "how do i download my resume",
      "download as pdf",
      "download as word",
      "get my cover letter as a file",
      "a pdf of my cover letter",
      "a pdf of my resume",
      "export my documents",
      "zip",
      "copy as text",
    ],
    words: ["download", "pdf", "word", "docx", "file", "export", "save", "zip", "copy", "text", "print"],
    answer: () =>
      "Open the document (from Documents in the top menu), press Download, and choose PDF or Word. You can also download the resume and cover letter together as one ZIP, or copy the text. The files are single-column and plain, so tracking systems can read them.",
    link: { href: "/documents", label: "Open my documents" },
  },
  {
    id: "edit",
    next: ["download"],
    question: "Can I edit my documents?",
    ask: [
      "can i edit my resume",
      "how do i edit my documents",
      "can i change the cover letter",
      "go back to an earlier version",
      "versions",
      "undo my changes",
      "change the tone",
    ],
    words: ["edit", "change", "version", "versions", "restore", "undo", "earlier", "tone", "shorten", "expand", "rewrite", "history", "hand"],
    answer: (f) =>
      `Yes, edit anything before you download. Every edit is saved as a new version and nothing is overwritten, so you can always go back to an earlier one. For a cover letter you can also shorten it, expand it or change its tone (${credits(f.coverEditCredits)}), or write it again (${credits(f.coverRewriteCredits)}).`,
  },
  {
    id: "apply",
    next: ["download"],
    question: "Do you apply to jobs for me?",
    ask: ["do you apply to jobs for me", "does it send my application", "how do i send my application", "how do i apply", "will it submit for me", "applied"],
    words: ["apply", "send", "submit", "applied", "automatically", "auto", "employer", "company", "tick", "track"],
    answer: () =>
      "No. We never apply for you. You download your resume and cover letter and apply on the company's own site. To remember where you've sent one, tick Applied next to the application in your Documents.",
    link: { href: "/documents", label: "Open my documents" },
  },
  {
    id: "ats",
    next: ["download"],
    question: "Will my resume pass the ATS?",
    ask: ["will my resume pass the ats", "what is ats", "is it ats friendly", "applicant tracking system", "ats score"],
    words: ["ats", "applicant", "tracking", "parse", "pass", "robot", "keywords", "compatible", "compatibility"],
    answer: (f) =>
      `Your documents are built to be read: single column, plain text, standard headings, as PDF or Word. The ATS compatibility check (${credits(f.atsCredits)}) looks at structure and keyword coverage. We can't promise how any employer's system will treat a resume, so it is a guide, not a guarantee.`,
  },
  {
    id: "directions",
    next: ["job"],
    question: "How do I know which jobs to look for?",
    ask: ["which jobs should i look for", "what jobs can i apply for", "what jobs fit me", "jobs to look for", "what kind of jobs", "am i qualified"],
    words: ["jobs", "look", "suggest", "recommend", "fit", "kind", "career", "field", "profession", "qualified", "direction"],
    answer: () =>
      "Your dashboard has a Jobs to look for card. It splits your work history by kind of work, for example UX design or graphic design, and shows each one's share of your experience, so you search where your experience really fits. It's added up from the dates in your profile, and it is a guide, not a promise of getting hired.",
    link: { href: "/dashboard", label: "Go to my dashboard" },
  },
  {
    id: "privacy",
    next: ["delete"],
    question: "Is my data safe? Who can see it?",
    ask: [
      "is my data safe",
      "who can see my data",
      "do you sell my data",
      "do you sell my information",
      "privacy",
      "is my cv private",
      "do you use my data to train ai",
    ],
    words: ["data", "information", "info", "personal", "safe", "private", "privacy", "secure", "security", "sell", "share", "train", "see", "store"],
    answer: () =>
      "Your profile and documents belong to you and only your account can open them. We don't sell your information, we don't show ads, and your content is not used to train AI models. To write your documents, the relevant parts of your profile and the job are sent to our AI provider to produce the result. The Privacy policy lists everything we keep and who helps us run the app.",
    link: { href: "/privacy", label: "Read the privacy policy" },
  },
  {
    id: "delete",
    next: ["privacy"],
    question: "How do I delete my account or download my data?",
    ask: ["how do i delete my account", "delete my data", "download my data", "remove my profile", "close my account"],
    words: ["delete", "remove", "account", "data", "download", "erase", "close", "gdpr", "export", "profile"],
    answer: () =>
      "Open Settings from the account menu at the top right. There you can Download my data, which gives you a copy of everything we hold, and Delete my account, which removes your account and all your data. You can also delete just your professional profile from the bottom of the Professional profile page.",
    link: { href: "/settings", label: "Open settings" },
  },
  {
    id: "self-id",
    next: ["privacy"],
    question: "What is Voluntary Self-Identification?",
    ask: ["what is voluntary self-identification", "do i have to answer the application questions", "work authorization questions", "why do you ask my gender"],
    words: ["voluntary", "self", "identification", "authorization", "visa", "gender", "race", "veteran", "disability", "pronouns", "relocation", "questions"],
    answer: () =>
      "These are optional questions that many applications ask, such as work authorization, visa, relocation, pronouns, gender, race, veteran and disability. You can answer any, none or just a few. They are kept privately with your profile so you can copy them into forms, and they never go into your resume or cover letter or reach the AI.",
  },
  {
    id: "video",
    next: ["account"],
    question: "Is there a video or a quick tour?",
    ask: ["is there a video", "show me how it works", "tour", "demo", "walkthrough", "tutorial"],
    words: ["video", "tour", "demo", "walkthrough", "tutorial", "show", "watch", "guide", "example"],
    answer: () =>
      "Yes. On the first page, under the headline, there is a short conversation that walks through every step. Press play, turn on Read aloud if you like, or read it all below the player.",
    link: { href: "/#tour", label: "Watch the tour" },
  },
  {
    id: "contact",
    next: ["privacy"],
    question: "How do I contact someone?",
    ask: ["how do i contact you", "i need help", "talk to a person", "support", "report a problem", "email"],
    words: ["contact", "support", "help", "human", "person", "report", "bug", "problem", "complaint", "reach"],
    answer: () =>
      "I'm Ask Drin, a helper built into ResumeAi, so I can't take messages. For a person, the Privacy policy and the Terms say how to get in touch with whoever runs the site. If something went wrong in the app, tell them what you were doing when it happened.",
    link: { href: "/terms", label: "Open the terms and contact details" },
  },
  {
    id: "who",
    next: ["about"],
    question: "Who are you?",
    ask: ["who are you", "what is your name", "are you a person", "are you a bot", "are you human", "who is drin"],
    words: ["who", "you", "name", "bot", "human", "drin", "person", "real", "robot"],
    answer: () =>
      "I'm Ask Drin, the helper built into ResumeAi. I'm not a live person: I answer from what the app really does, like how to sign up, what things cost and how your documents are made. If I don't know something I'll say so.",
  },
];

export const byId = (id: string) => ENTRIES.find((e) => e.id === id);

/** The questions shown as buttons when the chat opens. */
export const STARTERS = ["about", "account", "profile", "cost", "score", "invent", "download", "apply"] as const;
