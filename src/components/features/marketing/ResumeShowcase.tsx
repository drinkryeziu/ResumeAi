/**
 * Landing-page illustration of what the product does: a resume page with the lines that match
 * a job description highlighted, and a note naming the match. Fictional content, static markup.
 */
const Line = ({ w }: { w: string }) => <span aria-hidden="true" className="block h-[7px] rounded-full bg-[#dfe5ee]" style={{ width: w }} />;

function Match({ children }: { children: React.ReactNode }) {
  return <mark className="rounded-[3px] bg-sky-50 px-0.5 text-navy-900 shadow-[inset_0_-2px_0_var(--blue-600)]">{children}</mark>;
}

export function ResumeShowcase() {
  return (
    <figure className="relative mx-auto w-full max-w-[440px]">
      {/* The page */}
      <div className="rotate-[1.2deg] rounded-md bg-white p-ds-5 text-left text-navy-900 shadow-[0_24px_60px_rgba(0,0,0,0.35)] motion-reduce:rotate-0">
        <p className="text-[19px] leading-tight font-bold">Alex Rivera</p>
        <p className="text-[12px] text-blue-700">Senior Product Designer</p>
        <div className="mt-ds-2 flex gap-ds-2">
          <Line w="30%" />
          <Line w="22%" />
          <Line w="26%" />
        </div>

        <p className="mt-ds-4 border-b border-[#dfe5ee] pb-1 text-[10px] font-bold tracking-[0.6px] text-blue-700">EXPERIENCE</p>
        <div className="mt-ds-2 flex items-baseline justify-between text-[12px]">
          <span className="font-bold">Senior Product Designer, Harbor Credit Union</span>
        </div>
        <ul className="mt-1 flex flex-col gap-1.5 text-[11.5px] leading-snug">
          <li>
            • Built and maintained the <Match>design system in Figma</Match>, now used by 4 product teams
          </li>
          <li>
            • Ran <Match>user research and usability testing</Match> with members each quarter
          </li>
          <li>• Redesigned online account opening, raising completion from 41% to 63%</li>
        </ul>
        <div className="mt-ds-3 flex flex-col gap-1.5">
          <Line w="58%" />
          <Line w="88%" />
          <Line w="72%" />
        </div>

        <p className="mt-ds-4 border-b border-[#dfe5ee] pb-1 text-[10px] font-bold tracking-[0.6px] text-blue-700">SKILLS</p>
        <p className="mt-ds-2 pb-ds-5 text-[11.5px]">
          <Match>Prototyping</Match>, <Match>Interaction design</Match>, Visual design, Wireframing, <Match>Figma</Match>
        </p>
      </div>

      {/* The note — the page's one sand-300 moment */}
      <figcaption className="absolute -bottom-[52px] left-ds-2 w-[212px] -rotate-[2deg] rounded-md bg-sand-300 p-ds-3 text-navy-900 shadow-card motion-reduce:rotate-0 sm:-left-ds-6">
        <span className="block text-[30px] leading-none font-bold">7 of 10</span>
        <span className="mt-1 block text-[13px] leading-snug font-semibold">requirements for Senior UX Designer found in this resume</span>
      </figcaption>
    </figure>
  );
}
