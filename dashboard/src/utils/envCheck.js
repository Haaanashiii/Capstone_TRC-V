/**
 * Environment Variables Diagnostic
 * This file helps debug environment variable loading issues
 */

import logger from './logger';

export const checkEnvVariables = () => {
  const envVars = {
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    VITE_CLIENT_REDIRECT: import.meta.env.VITE_CLIENT_REDIRECT,
    NODE_ENV: import.meta.env.NODE_ENV,
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
  };

  logger.log('🔍 Environment Variables Check');
  logger.log('Current Environment:', import.meta.env.MODE);
  logger.log('Is Development?', import.meta.env.DEV);
  logger.log('Is Production?', import.meta.env.PROD);
  logger.log('---');
  Object.entries(envVars).forEach(([key, value]) => {
    const status = value ? '✅' : '❌';
    logger.log(`${status} ${key}:`, value || 'UNDEFINED');
  });

  return envVars;
};

// Auto-run check in development mode
if (import.meta.env.DEV) {
  checkEnvVariables();
}
