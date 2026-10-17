import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ResumeAi — Tailor your resume to every job", template: "%s · ResumeAi" },
  description: "Create your professional profile once, then tailor your resume and cover letter to every job.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
