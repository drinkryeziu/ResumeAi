import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // PDF/DOCX renderers and vendor SDKs only ever run on the server.
  serverExternalPackages: ["@react-pdf/renderer", "docx", "unpdf", "mammoth"],
  // Uploads (CV, job description) are capped at 4 MB in extract-text.ts, under Vercel's ~4.5 MB request limit.
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
