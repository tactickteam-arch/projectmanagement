import "server-only";

/**
 * Outgoing e-mail (decided 21 Nov 2026: sign-in codes and every alert go by e-mail). Sending is on
 * when EMAIL_FROM and RESEND_API_KEY are set (Resend, installed through the Vercel Marketplace, on
 * Sangeetha's own sending domain). Until then nothing is sent; in development the message is
 * printed to the server console instead.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.EMAIL_FROM && process.env.RESEND_API_KEY);
}

/** Demo accounts (…@…test) can never receive mail. */
export function deliverable(address: string): boolean {
  return !/\.(test|example|invalid|localhost)$/i.test(address.trim());
}

export type OutgoingEmail = { to: string; subject: string; text: string; html?: string };

export async function sendEmail(mail: OutgoingEmail): Promise<boolean> {
  if (!deliverable(mail.to)) return false;
  if (!emailConfigured()) {
    if (process.env.NODE_ENV !== "production") console.info(`[email not configured] to=${mail.to} subject=${mail.subject}\n${mail.text}`);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text, ...(mail.html ? { html: mail.html } : {}) }),
  });
  if (!res.ok) {
    console.error(`E-mail to ${mail.to} failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
    return false;
  }
  return true;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
