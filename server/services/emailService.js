const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : undefined,
  secure: /^(\s*true|1|yes\s*)$/i.test(String(process.env.EMAIL_SECURE)),
  // Prevent long hangs; tune timeouts as needed
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});
async function sendOTPEmail(to, otp) {
  const email = String(to || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid recipient email address');
  }
  const code = String(otp || '').trim();
  // Adjust length/pattern if your OTP differs
  if (!/^\d{6}$/.test(code)) {
    throw new Error('Invalid OTP format');
  }
  const fromName = process.env.EMAIL_FROM_NAME || 'TRC-V';
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
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
  const info = await transporter.sendMail(mailOptions);
  return info;
}

module.exports = { sendOTPEmail };
