require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter =
  process.env.MAIL_USER && process.env.MAIL_PASS
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
      })
    : null;

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const esc = (s) => String(s).replace(/[<>&"]/g, '');

const qrUrl = (b, guests) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(
    `WONDERWORLD|${b.bookingId}|${b.visitDate}|${guests}`
  )}`;

async function sendBookingEmail(to, name, b) {
  if (!transporter) {
    console.log('Email skipped: MAIL_USER / MAIL_PASS are not set in .env');
    return;
  }
  const guests = b.items.reduce((s, i) => s + i.qty, 0);
  const rows = b.items
    .map((i) => `<tr><td style="padding:6px 0">${esc(i.name)} × ${i.qty}</td><td align="right">${inr(i.price * i.qty)}</td></tr>`)
    .join('');

  await transporter.sendMail({
    from: `"WonderWorld" <${process.env.MAIL_USER}>`,
    to,
    subject: `Booking confirmed – ${b.bookingId}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border-radius:16px;overflow:hidden;border:1px solid #eee">
        <div style="background:#1E44A8;color:#fff;padding:24px">
          <h1 style="margin:0;font-size:26px">Wonder<span style="color:#F5B84A">World</span></h1>
          <p style="margin:6px 0 0">Your booking is confirmed!</p>
        </div>
        <div style="padding:24px;color:#2E2A25">
          <p>Hi ${esc(name)},</p>
          <p>Thank you for booking with WonderWorld. Show the QR code below at the park entry gate.</p>
          <table width="100%" style="font-size:14px">
            <tr><td><b>Booking ID</b></td><td align="right"><b>${b.bookingId}</b></td></tr>
            <tr><td>Visit Date</td><td align="right">${b.visitDate}</td></tr>
            <tr><td>Guests</td><td align="right">${guests}</td></tr>
            ${rows}
            <tr><td style="border-top:1px dashed #ccc;padding-top:8px"><b>Total Paid</b></td>
                <td align="right" style="border-top:1px dashed #ccc;padding-top:8px"><b>${inr(b.total)}</b></td></tr>
            <tr><td>Payment ID</td><td align="right">${b.paymentId}</td></tr>
          </table>
          <div style="text-align:center;margin:24px 0">
            <img src="${qrUrl(b, guests)}" alt="Ticket QR code" width="200" height="200" />
          </div>
          <p style="font-size:13px;color:#6F6A62">Park timings: Mon–Fri 10:30 AM – 6:00 PM, Sat–Sun 10:00 AM – 8:00 PM.</p>
        </div>
      </div>`,
  });
  console.log(`Confirmation email sent to ${to}`);
}

const CODE_TEXT = {
  signup: { title: 'Verify your email', line: 'Use this code to verify your email and create your WonderWorld account:', subject: 'verification code' },
  'login-admin': { title: 'Admin login code', line: 'Use this code to finish logging in to the WonderWorld admin panel:', subject: 'admin login code' },
  default: { title: 'Your login code', line: 'Use this code to log in to WonderWorld:', subject: 'login code' },
};

async function sendCodeEmail(to, code, name, purpose) {
  const t = CODE_TEXT[purpose] || CODE_TEXT.default;
  await transporter.sendMail({
    from: `"WonderWorld" <${process.env.MAIL_USER}>`,
    to,
    subject: `${code} is your WonderWorld ${t.subject}`,
    text: `${t.line} ${code}. It is valid for 10 minutes. If you did not ask for this, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border-radius:16px;overflow:hidden;border:1px solid #eee">
        <div style="background:#1E44A8;color:#fff;padding:24px">
          <h1 style="margin:0;font-size:26px">Wonder<span style="color:#F5B84A">World</span></h1>
          <p style="margin:6px 0 0">${t.title}</p>
        </div>
        <div style="padding:24px;color:#2E2A25">
          <p>Hi${name ? ' ' + esc(name) : ''},</p>
          <p>${t.line}</p>
          <div style="margin:20px 0;padding:16px;border:3px dashed #E9A23B;border-radius:14px;text-align:center;font-size:34px;font-weight:bold;letter-spacing:8px;color:#1E44A8">${code}</div>
          <p style="font-size:14px">The code is valid for <b>10 minutes</b>. Do not share it with anyone.</p>
          <p style="font-size:13px;color:#6F6A62">If you did not ask for this code, you can safely ignore this email.</p>
        </div>
      </div>`,
  });
  console.log(`Code email sent to ${to}`);
}

module.exports = { sendBookingEmail, sendCodeEmail, mailReady: !!transporter };