import fs from 'fs';
import path from 'path';

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

const targetDir = path.resolve('docker/volumes/db/init');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// 1. Generate 01_schema.sql
let schemaSql = `-- ==============================================================================
-- 01_schema.sql - Contratics Supabase Self-Hosted Database Schema
-- Auto-generated with support for all 22 collections, Realtime, GIN indexes and RLS.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper Function: Atomic document merge (support for setDoc with { merge: true })
CREATE OR REPLACE FUNCTION public.merge_document(tbl TEXT, doc_id TEXT, patch JSONB)
RETURNS JSONB AS $$
DECLARE
  res JSONB;
BEGIN
  EXECUTE format(
    'INSERT INTO public.%I (id, data, updated_at) VALUES ($1, $2, timezone(''utc''::text, now()))
     ON CONFLICT (id) DO UPDATE SET data = public.%I.data || $2, updated_at = timezone(''utc''::text, now())
     RETURNING data',
    tbl, tbl
  ) INTO res USING doc_id, patch;
  RETURN res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.merge_document TO anon, authenticated, service_role;

`;

for (const col of collections) {
  schemaSql += `
-- Table: ${col}
CREATE TABLE IF NOT EXISTS public."${col}" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_${col}_data" ON public."${col}" USING gin (data);

ALTER TABLE public."${col}" REPLICA IDENTITY FULL;

ALTER TABLE public."${col}" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = '${col}' AND policyname = 'Allow all access to ${col}'
  ) THEN
    CREATE POLICY "Allow all access to ${col}" ON public."${col}"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."${col}" TO anon, authenticated, service_role;
`;
}

// Add tables to realtime publication
schemaSql += `
-- Realtime publication for all Contratics collections
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE 
  ${collections.map(c => `public."${c}"`).join(',\n  ')};

-- Useful SQL Views for easier direct querying and reporting in Supabase Studio / BI tools
CREATE OR REPLACE VIEW public.v_contratos AS
SELECT 
  id,
  data->>'Num_Contrato' AS "Num_Contrato",
  data->>'Objeto' AS "Objeto",
  data->>'SEI_Processo' AS "SEI_Processo",
  data->>'Fornecedor' AS "Fornecedor",
  (data->>'Valor_Contrato')::numeric AS "Valor_Contrato",
  (data->>'Valor_Atualizado')::numeric AS "Valor_Atualizado",
  data->>'Vigencia_Inicio' AS "Vigencia_Inicio",
  (data->>'Vigencia_Inicial_Meses')::numeric AS "Vigencia_Inicial_Meses",
  (data->>'Perspectiva_Renovacao')::boolean AS "Perspectiva_Renovacao",
  data->>'Status_Contrato' AS "Status_Contrato",
  data->>'Gestor_Contrato' AS "Gestor_Contrato",
  data->>'Fiscal_Administrativo' AS "Fiscal_Administrativo",
  data->>'Fiscal_Tecnico' AS "Fiscal_Tecnico",
  data->>'Fiscal_Requisitante' AS "Fiscal_Requisitante",
  data->>'DFD_Vinculado' AS "DFD_Vinculado",
  data->>'updatedAt' AS "updatedAt",
  updated_at
FROM public."contratos";

CREATE OR REPLACE VIEW public.v_dfds AS
SELECT 
  id,
  data->>'Num_DFD' AS "Num_DFD",
  data->>'Ano_PCA' AS "Ano_PCA",
  data->>'Descricao_Objeto' AS "Descricao_Objeto",
  (data->>'Valor_Estimado')::numeric AS "Valor_Estimado",
  data->>'Status_DFD' AS "Status_DFD",
  data->>'UASG' AS "UASG",
  (data->>'Contabilizar_Orcamento')::boolean AS "Contabilizar_Orcamento",
  data->'Contabilizar_Orcamento_Anual' AS "Contabilizar_Orcamento_Anual",
  data->'Valor_Customizado_Anual' AS "Valor_Customizado_Anual",
  data->>'Planejamento_Vinculado' AS "Planejamento_Vinculado",
  data->>'Data_conclusao_estimada' AS "Data_conclusao_estimada",
  data->>'Periodicidade_Pagamento' AS "Periodicidade_Pagamento",
  data->>'updatedAt' AS "updatedAt",
  updated_at
FROM public."dfds";

CREATE OR REPLACE VIEW public.v_planejamentos AS
SELECT 
  id,
  data->>'SEI_Processo' AS "SEI_Processo",
  data->>'Objeto' AS "Objeto",
  data->>'Status_Planejamento' AS "Status_Planejamento",
  (data->>'Estimativa_Custo')::numeric AS "Estimativa_Custo",
  data->>'Ano_PCA_Vinculado' AS "Ano_PCA_Vinculado",
  data->>'PCA' AS "PCA",
  data->>'Tipo_Processo' AS "Tipo_Processo",
  data->>'Contrato_Originado' AS "Contrato_Originado",
  data->>'DFD_PNCP' AS "DFD_PNCP",
  data->>'updatedAt' AS "updatedAt",
  updated_at
FROM public."planejamentos";

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
`;

fs.writeFileSync(path.join(targetDir, '01_schema.sql'), schemaSql, 'utf-8');
console.log('Successfully generated 01_schema.sql');

// 2. Generate 02_real_data.sql from firestore_export.json
const rawExport = JSON.parse(fs.readFileSync(path.resolve('migration_data/firestore_export.json'), 'utf-8'));

let dataSql = `-- ==============================================================================
-- 02_real_data.sql - Real Data Migration from Firebase Firestore
-- 100% Real production data exported directly from Firestore.
-- NO MOCK / FICTIONAL DATA INCLUDED.
-- ==============================================================================

`;

let totalRecords = 0;
for (const col of collections) {
  const docs = rawExport[col] || [];
  totalRecords += docs.length;
  dataSql += `\n-- Collection: ${col} (${docs.length} real documents)\n`;
  if (docs.length === 0) continue;

  for (const doc of docs) {
    const id = doc.id;
    // Escape single quotes for SQL literal
    const jsonStr = JSON.stringify(doc).replace(/'/g, "''");
    const escapedId = id.replace(/'/g, "''");
    dataSql += `INSERT INTO public."${col}" (id, data, updated_at) VALUES ('${escapedId}', '${jsonStr}'::jsonb, timezone('utc'::text, now())) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = timezone('utc'::text, now());\n`;
  }
}

fs.writeFileSync(path.join(targetDir, '02_real_data.sql'), dataSql, 'utf-8');
console.log(`Successfully generated 02_real_data.sql with ${totalRecords} real records.`);
