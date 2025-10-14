const nodemailer = require('nodemailer');

// Build a fresh transporter using current environment variables. Creating a
// transporter per send avoids stale auth when the server process is long-lived
// and .env was modified without restarting the server.
function makeTransporter() {
  // Helpful defaults: if the user set EMAIL_HOST to an email address by mistake
  // (common when copying .env values), fallback to Gmail SMTP which is the
  // likely intent when using a Gmail app password.
  let host = process.env.EMAIL_HOST || '';
  if (host && /@/.test(host) && !/\./.test(host)) host = '';
  if (!host) host = process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com';

  const port = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : (process.env.EMAIL_SECURE === 'true' ? 465 : 587);
  const secure = /^\s*(true|1|yes)\s*$/i.test(String(process.env.EMAIL_SECURE));

  const smtpUser = process.env.EMAIL_SMTP_USER || process.env.EMAIL_USER || process.env.EMAIL_FROM;
  const smtpPass = process.env.EMAIL_SMTP_PASSWORD || process.env.EMAIL_PASSWORD;

  const transportOptions = {
    host,
    port,
    secure,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000
  };
  if (smtpUser && smtpPass) transportOptions.auth = { user: smtpUser, pass: smtpPass };

  return nodemailer.createTransport(transportOptions);
}

async function sendOTPEmail(to, otp) {
  const email = String(to || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid recipient email address');
  }
  const code = String(otp || '').trim();
  if (!/^\d{4,14}$/.test(code)) {
    throw new Error('Invalid OTP format');
  }
  const fromName = process.env.EMAIL_FROM_NAME || 'TRC-V';
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_SMTP_USER || process.env.EMAIL_USER;
  if (!fromAddress) {
    throw new Error('EMAIL_FROM or EMAIL_USER must be configured');
  }
  const mailOptions = {
    from: `${fromName} <${fromAddress}>`,
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP code is: ${code}. It will expire in 5 minutes.`,
    html: `<p>Your OTP code is: <b>${code}</b>. It will expire in 5 minutes.</p>`
  };
  const transporter = makeTransporter();
  try {
    const info = await transporter.sendMail(mailOptions);
    if (process.env.NODE_ENV !== 'production') {
      console.log('sendMail info:', info && info.messageId ? info.messageId : info);
    }
    return info;
  } catch (err) {
    // rethrow with message so callers can log succinctly
    const errMsg = err && err.message ? err.message : String(err);
    throw new Error(`Failed to send email: ${errMsg}`);
  }
}

module.exports = { sendOTPEmail };
