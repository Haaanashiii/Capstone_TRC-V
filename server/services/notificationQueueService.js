/**
 * Notification Queue Service - SIMPLIFIED
 * 
 * Smart orchestrator for SMS + Email notifications
 * ✅ Manages OTP attempt tracking (max 2 SMS, then email only)
 * ✅ Routes CRITICAL notifications to SMS + Email
 * ✅ Routes INFO notifications to Email only (cost optimization)
 * 
 * Does NOT wrap emailService/smsService - calls them directly
 */

const smsService = require('./smsService');
const emailService = require('./emailService');

/**
 * Notification types and their rules
 */
const NOTIFICATION_RULES = {
  OTP: {
    smsEnabled: false,
    maxSmsAttempts: 2,
    emailEnabled: true,
    priority: 'CRITICAL'
  },
  FRANCHISE_EXPIRY_1_WEEK: {
    smsEnabled: false,
    emailEnabled: true,
    priority: 'HIGH'
  },
  FRANCHISE_EXPIRY_FINAL_DAY: {
    smsEnabled: false,
    emailEnabled: true,
    priority: 'CRITICAL'
  },
  BPLO_APPROVAL: {
    smsEnabled: false,
    emailEnabled: true,
    priority: 'CRITICAL'
  },
  SB_APPROVAL: {
    smsEnabled: false,
    emailEnabled: true,
    priority: 'CRITICAL'
  },
  BPLO_DISAPPROVAL: {
    smsEnabled: false,
    emailEnabled: true,
    priority: 'HIGH'
  },
  GENERAL_UPDATE: {
    smsEnabled: false,
    emailEnabled: true,
    priority: 'LOW'
  }
};

/**
 * Queue for tracking sent notifications and OTP attempts
 */
const notificationQueue = new Map();

/**
 * Get or create notification record
 */
function getNotificationRecord(userId, notificationType) {
  const key = `${userId}:${notificationType}`;
  if (!notificationQueue.has(key)) {
    notificationQueue.set(key, {
      userId,
      type: notificationType,
      smsSent: 0,
      emailSent: 0,
      lastSms: null,
      lastEmail: null,
      attempts: 0,
      createdAt: new Date()
    });
  }
  return notificationQueue.get(key);
}

/**
 * Send OTP via SMS with attempt tracking
 * Max 2 SMS attempts (initial + resend)
 * Falls back to email after
 */
async function sendOTPNotification(userId, phoneNumber, email, otpCode, deliveryMethod = null) {
  try {
    console.log(`[Notification] Processing OTP for user: ${userId}, deliveryMethod: ${deliveryMethod}`);
    
    const record = getNotificationRecord(userId, 'OTP');
    const rules = NOTIFICATION_RULES.OTP;
    
    const results = {
      sms: null,
      email: null,
      smsSent: record.smsSent,
      attempt: record.attempts + 1,
      deliveryMethod: deliveryMethod
    };

    record.attempts++;

    // If delivery method is explicitly 'email', send email only
    if (deliveryMethod === 'email') {
      if (rules.emailEnabled && email) {
        const emailText = `Your TRC-V Verification Code is: ${otpCode}. It will expire in 5 minutes. Do not share this code with anyone.`;
        results.email = await emailService.sendOTPEmail(email, otpCode);
        
        if (results.email.success) {
          record.emailSent++;
          record.lastEmail = new Date();
          console.log(`[NotificationQueue] OTP Email sent to ${email}`);
        }
      }
    } 
    // If delivery method is explicitly 'phone', prioritize SMS
    else if (deliveryMethod === 'phone' && phoneNumber) {
      const smsText = `Your TRC-V OTP is: ${otpCode}. Valid for 5 minutes. Do not share.`;
      results.sms = await smsService.sendSMS(phoneNumber, smsText);
      
      if (results.sms.success) {
        record.smsSent++;
        record.lastSms = new Date();
        console.log(`[NotificationQueue] OTP SMS sent to ${phoneNumber} (attempt ${record.smsSent}/${rules.maxSmsAttempts})`);
      } else {
        console.warn(`[NotificationQueue] OTP SMS failed for ${phoneNumber}, will attempt email`);
        // Fall back to email if SMS fails
        if (rules.emailEnabled && email) {
          const emailText = `Your TRC-V Verification Code is: ${otpCode}. It will expire in 5 minutes. Do not share this code with anyone.`;
          results.email = await emailService.sendOTPEmail(email, otpCode);
          
          if (results.email.success) {
            record.emailSent++;
            record.lastEmail = new Date();
            console.log(`[NotificationQueue] OTP Email sent as fallback to ${email}`);
          }
        }
      }
    } else {
      // Default behavior: try SMS if available, always try email
      // SMS: Send only if under max attempts
      if (rules.smsEnabled && phoneNumber && record.smsSent < rules.maxSmsAttempts) {
        const smsText = `Your TRC-V OTP is: ${otpCode}. Valid for 5 minutes. Do not share.`;
        results.sms = await smsService.sendSMS(phoneNumber, smsText);
        
        if (results.sms.success) {
          record.smsSent++;
          record.lastSms = new Date();
          console.log(`[NotificationQueue] OTP SMS sent to ${phoneNumber} (attempt ${record.smsSent}/${rules.maxSmsAttempts})`);
        } else {
          console.warn(`[NotificationQueue] OTP SMS failed for ${phoneNumber}, will attempt email`);
        }
      }

      // Email: Always send (free backup)
      if (rules.emailEnabled && email) {
        const emailText = `Your TRC-V Verification Code is: ${otpCode}. It will expire in 5 minutes. Do not share this code with anyone.`;
        results.email = await emailService.sendOTPEmail(email, otpCode);
        
        if (results.email.success) {
          record.emailSent++;
          record.lastEmail = new Date();
          console.log(`[NotificationQueue] OTP Email sent to ${email}`);
        }
      }
    }

    // Summary
    console.log(`[NotificationQueue] OTP notification completed:`, {
      userId,
      deliveryMethod: deliveryMethod,
      smsStatus: results.sms?.success ? 'SUCCESS' : 'FAILED',
      emailStatus: results.email?.success ? 'SUCCESS' : 'FAILED',
      totalSmsSent: record.smsSent
    });

    return results;
  } catch (error) {
    console.error(`[Notification] OTP Error:`, error.message);
    return { sms: null, email: null, error: error.message };
  }
}

