import { api } from "@/lib/api";

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
      // Also log to console for development immediately
      const consoleMethod = level === 'fatal' ? 'error' : (level as any);
      if (console[consoleMethod]) {
        console[consoleMethod](`[${level.toUpperCase()}] ${message}`, context);
      }

      // Get user info from localStorage if available (promotor specific)
      const employeeRaw = localStorage.getItem('promotor_employee');
      const employee = employeeRaw ? JSON.parse(employeeRaw) : null;
      
      const deviceInfo = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: (navigator as any).platform,
        vendor: navigator.vendor,
        screen: `${window.screen.width}x${window.screen.height}`,
      };

      // Send log to our PostgreSQL API instead of Supabase
      await api('/api/app-logs', {
        method: 'POST',
        body: {
          level,
          message,
          context: {
            ...context,
            isOnline: navigator.onLine,
          },
          user_email: employee?.email || null,
          page_url: window.location.href,
          device_info: deviceInfo,
          stack_trace: stack_trace || (level === 'error' || level === 'fatal' ? new Error().stack : undefined),
        },
        silent: true // Don't show toast for logs
      }).catch(err => {
        // Silent fail for logger to avoid infinite loops or blocking UI
        console.warn('[logger] could not send to server', err);
      });

    } catch (err) {
      console.error('Failed to process log:', err);
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
