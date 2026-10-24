import { HelpTip } from "@/components/ui/HelpTip";

/** What the Job Match Score means, in a help icon beside its name. Said plainly, and never as a prediction of an employer's decision. */
export function JobMatchHelp() {
  return (
    <HelpTip label="What is the Job Match Score?">
      <p className="text-label-bold">Job Match Score</p>
      <p className="mt-1">
        It shows how much of what this job asks for is backed by your profile. Each requirement is checked against your work history, skills and education, and
        years of experience are counted from the dates you gave us.
      </p>
      <p className="mt-1">A higher score means more of the job is covered. It is an estimate to guide you, not a prediction of what an employer will decide.</p>
    </HelpTip>
  );
}

/** What the ATS Compatibility Score means, in a help icon beside its name. */
export function AtsHelp() {
  return (
    <HelpTip label="What is ATS compatibility?">
      <p className="text-label-bold">ATS compatibility</p>
      <p className="mt-1">ATS stands for applicant tracking system: the software many employers use to collect and sort resumes.</p>
      <p className="mt-1">
        The score shows how easily that kind of software can read this resume (a clean layout, standard headings) and how many of the job&apos;s keywords it
        covers. It is a guide only: we can&apos;t know how any employer&apos;s system will treat it.
      </p>
    </HelpTip>
  );
}
