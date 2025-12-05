import React from 'react';
import { Dialog, DialogContent, Box, Typography, IconButton, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const TermsAndConditionsModal = ({ open, onClose, onAgree, onDecline }) => {
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
            Terms & Conditions
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
                mb: 3
              }}
            >
              By signing up and creating an account on sangguniangbayan.solano.gov.ph, you agree to the following terms and conditions. These terms apply to all users who access, register, and engage with our website.
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
              1. Account Registration
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
              <strong>1.1</strong> You must provide accurate and complete information during the registration process.
              <br /><br />
              <strong>1.2</strong> You are responsible for maintaining the confidentiality of your account login credentials.
              <br /><br />
              <strong>1.3</strong> You must be at least 18 years old to create an account on our website. If you are under 18, you must have parental or guardian consent.
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
              2. Use of the Website
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
              <strong>2.1</strong> Your account grants you access to the community updates, news, and services provided by the municipality.
              <br /><br />
              <strong>2.2</strong> You agree to use the website in a manner that is lawful and respectful.
              <br /><br />
              <strong>2.3</strong> You are prohibited from sharing false or misleading information.
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
              3. Privacy and Data Protection
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
              <strong>3.1</strong> We respect your privacy and are committed to protecting your personal data. Please review our Privacy Policy for detailed information on how your data is collected, used, and stored.
              <br /><br />
              <strong>3.2</strong> By registering, you consent to our use of your personal data in accordance with applicable data protection laws.
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
              4. Termination of Account
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
              <strong>4.1</strong> We reserve the right to terminate or suspend your account at any time if we believe you have violated these terms or engaged in unlawful activities.
              <br /><br />
              <strong>4.2</strong> You may terminate your account at any time by contacting our support team or using the account settings.
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
              5. Changes to Terms
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
              <strong>5.1</strong> We reserve the right to modify these terms at any time.
              <br /><br />
              <strong>5.2</strong> If significant changes are made, we will notify users via email or through an announcement on our website. Continued use of the website after changes implies acceptance of the updated terms.
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
              6. Limitation of Liability
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
              <strong>6.1</strong> The website and its content are provided "as is" without any warranties or guarantees.
              <br /><br />
              <strong>6.2</strong> We are not responsible for any direct or indirect damages resulting from the use of the website or from the inability to access it.
            </Typography>
          </Box>
        </Box>

        {/* Footer with Agree Button */}
        <Box sx={{
          width: '100%',
          p: 2,
          backgroundColor: '#f8f9fa',
          borderTop: '1px solid #e0e0e0',
          borderRadius: '0 0 16px 16px',
          display: 'flex',
          gap: 1,
          justifyContent: 'flex-end',
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
                backgroundColor: '#f0f0f0',
                borderColor: '#1B4B75'
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

export default TermsAndConditionsModal;