/**
 * Send franchise expiry alerts
 * SMS: 1 week before + final day
 * Email: Always
 */
async function sendFranchiseExpiryNotification(franchiseData, daysUntilExpiry) {
  try {
    const { operatorName, franchiseNumber, operatorContactNumber, operatorEmail, _id: franchiseId } = franchiseData;
    
    if (daysUntilExpiry !== 7 && daysUntilExpiry !== 0) {
      console.log(`[NotificationQueue] Skipping expiry notification for ${franchiseNumber} (${daysUntilExpiry} days remaining)`);
      return { skipped: true, reason: `Not a notification day (${daysUntilExpiry} days)` };
    }

    console.log(`[Notification] Processing franchise expiry for Franchise #${franchiseNumber}`);

    const notificationType = daysUntilExpiry === 7 ? 'FRANCHISE_EXPIRY_1_WEEK' : 'FRANCHISE_EXPIRY_FINAL_DAY';
    const record = getNotificationRecord(franchiseId, notificationType);
    const rules = NOTIFICATION_RULES[notificationType];

    const results = {
      sms: null,
      email: null,
      notificationType
    };

    // SMS message
    let smsMessage;
    if (daysUntilExpiry === 7) {
      smsMessage = `REMINDER: Your franchise #${franchiseNumber} expires in 7 days. Start renewal process at TODA office. -TRC-V`;
    } else {
      smsMessage = `URGENT: Your franchise #${franchiseNumber} EXPIRES TODAY! Visit TODA office immediately to renew. -TRC-V`;
    }

    // SMS: Send per rules
    if (rules.smsEnabled && operatorContactNumber) {
      results.sms = await smsService.sendSMS(operatorContactNumber, smsMessage);
      if (results.sms.success) {
        record.smsSent++;
        record.lastSms = new Date();
        console.log(`[NotificationQueue] Expiry SMS sent to ${operatorContactNumber}`);
      }
    }

    // Email: Always send (free)
    if (rules.emailEnabled && operatorEmail) {
      // Use existing email service
      const emailSubject = daysUntilExpiry === 7 
        ? `Franchise Renewal Reminder - Expires in 7 Days`
        : `URGENT: Your Franchise Expires Today`;
      
      const emailText = `Dear ${operatorName},\n\n${smsMessage}\n\nPlease proceed to your nearest TODA office to renew your franchise.\n\nBest regards,\nTRC-V System`;
      
      results.email = await emailService.sendFranchiseExpiryEmail(
        operatorEmail,
        operatorName,
        franchiseNumber,
        franchiseData.expiryDate,
        daysUntilExpiry
      );
      
      if (results.email.success) {
        record.emailSent++;
        record.lastEmail = new Date();
        console.log(`[NotificationQueue] Expiry Email sent to ${operatorEmail}`);
      }
    }

    console.log(`[NotificationQueue] Franchise expiry notification completed:`, {
      franchiseNumber,
      daysRemaining: daysUntilExpiry,
      smsStatus: results.sms?.success ? 'SUCCESS' : 'FAILED',
      emailStatus: results.email?.success ? 'SUCCESS' : 'FAILED'
    });

    return results;
  } catch (error) {
    console.error(`[Notification] Expiry Error:`, error.message);
    return { sms: null, email: null, error: error.message };
  }
}

