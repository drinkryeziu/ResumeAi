import type { CSSProperties, ReactNode } from "react";
import { AlertTriangle, ArrowRight, Check, Compass, FileUp, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { PdfIcon, WordIcon } from "@/components/ui/FileIcons";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { cn } from "@/lib/cn";
import type { SceneId } from "@/lib/walkthrough";

/**
 * The drawn screens of the first-page tour: simplified, made-up pictures of each step of the app, built from the same
 * design-system pieces. They are decoration for the conversation beside them (the player hides them from screen readers).
 * Each one is mounted fresh when its scene starts, so its shapes pop in and its bars fill from the beginning.
 */
const at = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

const Pop = ({ delay = 0, className, children }: { delay?: number; className?: string; children: ReactNode }) => (
  <div className={cn("wt-pop", className)} style={at(delay)}>
    {children}
  </div>
);
const Bar = ({ w, delay = 0, tone = "gray" }: { w: string; delay?: number; tone?: "gray" | "blue" }) => (
  <span className={cn("wt-fill block h-[8px] rounded-full", tone === "blue" ? "bg-blue-600" : "bg-[#dfe5ee]")} style={{ width: w, ...at(delay) }} />
);
const Card = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cn("rounded-md bg-white p-ds-3 shadow-card", className)}>{children}</div>;
const Pill = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn("inline-flex items-center justify-center gap-1 rounded-pill px-ds-4 py-1.5 text-[11px] font-bold tracking-[0.4px] uppercase", className)}>{children}</span>
);

function About() {
  return (
    <div className="flex w-full max-w-lg flex-wrap items-center justify-center gap-ds-3 sm:flex-nowrap">
      <Pop className="w-[42%] min-w-[130px]">
        <Card className="flex flex-col gap-1.5">
          <span className="text-label-bold">The job</span>
          {["90%", "75%", "85%", "55%"].map((w, i) => (
            <Bar key={w + i} w={w} delay={200 + i * 200} />
          ))}
        </Card>
      </Pop>
      <Pop delay={900}>
        <ArrowRight size={22} className="text-blue-600" aria-hidden="true" />
      </Pop>
      <Pop delay={1300} className="w-[42%] min-w-[130px]">
        <Card className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between gap-1">
            <span className="text-label-bold">Your resume</span>
            <Badge tone="success">82% match</Badge>
          </span>
          {["88%", "70%", "80%", "60%"].map((w, i) => (
            <Bar key={w + i} w={w} delay={1500 + i * 200} tone={i === 1 ? "blue" : "gray"} />
          ))}
          <span className="text-caption">Only what&apos;s true about you</span>
        </Card>
      </Pop>
    </div>
  );
}

function Signup() {
  return (
    <Card className="flex w-full max-w-sm flex-col gap-ds-3">
      <Pop className="flex items-center justify-between gap-ds-2">
        <span className="text-label-bold">Create your account</span>
        <Badge tone="success">Free to start</Badge>
      </Pop>
      {["Full name", "Email", "Password"].map((l, i) => (
        <Pop key={l} delay={300 + i * 350} className="flex flex-col gap-1">
          <span className="text-caption">{l}</span>
          <span className="block rounded-sm bg-gray-100 p-2">
            <Bar w={["60%", "75%", "40%"][i]!} delay={600 + i * 350} />
          </span>
        </Pop>
      ))}
      <Pill className="wt-pulse bg-blue-600 py-2.5 text-white">Get started free</Pill>
    </Card>
  );
}

function Profile() {
  return (
    <div className="grid w-full gap-ds-3 sm:grid-cols-2">
      <Pop>
        <Card className="flex h-full flex-col items-center gap-ds-2 text-center">
          <FileUp size={28} className="text-blue-600" aria-hidden="true" />
          <span className="text-label-bold">Upload your CV</span>
          <span className="text-caption">PDF, Word or text</span>
          <span className="mt-1 rounded-pill bg-sky-50 px-ds-3 py-1 text-caption text-blue-700">My-CV.pdf</span>
        </Card>
      </Pop>
      <Pop delay={250}>
        <Card className="flex flex-col gap-ds-2">
          <span className="text-label-bold">Or type it in</span>
          {["Name", "Title", "Experience"].map((l, i) => (
            <div key={l} className="flex flex-col gap-1">
              <span className="text-caption">{l}</span>
              <span className="block rounded-sm bg-gray-100 p-2">
                <Bar w={["70%", "55%", "85%"][i]!} delay={500 + i * 350} />
              </span>
            </div>
          ))}
        </Card>
      </Pop>
    </div>
  );
}

