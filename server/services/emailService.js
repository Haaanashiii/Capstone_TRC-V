/**
 * TRC-V Email Service
 * 
 * Supports THREE email delivery methods (auto-detected based on environment variables):
 * 
 * 1. SMTP (Recommended for most deployments)
 *    - Works with Gmail App Password, Outlook, Yahoo, or any SMTP server
 *    - Requires: EMAIL_USER, EMAIL_PASSWORD, and optionally SMTP_HOST, SMTP_PORT
 *    - Easiest to set up - just needs email and app password
 * 
 * 2. Domain SMTP (For professional/enterprise deployments)
 *    - Works with custom domains (e.g., noreply@yourcompany.com)
 *    - Requires: SMTP_HOST, SMTP_PORT, EMAIL_USER, EMAIL_PASSWORD
 *    - Most professional option - uses your own domain
 * 
 * 3. Gmail API (Legacy - for advanced users only)
 *    - Uses Google OAuth2 with refresh tokens
 *    - Requires: GMAIL_API_CLIENT_ID, GMAIL_API_CLIENT_SECRET, GMAIL_API_REFRESH_TOKEN
 *    - Most complex to set up but doesn't require App Password
 * 
 * Priority: SMTP > Gmail API (if SMTP credentials exist, SMTP is used)
 */

const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');

// =============================================================================
// EMAIL METHOD DETECTION
// =============================================================================

/**
 * Detect which email method to use based on environment variables
 * Priority: SMTP > Gmail API
 */
function detectEmailMethod() {
  const hasSmtpCredentials = !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
  const hasCustomSmtp = !!(process.env.SMTP_HOST);
  const hasGmailApi = !!(
    process.env.GMAIL_API_CLIENT_ID && 
    process.env.GMAIL_API_CLIENT_SECRET && 
    process.env.GMAIL_API_REFRESH_TOKEN
  );

  if (hasCustomSmtp && hasSmtpCredentials) {
    return 'domain-smtp'; // Custom domain SMTP server
  } else if (hasSmtpCredentials) {
    return 'smtp'; // Gmail/Outlook/Yahoo App Password
  } else if (hasGmailApi) {
    return 'gmail-api'; // Gmail OAuth2 API
  } else {
    return 'none';
  }
}

/**
 * Get email configuration status for diagnostics
 */
function getEmailConfigStatus() {
  const method = detectEmailMethod();
  return {
    method,
    configured: method !== 'none',
    details: {
      smtpHost: process.env.SMTP_HOST || 'Not set (will auto-detect)',
      smtpPort: process.env.SMTP_PORT || 'Not set (will auto-detect)',
      emailUser: process.env.EMAIL_USER ? '✓ Set' : '✗ Not set',
      emailPassword: process.env.EMAIL_PASSWORD ? '✓ Set' : '✗ Not set',
      gmailApiConfigured: !!(process.env.GMAIL_API_CLIENT_ID && process.env.GMAIL_API_REFRESH_TOKEN),
    }
  };
}

// Log email configuration on startup
console.log('[EmailService] Configuration detected:', getEmailConfigStatus());

// =============================================================================
// SMTP TRANSPORT (App Password / Domain SMTP)
// =============================================================================

/**
 * Detect SMTP settings based on email provider
 */
function detectSmtpSettings(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  
  // Common email provider settings
  const providerSettings = {
    'gmail.com': { host: 'smtp.gmail.com', port: 587, secure: false },
    'googlemail.com': { host: 'smtp.gmail.com', port: 587, secure: false },
    'outlook.com': { host: 'smtp-mail.outlook.com', port: 587, secure: false },
    'hotmail.com': { host: 'smtp-mail.outlook.com', port: 587, secure: false },
    'live.com': { host: 'smtp-mail.outlook.com', port: 587, secure: false },
    'yahoo.com': { host: 'smtp.mail.yahoo.com', port: 587, secure: false },
    'icloud.com': { host: 'smtp.mail.me.com', port: 587, secure: false },
    'zoho.com': { host: 'smtp.zoho.com', port: 587, secure: false },
  };

  return providerSettings[domain] || null;
}

/**
 * Create SMTP transporter (fresh per send to handle env changes)
 */
function createSmtpTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;
  
  if (!user || !pass) {
    throw new Error('EMAIL_USER and EMAIL_PASSWORD are required for SMTP');
  }

  // Use custom SMTP settings if provided, otherwise auto-detect
  let smtpConfig;
  
  if (process.env.SMTP_HOST) {
    // Custom SMTP server (domain email)
    smtpConfig = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true' || parseInt(process.env.SMTP_PORT || '587', 10) === 465,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'
      }
    };
    console.log('[EmailService] Using custom SMTP:', process.env.SMTP_HOST);
  } else {
    // Auto-detect based on email domain
    const detected = detectSmtpSettings(user);
    if (detected) {
      smtpConfig = {
        ...detected,
        auth: { user, pass }
      };
      console.log('[EmailService] Auto-detected SMTP for:', user.split('@')[1]);
    } else {
      // Default fallback (generic SMTP settings)
      smtpConfig = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user, pass }
      };
      console.log('[EmailService] Using default Gmail SMTP settings');
    }
  }

  return nodemailer.createTransport(smtpConfig);
}

/**
 * Send email via SMTP (App Password or Domain SMTP)
 */
async function sendViaSmtp({ from, to, subject, text, html, attachments }) {
  if (!to || !subject || (!text && !html)) {
    throw new Error('Missing required email parameters: to, subject, and text/html');
  }

  const transporter = createSmtpTransporter();
  
  // Convert attachments to nodemailer format
  const nodeMailerAttachments = attachments?.map(att => ({
    filename: att.filename,
    path: att.path,
    cid: att.cid
  })) || [];

  const mailOptions = {
    from,
    to,
    subject,
    text,
    html,
    attachments: nodeMailerAttachments
  };

  try {
    console.log('[SMTP] Sending email to:', to);
    const info = await transporter.sendMail(mailOptions);
    console.log('[SMTP] Email sent successfully, messageId:', info.messageId);
    return { messageId: info.messageId };
  } catch (error) {
    console.error('[EmailService] SMTP send failed:', error.message);
    
    // Provide helpful error messages
    if (error.message.includes('Invalid login') || error.message.includes('authentication')) {
      throw new Error('SMTP authentication failed. Please check your EMAIL_USER and EMAIL_PASSWORD. For Gmail, use an App Password (not your regular password).');
    }
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
      throw new Error(`Cannot connect to SMTP server. Check SMTP_HOST and SMTP_PORT settings.`);
    }
    throw error;
  }
}

// =============================================================================
// GMAIL API (OAuth2 - Legacy method)
// =============================================================================

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
  // Validate inputs
  if (!to || !subject || !text || !html) {
    throw new Error('Missing required email parameters: to, subject, text, or html');
  }
  
  const oAuth2Client = getGmailOAuth2Client();
  if (!oAuth2Client) {
    throw new Error('Gmail API credentials not configured. Please set GMAIL_API_CLIENT_ID, GMAIL_API_CLIENT_SECRET, and GMAIL_API_REFRESH_TOKEN');
  }
  
  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
  const boundary = '----=_Part_' + Date.now();
  
  // Use multipart/related for inline images, with multipart/alternative nested inside
  let messageParts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/related; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: multipart/alternative; boundary="alt_' + boundary + '"',
    '',
    `--alt_${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    text,
    `--alt_${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    html,
    `--alt_${boundary}--`,
  ];
  
  // Add inline attachments
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
  const rawMessage = Buffer.from(messageParts.join('\r\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  try {
    console.log('[Gmail API] Attempting to send email to:', to);
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: rawMessage }
    });
    console.log('[Gmail API] Email sent successfully, messageId:', response.data.id);
    return { messageId: response.data.id || 'gmail-api' };
  } catch (error) {
    console.error('[EmailService] Gmail API send failed:', error.message);
    console.error('[EmailService] Error code:', error.code);
    console.error('[EmailService] Full error:', error);
    if (error.code === 401 || error.code === 403) {
      throw new Error('Gmail API authentication failed. Please check your refresh token.');
    }
    throw new Error(`Failed to send email via Gmail API: ${error.message}`);
  }
}

// =============================================================================
// UNIFIED EMAIL SENDER (Auto-selects method based on config)
// =============================================================================

/**
 * Send email using the best available method
 * Priority: SMTP > Gmail API
 * 
 * This is the main function that all email-sending functions should use
 */
