const nodemailer = require('nodemailer');
const path = require('path');

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
    subject: 'Your TRC-V Verification Code',
    text: `Your OTP code is: ${code}. It will expire in 5 minutes.`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TRC-V OTP Verification</title>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07); overflow: hidden;">
                
                <!-- Header with Logo -->
                <tr>
                  <td style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 35px 40px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 80px; vertical-align: middle;">
                          <img src="cid:logo" alt="TRC-V Logo" style="width: 70px; height: 70px; display: block;" />
                        </td>
                        <td style="vertical-align: middle; padding-left: 20px;">
                          <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 1px; font-family: 'Poppins', sans-serif;">TRC-V</h1>
                          <p style="color: #e0e7ff; margin: 5px 0 0 0; font-size: 14px; font-family: 'Poppins', sans-serif; font-weight: 400;">Tricycle Verification System</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Main Content -->
                <tr>
                  <td style="padding: 45px 40px;">
                    <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 24px; font-weight: 600; text-align: center; font-family: 'Poppins', sans-serif;">Email Verification</h2>
                    <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; text-align: center; font-family: 'Poppins', sans-serif;">
                      Please use the following One-Time Password to verify your email address:
                    </p>
                    
                    <!-- OTP Code Box -->
                    <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 2px solid #3b82f6; border-radius: 10px; padding: 30px; text-align: center; margin: 35px 0;">
                      <p style="color: #94a3b8; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0; font-family: 'Poppins', sans-serif;">Your OTP Code</p>
                      <p style="color: #1e3a8a; font-size: 42px; font-weight: 700; letter-spacing: 12px; margin: 0;  font-family: 'Poppins', sans-serif; font-weight: 1200;">
                        ${code}
                      </p>
                    </div>
                    
                    <div style="text-align: center; margin: 25px 0;">
                      <p style="color: #64748b; font-size: 14px; margin: 0 0 8px 0; font-family: 'Poppins', sans-serif;">
                        <svg width="16" height="16" style="vertical-align: middle; margin-right: 6px;" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="8" cy="8" r="7" stroke="#ef4444" stroke-width="2"/>
                          <path d="M8 4V8L10.5 10.5" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        <span style="color: #ef4444; font-weight: 600;">This code expires in 5 minutes</span>
                      </p>
                    </div>
                    
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 20px; margin-top: 30px; border-radius: 6px;">
                      <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 1.6; font-family: 'Poppins', sans-serif;">
                        <strong style="display: block; margin-bottom: 5px;">🔒 Security Notice</strong>
                        Never share this code with anyone. TRC-V staff will never ask for your OTP code.
                      </p>
                    </div>
                    
                    <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 25px 0 0 0; line-height: 1.5; font-family: 'Poppins', sans-serif;">
                      If you didn't request this code, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px 0; line-height: 1.5; font-family: 'Poppins', sans-serif;">
                      <strong style="color: #64748b;">TRC-V System</strong>
                    </p>
                    <p style="color: #cbd5e1; font-size: 12px; margin: 0 0 5px 0; font-family: 'Poppins', sans-serif;">
                      © ${new Date().getFullYear()} TRC-V. All rights reserved.
                    </p>
                    <p style="color: #cbd5e1; font-size: 11px; margin: 5px 0 0 0; font-family: 'Poppins', sans-serif;">
                      This is an automated message. Please do not reply to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    attachments: [{
      filename: 'TRC-vLogo.png',
      path: path.join(__dirname, '..', '..', 'dashboard', 'src', 'assets', 'TRC-vLogo.png'),
      cid: 'logo'
    }]
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
