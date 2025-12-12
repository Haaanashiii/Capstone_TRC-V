/**
 * Production-Safe Logger for CAPSTONE_TRC-V
 * Only logs in development mode - completely silent in production
 * 
 * This prevents sensitive debugging information from being exposed
 * to end users in browser console.
 */

// Check if we're in development mode
const isDev = import.meta.env.DEV || 
              import.meta.env.MODE === 'development' ||
              (typeof window !== 'undefined' && 
               (window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1'));

// Noop function for production
const noop = () => {};

/**
 * Development-only logger
 * All methods are no-ops in production
 */
const logger = {
  /**
   * Log informational messages (development only)
   */
  log: isDev ? console.log.bind(console) : noop,
  
  /**
   * Log warning messages (development only)
   */
  warn: isDev ? console.warn.bind(console) : noop,
  
  /**
   * Log error messages (development only)
   * Note: In some cases you may want errors to log in production
   * for debugging. Use logger.error for dev-only, console.error for always.
   */
  error: isDev ? console.error.bind(console) : noop,
  
  /**
   * Log info messages (development only)
   */
  info: isDev ? console.info.bind(console) : noop,
  
  /**
   * Log debug messages (development only)
   */
  debug: isDev ? console.debug.bind(console) : noop,
  
  /**
   * Group logs (development only)
   */
  group: isDev ? console.group.bind(console) : noop,
  groupEnd: isDev ? console.groupEnd.bind(console) : noop,
  groupCollapsed: isDev ? console.groupCollapsed.bind(console) : noop,
  
  /**
   * Table display (development only)
   */
  table: isDev ? console.table.bind(console) : noop,
  
  /**
   * Time tracking (development only)
   */
  time: isDev ? console.time.bind(console) : noop,
  timeEnd: isDev ? console.timeEnd.bind(console) : noop,
  
  /**
   * Check if in development mode
   */
  isDev,
  
  /**
   * Force log even in production (use sparingly for critical errors)
   * This bypasses the development check
   */
  force: {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
  }
};

export default logger;

// Named export of the logger object itself
export { logger };

// Named exports for convenience
export const log = logger.log;
export const warn = logger.warn;
export const error = logger.error;
export const info = logger.info;
export const debug = logger.debug;
