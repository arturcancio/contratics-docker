import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Carrega as credenciais existentes
const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(config);
const auth = getAuth(app);
const db = initializeFirestore(app, { ignoreUndefinedProperties: true }, config.firestoreDatabaseId);

const COLLECTIONS = [
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

async function runExport() {
  console.log('Autenticando no Firebase...');
  try {
    await signInAnonymously(auth);
    console.log('Autenticação anônima efetuada com sucesso!');
  } catch (err) {
    console.warn('Aviso na autenticação anônima, prosseguindo com conexão direta:', err.message);
  }

  const dump = {};
  let totalDocs = 0;

  for (const colName of COLLECTIONS) {
    process.stdout.write(`Exportando coleção '${colName}'... `);
    try {
      const snap = await getDocs(collection(db, colName));
      dump[colName] = [];
      snap.forEach(docSnap => {
        dump[colName].push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });
      totalDocs += dump[colName].length;
      console.log(`OK (${dump[colName].length} documentos)`);
    } catch (err) {
      console.log(`ERRO: ${err.message}`);
      dump[colName] = [];
    }
  }

  // 1. Salvar JSON Bruto com todos os dados
  const jsonPath = path.resolve('./contratics_firestore_dump.json');
  fs.writeFileSync(jsonPath, JSON.stringify(dump, null, 2), 'utf8');
  console.log(`\nDump JSON salvo com sucesso em: ${jsonPath} (Total: ${totalDocs} registros)`);

  // 2. Gerar Script SQL para o PostgreSQL do Supabase (01_data_import.sql)
  const sqlLines = [];
  sqlLines.push('-- Script de Carga de Dados Migrados do Firestore para PostgreSQL / Supabase');
  sqlLines.push('-- Compatível com a estrutura de 22 tabelas JSONB do contratics-docker\n');
  sqlLines.push('BEGIN;\n');

  for (const colName of COLLECTIONS) {
    const records = dump[colName] || [];
    if (records.length === 0) continue;

    sqlLines.push(`-- Inserindo ${records.length} registros na tabela public."${colName}"`);
    for (const rec of records) {
      const docId = rec.id;
      // Escapa strings para formato SQL seguro
      const jsonString = JSON.stringify(rec).replace(/'/g, "''");
      const safeId = String(docId).replace(/'/g, "''");
      sqlLines.push(
        `INSERT INTO public."${colName}" (id, data, updated_at) VALUES ('${safeId}', '${jsonString}'::jsonb, timezone('utc'::text, now())) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = timezone('utc'::text, now());`
      );
    }
    sqlLines.push('');
  }

  sqlLines.push('COMMIT;\n');

  const sqlPath = path.resolve('./02_import_data.sql');
  fs.writeFileSync(sqlPath, sqlLines.join('\n'), 'utf8');
  console.log(`Script SQL gerado com sucesso em: ${sqlPath}`);
}

runExport().then(() => {
  console.log('Exportação finalizada com sucesso!');
  process.exit(0);
}).catch(err => {
  console.error('Falha na exportação:', err);
  process.exit(1);
});
