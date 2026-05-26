import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Create a local client for logging to avoid circular dependencies or early initialization issues
const logClient = (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogData {
  message: string;
  level?: LogLevel;
  context?: any;
  stack_trace?: string;
}

export const logger = {
  async log({ message, level = 'info', context = {}, stack_trace }: LogData) {
    try {
      // Get user info from localStorage if available (promotor specific)
      const employeeRaw = localStorage.getItem('promotor_employee');
      const employee = employeeRaw ? JSON.parse(employeeRaw) : null;
      
      const { data: { session } } = await supabase.auth.getSession();
      
      const deviceInfo = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: (navigator as any).platform,
        vendor: navigator.vendor,
        screen: `${window.screen.width}x${window.screen.height}`,
      };

      await supabase.from('app_logs').insert({
        level,
        message,
        context: {
          ...context,
          isOnline: navigator.onLine,
        },
        user_id: session?.user?.id || null,
        user_email: session?.user?.email || employee?.email || null,
        page_url: window.location.href,
        device_info: deviceInfo,
        stack_trace: stack_trace || (level === 'error' || level === 'fatal' ? new Error().stack : undefined),
      });

      // Also log to console for development
      const consoleMethod = level === 'fatal' ? 'error' : (level as any);
      if (console[consoleMethod]) {
        console[consoleMethod](`[${level.toUpperCase()}] ${message}`, context);
      }
    } catch (err) {
      console.error('Failed to send log to server:', err);
    }
  },

  debug(message: string, context?: any) {
    return this.log({ message, level: 'debug', context });
  },

  info(message: string, context?: any) {
    return this.log({ message, level: 'info', context });
  },

  warn(message: string, context?: any) {
    return this.log({ message, level: 'warn', context });
  },

  error(message: string, context?: any, error?: Error) {
    return this.log({ 
      message, 
      level: 'error', 
      context, 
      stack_trace: error?.stack 
    });
  },

  fatal(message: string, context?: any, error?: Error) {
    return this.log({ 
      message, 
      level: 'fatal', 
      context, 
      stack_trace: error?.stack 
    });
  }
};
