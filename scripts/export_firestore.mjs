import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const config = JSON.parse(fs.readFileSync(path.resolve('./firebase-applet-config.json'), 'utf-8'));
const app = initializeApp(config);
const db = initializeFirestore(app, {}, config.firestoreDatabaseId);

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

async function dumpFirestore() {
  console.log('Exporting from Firestore database ID:', config.firestoreDatabaseId);
  const result = {};
  for (const colName of collections) {
    try {
      const snap = await getDocs(collection(db, colName));
      result[colName] = [];
      snap.forEach(doc => {
        result[colName].push({ id: doc.id, ...doc.data() });
      });
      console.log(`Collection "${colName}": ${result[colName].length} documents.`);
    } catch (err) {
      console.error(`Error reading ${colName}:`, err.message);
      result[colName] = [];
    }
  }

  const outDir = path.resolve('./migration_data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, 'firestore_export.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\nSuccessfully exported all collections to: ${outPath}`);
}

dumpFirestore()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal dump error:', err);
    process.exit(1);
  });
