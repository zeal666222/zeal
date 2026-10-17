// Check AIConsultant table schema
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zyrunsnweznyrhuroduo.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5cnVuc253ZXpueXJodXJvZHVvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQ5NzYwOCwiZXhwIjoyMTAzMDczNjA4fQ.b5rggzXRCyLeH9HP_-J_IbM4mMpCou6Rk9i0qU-ztiU';

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
