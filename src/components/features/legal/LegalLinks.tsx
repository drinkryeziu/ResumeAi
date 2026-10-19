import Link from "next/link";

/** Privacy policy and Terms, as plain text links for footers and forms. */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <span className={className}>
      <Link href="/privacy" className="text-blue-700 underline">
        Privacy policy
      </Link>
      {" · "}
      <Link href="/terms" className="text-blue-700 underline">
        Terms
      </Link>
    </span>
  );
}
