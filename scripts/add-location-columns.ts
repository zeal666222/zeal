// Add location and country columns to AIConsultant table
import { createClient } from '@supabase/supabase-js';

// Service-role key comes from the environment; it must never be committed.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://zyrunsnweznyrhuroduo.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set. Export it in your shell; do not commit it.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addColumns() {
  console.log('Adding location and country columns to AIConsultant...');

  // Use RPC to run raw SQL (requires a custom function)
  // Alternative: use the management API
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE "AIConsultant" ADD COLUMN IF NOT EXISTS location text, ADD COLUMN IF NOT EXISTS country text;`
  });

  if (error) {
    console.error('Failed:', error.message);
    console.log('\nTrying alternative approach via management API...');

    // Try direct table update to trigger schema refresh
    const { error: updateError } = await supabase
      .from('AIConsultant')
      .select('id')
      .limit(1);

    if (updateError) {
      console.error('Table access error:', updateError.message);
    } else {
      console.log('Table is accessible. Columns may need to be added via Supabase dashboard.');
    }
  } else {
    console.log('✓ Columns added successfully');
  }
}

addColumns().catch(console.error);
