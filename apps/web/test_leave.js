import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*, profiles(full_name)')
    .limit(1);
  console.log('Test 1 (with profiles) Error:', error?.message);
  
  const { data: data2, error: error2 } = await supabase
    .from('leave_requests')
    .select('*')
    .limit(1);
  console.log('Test 2 (no profiles) Error:', error2?.message);
  console.log('Test 2 Data:', data2);
}
test();
