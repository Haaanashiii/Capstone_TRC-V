const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

async function sendOTPEmail(to, otp) {
  const mailOptions = {
    from: `${process.env.EMAIL_FROM_NAME || 'TRC-V'} <${process.env.EMAIL_FROM}>`,
    to,
    subject: 'Your OTP Code',
    text: `Your OTP code is: ${otp}. It will expire in 5 minutes.`,
    html: `<p>Your OTP code is: <b>${otp}</b>. It will expire in 5 minutes.</p>`
  };
  await transporter.sendMail(mailOptions);
}

module.exports = { sendOTPEmail };
