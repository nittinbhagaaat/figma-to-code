import nodemailer from "nodemailer";
import { env } from "@/lib/env";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function layout(title, bodyHtml, cta) {
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#18181b">
<h2 style="margin:0 0 16px">${esc(title)}</h2>${bodyHtml}
${cta ? `<p style="margin:28px 0"><a href="${esc(cta.url)}" style="background:#5b5bd6;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${esc(cta.label)}</a></p>
<p style="font-size:12px;color:#71717a">If the button doesn't work, paste this link into your browser:<br>${esc(cta.url)}</p>` : ""}
</div>`;
}

/**
 * Sends mail via Resend (RESEND_API_KEY) or SMTP (SMTP_HOST). With neither configured, the message
 * is printed to the server console so the flows stay testable in local development.
 * Returns { delivered: boolean, transport }.
 */
export async function sendEmail({ to, subject, html, text }) {
  const from = env.emailFrom;
  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (!res.ok) throw new Error(`Resend error ${res.status}`);
    return { delivered: true, transport: "resend" };
  }
  if (process.env.SMTP_HOST) {
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await t.sendMail({ from, to, subject, html, text });
    return { delivered: true, transport: "smtp" };
  }
  console.log(`\n[email:dev-console] To: ${to}\nSubject: ${subject}\n${text}\n`);
  if (!env.isProd) {
    // Dev/test only: persist for automated tests and local inspection.
    const fs = await import("node:fs/promises");
    await fs.mkdir(".data", { recursive: true });
    await fs.appendFile(".data/outbox.jsonl", JSON.stringify({ to, subject, text, at: new Date().toISOString() }) + "\n");
  }
  return { delivered: false, transport: "console" };
}

export function sendVerificationEmail(user, token) {
  const url = `${env.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  return sendEmail({ to: user.email, subject: "Verify your email", text: `Verify your email: ${url}`,
    html: layout("Verify your email", `<p>Hi ${esc(user.name)}, confirm your address to activate your account.</p>`, { url, label: "Verify email" }) });
}
export function sendPasswordResetEmail(user, token) {
  const url = `${env.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  return sendEmail({ to: user.email, subject: "Reset your password", text: `Reset your password: ${url}`,
    html: layout("Reset your password", `<p>We received a request to reset your password. This link expires in 1 hour. If this wasn't you, ignore this email.</p>`, { url, label: "Reset password" }) });
}
export function sendInvitationEmail({ to, inviterName, workspaceName, role, token }) {
  const url = `${env.appUrl}/invite/${encodeURIComponent(token)}`;
  return sendEmail({ to, subject: `${inviterName} invited you to ${workspaceName}`, text: `${inviterName} invited you to join "${workspaceName}" as ${role}: ${url}`,
    html: layout(`Join ${workspaceName}`, `<p><b>${esc(inviterName)}</b> invited you to collaborate on <b>${esc(workspaceName)}</b> as <b>${esc(role)}</b>. The invitation expires in 7 days.</p>`, { url, label: "Accept invitation" }) });
}