async function sendEmail(mailOptions) {
  const method = detectEmailMethod();
  
  if (method === 'none') {
    throw new Error(
      'No email configuration found. Please configure one of the following:\n' +
      '1. SMTP (Recommended): Set EMAIL_USER and EMAIL_PASSWORD\n' +
      '2. Domain SMTP: Set SMTP_HOST, SMTP_PORT, EMAIL_USER, and EMAIL_PASSWORD\n' +
      '3. Gmail API: Set GMAIL_API_CLIENT_ID, GMAIL_API_CLIENT_SECRET, and GMAIL_API_REFRESH_TOKEN'
    );
  }

  console.log(`[EmailService] Sending email via: ${method}`);

  try {
    if (method === 'domain-smtp' || method === 'smtp') {
      return await sendViaSmtp(mailOptions);
    } else if (method === 'gmail-api') {
      return await sendViaGmailApi(mailOptions);
    }
  } catch (error) {
    console.error(`[EmailService] Failed to send via ${method}:`, error.message);
    throw error;
  }
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
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  if (!fromAddress) {
    throw new Error('EMAIL_FROM must be configured');
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
                        <strong style="display: block; margin-bottom: 5px;">Security Notice</strong>
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
        path: path.join(__dirname, '..', 'assets', 'TRC-vLogo.png'),
      cid: 'logo'
    }]
  };
  try {
    const info = await sendEmail(mailOptions);
    if (process.env.NODE_ENV !== 'production') {
      console.log('sendMail info:', info && info.messageId ? info.messageId : info);
    }
    return { success: true, messageId: info.messageId || info };
  } catch (err) {
    const errMsg = err && err.message ? err.message : String(err);
    console.error('[sendOTPEmail] Error:', errMsg);
    return { success: false, error: errMsg };
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
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  if (!fromAddress) {
    throw new Error('EMAIL_FROM must be configured');
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
    subject = 'URGENT: Your Franchise Has Expired';
    urgencyLevel = 'EXPIRED';
    mainMessage = 'Your tricycle franchise has expired today.';
    actionMessage = 'Your franchise is no longer valid. Please renew immediately to continue operations.';
    urgencyColor = '#dc2626'; // Red
    urgencyIcon = '[!]';
  } else if (daysUntilExpiry <= 7) {
    subject = 'FINAL NOTICE: Franchise Expiring in 7 Days';
    urgencyLevel = 'URGENT - 7 DAYS';
    mainMessage = `Your tricycle franchise will expire in <strong>${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'day' : 'days'}</strong>.`;
    actionMessage = 'This is your final reminder. Please process your renewal as soon as possible to avoid service interruption.';
    urgencyColor = '#ea580c'; // Orange
    urgencyIcon = '[!]';
  } else if (daysUntilExpiry <= 30) {
    subject = 'Reminder: Franchise Expiring in 30 Days';
    urgencyLevel = 'REMINDER - 30 DAYS';
    mainMessage = `Your tricycle franchise will expire in <strong>${daysUntilExpiry} days</strong>.`;
    actionMessage = 'We recommend starting your renewal process now to ensure uninterrupted service.';
    urgencyColor = '#f59e0b'; // Amber
    urgencyIcon = '[i]';
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
                        <strong style="display: block; margin-bottom: 8px;">Action Required</strong>
                        ${actionMessage}
                      </p>
                    </div>
                    
                    <!-- Renewal Instructions -->
                    <div style="margin: 30px 0;">
                      <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px; font-weight: 600; font-family: 'Poppins', sans-serif;">How to Renew Your Franchise:</h3>
                      <ol style="color: #64748b; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px; font-family: 'Poppins', sans-serif;">
                        <li>Access the TRC-V website</li>
                        <li>Log in to your account and select the “Renew” option.</li>
                        <li>Submit the required renewal forms</li>
                        <li>Settle the renewal fees after the tricycle inspection.</li>
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
      path: path.join(__dirname, '..', 'assets', 'TRC-vLogo.png'),
      cid: 'logo'
    }]
  };
  try {
    const info = await sendEmail(mailOptions);
    if (process.env.NODE_ENV !== 'production') {
      console.log('Franchise expiry email sent:', info && info.messageId ? info.messageId : info);
    }
    return { success: true, messageId: info.messageId || info };
  } catch (err) {
    const errMsg = err && err.message ? err.message : String(err);
    console.error('[sendFranchiseExpiryEmail] Error:', errMsg);
    return { success: false, error: errMsg };
  }
}

/**
 * Send franchise created/accepted notification email
 */
