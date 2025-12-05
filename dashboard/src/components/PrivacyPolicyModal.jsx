import React from 'react';
import { Dialog, DialogContent, Box, Typography, IconButton, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const PrivacyPolicyModal = ({ open, onClose, onAgree, onDecline }) => {
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          boxShadow: '0 12px 48px rgba(0,0,0,0.25)',
          backgroundColor: '#f8f9fa'
        }
      }}
    >
      <DialogContent 
        sx={{
          position: 'relative',
          p: 0,
          backgroundColor: '#f8f9fa',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflow: 'hidden'
        }}
      >
        {/* Header Section */}
        <Box sx={{ 
          width: '100%',
          background: 'linear-gradient(135deg, #1B4B75 0%, #143c6e 100%)',
          p: 3,
          textAlign: 'center',
          position: 'relative',
          borderRadius: '16px 16px 0 0',
          flexShrink: 0
        }}>
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 'bold', 
              color: '#F4D77E',
              fontFamily: 'Poppins, sans-serif',
              fontSize: { xs: '18px', sm: '22px' }
            }}
          >
            Privacy Policy
          </Typography>
          
          {/* Close Button */}
          <IconButton
            onClick={onClose}
            sx={{
              position: 'absolute',
              right: 12,
              top: 12,
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              color: '#F4D77E',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.25)'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content Container - Scrollable */}
        <Box sx={{ 
          width: '100%',
          p: { xs: 2.5, sm: 3 },
          display: 'flex',
          justifyContent: 'flex-start',
          backgroundColor: '#fff',
          borderRadius: '0 0 16px 16px',
          overflowY: 'auto',
          overflowX: 'hidden',
          flex: 1,
          '&::-webkit-scrollbar': {
            width: '8px'
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f1f1'
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#1B4B75',
            borderRadius: '4px'
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: '#143c6e'
          }
        }}>
          <Box sx={{ width: '100%' }}>
            <Typography 
              sx={{ 
                fontFamily: 'Poppins, sans-serif',
                fontSize: '14px',
                lineHeight: 1.8,
                color: '#333',
                mb: 1
              }}
            >
              At sangguniangbayan.solano.gov.ph, we value your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you sign up and use our website.
            </Typography>

            <Typography 
              sx={{ 
                fontFamily: 'Poppins, sans-serif',
                fontSize: '14px',
                lineHeight: 1.8,
                color: '#333',
                mb: 3
              }}
            >
              By signing up and using our website, you agree to the terms of this Privacy Policy.
            </Typography>

            {/* Section 1 */}
            <Typography 
              variant="h6"
              sx={{ 
                fontFamily: 'Poppins, sans-serif',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#1B4B75',
                mt: 3,
                mb: 1.5
              }}
            >
              1. Information We Collect
            </Typography>
            <Typography 
              sx={{ 
                fontFamily: 'Poppins, sans-serif',
                fontSize: '14px',
                lineHeight: 1.8,
                color: '#333',
                ml: 1,
                mb: 2
              }}
            >
              <strong>1.1 Personal Information</strong> When you sign up, we collect the personal information you provide, such as:
              <br />• Full Name
              <br />• Email Address
              <br />• Contact Information (e.g., phone number)
              <br />• Address (if required for specific services)
              <br /><br />
              <strong>1.2 Automatic Data Collection</strong><br />
              When you interact with our website, we automatically collect certain information through cookies, log files, and similar technologies. This includes:
              <br />• IP Address
              <br />• Browser Type
              <br />• Device Information
              <br />• Pages Visited and Time Spent on the Site
            </Typography>

            {/* Section 2 */}
            <Typography 
              variant="h6"
              sx={{ 
                fontFamily: 'Poppins, sans-serif',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#1B4B75',
                mt: 3,
                mb: 1.5
              }}
            >
              2. How We Use Your Information
            </Typography>
            <Typography 
              sx={{ 
                fontFamily: 'Poppins, sans-serif',
                fontSize: '14px',
                lineHeight: 1.8,
                color: '#333',
                ml: 1,
                mb: 2
              }}
            >
              We may use the information we collect from you in the following ways:
              <br /><br />
              <strong>2.1</strong> To create and manage your account.
              <br /><strong>2.2</strong> To provide you with updates, services, and notifications related to the municipality.
              <br /><strong>2.3</strong> To respond to your inquiries or support requests.
              <br /><strong>2.4</strong> To improve the functionality and content of our website.
              <br /><strong>2.5</strong> To ensure compliance with our Terms and Conditions.
            </Typography>

            {/* Section 3 */}
            <Typography 
              variant="h6"
              sx={{ 
                fontFamily: 'Poppins, sans-serif',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#1B4B75',
                mt: 3,
                mb: 1.5
              }}
            >
              3. Sharing Your Information
            </Typography>
            <Typography 
              sx={{ 
                fontFamily: 'Poppins, sans-serif',
                fontSize: '14px',
                lineHeight: 1.8,
                color: '#333',
                ml: 1,
                mb: 2
              }}
            >
              <strong>3.1 Third-Party Service Providers</strong><br />
              We may share your data with trusted third-party service providers who help us operate our website (e.g., hosting services, analytics providers). These third parties are bound by confidentiality agreements and may not use your data for any other purposes.
              <br /><br />
              <strong>3.2 Legal Requirements</strong><br />
              We may disclose your personal information if required to do so by law, or in response to valid requests by public authorities (e.g., court orders or government regulations).
            </Typography>

            {/* Section 4 */}
            <Typography 
              variant="h6"
              sx={{ 
                fontFamily: 'Poppins, sans-serif',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#1B4B75',
                mt: 3,
                mb: 1.5
              }}
            >
              4. Cookies and Tracking Technologies
            </Typography>
            <Typography 
              sx={{ 
                fontFamily: 'Poppins, sans-serif',
                fontSize: '14px',
                lineHeight: 1.8,
                color: '#333',
                ml: 1,
                mb: 2
              }}
            >
              <strong>4.1 Cookies</strong><br />
              We use cookies to track how users navigate the site and to enhance your user experience. You can modify your browser settings to refuse cookies, but this may affect your ability to use some features of our website.
              <br /><br />
              <strong>4.2 Analytics</strong><br />
              We use third-party analytics tools (e.g., Google Analytics) to understand how visitors use our website. These tools may collect data such as your IP address and browsing behavior.
            </Typography>

            {/* Section 5 */}
            <Typography 
              variant="h6"
              sx={{ 
                fontFamily: 'Poppins, sans-serif',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#1B4B75',
                mt: 3,
                mb: 1.5
              }}
            >
              5. Data Security
            </Typography>
            <Typography 
              sx={{ 
                fontFamily: 'Poppins, sans-serif',
                fontSize: '14px',
                lineHeight: 1.8,
                color: '#333',
                ml: 1,
                mb: 2
              }}
            >
              We take the security of your personal data seriously. We implement reasonable administrative, technical, and physical safeguards to protect your information from unauthorized access, use, or disclosure. However, no internet transmission or storage system is entirely secure. Therefore, while we strive to protect your data, we cannot guarantee its absolute security.
            </Typography>

            {/* Section 6 */}
            <Typography 
              variant="h6"
              sx={{ 
                fontFamily: 'Poppins, sans-serif',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#1B4B75',
                mt: 3,
                mb: 1.5
              }}
            >
              6. Your Data Rights
            </Typography>
            <Typography 
              sx={{ 
                fontFamily: 'Poppins, sans-serif',
                fontSize: '14px',
                lineHeight: 1.8,
                color: '#333',
                ml: 1,
                mb: 2
              }}
            >
              Depending on your location, you may have the following rights regarding your personal information:
              <br /><br />
              <strong>6.1 Access:</strong> You have the right to access the personal data we hold about you.
              <br /><strong>6.2 Correction:</strong> You have the right to request correction of any inaccurate or incomplete data.
              <br /><strong>6.3 Deletion:</strong> You may request that we delete your personal data, subject to any legal obligations we may have to retain it.
              <br /><strong>6.4 Data Portability:</strong> You can request a copy of your data in a machine-readable format.
            </Typography>

            {/* Section 7 */}
            <Typography 
              variant="h6"
              sx={{ 
                fontFamily: 'Poppins, sans-serif',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#1B4B75',
                mt: 3,
                mb: 1.5
              }}
            >
              7. Children's Privacy
            </Typography>
            <Typography 
              sx={{ 
                fontFamily: 'Poppins, sans-serif',
                fontSize: '14px',
                lineHeight: 1.8,
                color: '#333',
                ml: 1,
                mb: 2
              }}
            >
              Our website is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children without parental or guardian consent. If we become aware that we have collected personal data from a child, we will delete it.
            </Typography>

            {/* Section 8 */}
            <Typography 
              variant="h6"
              sx={{ 
                fontFamily: 'Poppins, sans-serif',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#1B4B75',
                mt: 3,
                mb: 1.5
              }}
            >
              8. Changes to This Privacy Policy
            </Typography>
            <Typography 
              sx={{ 
                fontFamily: 'Poppins, sans-serif',
                fontSize: '14px',
                lineHeight: 1.8,
                color: '#333',
                ml: 1,
                mb: 3
              }}
            >
              We reserve the right to update or modify this Privacy Policy at any time. If we make material changes, we will notify you by posting the updated policy on our website and revising the "Effective Date" at the top.
              <br /><br />
              By using our website, you consent to the collection and use of your data in accordance with this Privacy Policy.
            </Typography>
          </Box>
        </Box>

        {/* Footer Section with Action Buttons */}
        <Box sx={{ 
          width: '100%',
          p: 2.5,
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end',
          backgroundColor: '#f8f9fa',
          borderTop: '1px solid #e0e0e0',
          flexShrink: 0
        }}>
          <Button
            onClick={() => {
              onDecline();
              onClose();
            }}
            variant="outlined"
            sx={{
              color: '#1B4B75',
              borderColor: '#1B4B75',
              fontFamily: 'Poppins, sans-serif',
              fontWeight: '600',
              textTransform: 'none',
              '&:hover': {
                backgroundColor: 'rgba(27, 75, 117, 0.05)',
                borderColor: '#143c6e'
              }
            }}
          >
            Decline
          </Button>
          <Button
            onClick={() => {
              onAgree();
              onClose();
            }}
            variant="contained"
            sx={{
              backgroundColor: '#1B4B75',
              color: '#fff',
              fontFamily: 'Poppins, sans-serif',
              fontWeight: '600',
              textTransform: 'none',
              '&:hover': {
                backgroundColor: '#143c6e'
              }
            }}
          >
            I Agree
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default PrivacyPolicyModal;