/**
 * Send BPLO Approval Notification
 * SMS: Action required (go to BPLO)
 * Email: Always
 */
async function sendBPLOApprovalNotification(application) {
  try {
    console.log(`[Notification] Processing BPLO approval for ${application.operatorName}`);

    const { operatorName, franchiseNumber, operatorContactNumber, operatorEmail, _id: appId } = application;
    const record = getNotificationRecord(appId, 'BPLO_APPROVAL');
    const rules = NOTIFICATION_RULES.BPLO_APPROVAL;

    const results = {
      sms: null,
      email: null,
      notificationType: 'BPLO_APPROVAL'
    };

    // SMS message
    const smsMessage = `✓ APPROVED by BPLO! Go to BPLO office for inspection. After inspection, submit OR number. -TRC-V`;

    // SMS
    if (rules.smsEnabled && operatorContactNumber) {
      results.sms = await smsService.sendBPLOApprovalSMS(
        operatorContactNumber,
        operatorName,
        franchiseNumber || 'PENDING'
      );
      if (results.sms.success) {
        record.smsSent++;
        record.lastSms = new Date();
        console.log(`[NotificationQueue] BPLO approval SMS sent to ${operatorContactNumber}`);
      }
    }

    // Email: Always send (free)
    if (rules.emailEnabled && operatorEmail) {
      // Send via email service directly
      results.email = await emailService.sendBPLOApprovalNotification(application).catch(err => ({
        success: false,
        error: err.message
      }));
      
      if (results.email?.success) {
        record.emailSent++;
        record.lastEmail = new Date();
        console.log(`[NotificationQueue] BPLO approval Email sent to ${operatorEmail}`);
      }
    }

    console.log(`[NotificationQueue] BPLO approval notification completed:`, {
      operator: operatorName,
      smsStatus: results.sms?.success ? 'SUCCESS' : 'FAILED',
      emailStatus: results.email?.success ? 'SUCCESS' : 'FAILED'
    });

    return results;
  } catch (error) {
    console.error(`[Notification] BPLO Error:`, error.message);
    return { sms: null, email: null, error: error.message };
  }
}

/**
 * Send SB Final Approval Notification
 * SMS: Claim franchise (action required)
 * Email: Always
 */
async function sendSBApprovalNotification(franchiseData, resolutionNumber) {
  try {
    console.log(`[Notification] Processing SB approval for ${franchiseData.operatorName}`);

    const { operatorName, franchiseNumber, operatorContactNumber, operatorEmail, _id: franchiseId } = franchiseData;
    const record = getNotificationRecord(franchiseId, 'SB_APPROVAL');
    const rules = NOTIFICATION_RULES.SB_APPROVAL;

    const results = {
      sms: null,
      email: null,
      notificationType: 'SB_APPROVAL'
    };

    // SMS message
    const smsMessage = `🎉 FINAL APPROVAL! Your franchise #${franchiseNumber} (Resolution: ${resolutionNumber}) is approved. Claim your certificate now! -TRC-V`;

    // SMS
    if (rules.smsEnabled && operatorContactNumber) {
      results.sms = await smsService.sendSBApprovalSMS(
        operatorContactNumber,
        operatorName,
        franchiseNumber,
        resolutionNumber
      );
      if (results.sms.success) {
        record.smsSent++;
        record.lastSms = new Date();
        console.log(`[NotificationQueue] SB approval SMS sent to ${operatorContactNumber}`);
      }
    }

    // Email: Always send (free)
    if (rules.emailEnabled && operatorEmail) {
      // Send via email service directly
      results.email = await emailService.sendSBApprovalNotification(franchiseData, resolutionNumber).catch(err => ({
        success: false,
        error: err.message
      }));
      
      if (results.email?.success) {
        record.emailSent++;
        record.lastEmail = new Date();
        console.log(`[NotificationQueue] SB approval Email sent to ${operatorEmail}`);
      }
    }

    console.log(`[NotificationQueue] SB approval notification completed:`, {
      operator: operatorName,
      smsStatus: results.sms?.success ? 'SUCCESS' : 'FAILED',
      emailStatus: results.email?.success ? 'SUCCESS' : 'FAILED'
    });

    return results;
  } catch (error) {
    console.error(`[Notification] SB Error:`, error.message);
    return { sms: null, email: null, error: error.message };
  }
}

