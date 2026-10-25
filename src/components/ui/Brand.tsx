/**
 * The product's name where it is shown as a name (the logo, the footer, a heading): "KRZ" in black type (weight 900) and "ResumeBuilder" in
 * light type, as one word. In running sentences the name is written as plain text, "KRZResumeBuilder".
 */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="font-black">KRZ</span>
      <span className="font-light">ResumeBuilder</span>
    </span>
  );
}
