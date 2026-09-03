-- ==============================================================================
-- setup_roles.sql - Criação de Roles e Permissões Supabase para Contratics
-- ==============================================================================

-- 1. Criação das roles essenciais do Supabase se não existirem
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    CREATE ROLE postgres WITH LOGIN SUPERUSER CREATEDB CREATEROLE REPLICATION PASSWORD 'contratics_pg_secret_2026';
  ELSE
    ALTER ROLE postgres WITH LOGIN SUPERUSER CREATEDB CREATEROLE REPLICATION PASSWORD 'contratics_pg_secret_2026';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator WITH LOGIN NOINHERIT PASSWORD 'contratics_pg_secret_2026';
  ELSE
    ALTER ROLE authenticator WITH LOGIN NOINHERIT PASSWORD 'contratics_pg_secret_2026';
  END IF;
END $$;

-- 2. Membros e herança de roles
GRANT anon, authenticated, service_role TO authenticator;
GRANT anon, authenticated, service_role TO postgres;

-- 3. Permissões no schema public
GRANT USAGE, CREATE ON SCHEMA public TO postgres, anon, authenticated, service_role, authenticator;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role, authenticator;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role, authenticator;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role, authenticator;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role, authenticator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role, authenticator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role, authenticator;

-- 4. Criação de Políticas RLS para todas as 22 tabelas
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'users', 'fornecedores', 'dfds', 'planejamentos', 'contratos',
    'itensSOF', 'itensPlanejamentoSOF', 'tarefas', 'historicoPlanejamentos',
    'historicosContratuais', 'aditivos', 'apostilamentos', 'pagamentos',
    'baseConhecimento', 'faqs', 'presencialDays', 'templates',
    'siopData', 'siopHistory', 'loginLogs', 'system', 'projectionSpreadsheets'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Allow all access to %I" ON public.%I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Allow all" ON public.%I', tbl);
      EXECUTE format('CREATE POLICY "Allow all" ON public.%I FOR ALL TO anon, authenticated, service_role, postgres USING (true) WITH CHECK (true)', tbl);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Notice on table %: %', tbl, SQLERRM;
    END;
  END LOOP;
END $$;

-- 5. Notifica o PostgREST para recarregar o schema
NOTIFY pgrst, 'reload schema';
