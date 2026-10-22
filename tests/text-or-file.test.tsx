import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { JobInput } from "@/components/features/job-flow/JobInput";
import { TextOrFile } from "@/components/ui/TextOrFile";

const noop = () => {};
const refs = { textRef: { current: null }, fileRef: { current: null } };
const cv = (mode: "paste" | "upload", text = "") =>
  renderToStaticMarkup(
    <TextOrFile
      label="Your CV"
      mode={mode}
      onModeChange={noop}
      text={text}
      onTextChange={noop}
      fileName={null}
      onFileChange={noop}
      {...refs}
      textName="cvText"
      fileInputName="cv"
      ariaLabel="CV text"
      hint="Paste the text of your CV here, with headings such as Experience, Education and Skills. You can also"
      pasteLinkText="Paste CV as text"
      fileTitle="Choose your CV"
      fileHelp="PDF or Word (.docx) · up to 4 MB"
      accept=".pdf,.docx"
      onTint
    />,
  );

describe("the shared paste-or-upload input", () => {
  it("opens as a text box whose hint ends with an upload link, and only the text side is posted", () => {
    const html = cv("paste");
    expect(html).toContain("Paste the text of your CV here, with headings such as Experience, Education and Skills. You can also");
    expect(html).toContain("upload it as a file");
    expect(html).toContain('name="cvText"');
    expect(html).not.toContain('name="cv"');
    expect(html).not.toContain("Paste CV as text"); // that link belongs to the upload side
  });

  it("shows the paste link at the top right of the upload, and posts only the file", () => {
    const html = cv("upload");
    expect(html).toContain("Paste CV as text");
    expect(html).toContain('name="cv"');
    expect(html).not.toContain('name="cvText"');
    expect(html).toContain("Choose your CV");
    expect(html).toContain("PDF or Word (.docx) · up to 4 MB");
  });

  it("hides the hint once there is text", () => {
    expect(cv("paste", "My CV text")).not.toContain("upload it as a file");
  });

  it("is still the job description box, with its own words", () => {
    const html = renderToStaticMarkup(<JobInput />);
    expect(html).toContain("Paste the complete job description here");
    expect(html).toContain('name="description"');
    expect(html).toContain("upload it as a file");
    expect(html).not.toContain("CV");
  });
});
