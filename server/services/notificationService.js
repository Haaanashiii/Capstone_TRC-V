const nodemailer = require('nodemailer');
const twilio = require('twilio');

/**
 * Email notification service for franchise expiration alerts
 */
class NotificationService {
  constructor() {
    //validate email config
    const requiredEmailVars = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD'];
    const missingEmailVars = requiredEmailVars.filter(v => !process.env[v]);
    if (missingEmailVars.length > 0) {
      console.warn(`Warning: Missing email configuration variables: ${missingEmailVars.join(', ')}. Email notifications will be disabled.`);
      this.emailTransporter = null;
    }else {
      // Initialize email transporter
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });
    }

    // Initialize SMS client if credentials are available
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.smsClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }
  }

  /**
   * Send email notification
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} text - Plain text content
   * @param {string} html - HTML content
   * @returns {Promise} - Email sending result
   */
  async sendEmail(to, subject, text, html) {
    if(!this.emailTransporter) {
      return { success: false, error: 'Email transporter not configured' };
    }
    try {
      const result = await this.emailTransporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME || 'Tricycle Franchising System'}" <${process.env.EMAIL_FROM || 'noreply@solano.gov.ph'}>`,
        to,
        subject,
        text,
        html
      });
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Email sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send SMS notification
   * @param {string} to - Recipient phone number
   * @param {string} message - SMS message content
   * @returns {Promise} - SMS sending result
   */
  async sendSMS(to, message) {
    try {
      if (!this.smsClient) {
        throw new Error('SMS client not configured');
      }
      
      if(!process.env.TWILIO_PHONE_NUMBER) {
        throw new Error('Twilio phone number not configured');
      }
      const result = await this.smsClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to
      });

      return { success: true, sid: result.sid };
    } catch (error) {
      console.error('SMS sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send franchise expiration notification
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
    
    const text = `Dear ${operatorName},\n\nGood news! Your tricycle franchise application has been approved by the Barangay Public Land Office (BPLO).\n\nNext Steps:\n1. Please proceed to the BPLO office for tricycle inspection\n2. After inspection, submit your Official Receipt (OR) number and OR document through your account\n\nOnce you submit your OR, your application will be forwarded to the Sangguniang Bayan for final approval.\n\nThank you,\nMunicipality of Solano - Tricycle Franchising Office`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .steps { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
          .footer { text-align: center; padding: 15px; color: #666; font-size: 12px; }
          .highlight { background-color: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>✓ BPLO Approval Received</h2>
          </div>
          <div class="content">
            <p>Dear <strong>${operatorName}</strong>,</p>
            
            <p>Good news! Your tricycle franchise application has been <strong>approved by the Barangay Public Land Office (BPLO)</strong>.</p>
            
            <div class="highlight">
              <strong>⚠ Important: Inspection Required</strong>
              <p>Please proceed to the BPLO office for your tricycle inspection.</p>
            </div>
            
            <div class="steps">
              <h3>Next Steps:</h3>
              <ol>
                <li><strong>Visit BPLO Office</strong> - Bring your tricycle for inspection</li>
                <li><strong>Pay Required Fees</strong> - Complete the payment and get your Official Receipt</li>
                <li><strong>Submit OR Online</strong> - Log in to your account and submit your OR number and document</li>
                <li><strong>Final Approval</strong> - Your application will then be forwarded to Sangguniang Bayan for final approval</li>
              </ol>
            </div>
            
            <p>Once you submit your OR, we will notify you about the final approval status.</p>
            
            <p>If you have any questions, please contact the BPLO office.</p>
          </div>
          <div class="footer">
            <p>Municipality of Solano - Tricycle Franchising Office</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(application.operatorEmail, subject, text, html);
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

    const subject = 'Franchise Application - Action Required';
    const operatorName = application.operatorName || 'Applicant';
    
    const text = `Dear ${operatorName},\n\nYour tricycle franchise application requires attention.\n\nReason: ${reason}\n\nPlease review the issue and contact the BPLO office for guidance on how to proceed.\n\nThank you,\nMunicipality of Solano - Tricycle Franchising Office`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #ff9800; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .reason-box { background-color: #fff3e0; padding: 15px; margin: 15px 0; border-left: 4px solid #ff9800; }
          .footer { text-align: center; padding: 15px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>⚠ Application Requires Attention</h2>
          </div>
          <div class="content">
            <p>Dear <strong>${operatorName}</strong>,</p>
            
            <p>Your tricycle franchise application has been reviewed by the BPLO office and requires your attention.</p>
            
            <div class="reason-box">
              <h3>Reason:</h3>
              <p><strong>${reason}</strong></p>
            </div>
            
            <p><strong>What to do next:</strong></p>
            <ul>
              <li>Please contact the BPLO office for guidance</li>
              <li>Address the issues mentioned above</li>
              <li>You may need to resubmit your application with corrections</li>
            </ul>
            
            <p>If you have questions or need clarification, please visit the BPLO office.</p>
          </div>
          <div class="footer">
            <p>Municipality of Solano - Tricycle Franchising Office</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(application.operatorEmail, subject, text, html);
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
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .success-box { background-color: #e8f5e9; padding: 20px; margin: 15px 0; border-left: 4px solid #4CAF50; text-align: center; }
          .resolution { background-color: white; padding: 15px; margin: 15px 0; border: 2px solid #2196F3; font-size: 18px; font-weight: bold; text-align: center; }
          .requirements { background-color: white; padding: 15px; margin: 15px 0; }
          .footer { text-align: center; padding: 15px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🎉 CONGRATULATIONS!</h2>
          </div>
          <div class="content">
            <p>Dear <strong>${operatorName}</strong>,</p>
            
            <div class="success-box">
              <h2>Your Franchise Application is APPROVED!</h2>
              <p>Your application has been finally approved by the Sangguniang Bayan.</p>
            </div>
            
            <div class="resolution">
              <p>Resolution Number:</p>
              <p style="color: #2196F3; font-size: 24px;">${resolutionNumber}</p>
            </div>
            
            <p><strong>Next Step: Claim Your Certificate</strong></p>
            
            <div class="requirements">
              <h3>Please bring the following to the Municipal Office:</h3>
              <ul>
                <li>Valid Government-issued ID</li>
                <li>Official Receipt (OR)</li>
                <li>This email notification (printed or on your phone)</li>
              </ul>
            </div>
            
            <p>Congratulations on your new franchise! We wish you success in your business.</p>
          </div>
          <div class="footer">
            <p>Municipality of Solano - Tricycle Franchising Office</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(application.operatorEmail, subject, text, html);
  }
}

module.exports = new NotificationService();