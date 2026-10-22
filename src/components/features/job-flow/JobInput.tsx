"use client";

import { useRef, useState } from "react";
import { TextOrFile, type TextOrFileMode } from "@/components/ui/TextOrFile";

/** The job description, pasted or uploaded; one of the two is sent with the form. */
export function JobInput({ defaultText }: { defaultText?: string }) {
  const [mode, setMode] = useState<TextOrFileMode>("paste");
  const [text, setText] = useState(defaultText ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <TextOrFile
      label="Job description"
      required
      mode={mode}
      onModeChange={setMode}
      text={text}
      onTextChange={setText}
      fileName={fileName}
      onFileChange={setFileName}
      textRef={textRef}
      fileRef={fileRef}
      textName="description"
      fileInputName="file"
      ariaLabel="Job description"
      hint="Paste the complete job description here — responsibilities and requirements included. You can also"
      pasteLinkText="Paste job description as text"
      fileTitle="Choose a file"
      fileHelp="PDF, Word (.docx) or text · up to 4 MB"
      accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
    />
  );
}
