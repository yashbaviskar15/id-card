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

async function fixStorage() {
  console.log('Checking storage bucket...');
  
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.error('Error listing buckets:', listError);
    return;
  }

  const bucketName = 'documents';
  const bucketExists = buckets.some(b => b.name === bucketName);

  if (!bucketExists) {
    console.log(`Bucket "${bucketName}" not found. Creating...`);
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: false,
      fileSizeLimit: 52428800, // 50MB
    });
    
    if (createError) {
      console.error('Error creating bucket:', createError);
    } else {
      console.log(`Bucket "${bucketName}" created successfully.`);
    }
  } else {
    console.log(`Bucket "${bucketName}" already exists.`);
  }

  console.log('Verifying RLS policies for storage is not possible via JS client easily, but ensuring bucket is private...');
  const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
    public: false
  });
  
  if (updateError) {
    console.error('Error updating bucket:', updateError);
  } else {
    console.log(`Bucket "${bucketName}" is set to private.`);
  }
}

fixStorage();
