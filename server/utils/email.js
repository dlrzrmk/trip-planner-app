// Minimal Resend REST API wrapper — no SDK dependency, just fetch (Node 18+).
//
// Setup (one-time, done by the site owner, not by this code):
//   1. Create a free account at https://resend.com
//   2. Create an API key and set it as RESEND_API_KEY in the backend's
//      environment variables (Render > service > Environment).
//   3. Optionally verify your own sending domain in Resend and set
//      RESEND_FROM to an address on it (e.g. "Voyago <no-reply@yourdomain.com>").
//      Until you do, RESEND_FROM defaults to Resend's shared test sender,
//      which only delivers to the email address you signed up to Resend with —
//      fine for trying things out, not for real users.
const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Voyago <onboarding@resend.dev>';

async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('RESEND_API_KEY tanımlı değil, e-posta gönderilmedi:', { to, subject });
    return { skipped: true };
  }
  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || DEFAULT_FROM,
      to: [to],
      subject,
      html,
      text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend gönderim hatası (${res.status}): ${body}`);
  }
  return res.json();
}

function verificationEmailHtml(code) {
  return `
    <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
      <h2 style="color:#2f6fed;">Voyago</h2>
      <p>Hesabınızı doğrulamak için aşağıdaki kodu kullanın:</p>
      <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color:#111;">${code}</p>
      <p style="color:#6b7280; font-size: 13px;">Bu kod 15 dakika içinde geçerliliğini yitirecektir. Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>
    </div>
  `;
}

async function sendVerificationEmail(to, code) {
  return sendEmail({
    to,
    subject: `Doğrulama kodunuz: ${code}`,
    html: verificationEmailHtml(code),
    text: `Doğrulama kodunuz: ${code} (15 dakika geçerlidir)`,
  });
}

module.exports = { sendEmail, sendVerificationEmail };