async function sendFranchiseCreatedEmail(to, operatorName, franchiseNumber) {
  const email = String(to || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid recipient email address');
  }
  
  const fromName = process.env.EMAIL_FROM_NAME || 'TRC-V';
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  if (!fromAddress) {
    throw new Error('EMAIL_FROM must be configured');
  }
  
  const mailOptions = {
    from: `${fromName} <${fromAddress}>`,
    to: email,
    subject: `Franchise Approved - License #${franchiseNumber} Ready to Claim`,
    text: `Dear ${operatorName},\n\nCongratulations! Your franchise application has been approved. Your franchise license number is ${franchiseNumber}.`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Franchise Approved - TRC-V</title>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07); overflow: hidden;">
                
                <!-- Header with Logo -->
                <tr>
                  <td style="background: linear-gradient(135deg, #10b981 0%, #34d399 100%); padding: 35px 40px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 80px; vertical-align: middle;">
                          <img src="cid:logo" alt="TRC-V Logo" style="width: 70px; height: 70px; display: block;" />
                        </td>
                        <td style="vertical-align: middle; padding-left: 20px;">
                          <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 1px; font-family: 'Poppins', sans-serif;">TRC-V</h1>
                          <p style="color: #d1fae5; margin: 5px 0 0 0; font-size: 14px; font-family: 'Poppins', sans-serif; font-weight: 400;">Tricycle Verification System</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Main Content -->
                <tr>
                  <td style="padding: 45px 40px;">
                    <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 28px; font-weight: 700; text-align: center; font-family: 'Poppins', sans-serif;">Congratulations!</h2>
                    <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; text-align: center; font-family: 'Poppins', sans-serif;">
                      Your franchise application has been <strong style="color: #10b981;">approved</strong> by the Sangguniang Bayan!
                    </p>
                    
                    <!-- License Info Box -->
                    <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 2px solid #10b981; border-radius: 10px; padding: 30px; text-align: center; margin: 35px 0;">
                      <p style="color: #64748b; font-size: 14px; margin: 0 0 15px 0; font-family: 'Poppins', sans-serif;">Your Franchise License Number</p>
                      <p style="color: #10b981; font-size: 48px; font-weight: 700; margin: 0; font-family: 'Poppins', monospace; letter-spacing: 4px;">${franchiseNumber}</p>
                      <p style="color: #64748b; font-size: 12px; margin: 15px 0 0 0; font-family: 'Poppins', sans-serif;">Keep this number for your records</p>
                    </div>
                    
                    <!-- Next Steps -->
                    <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 30px 0; border-radius: 6px;">
                      <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 16px; font-weight: 600; font-family: 'Poppins', sans-serif;">Next Steps:</h3>
                      <ol style="color: #64748b; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px; font-family: 'Poppins', sans-serif;">
                        <li>Your approved franchise details are now available in your TRC-V account.</li>
                        <li>The franchise dashboard provides access to your official franchise records.</li>
                        <li>Your franchise certificate and QR code may be downloaded for authorized use.</li>
                        <li>Please retain all franchise documents for compliance and future reference.</li>
                      </ol>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${process.env.BASE_URL || 'http://localhost:5173'}/operator/franchise" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #34d399 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; font-family: 'Poppins', sans-serif;">
                        View Your Franchise
                      </a>
                    </div>
                    
                    <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 25px 0 0 0; line-height: 1.5; font-family: 'Poppins', sans-serif;">
                      If you have any questions, please contact the Municipal Transportation Office.
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
      path: path.join(__dirname, '..', 'assets', 'TRC-vLogo.png'),
      cid: 'logo'
    }]
  };
  
  try {
    const info = await sendEmail(mailOptions);
    if (process.env.NODE_ENV !== 'production') {
      console.log('Franchise created email sent:', info && info.messageId ? info.messageId : info);
    }
    return { success: true, messageId: info.messageId || info };
  } catch (err) {
    const errMsg = err && err.message ? err.message : String(err);
    console.error('[sendFranchiseCreatedEmail] Error:', errMsg);
    return { success: false, error: errMsg };
  }
}

/**
 * Send franchise renewed/amended notification email
 */