/**
 * Get notification statistics
 */
function getNotificationStats() {
  const stats = {
    totalQueued: notificationQueue.size,
    byType: {},
    totalSmsSent: 0,
    totalEmailSent: 0
  };

  notificationQueue.forEach((record) => {
    stats.byType[record.type] = (stats.byType[record.type] || 0) + 1;
    stats.totalSmsSent += record.smsSent;
    stats.totalEmailSent += record.emailSent;
  });

  return stats;
}

/**
 * Clear old notification records (older than 24 hours)
 */
function cleanupOldRecords() {
  const now = new Date();
  const CLEANUP_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours

  let cleaned = 0;
  notificationQueue.forEach((record, key) => {
    if (now - record.createdAt > CLEANUP_AFTER_MS) {
      notificationQueue.delete(key);
      cleaned++;
    }
  });

  console.log(`[Notification] Cleaned up ${cleaned} old records`);
  return cleaned;
}

/**
 * Send walk-in application notification (Admin-submitted application)
 * Notifies the operator via email or phone that their application was submitted
 */
async function sendWalkInApplicationNotification(application) {
  try {
    console.log('[Notification] Sending walk-in application notification:', {
      operatorName: application.operatorName,
      email: application.operatorEmail,
      phone: application.operatorContactNumber,
      hasOR: !!application.officialReceiptNumber
    });

    const operatorName = application.operatorName || 'Valued Operator';
    const operatorEmail = application.operatorEmail;
    const operatorContactNumber = application.operatorContactNumber;
    const orNumber = application.officialReceiptNumber || 'Not yet provided';
    
    const results = {
      sms: null,
      email: null,
      method: null
    };

    // Try email first if available
    if (operatorEmail) {
      try {
        const emailText = `Dear ${operatorName},

Your franchise application has been successfully submitted through our office.

Application Details:
- Operator Name: ${operatorName}
- MV Plate: ${application.mvPlateNo || 'N/A'}
- Official Receipt Number: ${orNumber}
- Status: Pending Review

${application.officialReceiptNumber ? 'Your OR has been recorded. ' : 'Please submit your Official Receipt (OR) as soon as possible. '}You will be notified of any updates via ${operatorEmail ? 'email' : 'phone'}.

For inquiries, please visit our office or contact us.

Thank you,
TRC-V Management`;

        results.email = await emailService.sendEmail(
          operatorEmail,
          'Franchise Application Submitted - Walk-in',
          emailText
        );
        results.method = 'email';
        console.log('[Notification] Walk-in email sent successfully');
      } catch (emailError) {
        console.error('[Notification] Walk-in email error:', emailError);
        results.email = { success: false, error: emailError.message };
      }
    }

    // Send SMS if phone number is available (as backup or primary if no email)
    if (operatorContactNumber && (!operatorEmail || !results.email?.success)) {
      try {
        const smsMessage = `Dear ${operatorName}, your franchise application has been submitted. ${application.officialReceiptNumber ? `OR: ${orNumber}. ` : ''}Status: Pending Review. You will be notified of updates. - TRC-V`;
        
        results.sms = await smsService.sendSMS(operatorContactNumber, smsMessage);
        if (!results.method) results.method = 'sms';
        console.log('[Notification] Walk-in SMS sent successfully');
      } catch (smsError) {
        console.error('[Notification] Walk-in SMS error:', smsError);
        results.sms = { success: false, error: smsError.message };
      }
    }

    return results;
  } catch (error) {
    console.error('[Notification] Walk-in notification error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendOTPNotification,
  sendFranchiseExpiryNotification,
  sendBPLOApprovalNotification,
  sendSBApprovalNotification,
  sendWalkInApplicationNotification,
  getNotificationStats,
  cleanupOldRecords,
  NOTIFICATION_RULES
};
