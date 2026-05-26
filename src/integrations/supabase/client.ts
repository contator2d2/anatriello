// This file is unused as we use the external PostgreSQL API via src/lib/api.ts
// We keep it as a stub to avoid build errors if there are lingering imports
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  from: () => ({
    select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }),
    insert: () => Promise.resolve({ data: null, error: null }),
  }),
};
