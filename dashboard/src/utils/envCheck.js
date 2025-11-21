/**
 * Environment Variables Diagnostic
 * This file helps debug environment variable loading issues
 */

export const checkEnvVariables = () => {
  const envVars = {
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    VITE_CLIENT_REDIRECT: import.meta.env.VITE_CLIENT_REDIRECT,
    NODE_ENV: import.meta.env.NODE_ENV,
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
  };

  console.group('🔍 Environment Variables Check');
  console.log('Current Environment:', import.meta.env.MODE);
  console.log('Is Development?', import.meta.env.DEV);
  console.log('Is Production?', import.meta.env.PROD);
  console.log('---');
  Object.entries(envVars).forEach(([key, value]) => {
    const status = value ? '✅' : '❌';
    console.log(`${status} ${key}:`, value || 'UNDEFINED');
  });
  console.groupEnd();

  return envVars;
};

// Auto-run check in development mode
if (import.meta.env.DEV) {
  checkEnvVariables();
}
