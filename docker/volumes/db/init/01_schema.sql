-- ==============================================================================
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


-- Table: users
CREATE TABLE IF NOT EXISTS public."users" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_users_data" ON public."users" USING gin (data);

ALTER TABLE public."users" REPLICA IDENTITY FULL;

ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Allow all access to users'
  ) THEN
    CREATE POLICY "Allow all access to users" ON public."users"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."users" TO anon, authenticated, service_role;

-- Table: fornecedores
CREATE TABLE IF NOT EXISTS public."fornecedores" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_fornecedores_data" ON public."fornecedores" USING gin (data);

ALTER TABLE public."fornecedores" REPLICA IDENTITY FULL;

ALTER TABLE public."fornecedores" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'fornecedores' AND policyname = 'Allow all access to fornecedores'
  ) THEN
    CREATE POLICY "Allow all access to fornecedores" ON public."fornecedores"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."fornecedores" TO anon, authenticated, service_role;

-- Table: dfds
CREATE TABLE IF NOT EXISTS public."dfds" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_dfds_data" ON public."dfds" USING gin (data);

ALTER TABLE public."dfds" REPLICA IDENTITY FULL;

ALTER TABLE public."dfds" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dfds' AND policyname = 'Allow all access to dfds'
  ) THEN
    CREATE POLICY "Allow all access to dfds" ON public."dfds"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."dfds" TO anon, authenticated, service_role;

-- Table: planejamentos
CREATE TABLE IF NOT EXISTS public."planejamentos" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_planejamentos_data" ON public."planejamentos" USING gin (data);

ALTER TABLE public."planejamentos" REPLICA IDENTITY FULL;

ALTER TABLE public."planejamentos" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'planejamentos' AND policyname = 'Allow all access to planejamentos'
  ) THEN
    CREATE POLICY "Allow all access to planejamentos" ON public."planejamentos"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."planejamentos" TO anon, authenticated, service_role;

-- Table: contratos
CREATE TABLE IF NOT EXISTS public."contratos" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_contratos_data" ON public."contratos" USING gin (data);

ALTER TABLE public."contratos" REPLICA IDENTITY FULL;

ALTER TABLE public."contratos" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'contratos' AND policyname = 'Allow all access to contratos'
  ) THEN
    CREATE POLICY "Allow all access to contratos" ON public."contratos"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."contratos" TO anon, authenticated, service_role;

-- Table: itensSOF
CREATE TABLE IF NOT EXISTS public."itensSOF" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_itensSOF_data" ON public."itensSOF" USING gin (data);

ALTER TABLE public."itensSOF" REPLICA IDENTITY FULL;

ALTER TABLE public."itensSOF" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'itensSOF' AND policyname = 'Allow all access to itensSOF'
  ) THEN
    CREATE POLICY "Allow all access to itensSOF" ON public."itensSOF"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."itensSOF" TO anon, authenticated, service_role;

-- Table: itensPlanejamentoSOF
CREATE TABLE IF NOT EXISTS public."itensPlanejamentoSOF" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_itensPlanejamentoSOF_data" ON public."itensPlanejamentoSOF" USING gin (data);

ALTER TABLE public."itensPlanejamentoSOF" REPLICA IDENTITY FULL;

ALTER TABLE public."itensPlanejamentoSOF" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'itensPlanejamentoSOF' AND policyname = 'Allow all access to itensPlanejamentoSOF'
  ) THEN
    CREATE POLICY "Allow all access to itensPlanejamentoSOF" ON public."itensPlanejamentoSOF"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."itensPlanejamentoSOF" TO anon, authenticated, service_role;

-- Table: tarefas
CREATE TABLE IF NOT EXISTS public."tarefas" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tarefas_data" ON public."tarefas" USING gin (data);

ALTER TABLE public."tarefas" REPLICA IDENTITY FULL;

ALTER TABLE public."tarefas" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tarefas' AND policyname = 'Allow all access to tarefas'
  ) THEN
    CREATE POLICY "Allow all access to tarefas" ON public."tarefas"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."tarefas" TO anon, authenticated, service_role;

