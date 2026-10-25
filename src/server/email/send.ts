import "server-only";

export type Email = { to: string; subject: string; text: string };

/** Whether real email can be sent. Without RESEND_API_KEY nothing leaves the server (see sendEmail). */
export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY?.trim());

/**
 * Sends one plain-text email through Resend's HTTP API (no extra dependency).
 *  - RESEND_API_KEY  the key from resend.com
 *  - EMAIL_FROM      "KRZResumeBuilder <hello@your-domain.com>" — a domain verified in Resend. Resend's test sender
 *                    (the default below) only delivers to the address that owns the Resend account.
 * With no key the message is only written to the server log, outside production, so local development can follow the link.
 */
export async function sendEmail(email: Email): Promise<{ sent: boolean }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    if (process.env.NODE_ENV === "production") console.warn("[email] RESEND_API_KEY is not set, so no email was sent.");
    else console.info(`[email] not configured — would send to ${email.to}\nSubject: ${email.subject}\n\n${email.text}`);
    return { sent: false };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM?.trim() || "KRZResumeBuilder <onboarding@resend.dev>", to: [email.to], subject: email.subject, text: email.text }),
  });
  if (!res.ok) throw new Error(`Email provider answered ${res.status}.`);
  return { sent: true };
}
