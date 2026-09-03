import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'http://localhost:8000';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZWZlcmVuY2UiOiJjb250cmF0aWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY3MDAwMDAwMCwiZXhwIjoxOTg1NTc0NDAwfQ.contratics_secret_service_key';

console.log('Connecting to Supabase at:', SUPABASE_URL);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const collections = [
  'users',
  'fornecedores',
  'dfds',
  'planejamentos',
  'contratos',
  'itensSOF',
  'itensPlanejamentoSOF',
  'tarefas',
  'historicoPlanejamentos',
  'historicosContratuais',
  'aditivos',
  'apostilamentos',
  'pagamentos',
  'baseConhecimento',
  'faqs',
  'presencialDays',
  'templates',
  'siopData',
  'siopHistory',
  'loginLogs',
  'system',
  'projectionSpreadsheets'
];

async function runImport() {
  const exportPath = path.resolve('migration_data/firestore_export.json');
  if (!fs.existsSync(exportPath)) {
    console.error('Export file not found:', exportPath);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
  let totalImported = 0;

  for (const col of collections) {
    const docs = data[col] || [];
    if (docs.length === 0) {
      console.log(`Skipping empty collection: ${col}`);
      continue;
    }

    console.log(`Importing ${docs.length} records into "${col}"...`);
    // Upsert in batches of 50
    const batchSize = 50;
    for (let i = 0; i < docs.length; i += batchSize) {
      const chunk = docs.slice(i, i + batchSize).map(d => ({
        id: d.id,
        data: d,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase.from(col).upsert(chunk, { onConflict: 'id' });
      if (error) {
        console.error(`Error importing batch into "${col}":`, error.message);
      } else {
        totalImported += chunk.length;
      }
    }
  }

  console.log(`\nImport process completed! Total imported/updated: ${totalImported} records.`);
}

runImport()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal import error:', err);
    process.exit(1);
  });