function Career() {
  const row = (name: string, years: string, delay: number) => (
    <Pop delay={delay}>
      <span className="flex items-center justify-between gap-ds-3 text-body-sm">
        <span>{name}</span>
        <span className="font-bold">{years}</span>
      </span>
    </Pop>
  );
  return (
    <Card className="flex w-full max-w-md flex-col gap-ds-3">
      <span className="flex items-center gap-ds-2 text-label-bold">
        <Compass size={18} className="text-blue-600" aria-hidden="true" /> Your career at a glance
      </span>
      <span className="text-caption">Senior UX Designer · 12.9 years in total</span>
      <div className="flex flex-col gap-ds-2 divide-y divide-gray-100">
        {row("UX Designer", "7.7 years", 200)}
        {row("Product Designer", "3.2 years", 650)}
        {row("Graphic Designer", "2 years", 1100)}
      </div>
      <Badge tone="success" className="self-start">
        Free
      </Badge>
    </Card>
  );
}

function Directions() {
  const row = (name: string, percent: number, tag: string, tone: "success" | "info", delay: number) => (
    <Pop delay={delay} className="flex flex-col gap-1">
      <span className="flex items-center justify-between gap-ds-2 text-body-sm">
        <span className="text-label-bold">{name}</span>
        <span className="flex items-center gap-ds-2">
          <Badge tone={tone}>{tag}</Badge>
          <span className="text-label-bold tabular-nums">{percent}%</span>
        </span>
      </span>
      <span className="block h-2 rounded-pill bg-sky-50">
        <Bar w={`${percent}%`} delay={delay + 250} tone="blue" />
      </span>
    </Pop>
  );
  return (
    <Card className="flex w-full max-w-md flex-col gap-ds-3">
      <span className="flex items-center gap-ds-2 text-label-bold">
        <Compass size={18} className="text-blue-600" aria-hidden="true" /> Jobs to look for
      </span>
      {row("UX Designer", 60, "Where you are strongest", "success", 200)}
      {row("Product Designer", 25, "Also a good fit", "info", 700)}
      {row("Graphic Designer", 15, "Also a good fit", "info", 1200)}
    </Card>
  );
}

function Job() {
  return (
    <Card className="flex w-full max-w-md flex-col gap-ds-3">
      <span className="text-label-bold">Job description</span>
      <div className="flex flex-col gap-2 rounded-sm bg-gray-100 p-ds-3">
        {["95%", "88%", "92%", "60%"].map((w, i) => (
          <Bar key={w + i} w={w} delay={200 + i * 380} />
        ))}
        <span className="text-caption text-gray-500">
          …or <span className="text-blue-700 underline">upload it as a file</span>
        </span>
      </div>
      <Pill className="wt-pulse bg-blue-600 py-2.5 text-white">Tailor your resume to a job</Pill>
    </Card>
  );
}

function Match() {
  const row = (ok: boolean, label: string, delay: number) => (
    <Pop delay={delay}>
      <span className="flex items-center gap-ds-2 text-body-sm">
        {ok ? <Check size={16} className="shrink-0 text-success" aria-hidden="true" /> : <AlertTriangle size={16} className="shrink-0 text-warning" aria-hidden="true" />}
        {label}
        <span className="ml-auto text-caption">{ok ? "Covered" : "Not found"}</span>
      </span>
    </Pop>
  );
  return (
    <Card className="flex w-full max-w-lg flex-wrap items-center justify-center gap-ds-4 sm:flex-nowrap">
      <Pop>
        <ScoreRing value={82} label="Job Match Score" size={108} />
      </Pop>
      <div className="flex w-full flex-col gap-ds-2 sm:w-auto sm:min-w-[220px]">
        {row(true, "Design systems", 500)}
        {row(true, "User research", 850)}
        {row(false, "Accessibility audits", 1200)}
      </div>
    </Card>
  );
}

