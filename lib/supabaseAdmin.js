import { createClient } from '@supabase/supabase-js';

// The "export" keyword here is what fixes the error
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);