async function sendFranchiseUpdatedEmail(to, operatorName, franchiseNumber, updateType) {
  const email = String(to || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid recipient email address');
  }
  
  const fromName = process.env.EMAIL_FROM_NAME || 'TRC-V';
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  if (!fromAddress) {
    throw new Error('EMAIL_FROM must be configured');
  }
  
  const typeLabel = updateType === 'renewal' ? 'Renewal' : updateType === 'change_unit' ? 'Unit Change' : 'Amendment';
  const typeMessage = updateType === 'renewal' ? 'renewed' : updateType === 'change_unit' ? 'unit has been changed' : 'amended';
  
  const mailOptions = {
    from: `${fromName} <${fromAddress}>`,
    to: email,
    subject: `Franchise ${typeLabel} Approved - License #${franchiseNumber}`,
    text: `Dear ${operatorName},\n\nYour franchise ${typeMessage} has been approved. Your franchise license number is ${franchiseNumber}.\n\nPlease login to your TRC-V account to view your updated franchise details.`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Franchise ${typeLabel} Approved - TRC-V</title>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07); overflow: hidden;">
                
                <!-- Header with Logo -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); padding: 35px 40px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 80px; vertical-align: middle;">
                          <img src="cid:logo" alt="TRC-V Logo" style="width: 70px; height: 70px; display: block;" />
                        </td>
                        <td style="vertical-align: middle; padding-left: 20px;">
                          <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 1px; font-family: 'Poppins', sans-serif;">TRC-V</h1>
                          <p style="color: #cffafe; margin: 5px 0 0 0; font-size: 14px; font-family: 'Poppins', sans-serif; font-weight: 400;">Tricycle Verification System</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Main Content -->
                <tr>
                  <td style="padding: 45px 40px;">
                    <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 28px; font-weight: 700; text-align: center; font-family: 'Poppins', sans-serif;">Approved</h2>
                    <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; text-align: center; font-family: 'Poppins', sans-serif;">
                      Your franchise <strong style="color: #0ea5e9;">${typeMessage}</strong> has been approved!
                    </p>
                    
                    <!-- License Info Box -->
                    <div style="background: linear-gradient(135deg, #ecf0ff 0%, #dbeafe 100%); border: 2px solid #0ea5e9; border-radius: 10px; padding: 30px; text-align: center; margin: 35px 0;">
                      <p style="color: #64748b; font-size: 14px; margin: 0 0 15px 0; font-family: 'Poppins', sans-serif;">Your Franchise License Number</p>
                      <p style="color: #0ea5e9; font-size: 48px; font-weight: 700; margin: 0; font-family: 'Poppins', monospace; letter-spacing: 4px;">${franchiseNumber}</p>
                      <p style="color: #64748b; font-size: 12px; margin: 15px 0 0 0; font-family: 'Poppins', sans-serif;">Keep this number for your records</p>
                    </div>
                    
                    <!-- Info Box -->
                    <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 20px; margin: 30px 0; border-radius: 6px;">
                      <p style="color: #064e3b; font-size: 14px; line-height: 1.8; margin: 0; font-family: 'Poppins', sans-serif;">
                        Your franchise ${typeMessage} has been processed and approved by the Sangguniang Bayan. Your updated franchise is now valid and ready for use.
                      </p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${process.env.BASE_URL || 'http://localhost:5173'}/operator/franchise" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; font-family: 'Poppins', sans-serif;">
                        View Franchise Details
                      </a>
                    </div>
                    
                    <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 25px 0 0 0; line-height: 1.5; font-family: 'Poppins', sans-serif;">
                      If you have any questions, please contact the Municipal Transportation Office.
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
      path: path.join(__dirname, '..', 'assets', 'TRC-vLogo.png'),
      cid: 'logo'
    }]
  };
  
  try {
    const info = await sendEmail(mailOptions);
    if (process.env.NODE_ENV !== 'production') {
      console.log('Franchise updated email sent:', info && info.messageId ? info.messageId : info);
    }
    return { success: true, messageId: info.messageId || info };
  } catch (err) {
    const errMsg = err && err.message ? err.message : String(err);
    console.error('[sendFranchiseUpdatedEmail] Error:', errMsg);
    return { success: false, error: errMsg };
  }
}

/**
 * Send franchise disapproval notification email
 */