-- Table: historicoPlanejamentos
CREATE TABLE IF NOT EXISTS public."historicoPlanejamentos" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_historicoPlanejamentos_data" ON public."historicoPlanejamentos" USING gin (data);

ALTER TABLE public."historicoPlanejamentos" REPLICA IDENTITY FULL;

ALTER TABLE public."historicoPlanejamentos" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'historicoPlanejamentos' AND policyname = 'Allow all access to historicoPlanejamentos'
  ) THEN
    CREATE POLICY "Allow all access to historicoPlanejamentos" ON public."historicoPlanejamentos"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."historicoPlanejamentos" TO anon, authenticated, service_role;

-- Table: historicosContratuais
CREATE TABLE IF NOT EXISTS public."historicosContratuais" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_historicosContratuais_data" ON public."historicosContratuais" USING gin (data);

ALTER TABLE public."historicosContratuais" REPLICA IDENTITY FULL;

ALTER TABLE public."historicosContratuais" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'historicosContratuais' AND policyname = 'Allow all access to historicosContratuais'
  ) THEN
    CREATE POLICY "Allow all access to historicosContratuais" ON public."historicosContratuais"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."historicosContratuais" TO anon, authenticated, service_role;

-- Table: aditivos
CREATE TABLE IF NOT EXISTS public."aditivos" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_aditivos_data" ON public."aditivos" USING gin (data);

ALTER TABLE public."aditivos" REPLICA IDENTITY FULL;

ALTER TABLE public."aditivos" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'aditivos' AND policyname = 'Allow all access to aditivos'
  ) THEN
    CREATE POLICY "Allow all access to aditivos" ON public."aditivos"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."aditivos" TO anon, authenticated, service_role;

-- Table: apostilamentos
CREATE TABLE IF NOT EXISTS public."apostilamentos" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_apostilamentos_data" ON public."apostilamentos" USING gin (data);

ALTER TABLE public."apostilamentos" REPLICA IDENTITY FULL;

ALTER TABLE public."apostilamentos" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'apostilamentos' AND policyname = 'Allow all access to apostilamentos'
  ) THEN
    CREATE POLICY "Allow all access to apostilamentos" ON public."apostilamentos"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."apostilamentos" TO anon, authenticated, service_role;

-- Table: pagamentos
CREATE TABLE IF NOT EXISTS public."pagamentos" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pagamentos_data" ON public."pagamentos" USING gin (data);

ALTER TABLE public."pagamentos" REPLICA IDENTITY FULL;

ALTER TABLE public."pagamentos" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pagamentos' AND policyname = 'Allow all access to pagamentos'
  ) THEN
    CREATE POLICY "Allow all access to pagamentos" ON public."pagamentos"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."pagamentos" TO anon, authenticated, service_role;

-- Table: baseConhecimento
CREATE TABLE IF NOT EXISTS public."baseConhecimento" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_baseConhecimento_data" ON public."baseConhecimento" USING gin (data);

ALTER TABLE public."baseConhecimento" REPLICA IDENTITY FULL;

ALTER TABLE public."baseConhecimento" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'baseConhecimento' AND policyname = 'Allow all access to baseConhecimento'
  ) THEN
    CREATE POLICY "Allow all access to baseConhecimento" ON public."baseConhecimento"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."baseConhecimento" TO anon, authenticated, service_role;

-- Table: faqs
CREATE TABLE IF NOT EXISTS public."faqs" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_faqs_data" ON public."faqs" USING gin (data);

ALTER TABLE public."faqs" REPLICA IDENTITY FULL;

ALTER TABLE public."faqs" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'faqs' AND policyname = 'Allow all access to faqs'
  ) THEN
    CREATE POLICY "Allow all access to faqs" ON public."faqs"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."faqs" TO anon, authenticated, service_role;

-- Table: presencialDays
CREATE TABLE IF NOT EXISTS public."presencialDays" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_presencialDays_data" ON public."presencialDays" USING gin (data);

