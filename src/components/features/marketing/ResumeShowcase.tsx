/**
 * Landing-page illustration of what the product does: a resume page with the lines that match
 * a job description highlighted, and a note naming the match. Fictional content, static markup.
 */
const Line = ({ w }: { w: string }) => <span aria-hidden="true" className="block h-[7px] rounded-full bg-[#e6defa]" style={{ width: w }} />;

function Match({ children, tone = "violet" }: { children: React.ReactNode; tone?: "violet" | "mint" | "pink" }) {
  const bg = tone === "mint" ? "bg-[#c9f3ec]" : tone === "pink" ? "bg-[#ffd9ec]" : "bg-[#e1d6ff]";
  return <mark className={`rounded-[5px] px-1 py-px text-navy-900 ${bg}`}>{children}</mark>;
}

export function ResumeShowcase() {
  return (
    <figure className="relative mx-auto w-full max-w-[480px] pb-14">
      {/* The gradient frame behind the page */}
      <div
        aria-hidden="true"
        className="au-grad-full absolute -top-[18px] -right-[18px] bottom-[86px] left-[18px] rotate-[4deg] rounded-[36px] opacity-90 motion-reduce:rotate-0"
      />
      {/* The page */}
      <div className="relative rounded-[28px] bg-white p-ds-4 text-left text-navy-900 shadow-[0_30px_60px_-24px_rgba(40,20,120,0.5)] sm:p-[30px]">
        <p className="text-[26px] leading-[1.1] font-extrabold tracking-[-0.4px]">Alex Rivera</p>
        <p className="mt-[3px] text-[14px] font-bold text-blue-700">Senior Product Designer</p>
        <div className="mt-ds-2 flex gap-ds-2">
          <Line w="30%" />
          <Line w="22%" />
          <Line w="26%" />
        </div>

        <p className="mt-ds-4 border-b-2 border-[#efe9ff] pb-1 text-[11px] font-extrabold tracking-[1px] text-blue-700">EXPERIENCE</p>
        <p className="mt-ds-2 text-[13px] font-bold">Senior Product Designer, Harbor Credit Union</p>
        <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-[18px] text-[13px] leading-[1.55]">
          <li>
            Built and maintained the <Match>design system in Figma</Match>, now used by 4 product teams
          </li>
          <li>
            Ran <Match tone="mint">user research and usability testing</Match> with members each quarter
          </li>
          <li>Redesigned online account opening, raising completion from 41% to 63%</li>
        </ul>
        <div className="mt-ds-3 flex flex-col gap-1.5">
          <Line w="78%" />
          <Line w="92%" />
        </div>

        <p className="mt-ds-4 border-b-2 border-[#efe9ff] pb-1 text-[11px] font-extrabold tracking-[1px] text-blue-700">SKILLS</p>
        <p className="mt-ds-2 text-[13px] leading-[2]">
          <Match tone="pink">Prototyping</Match> <Match tone="pink">Interaction design</Match>{" "}
          <span className="rounded-full bg-[#f4f0ff] px-[7px] py-0.5">Visual design</span>{" "}
          <span className="rounded-full bg-[#f4f0ff] px-[7px] py-0.5">Wireframing</span> <Match tone="pink">Figma</Match>
        </p>
      </div>

      {/* The note: seven of the ten bars are filled */}
      <figcaption className="absolute bottom-0 left-0 w-[250px] max-w-[80%] -rotate-[3deg] rounded-[20px] bg-white px-[18px] py-[14px] text-navy-900 shadow-[0_20px_40px_-14px_rgba(40,20,120,0.5)] motion-reduce:rotate-0 sm:-left-2">
        <span aria-hidden="true" className="mb-2.5 flex gap-1">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={`h-2 flex-1 rounded-full ${i < 7 ? "au-grad" : "bg-[#e6defa]"}`} />
          ))}
        </span>
        <span className="block text-[14px] leading-[1.35] font-bold">7 of 10 requirements for Senior UX Designer found in this resume</span>
      </figcaption>
    </figure>
  );
}
