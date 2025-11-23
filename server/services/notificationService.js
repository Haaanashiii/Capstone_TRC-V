const emailService = require('./emailService');

/**
 * Email notification service for franchise expiration alerts
 */
class NotificationService {
  constructor() {
    // Gmail API is configured in emailService
    // Validate that Gmail API credentials are available
    const requiredGmailVars = ['GMAIL_API_CLIENT_ID', 'GMAIL_API_CLIENT_SECRET', 'GMAIL_API_REFRESH_TOKEN'];
    const missingGmailVars = requiredGmailVars.filter(v => !process.env[v]);
    if (missingGmailVars.length > 0) {
      console.warn(`Warning: Missing Gmail API configuration variables: ${missingGmailVars.join(', ')}. Email notifications will be disabled.`);
      this.emailAvailable = false;
    } else {
      this.emailAvailable = true;
    }
  }

  /**
   * Send email notification using Gmail API
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} text - Plain text content
   * @param {string} html - HTML content
   * @param {Array} attachments - Optional email attachments
   * @returns {Promise} - Email sending result
   */
  async sendEmail(to, subject, text, html, attachments = []) {
    if (!this.emailAvailable) {
      return { success: false, error: 'Gmail API not configured' };
    }
    try {
      const from = process.env.EMAIL_FROM || process.env.GMAIL_API_USER_EMAIL || 'noreply@solano.gov.ph';
      const fromName = process.env.EMAIL_FROM_NAME || 'Tricycle Franchising System';
      const result = await emailService.sendViaGmailApi({
        from: `"${fromName}" <${from}>`,
        to,
        subject,
        text,
        html,
        attachments
      });
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Email sending failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send SMS notification - not implemented, returns not configured
   * @param {string} to - Recipient phone number
   * @param {string} message - SMS message content
   * @returns {Promise} - SMS sending result
   */
  async sendSMS(to, message) {
    try {
      throw new Error('SMS notifications are not configured. Please use email notifications instead.');
    } catch (error) {
      console.error('SMS sending failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send expiration notifications for a franchise
   * @param {Object} driver - Driver information
   * @param {Object} application - Application information
   * @param {number} daysRemaining - Days remaining until expiration
   * @returns {Promise} - Notification sending results
   */
  async sendExpirationNotification(driver, application, daysRemaining) {
    const results = {};

    // Email notification
    if (driver.email) {
      const subject = `Your Tricycle Franchise will expire in ${daysRemaining} days`;
      const text = `Dear ${driver.name},\n\nYour tricycle franchise (ID: ${application.franchiseId}) will expire in ${daysRemaining} days on ${new Date(application.expiryDate).toLocaleDateString()}.\n\nPlease visit the Tricycle Franchising Office to renew your franchise.\n\nRegards,\nMunicipality of Solano`;
      const html = `
        <h2>Franchise Expiration Notice</h2>
        <p>Dear ${driver.name},</p>
        <p>Your tricycle franchise (ID: <strong>${application.franchiseId}</strong>) will expire in <strong>${daysRemaining} days</strong> on <strong>${new Date(application.expiryDate).toLocaleDateString()}</strong>.</p>
        <p>Please visit the Tricycle Franchising Office to renew your franchise.</p>
        <p>Regards,<br>Municipality of Solano</p>
      `;

      results.email = await this.sendEmail(driver.email, subject, text, html);
    }

    // SMS notification
    if (driver.phone) {
      const message = `NOTICE: Tricycle franchise ${application.franchiseId} expires in ${daysRemaining} days (${new Date(application.expiryDate).toLocaleDateString('en-PH')}). Renew at office. -Solano`;
      results.sms = await this.sendSMS(driver.phone, message);
    }

    return results;
  }

  /**
   * Schedule expiration notifications for a franchise
   * @param {Object} application - The approved application
   */
  scheduleExpiryNotifications(application) {
    // This would typically use a job scheduler like node-cron, bull, or agenda
    // For demonstration, we'll just log the scheduling
    console.log(`Scheduled expiration notifications for franchise ${application.franchiseId}`);
    
    // In a real implementation, you would create scheduled jobs for:
    // 1. 30 days before expiry
    // 2. 14 days before expiry
    // 3. 7 days before expiry
    // 1 day before expiry
  }

  /**
   * Send BPLO approval notification with inspection requirement
   * @param {Object} application - The application approved by BPLO
   * @returns {Promise} - Email sending result
   */
  async sendBPLOApprovalNotification(application) {
    if (!application.operatorEmail) {
      console.warn('[NotificationService] No operator email for BPLO approval notification');
      return { success: false, error: 'No operator email' };
    }

    const subject = 'Franchise Application Approved by BPLO - Inspection Required';
    const operatorName = application.operatorName || 'Applicant';
    
    const text = `Dear ${operatorName},\n\nGood news! Your tricycle franchise application has been approved by the Business Permit and Licensing Office (BPLO).\n\nNext Steps:\n1. Please proceed to the BPLO office for tricycle inspection\n2. After inspection, submit your Official Receipt (OR) number and OR document through your account\n\nOnce you submit your OR, your application will be forwarded to the Sangguniang Bayan for final approval.\n\nThank you,\nMunicipality of Solano - Tricycle Franchising Office`;
    
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TRC-V BPLO Approval</title>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07); overflow: hidden;">
                
                <!-- Header with Logo -->
                <tr>
                  <td style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 35px 40px;">
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
                    <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 24px; font-weight: 600; text-align: center; font-family: 'Poppins', sans-serif;">BPLO Approval Received</h2>
                    <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; text-align: center; font-family: 'Poppins', sans-serif;">
                      Dear <strong style="color: #1e293b;">${operatorName}</strong>,
                    </p>
                    
                    <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border: 2px solid #10b981; border-radius: 10px; padding: 25px; text-align: center; margin: 30px 0;">
                      <p style="color: #065f46; font-size: 18px; font-weight: 600; line-height: 1.6; margin: 0; font-family: 'Poppins', sans-serif;">
                        Your franchise application has been approved by the<br/><strong>Business Permit and Licensing Office (BPLO)</strong>
                      </p>
                    </div>
                    
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 20px; margin: 25px 0; border-radius: 6px;">
                      <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 1.6; font-family: 'Poppins', sans-serif;">
                        <strong style="display: block; margin-bottom: 5px;">Important: Inspection Required</strong>
                        Please proceed to the BPLO office for your tricycle inspection.
                      </p>
                    </div>
                    
                    <!-- Next Steps -->
                    <div style="background-color: #f8fafc; border-radius: 8px; padding: 25px; margin: 25px 0;">
                      <p style="color: #1e293b; font-size: 15px; font-weight: 600; margin: 0 0 15px 0; font-family: 'Poppins', sans-serif;">Next Steps:</p>
                      <ol style="color: #475569; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px; font-family: 'Poppins', sans-serif;">
                        <li style="margin-bottom: 10px;"><strong>Visit BPLO Office</strong> - Bring your tricycle for inspection</li>
                        <li style="margin-bottom: 10px;"><strong>Pay Required Fees</strong> - Complete the payment and get your Official Receipt (OR)</li>
                        <li style="margin-bottom: 10px;"><strong>Submit OR Online</strong> - Log in to your account and submit your OR number and document</li>
                        <li style="margin-bottom: 0;"><strong>Final Approval</strong> - Your application will be forwarded to Sangguniang Bayan</li>
                      </ol>
                    </div>
                    
                    <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px 20px; margin-top: 30px; border-radius: 6px;">
                      <p style="color: #1e40af; font-size: 13px; margin: 0; line-height: 1.6; font-family: 'Poppins', sans-serif;">
                        <strong style="display: block; margin-bottom: 5px;">What's Next?</strong>
                        Once you submit your OR, we will notify you about the final approval status from Sangguniang Bayan.
                      </p>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px 0; line-height: 1.5; font-family: 'Poppins', sans-serif;">
                      <strong style="color: #64748b;">Municipality of Solano - Tricycle Franchising Office</strong>
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
    `;

    const path = require('path');
    const attachments = [{
      filename: 'TRC-vLogo.png',
      path: path.join(__dirname, '..', '..', 'dashboard', 'src', 'assets', 'TRC-vLogo.png'),
      cid: 'logo'
    }];

    return await this.sendEmail(application.operatorEmail, subject, text, html, attachments);
  }

  /**
   * Send BPLO disapproval notification
   * @param {Object} application - The application disapproved by BPLO
   * @param {string} reason - Reason for disapproval
   * @returns {Promise} - Email sending result
   */
  async sendBPLODisapprovalNotification(application, reason) {
    if (!application.operatorEmail) {
      console.warn('[NotificationService] No operator email for BPLO disapproval notification');
      return { success: false, error: 'No operator email' };
    }

    const subject = 'Application Update: Action Required';
    const operatorName = application.operatorName || 'Applicant';
    
    const text = `Dear ${operatorName},\n\nYour tricycle franchise application requires attention.\n\nReason: ${reason}\n\nPlease review the issue and contact the Business Permit and Licensing Office (BPLO) for guidance on how to proceed.\n\nThank you,\nMunicipality of Solano - Tricycle Franchising Office`;
    
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TRC-V Application Update</title>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07); overflow: hidden;">
                
                <!-- Header with Logo -->
                <tr>
                  <td style="background: linear-gradient(135deg, #dc2626 0%, #f97316 100%); padding: 35px 40px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 80px; vertical-align: middle;">
                          <img src="cid:logo" alt="TRC-V Logo" style="width: 70px; height: 70px; display: block;" />
                        </td>
                        <td style="vertical-align: middle; padding-left: 20px;">
                          <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 1px; font-family: 'Poppins', sans-serif;">TRC-V</h1>
                          <p style="color: #fed7aa; margin: 5px 0 0 0; font-size: 14px; font-family: 'Poppins', sans-serif; font-weight: 400;">Tricycle Verification System</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Main Content -->
                <tr>
                  <td style="padding: 45px 40px;">
                    <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 24px; font-weight: 600; text-align: center; font-family: 'Poppins', sans-serif;">Application Requires Attention</h2>
                    <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; text-align: center; font-family: 'Poppins', sans-serif;">
                      Dear <strong style="color: #1e293b;">${operatorName}</strong>,
                    </p>
                    
                    <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 25px 0; font-family: 'Poppins', sans-serif;">
                      Your tricycle franchise application has been reviewed by the <strong>Business Permit and Licensing Office (BPLO)</strong> and requires your attention.
                    </p>
                    
                    <!-- Reason Box -->
                    <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 2px solid #f87171; border-radius: 10px; padding: 25px; margin: 30px 0;">
                      <p style="color: #991b1b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px 0; font-family: 'Poppins', sans-serif;">Reason for Review</p>
                      <p style="color: #7f1d1d; font-size: 16px; font-weight: 500; line-height: 1.6; margin: 0; font-family: 'Poppins', sans-serif;">
                        ${reason}
                      </p>
                    </div>
                    
                    <!-- Action Steps -->
                    <div style="background-color: #f8fafc; border-radius: 8px; padding: 25px; margin: 25px 0;">
                      <p style="color: #1e293b; font-size: 15px; font-weight: 600; margin: 0 0 15px 0; font-family: 'Poppins', sans-serif;">What to do next:</p>
                      <ul style="color: #475569; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px; font-family: 'Poppins', sans-serif;">
                        <li style="margin-bottom: 8px;">Please contact the Business Permit and Licensing Office (BPLO) for guidance</li>
                        <li style="margin-bottom: 8px;">Address the issues mentioned above</li>
                        <li style="margin-bottom: 0;">You may need to resubmit your application with corrections</li>
                      </ul>
                    </div>
                    
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 20px; margin-top: 30px; border-radius: 6px;">
                      <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 1.6; font-family: 'Poppins', sans-serif;">
                        <strong style="display: block; margin-bottom: 5px;">Need Help?</strong>
                        If you have questions or need clarification, please visit the Business Permit and Licensing Office (BPLO).
                      </p>
                    </div>
                    
                    <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 25px 0 0 0; line-height: 1.5; font-family: 'Poppins', sans-serif;">
                      We're here to help you complete your application successfully.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px 0; line-height: 1.5; font-family: 'Poppins', sans-serif;">
                      <strong style="color: #64748b;">Municipality of Solano - Tricycle Franchising Office</strong>
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
    `;

    const path = require('path');
    const attachments = [{
      filename: 'TRC-vLogo.png',
      path: path.join(__dirname, '..', '..', 'dashboard', 'src', 'assets', 'TRC-vLogo.png'),
      cid: 'logo'
    }];

    return await this.sendEmail(application.operatorEmail, subject, text, html, attachments);
  }

  /**
   * Send SB approval notification - certificate ready for claiming
   * @param {Object} application - The application approved by SB
   * @param {string} resolutionNumber - Resolution number for the certificate
   * @returns {Promise} - Email sending result
   */
  async sendSBApprovalNotification(application, resolutionNumber) {
    if (!application.operatorEmail) {
      console.warn('[NotificationService] No operator email for SB approval notification');
      return { success: false, error: 'No operator email' };
    }

    const subject = 'Congratulations! Your Franchise Application is Approved';
    const operatorName = application.operatorName || 'Applicant';
    
    const text = `Dear ${operatorName},\n\nCongratulations! Your tricycle franchise application has been finally approved by the Sangguniang Bayan.\n\nResolution Number: ${resolutionNumber}\n\nYou can now claim your Certificate of Approval at the Municipal Office.\n\nPlease bring:\n- Valid ID\n- Official Receipt\n- This email notification\n\nThank you,\nMunicipality of Solano - Tricycle Franchising Office`;
    
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TRC-V Final Approval</title>
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
                    <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 24px; font-weight: 600; text-align: center; font-family: 'Poppins', sans-serif;">CONGRATULATIONS!</h2>
                    <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; text-align: center; font-family: 'Poppins', sans-serif;">
                      Dear <strong style="color: #1e293b;">${operatorName}</strong>,
                    </p>
                    
                    <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border: 2px solid #3b82f6; border-radius: 10px; padding: 30px; text-align: center; margin: 30px 0;">
                      <p style="color: #1e3a8a; font-size: 20px; font-weight: 700; line-height: 1.6; margin: 0 0 10px 0; font-family: 'Poppins', sans-serif;">
                        Your Franchise Application is APPROVED!
                      </p>
                      <p style="color: #1e40af; font-size: 15px; font-weight: 500; margin: 0; font-family: 'Poppins', sans-serif;">
                        Approved by Sangguniang Bayan
                      </p>
                    </div>
                    
                    <!-- Resolution Number Box -->
                    <div style="background-color: #eff6ff; border: 2px solid #3b82f6; border-radius: 10px; padding: 25px; margin: 30px 0; text-align: center;">
                      <p style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0; font-family: 'Poppins', sans-serif;">Resolution Number</p>
                      <p style="color: #1e3a8a; font-size: 32px; font-weight: 700; letter-spacing: 2px; margin: 0; font-family: 'Courier New', Consolas, monospace;">
                        ${resolutionNumber}
                      </p>
                    </div>
                    
                    <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px; margin: 25px 0; border-radius: 6px;">
                      <p style="color: #166534; font-size: 15px; font-weight: 600; margin: 0 0 10px 0; font-family: 'Poppins', sans-serif;">Claim Your Certificate</p>
                      <p style="color: #15803d; font-size: 14px; margin: 0; line-height: 1.6; font-family: 'Poppins', sans-serif;">
                        You can now claim your Certificate of Approval at the Municipal Office.
                      </p>
                    </div>
                    
                    <!-- Requirements to Bring -->
                    <div style="background-color: #f8fafc; border-radius: 8px; padding: 25px; margin: 25px 0;">
                      <p style="color: #1e293b; font-size: 15px; font-weight: 600; margin: 0 0 15px 0; font-family: 'Poppins', sans-serif;">Please bring the following:</p>
                      <ul style="color: #475569; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px; font-family: 'Poppins', sans-serif;">
                        <li style="margin-bottom: 8px;">Valid Government-issued ID</li>
                        <li style="margin-bottom: 8px;">Official Receipt (OR)</li>
                        <li style="margin-bottom: 0;">This email notification (printed or on your phone)</li>
                      </ul>
                    </div>
                    
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 20px; margin-top: 30px; border-radius: 6px;">
                      <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 1.6; font-family: 'Poppins', sans-serif;">
                        <strong style="display: block; margin-bottom: 5px;">Congratulations!</strong>
                        Congratulations on your new franchise! We wish you success in your business.
                      </p>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px 0; line-height: 1.5; font-family: 'Poppins', sans-serif;">
                      <strong style="color: #64748b;">Municipality of Solano - Tricycle Franchising Office</strong>
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
    `;

    const path = require('path');
    const attachments = [{
      filename: 'TRC-vLogo.png',
      path: path.join(__dirname, '..', '..', 'dashboard', 'src', 'assets', 'TRC-vLogo.png'),
      cid: 'logo'
    }];

    return await this.sendEmail(application.operatorEmail, subject, text, html, attachments);
  }
}

module.exports = new NotificationService();