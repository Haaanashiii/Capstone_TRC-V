import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Snackbar, Button, Alert } from '@mui/material';

function PWAUpdatePrompt() {
  const [showReload, setShowReload] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error) {
      console.log('SW registration error:', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      setShowReload(true);
    }
  }, [needRefresh]);

  const handleUpdate = () => {
    updateServiceWorker(true);
    setShowReload(false);
  };

  const handleClose = () => {
    setNeedRefresh(false);
    setShowReload(false);
  };

  return (
    <Snackbar
      open={showReload}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity="info"
        sx={{ width: '100%' }}
        action={
          <>
            <Button color="inherit" size="small" onClick={handleClose}>
              Later
            </Button>
            <Button color="primary" size="small" onClick={handleUpdate}>
              Update Now
            </Button>
          </>
        }
      >
        A new version is available!
      </Alert>
    </Snackbar>
  );
}

export default PWAUpdatePrompt;
