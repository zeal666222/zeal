// Check AIConsultant table schema
import { createClient } from '@supabase/supabase-js';

// Credentials come from the environment only. A service-role key was once
// hardcoded here and got committed — it must be rotated in the Supabase
// dashboard, and it must never be re-added to a tracked file.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://zyrunsnweznyrhuroduo.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set. Export it in your shell; do not commit it.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  console.log('Checking AIConsultant table schema...\n');

  const { data, error } = await supabase
    .from('AIConsultant')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log('Sample row keys:', Object.keys(data[0]));
    console.log('\nFirst consultant:', JSON.stringify(data[0], null, 2));
  } else {
    console.log('No rows found');
  }
}

checkSchema().catch(console.error);
