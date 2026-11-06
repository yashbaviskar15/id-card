import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debug() {
  console.log('--- Database Check ---');
  
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
  if (pError) console.error('Profiles error:', pError);
  else console.log('Profiles:', profiles);

  const { data: documents, error: dError } = await supabase.from('documents').select('*');
  if (dError) console.error('Documents error:', dError);
  else console.log('Documents:', documents);

  console.log('--- Storage Check ---');
  if (profiles && profiles.length > 0) {
    for (const p of profiles) {
      if (p.photo_path) {
        console.log(`Checking photo path: ${p.photo_path}`);
        const { data, error } = await supabase.storage.from('documents').createSignedUrl(p.photo_path, 60);
        if (error) console.error(`Signed URL error for ${p.photo_path}:`, error);
        else console.log(`Signed URL for ${p.photo_path}:`, data.signedUrl);
      }
    }
  }
}

debug();
