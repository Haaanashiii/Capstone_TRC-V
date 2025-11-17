const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

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

// --- Gmail API integration ---

function getGmailOAuth2Client() {
  const client_id = process.env.GMAIL_API_CLIENT_ID;
  const client_secret = process.env.GMAIL_API_CLIENT_SECRET;
  const redirect_uri = process.env.GMAIL_API_REDIRECT_URI;
  const refresh_token = process.env.GMAIL_API_REFRESH_TOKEN;
  if (!client_id || !client_secret || !refresh_token) return null;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
  oAuth2Client.setCredentials({ refresh_token });
  return oAuth2Client;
}

function getGmailOAuth2Client() {
  const client_id = process.env.GMAIL_API_CLIENT_ID;
  const client_secret = process.env.GMAIL_API_CLIENT_SECRET;
  const redirect_uri = process.env.GMAIL_API_REDIRECT_URI;
  const refresh_token = process.env.GMAIL_API_REFRESH_TOKEN;
  if (!client_id || !client_secret || !refresh_token) return null;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
  oAuth2Client.setCredentials({ refresh_token });
  return oAuth2Client;
}

async function sendViaGmailApi({ from, to, subject, text, html, attachments }) {
  const oAuth2Client = getGmailOAuth2Client();
  if (!oAuth2Client) throw new Error('Gmail API credentials not configured');
  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
  const boundary = '----=_Part_' + Date.now();
  let messageParts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    text,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    html,
  ];
  if (attachments && attachments.length) {
    for (const att of attachments) {
      const attData = fs.readFileSync(att.path);
      messageParts.push(`--${boundary}`);
      messageParts.push(`Content-Type: image/png; name="${att.filename}"`);
      messageParts.push('Content-Transfer-Encoding: base64');
      messageParts.push(`Content-ID: <${att.cid}>`);
      messageParts.push('Content-Disposition: inline');
      messageParts.push('');
      messageParts.push(attData.toString('base64'));
    }
  }
  messageParts.push(`--${boundary}--`);
  const rawMessage = Buffer.from(messageParts.join('\r\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: rawMessage }
  });
  return { messageId: 'gmail-api' };
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
                      <p style="color: #1e3a8a; font-size: 42px; font-weight: 700; letter-spacing: 12px; margin: 0; font-family: 'Courier New', Consolas, monospace;">
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
  const useGmailApi = process.env.NODE_ENV === 'production' && getGmailOAuth2Client();
  try {
    let info;
    if (useGmailApi) {
      info = await sendViaGmailApi(mailOptions);
    } else {
      const transporter = makeTransporter();
      info = await transporter.sendMail(mailOptions);
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('sendMail info:', info && info.messageId ? info.messageId : info);
    }
    return info;
  } catch (err) {
    const errMsg = err && err.message ? err.message : String(err);
    throw new Error(`Failed to send email: ${errMsg}`);
  }
}

/**
 * Send franchise expiry reminder email
 * @param {string} to - Recipient email
 * @param {string} operatorName - Operator's name
 * @param {string} mtopNumber - MTOP number
 * @param {Date} expiryDate - Franchise expiry date
 * @param {number} daysUntilExpiry - Days until expiry (0 = expired, 7 = 7 days, 30 = 30 days)
 */