ALTER TABLE public."presencialDays" REPLICA IDENTITY FULL;

ALTER TABLE public."presencialDays" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'presencialDays' AND policyname = 'Allow all access to presencialDays'
  ) THEN
    CREATE POLICY "Allow all access to presencialDays" ON public."presencialDays"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."presencialDays" TO anon, authenticated, service_role;

-- Table: templates
CREATE TABLE IF NOT EXISTS public."templates" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_templates_data" ON public."templates" USING gin (data);

ALTER TABLE public."templates" REPLICA IDENTITY FULL;

ALTER TABLE public."templates" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'templates' AND policyname = 'Allow all access to templates'
  ) THEN
    CREATE POLICY "Allow all access to templates" ON public."templates"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."templates" TO anon, authenticated, service_role;

-- Table: siopData
CREATE TABLE IF NOT EXISTS public."siopData" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_siopData_data" ON public."siopData" USING gin (data);

ALTER TABLE public."siopData" REPLICA IDENTITY FULL;

ALTER TABLE public."siopData" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'siopData' AND policyname = 'Allow all access to siopData'
  ) THEN
    CREATE POLICY "Allow all access to siopData" ON public."siopData"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."siopData" TO anon, authenticated, service_role;

-- Table: siopHistory
CREATE TABLE IF NOT EXISTS public."siopHistory" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_siopHistory_data" ON public."siopHistory" USING gin (data);

ALTER TABLE public."siopHistory" REPLICA IDENTITY FULL;

ALTER TABLE public."siopHistory" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'siopHistory' AND policyname = 'Allow all access to siopHistory'
  ) THEN
    CREATE POLICY "Allow all access to siopHistory" ON public."siopHistory"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."siopHistory" TO anon, authenticated, service_role;

-- Table: loginLogs
CREATE TABLE IF NOT EXISTS public."loginLogs" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_loginLogs_data" ON public."loginLogs" USING gin (data);

ALTER TABLE public."loginLogs" REPLICA IDENTITY FULL;

ALTER TABLE public."loginLogs" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'loginLogs' AND policyname = 'Allow all access to loginLogs'
  ) THEN
    CREATE POLICY "Allow all access to loginLogs" ON public."loginLogs"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."loginLogs" TO anon, authenticated, service_role;

-- Table: system
CREATE TABLE IF NOT EXISTS public."system" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_system_data" ON public."system" USING gin (data);

ALTER TABLE public."system" REPLICA IDENTITY FULL;

ALTER TABLE public."system" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'system' AND policyname = 'Allow all access to system'
  ) THEN
    CREATE POLICY "Allow all access to system" ON public."system"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."system" TO anon, authenticated, service_role;

-- Table: projectionSpreadsheets
CREATE TABLE IF NOT EXISTS public."projectionSpreadsheets" (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_projectionSpreadsheets_data" ON public."projectionSpreadsheets" USING gin (data);

ALTER TABLE public."projectionSpreadsheets" REPLICA IDENTITY FULL;

ALTER TABLE public."projectionSpreadsheets" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'projectionSpreadsheets' AND policyname = 'Allow all access to projectionSpreadsheets'
  ) THEN
    CREATE POLICY "Allow all access to projectionSpreadsheets" ON public."projectionSpreadsheets"
      FOR ALL TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public."projectionSpreadsheets" TO anon, authenticated, service_role;

-- Realtime publication for all Contratics collections
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE 
  public."users",
  public."fornecedores",
  public."dfds",
  public."planejamentos",
  public."contratos",
  public."itensSOF",
  public."itensPlanejamentoSOF",
  public."tarefas",
  public."historicoPlanejamentos",
  public."historicosContratuais",
  public."aditivos",
  public."apostilamentos",
  public."pagamentos",
  public."baseConhecimento",
  public."faqs",
  public."presencialDays",
  public."templates",
  public."siopData",
  public."siopHistory",
  public."loginLogs",
  public."system",
  public."projectionSpreadsheets";

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
