// Add location and country columns to AIConsultant table
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zyrunsnweznyrhuroduo.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5cnVuc253ZXpueXJodXJvZHVvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQ5NzYwOCwiZXhwIjoyMTAzMDczNjA4fQ.b5rggzXRCyLeH9HP_-J_IbM4mMpCou6Rk9i0qU-ztiU';

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