async function sendFranchiseExpiryEmail(to, operatorName, mtopNumber, expiryDate, daysUntilExpiry) {
  const email = String(to || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid recipient email address');
  }
  
  const fromName = process.env.EMAIL_FROM_NAME || 'TRC-V';
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_SMTP_USER || process.env.EMAIL_USER;
  if (!fromAddress) {
    throw new Error('EMAIL_FROM or EMAIL_USER must be configured');
  }
  
  // Format expiry date
  const formattedDate = new Date(expiryDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Determine message based on days until expiry
  let subject, urgencyLevel, mainMessage, actionMessage, urgencyColor, urgencyIcon;
  
  if (daysUntilExpiry === 0) {
    subject = '🚨 URGENT: Your Franchise Has Expired';
    urgencyLevel = 'EXPIRED';
    mainMessage = 'Your tricycle franchise has expired today.';
    actionMessage = 'Your franchise is no longer valid. Please renew immediately to continue operations.';
    urgencyColor = '#dc2626'; // Red
    urgencyIcon = '🚨';
  } else if (daysUntilExpiry <= 7) {
    subject = '⚠️ FINAL NOTICE: Franchise Expiring in 7 Days';
    urgencyLevel = 'URGENT - 7 DAYS';
    mainMessage = `Your tricycle franchise will expire in <strong>${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'day' : 'days'}</strong>.`;
    actionMessage = 'This is your final reminder. Please process your renewal as soon as possible to avoid service interruption.';
    urgencyColor = '#ea580c'; // Orange
    urgencyIcon = '⚠️';
  } else if (daysUntilExpiry <= 30) {
    subject = '📢 Reminder: Franchise Expiring in 30 Days';
    urgencyLevel = 'REMINDER - 30 DAYS';
    mainMessage = `Your tricycle franchise will expire in <strong>${daysUntilExpiry} days</strong>.`;
    actionMessage = 'We recommend starting your renewal process now to ensure uninterrupted service.';
    urgencyColor = '#f59e0b'; // Amber
    urgencyIcon = '📢';
  }
  
  const mailOptions = {
    from: `${fromName} <${fromAddress}>`,
    to: email,
    subject: subject,
    text: `Dear ${operatorName},\n\n${mainMessage}\n\nMTOP Number: ${mtopNumber}\nExpiry Date: ${formattedDate}\n\n${actionMessage}\n\nPlease visit your nearest TODA office or contact us to renew your franchise.\n\nBest regards,\nTRC-V System`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Franchise Expiry Notice</title>
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
                
                <!-- Urgency Banner -->
                <tr>
                  <td style="background-color: ${urgencyColor}; padding: 15px 40px; text-align: center;">
                    <p style="color: #ffffff; margin: 0; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-family: 'Poppins', sans-serif;">
                      ${urgencyIcon} ${urgencyLevel}
                    </p>
                  </td>
                </tr>
                
                <!-- Main Content -->
                <tr>
                  <td style="padding: 45px 40px;">
                    <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 24px; font-weight: 600; text-align: center; font-family: 'Poppins', sans-serif;">Franchise Expiry Notice</h2>
                    
                    <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: 'Poppins', sans-serif;">
                      Dear <strong>${operatorName}</strong>,
                    </p>
                    
                    <p style="color: #1e293b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; font-family: 'Poppins', sans-serif;">
                      ${mainMessage}
                    </p>
                    
                    <!-- Franchise Details Box -->
                    <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px solid #3b82f6; border-radius: 10px; padding: 25px; margin: 25px 0;">
                      <table role="presentation" style="width: 100%;">
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px; font-family: 'Poppins', sans-serif;">MTOP Number:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 16px; font-weight: 600; text-align: right; font-family: 'Poppins', sans-serif;">${mtopNumber}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px; font-family: 'Poppins', sans-serif;">Expiry Date:</td>
                          <td style="padding: 8px 0; color: ${urgencyColor}; font-size: 16px; font-weight: 700; text-align: right; font-family: 'Poppins', sans-serif;">${formattedDate}</td>
                        </tr>
                      </table>
                    </div>
                    
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 20px; margin: 25px 0; border-radius: 6px;">
                      <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.6; font-family: 'Poppins', sans-serif;">
                        <strong style="display: block; margin-bottom: 8px;">⚠️ Action Required</strong>
                        ${actionMessage}
                      </p>
                    </div>
                    
                    <!-- Renewal Instructions -->
                    <div style="margin: 30px 0;">
                      <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px; font-weight: 600; font-family: 'Poppins', sans-serif;">How to Renew Your Franchise:</h3>
                      <ol style="color: #64748b; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px; font-family: 'Poppins', sans-serif;">
                        <li>Visit your nearest TODA office or Municipal Hall</li>
                        <li>Bring your current franchise documents</li>
                        <li>Submit the required renewal forms</li>
                        <li>Pay the renewal fees</li>
                        <li>Receive your updated franchise certificate</li>
                      </ol>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${process.env.BASE_URL || 'http://localhost:5173'}/operator/franchise" style="display: inline-block; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; font-family: 'Poppins', sans-serif;">
                        Renew Franchise Now
                      </a>
                    </div>
                    
                    <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 25px 0 0 0; line-height: 1.5; font-family: 'Poppins', sans-serif;">
                      If you have already renewed your franchise, please disregard this message.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px 0; line-height: 1.5; font-family: 'Poppins', sans-serif;">
                      <strong style="color: #64748b;">TRC-V System</strong><br>
                      Tricycle Regulatory Compliance & Verification
                    </p>
                    <p style="color: #cbd5e1; font-size: 12px; margin: 5px 0; font-family: 'Poppins', sans-serif;">
                      © ${new Date().getFullYear()} TRC-V. All rights reserved.
                    </p>
                    <p style="color: #cbd5e1; font-size: 11px; margin: 5px 0 0 0; font-family: 'Poppins', sans-serif;">
                      This is an automated notification. Please do not reply to this email.
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
  const useGmailApi = process.env.NODE_ENV === 'production' && getGmailOAuth2Client();
  try {
    let info;
    if (useGmailApi) {
      info = await sendViaGmailApi(mailOptions);
    } else {
      const transporter = makeTransporter();
      info = await transporter.sendMail(mailOptions);
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('Franchise expiry email sent:', info && info.messageId ? info.messageId : info);
    }
    return info;
  } catch (err) {
    const errMsg = err && err.message ? err.message : String(err);
    throw new Error(`Failed to send franchise expiry email: ${errMsg}`);
  }
}

module.exports = { sendOTPEmail, sendFranchiseExpiryEmail };
