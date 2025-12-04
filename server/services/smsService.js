/**
 * SMS Service using iProg SMS Gateway
 * Handles sending SMS for OTP, notifications, and alerts
 * Non-blocking: Errors are logged but don't crash the server
 */

const axios = require('axios');

/**
 * Send SMS via iProg SMS Gateway
 * @param {string} phoneNumber - Recipient phone number (format: 09123456789 or +639123456789)
 * @param {string} message - SMS message content
 * @returns {Promise<Object>} Response from iProg API or error object
 */
async function sendSMS(phoneNumber, message) {
  try {
    // Validate inputs
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      throw new Error('Invalid phone number');
    }
    if (!message || typeof message !== 'string') {
      throw new Error('Invalid message');
    }

    const apiToken = process.env.IPROG_Token;
    if (!apiToken) {
      throw new Error('IPROG_Token not configured in environment variables');
    }

    // Normalize phone number (handle both formats: 09123456789 and +639123456789)
    let normalizedPhone = phoneNumber.trim();
    if (normalizedPhone.startsWith('09')) {
      // Convert 09 to 639 format
      normalizedPhone = '63' + normalizedPhone.substring(1);
    } else if (normalizedPhone.startsWith('+63')) {
      // Already in +639 format, remove +
      normalizedPhone = normalizedPhone.substring(1);
    } else if (!normalizedPhone.startsWith('63')) {
      // Assume it's just the digits without country code
      throw new Error('Phone number must start with 09 or 63');
    }

    // Truncate message to 160 characters for SMS
    const truncatedMessage = message.substring(0, 160);

    // Build URL with query parameters as per iPROG API documentation
    const url = new URL('https://www.iprogsms.com/api/v1/sms_messages');
    url.searchParams.append('api_token', apiToken);
    url.searchParams.append('phone_number', normalizedPhone);
    url.searchParams.append('message', truncatedMessage);

    const response = await axios.post(
      url.toString(),
      {},
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );
    return {
      success: true,
      messageId: response.data?.message_id || 'iprog-sms',
      status: response.data?.status,
      data: response.data
    };
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
    console.error(`[SMS] Error sending SMS:`, errorMessage);

    return {
      success: false,
      error: errorMessage,
      statusCode: error.response?.status || 500
    };
  }
}

/**
 * Send OTP via SMS
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} otp - OTP code (4-14 digits)
 * @returns {Promise<Object>} Send result (success/failure with details)
 */
