
import React from "react";
import { Box, Typography, Button, Paper, Grid, Avatar, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import PersonIcon from '@mui/icons-material/Person';

const RoundedNav = styled(Box)(({ theme }) => ({
  background: '#fff',
  borderRadius: 40,
  boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
  display: 'flex',
  alignItems: 'center',
  padding: '8px 32px',
  gap: 32,
  maxWidth: 500,
  margin: '0 auto',
}));

const FranchisePaper = styled(Paper)(({ theme }) => ({
  borderRadius: 16,
  padding: theme.spacing(3),
  background: '#fff',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
}));

const InfoTextField = styled(TextField)({
  '& .MuiInputBase-input': {
    background: '#f7f7f7',
    borderRadius: 4,
    fontWeight: 500,
    fontSize: '1rem',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#bbb',
  },
});

const IDBox = styled(Box)({
  background: '#ffe600',
  color: '#0a3576',
  fontWeight: 'bold',
  borderRadius: 8,
  padding: '8px 24px',
  fontSize: '1.1rem',
  position: 'absolute',
  right: 32,
  top: 32,
  zIndex: 2,
});

const ProfileAvatar = styled(Avatar)({
  width: 120,
  height: 120,
  marginBottom: 8,
  boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
});

const SealImg = styled('img')({
  width: 180,
  height: 'auto',
  borderRadius: 16,
  boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
});

const BgBlue = styled(Box)({
  background: '#0a3576',
  width: '100vw',
  minHeight: 340,
  position: 'relative',
  padding: '40px 0 0 0',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
});

const MainContent = styled(Box)({
  display: 'flex',
  gap: 32,
  marginTop: 24,
  padding: '0 32px',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  width: '100vw',
  marginLeft: 0,
  marginRight: 0,
  boxSizing: 'border-box',
});

const FranchiseDivider = styled('hr')({
  border: 'none',
  borderTop: '2px solid #222',
  margin: '8px 0 16px 0',
});

const FranchiseLabel = styled(Typography)({
  fontWeight: 700,
  color: '#0a3576',
  fontSize: '1.1rem',
  marginBottom: 8,
});

const FranchiseSection = styled(Box)({
  marginBottom: 24,
});

const InfoRow = styled(Box)({
  display: 'flex',
  gap: 24,
  marginBottom: 12,
});

const InfoCol = styled(Box)({
  flex: 1,
});

const ProfileDetails = styled(Box)({
  marginLeft: 24,
  marginTop: 8,
});

const ActiveBtn = styled(Button)({
  background: '#2ecc71',
  color: '#fff',
  fontWeight: 700,
  borderRadius: 8,
  marginTop: 8,
  padding: '8px 24px',
  '&:hover': {
    background: '#27ae60',
  },
});

function DriverId() {
  return (
    <Box sx={{ minHeight: '100vh', width: '100%', maxWidth: '100vw', bgcolor: '#f5f7fa', overflowX: 'hidden' }}>
      <BgBlue sx={{ width: '100vw', overflowX: 'hidden' }}>
        <Box sx={{ width: '100vw', px: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <img src="/public/Logos/TRC-vLogo.png" alt="TRC-V Logo" style={{ height: 40 }} />
            <Box sx={{ color: '#ffe600', fontWeight: 700, fontSize: 28, ml: 2, letterSpacing: 2 }}>TRC-V</Box>
            <Typography sx={{ color: '#fff', fontWeight: 400, fontSize: 14, ml: 1 }}>TRICYCLE VERIFICATION SYSTEM</Typography>
          </Box>
          <RoundedNav>
            <Typography sx={{ color: '#222', fontWeight: 700, fontSize: 18 }}>HOME</Typography>
            <Typography sx={{ color: '#222', fontWeight: 700, fontSize: 18 }}>MY FRANCHISE</Typography>
            <Button startIcon={<PersonIcon />} sx={{ bgcolor: '#0a3576', color: '#fff', borderRadius: 40, px: 3, fontWeight: 700, boxShadow: 2, textTransform: 'none' }}>MARLA</Button>
          </RoundedNav>
        </Box>
  <Box sx={{ position: 'relative', width: '100vw', mt: 4, display: 'flex', alignItems: 'flex-start' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 180 }}>
            <ProfileAvatar src="/public/Logos/clipboard.gif" alt="Profile" sx={{ border: '6px solid #fff', mb: 2 }} />
          </Box>
          <Box sx={{ ml: 4, pt: 2, flex: 1 }}>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>MARLA RIHANA V. JOSE</Typography>
            <Typography sx={{ color: '#fff', fontWeight: 500, fontSize: 16 }}>#72 Baccara St. Brgy. Quezon, Solano Nueva Vizcaya</Typography>
            <Typography sx={{ color: '#fff', fontWeight: 500, fontSize: 16 }}>SINGLE | NO CO-OWNER</Typography>
            <ActiveBtn variant="contained">ACTIVE FRANCHISE</ActiveBtn>
          </Box>
          <IDBox sx={{ position: 'absolute', right: 0, top: 0 }}>ID NO: 02612</IDBox>
        </Box>
      </BgBlue>
      <MainContent>
        <FranchisePaper sx={{ flex: 2, position: 'relative', minWidth: 420, maxWidth: 800 }}>
          <FranchiseSection>
            <FranchiseLabel>MOTORIZED TRICYCLE OPERATORS FRANCHISE</FranchiseLabel>
            <FranchiseDivider />
            <InfoRow>
              <InfoCol>
                <Typography sx={{ fontWeight: 500, mb: 1 }}>OR NUMBER</Typography>
                <InfoTextField value="716731" size="small" fullWidth InputProps={{ readOnly: true }} />
              </InfoCol>
              <InfoCol>
                <Typography sx={{ fontWeight: 500, mb: 1 }}>FRANCHISE NUMBER</Typography>
                <InfoTextField value="81737" size="small" fullWidth InputProps={{ readOnly: true }} />
              </InfoCol>
            </InfoRow>
            <InfoRow>
              <InfoCol>
                <Typography sx={{ fontWeight: 500, mb: 1 }}>DATE APPROVED</Typography>
                <InfoTextField value="09/10/2025" size="small" fullWidth InputProps={{ readOnly: true }} />
              </InfoCol>
              <InfoCol>
                <Typography sx={{ fontWeight: 500, mb: 1 }}>EXPIRY DATE</Typography>
                <InfoTextField value="09/10/2029" size="small" fullWidth InputProps={{ readOnly: true }} />
              </InfoCol>
            </InfoRow>
          </FranchiseSection>
          <FranchiseSection>
            <FranchiseLabel>MOTORCYCLE INFORMATION</FranchiseLabel>
            <FranchiseDivider />
            <InfoRow>
              <InfoCol>
                <Typography sx={{ fontWeight: 500, mb: 1 }}>MAKE</Typography>
                <InfoTextField value="Skygo" size="small" fullWidth InputProps={{ readOnly: true }} />
              </InfoCol>
              <InfoCol>
                <Typography sx={{ fontWeight: 500, mb: 1 }}>SIDECAR NUMBER</Typography>
                <InfoTextField value="81737" size="small" fullWidth InputProps={{ readOnly: true }} />
              </InfoCol>
              <InfoCol>
                <Typography sx={{ fontWeight: 500, mb: 1 }}>PLATE NUMBER</Typography>
                <InfoTextField value="090703" size="small" fullWidth InputProps={{ readOnly: true }} />
              </InfoCol>
            </InfoRow>
            <InfoRow>
              <InfoCol>
                <Typography sx={{ fontWeight: 500, mb: 1 }}>CHASSIS NUMBER</Typography>
                <InfoTextField value="L8KS5JB5N8D" size="small" fullWidth InputProps={{ readOnly: true }} />
              </InfoCol>
              <InfoCol>
                <Typography sx={{ fontWeight: 500, mb: 1 }}>MOTOR NUMBER</Typography>
                <InfoTextField value="125G506767578" size="small" fullWidth InputProps={{ readOnly: true }} />
              </InfoCol>
            </InfoRow>
          </FranchiseSection>
        </FranchisePaper>
  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 220, maxWidth: 320 }}>
          <SealImg src="/public/Logos/SBLogo.png" alt="Municipal Seal" />
        </Box>
      </MainContent>
    </Box>
  );
}

export default DriverId;