async function sendFranchiseDisapprovalEmail(to, operatorName, reason) {
  const email = String(to || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid recipient email address');
  }
  
  const fromName = process.env.EMAIL_FROM_NAME || 'TRC-V';
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  if (!fromAddress) {
    throw new Error('EMAIL_FROM must be configured');
  }
  
  const mailOptions = {
    from: `${fromName} <${fromAddress}>`,
    to: email,
    subject: 'Franchise Application Status Update - Action Required',
    text: `Dear ${operatorName},\n\nYour franchise application has been reviewed. Reason: ${reason}\n\nPlease login to your TRC-V account to view details and resubmit if needed.`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Application Status Update - TRC-V</title>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07); overflow: hidden;">
                
                <!-- Header with Logo -->
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); padding: 35px 40px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 80px; vertical-align: middle;">
                          <img src="cid:logo" alt="TRC-V Logo" style="width: 70px; height: 70px; display: block;" />
                        </td>
                        <td style="vertical-align: middle; padding-left: 20px;">
                          <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 1px; font-family: 'Poppins', sans-serif;">TRC-V</h1>
                          <p style="color: #fef3c7; margin: 5px 0 0 0; font-size: 14px; font-family: 'Poppins', sans-serif; font-weight: 400;">Tricycle Verification System</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Main Content -->
                <tr>
                  <td style="padding: 45px 40px;">
                    <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 28px; font-weight: 700; text-align: center; font-family: 'Poppins', sans-serif;">Action Required</h2>
                    <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; text-align: center; font-family: 'Poppins', sans-serif;">
                      Your franchise application requires attention
                    </p>
                    
                    <!-- Alert Box -->
                    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 10px; padding: 30px; text-align: center; margin: 35px 0;">
                      <p style="color: #64748b; font-size: 14px; margin: 0 0 15px 0; font-family: 'Poppins', sans-serif;">Feedback from BPLO:</p>
                      <p style="color: #92400e; font-size: 16px; font-weight: 600; margin: 0; font-family: 'Poppins', sans-serif;">${reason}</p>
                    </div>
                    
                    <!-- Info Box -->
                    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 30px 0; border-radius: 6px;">
                      <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 16px; font-weight: 600; font-family: 'Poppins', sans-serif;">What to do next:</h3>
                      <ol style="color: #64748b; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px; font-family: 'Poppins', sans-serif;">
                        <li>Review the feedback provided above</li>
                        <li>Prepare the required documents or information</li>
                        <li>Login to your TRC-V account and resubmit your application</li>
                        <li>Your application will be reviewed again</li>
                      </ol>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${process.env.BASE_URL || 'http://localhost:5173'}/operator/applications" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; font-family: 'Poppins', sans-serif;">
                        Review Application
                      </a>
                    </div>
                    
                    <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 25px 0 0 0; line-height: 1.5; font-family: 'Poppins', sans-serif;">
                      If you have questions, please contact the BPLO office.
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
      path: path.join(__dirname, '..', 'assets', 'TRC-vLogo.png'),
      cid: 'logo'
    }]
  };
  
  try {
    const info = await sendEmail(mailOptions);
    if (process.env.NODE_ENV !== 'production') {
      console.log('Franchise disapproval email sent:', info && info.messageId ? info.messageId : info);
    }
    return { success: true, messageId: info.messageId || info };
  } catch (err) {
    const errMsg = err && err.message ? err.message : String(err);
    console.error('[sendFranchiseDisapprovalEmail] Error:', errMsg);
    return { success: false, error: errMsg };
  }
}

/**
 * Send BPLO approval notification email
 * @param {Object} application - Application object with operator details
 */
