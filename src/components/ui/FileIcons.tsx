import type { SVGProps } from "react";

/** Line icons in the lucide style (24px grid, 2px stroke, currentColor) for the two download formats. */
const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});

function Page() {
  return (
    <>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <path d="M14 2v6h6" />
    </>
  );
}

export function PdfIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <Page />
      <path d="M8.5 18c2-1 3.2-3.6 3.5-7 .4 2.4 1.6 4.8 3.6 5.6-2.2-.4-4.6 0-7.1 1.4z" />
    </svg>
  );
}

export function WordIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <Page />
      <path d="M8 11l1.7 6L12 12l2.3 5L16 11" />
    </svg>
  );
}
