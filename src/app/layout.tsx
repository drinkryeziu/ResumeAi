import type { Metadata } from "next";
import "./globals.css";
import { AskDrinLoader } from "@/components/features/chat/AskDrinLoader";

export const metadata: Metadata = {
  title: { default: "KRZResumeBuilder — Tailor your resume to every job", template: "%s · KRZResumeBuilder" },
  description: "Create your professional profile once, then tailor your resume and cover letter to every job.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="aurora">
      <body>
        {children}
        <AskDrinLoader />
      </body>
    </html>
  );
}