async function sendBPLOApprovalNotification(application) {
  const email = String(application.operatorEmail || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid email address');
  }
  
  const fromName = process.env.EMAIL_FROM_NAME || 'TRC-V';
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  if (!fromAddress) {
    throw new Error('Email service not configured');
  }
  
  const operatorName = application.operatorName || 'Operator';
  const franchiseNumber = application.franchiseNumber || 'PENDING';
  
  const mailOptions = {
    from: `${fromName} <${fromAddress}>`,
    to: email,
    subject: `Documentary Requirements Approved - Inspection Required`,
    text: `Dear ${operatorName},\n\nGood news! Your franchise application documents have been reviewed and approved by the BPLO office.\n\nApplication Number: ${franchiseNumber}\n\nNext Steps:\n1. Visit the BPLO office for tricycle inspection\n2. Bring your tricycle and all required documents\n3. After passing inspection, submit your Official Receipt (OR) number\n\nPlease complete these steps as soon as possible to proceed with your application.\n\nBest regards,\nTRC-V System`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>BPLO Approval - Inspection Required</title>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07); overflow: hidden;">
                
                <!-- Header with Logo -->
                <tr>
                  <td style="background: linear-gradient(135deg, #10b981 0%, #34d399 100%); padding: 35px 40px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 80px; vertical-align: middle;">
                          <img src="cid:logo" alt="TRC-V Logo" style="width: 70px; height: 70px; display: block;" />
                        </td>
                        <td style="vertical-align: middle; padding-left: 20px;">
                          <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 1px; font-family: 'Poppins', sans-serif;">TRC-V</h1>
                          <p style="color: #d1fae5; margin: 5px 0 0 0; font-size: 14px; font-family: 'Poppins', sans-serif; font-weight: 400;">Tricycle Verification System</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Status Banner -->
                <tr>
                  <td style="background-color: #10b981; padding: 15px 40px; text-align: center;">
                    <p style="color: #ffffff; margin: 0; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-family: 'Poppins', sans-serif;">
                      ✓ DOCUMENTS APPROVED BY BPLO
                    </p>
                  </td>
                </tr>
                
                <!-- Main Content -->
                <tr>
                  <td style="padding: 45px 40px;">
                    <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 24px; font-weight: 600; text-align: center; font-family: 'Poppins', sans-serif;">Inspection Required</h2>
                    
                    <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: 'Poppins', sans-serif;">
                      Dear <strong>${operatorName}</strong>,
                    </p>
                    
                    <p style="color: #1e293b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; font-family: 'Poppins', sans-serif;">
                      Good news! Your franchise application documents have been reviewed and <strong style="color: #10b981;">approved</strong> by the BPLO office.
                    </p>
                    
                    <!-- Application Details Box -->
                    <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 2px solid #10b981; border-radius: 10px; padding: 25px; margin: 25px 0;">
                      <table role="presentation" style="width: 100%;">
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px; font-family: 'Poppins', sans-serif;">Application Number:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 16px; font-weight: 600; text-align: right; font-family: 'Poppins', sans-serif;">${franchiseNumber}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px; font-family: 'Poppins', sans-serif;">Status:</td>
                          <td style="padding: 8px 0; color: #10b981; font-size: 16px; font-weight: 700; text-align: right; font-family: 'Poppins', sans-serif;">APPROVED FOR INSPECTION</td>
                        </tr>
                      </table>
                    </div>
                    
                    <!-- Next Steps -->
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 30px 0; border-radius: 6px;">
                      <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px; font-weight: 600; font-family: 'Poppins', sans-serif;">Next Steps:</h3>
                      <ol style="color: #64748b; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px; font-family: 'Poppins', sans-serif;">
                        <li><strong>Visit the BPLO office</strong> for tricycle inspection</li>
                        <li><strong>Bring your tricycle</strong> and all required documents</li>
                        <li><strong>Complete the inspection</strong> process</li>
                        <li><strong>Submit your Official Receipt (OR)</strong> number through your TRC-V account</li>
                      </ol>
                    </div>
                    
                    <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 16px 20px; margin: 25px 0; border-radius: 6px;">
                      <p style="color: #1e3a8a; font-size: 14px; margin: 0; line-height: 1.6; font-family: 'Poppins', sans-serif;">
                        <strong style="display: block; margin-bottom: 8px;">Important Reminder</strong>
                        Please complete the inspection and OR submission as soon as possible. Your application will proceed to SB (Sangguniang Bayan) approval after these steps are completed.
                      </p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${process.env.BASE_URL || 'http://localhost:5173'}/operator/franchise" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #34d399 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; font-family: 'Poppins', sans-serif;">
                        View Application Status
                      </a>
                    </div>
                    
                    <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 25px 0 0 0; line-height: 1.5; font-family: 'Poppins', sans-serif;">
                      If you have any questions, please contact the BPLO office.
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
      path: path.join(__dirname, '..', 'assets', 'TRC-vLogo.png'),
      cid: 'logo'
    }]
  };
  
  try {
    await sendEmail(mailOptions);
    console.log('[emailService] BPLO approval email sent to:', email);
    return { success: true, email };
  } catch (err) {
    console.error('[emailService] Failed to send BPLO approval email:', err.message);
    throw err;
  }
}

module.exports = { 
  sendOTPEmail, 
  sendFranchiseExpiryEmail, 
  sendFranchiseCreatedEmail,
  sendFranchiseUpdatedEmail,
  sendFranchiseDisapprovalEmail,
  sendBPLOApprovalNotification,
  sendEmail,
  sendViaSmtp,
  sendViaGmailApi,
  getEmailConfigStatus,
  detectEmailMethod
};