function Questions() {
  return (
    <Card className="flex w-full max-w-md flex-col gap-ds-3">
      <Pop>
        <p className="text-body-sm">
          This job asks for: “Accessibility audits”. <strong>Do you have this experience?</strong>
        </p>
      </Pop>
      <Pop delay={500} className="flex gap-ds-2">
        <Pill className="wt-pulse bg-blue-600 text-white">Yes, I have this</Pill>
        <Pill className="bg-gray-100 text-navy-900">No, I don&apos;t</Pill>
      </Pop>
      <Pop delay={1000}>
        <span className="flex flex-col gap-1 rounded-sm bg-gray-100 p-ds-2">
          <span className="text-caption">In your own words</span>
          <Bar w="90%" delay={1300} />
          <Bar w="55%" delay={1600} />
        </span>
      </Pop>
    </Card>
  );
}

function Page({ name, lines, delay }: { name: string; lines: string[]; delay: number }) {
  return (
    <Pop delay={delay} className="flex-1">
      <div className="flex flex-col gap-1.5 rounded-md bg-white p-ds-3 shadow-card">
        <span className="text-[13px] leading-tight font-bold">{name}</span>
        {lines.map((w, i) => (
          <Bar key={w + i} w={w} delay={delay + 300 + i * 180} />
        ))}
      </div>
    </Pop>
  );
}

function Documents() {
  return (
    <div className="flex w-full max-w-lg flex-col gap-ds-3">
      <div className="flex gap-ds-3">
        <Page name="Resume" delay={0} lines={["90%", "70%", "85%", "60%", "78%"]} />
        <Page name="Cover letter" delay={350} lines={["80%", "92%", "88%", "74%", "50%"]} />
      </div>
      <Pop delay={1200} className="flex items-center justify-center gap-ds-3">
        <Badge tone="info">Version 2</Badge>
        <span className="inline-flex items-center gap-1 text-body-sm text-blue-700">
          <Pencil size={14} aria-hidden="true" /> Edit anything
        </span>
      </Pop>
    </div>
  );
}

function Download() {
  return (
    <div className="grid w-full max-w-lg gap-ds-3 sm:grid-cols-2">
      <Pop>
        <Card className="flex h-full flex-col gap-ds-2">
          <span className="text-label-bold">Download</span>
          <span className="flex items-center gap-ds-2 rounded-md bg-gray-100 p-ds-2 text-body-sm text-blue-600">
            <PdfIcon size={20} /> <span className="text-navy-900">PDF</span>
          </span>
          <span className="flex items-center gap-ds-2 rounded-md bg-gray-100 p-ds-2 text-body-sm text-blue-600">
            <WordIcon size={20} /> <span className="text-navy-900">Word (.docx)</span>
          </span>
        </Card>
      </Pop>
      <Pop delay={450}>
        <Card className="flex h-full flex-col gap-ds-2">
          <span className="flex items-center justify-between">
            <span className="text-label-bold">Northwind</span>
            <span className="inline-flex items-center gap-2 text-body-sm">
              Applied
              <span className="wt-pop grid size-5 place-items-center rounded-[4px] bg-blue-600 text-white" style={at(1500)}>
                <Check size={14} aria-hidden="true" />
              </span>
            </span>
          </span>
          <span className="text-caption">You apply on the company&apos;s own site. KRZResumeBuilder never applies for you.</span>
        </Card>
      </Pop>
    </div>
  );
}

const SCENE_ART: Record<SceneId, () => React.JSX.Element> = { about: About, signup: Signup, profile: Profile, career: Career, directions: Directions, job: Job, match: Match, questions: Questions, documents: Documents, download: Download };

export function TourScene({ id }: { id: SceneId }) {
  const Art = SCENE_ART[id];
  return <Art />;
}
