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
    // 4. 1 day before expiry
  }
}

module.exports = new NotificationService();