async function sendOTPSMS(phoneNumber, otp) {
  try {
    if (!phoneNumber) {
      throw new Error('Phone number is required for OTP SMS');
    }
    if (!/^\d{4,14}$/.test(String(otp).trim())) {
      throw new Error('Invalid OTP format');
    }

    const message = `Your TRC-V Verification Code is: ${otp}. It will expire in 5 minutes. Do not share this code with anyone.`;

    const result = await sendSMS(phoneNumber, message);
    
    if (result.success) {
      console.log(`[SMS] OTP sent successfully to ${phoneNumber}`);
    } else {
      console.warn(`[SMS] OTP failed for ${phoneNumber}: ${result.error}`);
    }
    
    return result;
  } catch (error) {
    console.error(`[SMS] OTP Error:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send BPLO Approval Notification
 * @param {string} phoneNumber - Operator's phone number
 * @param {string} operatorName - Operator's name
 * @param {string} franchiseNumber - Franchise number
 * @returns {Promise<Object>} Send result
 */
async function sendBPLOApprovalSMS(phoneNumber, operatorName, franchiseNumber) {
  try {
    if (!phoneNumber || !operatorName || !franchiseNumber) {
      throw new Error('Missing required parameters for BPLO approval SMS');
    }

    const message = `Hi ${operatorName}, your franchise application (${franchiseNumber}) has been APPROVED by BPLO. Please proceed to submit your Official Receipt (OR) to finalize the process.`;

    console.log(`[SMS Service] Sending BPLO approval notification to ${phoneNumber}`);
    const result = await sendSMS(phoneNumber, message);

    if (result.success) {
      console.log(`[SMS Service] BPLO approval SMS sent to ${phoneNumber}`);
    } else {
      console.warn(`[SMS] BPLO approval SMS failed`);
    }

    return result;
  } catch (error) {
    console.error(`[SMS] BPLO Error:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send SB Approval Notification
 * @param {string} phoneNumber - Operator's phone number
 * @param {string} operatorName - Operator's name
 * @param {string} franchiseNumber - Franchise number
 * @param {string} resolutionNumber - SB Resolution number
 * @returns {Promise<Object>} Send result
 */
async function sendSBApprovalSMS(phoneNumber, operatorName, franchiseNumber, resolutionNumber) {
  try {
    if (!phoneNumber || !operatorName || !franchiseNumber) {
      throw new Error('Missing required parameters for SB approval SMS');
    }

    const message = `Congratulations ${operatorName}! Your franchise (${franchiseNumber}) has been APPROVED by SB (Resolution: ${resolutionNumber}). You can now claim your certificate.`;

    console.log(`[SMS Service] Sending SB approval notification to ${phoneNumber}`);
    const result = await sendSMS(phoneNumber, message);

    if (result.success) {
      console.log(`[SMS Service] SB approval SMS sent to ${phoneNumber}`);
    } else {
      console.warn(`[SMS] SB approval SMS failed`);
    }

    return result;
  } catch (error) {
    console.error(`[SMS] SB Error:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send Franchise Expiry Reminder SMS
 * @param {string} phoneNumber - Operator's phone number
 * @param {string} operatorName - Operator's name
 * @param {string} franchiseNumber - Franchise number
 * @param {number} daysUntilExpiry - Days until expiry
 * @returns {Promise<Object>} Send result
 */
async function sendFranchiseExpirySMS(phoneNumber, operatorName, franchiseNumber, daysUntilExpiry) {
  try {
    if (!phoneNumber || !operatorName || !franchiseNumber || daysUntilExpiry === undefined) {
      throw new Error('Missing required parameters for expiry SMS');
    }

    let message;
    if (daysUntilExpiry === 0) {
      message = `URGENT: ${operatorName}, your franchise (${franchiseNumber}) has EXPIRED today! Visit your TODA office immediately to renew.`;
    } else if (daysUntilExpiry <= 7) {
      message = `ALERT: ${operatorName}, your franchise (${franchiseNumber}) expires in ${daysUntilExpiry} days! Renew now at your TODA office.`;
    } else {
      message = `REMINDER: ${operatorName}, your franchise (${franchiseNumber}) expires in ${daysUntilExpiry} days. Please plan to renew soon.`;
    }

    console.log(`[SMS Service] Sending expiry reminder to ${phoneNumber}`);
    const result = await sendSMS(phoneNumber, message);

    if (result.success) {
      console.log(`[SMS Service] Expiry SMS sent to ${phoneNumber}`);
    } else {
      console.warn(`[SMS Service] Expiry SMS failed for ${phoneNumber}: ${result.error}`);
    }

    return result;
  } catch (error) {
    console.error(`[SMS Service] Error in sendFranchiseExpirySMS:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send Custom SMS Message
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} customMessage - Custom message to send
 * @returns {Promise<Object>} Send result
 */
async function sendCustomSMS(phoneNumber, customMessage) {
  try {
    if (!phoneNumber || !customMessage) {
      throw new Error('Phone number and message are required');
    }

    console.log(`[SMS Service] Sending custom SMS to ${phoneNumber}`);
    const result = await sendSMS(phoneNumber, customMessage);

    if (result.success) {
      console.log(`[SMS Service] Custom SMS sent to ${phoneNumber}`);
    } else {
      console.warn(`[SMS Service] Custom SMS failed for ${phoneNumber}: ${result.error}`);
    }

    return result;
  } catch (error) {
    console.error(`[SMS Service] Error in sendCustomSMS:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  sendSMS,
  sendOTPSMS,
  sendBPLOApprovalSMS,
  sendSBApprovalSMS,
  sendFranchiseExpirySMS,
  sendCustomSMS
};
