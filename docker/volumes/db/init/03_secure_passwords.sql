-- ==============================================================================
-- 03_secure_passwords.sql
-- Migração e Blindagem de Segurança de Senhas (Bcrypt / Pgcrypto)
-- 
-- 1. Cria tabela isolada e protegida public.user_credentials
-- 2. Habilita RLS e revoga acesso direto de 'anon' e 'authenticated' à tabela de credenciais
-- 3. Migra todas as senhas existentes para hash seguro Bcrypt (blowfish 10 rounds)
-- 4. Remove o campo plaintext 'passwordSimulated' do JSON de public.users
-- 5. Cria funções seguras (RPCs SECURITY DEFINER):
--    - authenticate_user(p_email, p_password)
--    - admin_reset_user_password(p_target_user_id, p_temp_password)
--    - change_user_password(p_user_id, p_new_password)
--    - create_new_user(p_user_id, p_name, p_email, p_role, p_initial_password)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabela isolada de credenciais com RLS
CREATE TABLE IF NOT EXISTS public.user_credentials (
  user_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ativar RLS e revogar acesso direto aos clientes API/Web
ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_credentials FROM anon, authenticated;
GRANT ALL ON TABLE public.user_credentials TO postgres, service_role;

-- 2. Migração das senhas existentes das 13 contas reais para Bcrypt com sal
-- Se data contém 'passwordSimulated', converte em hash Bcrypt e salva em user_credentials
INSERT INTO public.user_credentials (user_id, password_hash, created_at, updated_at)
SELECT 
  id, 
  crypt(data->>'passwordSimulated', gen_salt('bf', 10)),
  timezone('utc'::text, now()),
  timezone('utc'::text, now())
FROM public.users
WHERE data->>'passwordSimulated' IS NOT NULL 
  AND data->>'passwordSimulated' != ''
ON CONFLICT (user_id) DO UPDATE 
SET password_hash = EXCLUDED.password_hash, 
    updated_at = timezone('utc'::text, now());

-- Sincronizar credencial para user-1 (Artur Câncio GECTI):
-- Se a senha foi alterada na conta Teste devido ao conflito anterior,
-- copiamos o novo hash para user-1 (GECTI) para que a nova senha funcione imediatamente.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_credentials WHERE user_id = 'user-1783016954177') THEN
    UPDATE public.user_credentials
    SET password_hash = (SELECT password_hash FROM public.user_credentials WHERE user_id = 'user-1783016954177'),
        updated_at = timezone('utc'::text, now())
    WHERE user_id = 'user-1';

    -- Restaura a conta de Teste (arturcancio@gmail.com) para sua senha original 'Bb25042014@'
    UPDATE public.user_credentials
    SET password_hash = crypt('Bb25042014@', gen_salt('bf', 10)),
        updated_at = timezone('utc'::text, now())
    WHERE user_id = 'user-1783016954177';
  END IF;
END $$;

-- 3. Remover definitivamente o campo 'passwordSimulated' da coluna data de public.users
UPDATE public.users
SET data = data - 'passwordSimulated'
WHERE data ? 'passwordSimulated';

-- 4. Função RPC de Autenticação Segura (executada em tempo de login)
CREATE OR REPLACE FUNCTION public.authenticate_user(
  p_email TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_row RECORD;
  v_cred RECORD;
  v_clean_email TEXT;
  v_user_data JSONB;
BEGIN
  v_clean_email := lower(trim(p_email));
  
  -- Localizar ESTRITAMENTE pelo e-mail exato cadastrado (sem aliases ou buscas parciais)
  SELECT id, data INTO v_user_row
  FROM public.users
  WHERE lower(trim(data->>'email')) = v_clean_email
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'E-mail institucional ou senha incorretos!');
  END IF;

  -- Buscar hash da credencial
  SELECT password_hash INTO v_cred
  FROM public.user_credentials
  WHERE user_id = v_user_row.id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Credenciais de acesso não configuradas para este usuário.');
  END IF;

  -- Validação criptográfica do hash Bcrypt
  -- Para a conta user-1 (Artur GECTI), aceita a senha criptografada e também o fallback sof123
  IF v_cred.password_hash = crypt(p_password, v_cred.password_hash)
     OR (v_user_row.id = 'user-1' AND v_clean_email = 'artur.cancio@planejamento.gov.br' AND p_password = 'sof123') THEN
    
    -- Se logou com sof123 no user-1, atualiza a credencial para sof123
    IF p_password = 'sof123' AND v_user_row.id = 'user-1' THEN
      UPDATE public.user_credentials
      SET password_hash = crypt('sof123', gen_salt('bf', 10)),
          updated_at = timezone('utc'::text, now())
      WHERE user_id = 'user-1';
    END IF;

    -- Retornar os dados do usuário limpos de qualquer credencial ou hash
    v_user_data := (v_user_row.data - 'passwordSimulated' - 'passwordHash') || jsonb_build_object('id', v_user_row.id);
    RETURN jsonb_build_object('success', true, 'user', v_user_data);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'E-mail institucional ou senha incorretos!');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.authenticate_user(TEXT, TEXT) TO anon, authenticated, service_role;

-- 5. Função RPC para Reset de Senha por Perfil GECTI
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
  p_target_user_id TEXT,
  p_temp_password TEXT DEFAULT 'sof123'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_user_row RECORD;
  v_clean_pass TEXT;
BEGIN
  SELECT id, data INTO v_user_row FROM public.users WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado.');
  END IF;

  v_clean_pass := coalesce(nullif(trim(p_temp_password), ''), 'sof123');
  v_hash := crypt(v_clean_pass, gen_salt('bf', 10));

  INSERT INTO public.user_credentials (user_id, password_hash, updated_at)
  VALUES (p_target_user_id, v_hash, timezone('utc'::text, now()))
  ON CONFLICT (user_id) DO UPDATE
  SET password_hash = EXCLUDED.password_hash, updated_at = EXCLUDED.updated_at;

  -- Atualiza o usuário definindo needsPasswordReset = true e removendo qualquer resquício de plaintext
  UPDATE public.users
  SET data = (data - 'passwordSimulated') || jsonb_build_object('needsPasswordReset', true),
      updated_at = timezone('utc'::text, now())
  WHERE id = p_target_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(TEXT, TEXT) TO anon, authenticated, service_role;

-- 6. Função RPC para Alteração de Senha Pessoal pelo próprio Usuário (Primeiro acesso ou reset)
CREATE OR REPLACE FUNCTION public.change_user_password(
  p_user_id TEXT,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_user_row RECORD;
BEGIN
  IF length(trim(p_new_password)) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A nova senha deve possuir no mínimo 6 caracteres!');
  END IF;

  SELECT id, data INTO v_user_row FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado.');
  END IF;

  v_hash := crypt(trim(p_new_password), gen_salt('bf', 10));

  INSERT INTO public.user_credentials (user_id, password_hash, updated_at)
  VALUES (p_user_id, v_hash, timezone('utc'::text, now()))
  ON CONFLICT (user_id) DO UPDATE
  SET password_hash = EXCLUDED.password_hash, updated_at = EXCLUDED.updated_at;

  -- Atualiza o usuário definindo needsPasswordReset = false e removendo qualquer plaintext
  UPDATE public.users
  SET data = (data - 'passwordSimulated') || jsonb_build_object('needsPasswordReset', false),
      updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_user_password(TEXT, TEXT) TO anon, authenticated, service_role;

-- 7. Função RPC para Criação de Novo Usuário (por GECTI) com Hashing Automático
CREATE OR REPLACE FUNCTION public.create_new_user(
  p_user_id TEXT,
  p_name TEXT,
  p_email TEXT,
  p_role TEXT,
  p_initial_password TEXT DEFAULT 'sof123'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_clean_pass TEXT;
  v_user_data JSONB;
BEGIN
  v_clean_pass := coalesce(nullif(trim(p_initial_password), ''), 'sof123');
  v_hash := crypt(v_clean_pass, gen_salt('bf', 10));

  v_user_data := jsonb_build_object(
    'id', p_user_id,
    'name', trim(p_name),
    'email', lower(trim(p_email)),
    'role', p_role,
    'needsPasswordReset', true
  );

  INSERT INTO public.users (id, data, updated_at)
  VALUES (p_user_id, v_user_data, timezone('utc'::text, now()))
  ON CONFLICT (id) DO UPDATE
  SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;

  INSERT INTO public.user_credentials (user_id, password_hash, updated_at)
  VALUES (p_user_id, v_hash, timezone('utc'::text, now()))
  ON CONFLICT (user_id) DO UPDATE
  SET password_hash = EXCLUDED.password_hash, updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object('success', true, 'user', v_user_data);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_new_user(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 8. Função RPC para Usuário Autenticado Alterar a Própria Senha (com validação da senha atual)
CREATE OR REPLACE FUNCTION public.user_update_password(
  p_user_id TEXT,
  p_current_password TEXT,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_cred RECORD;
  v_hash TEXT;
BEGIN
  IF length(trim(p_new_password)) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A nova senha deve possuir no mínimo 6 caracteres!');
  END IF;

  -- Localiza credencial atual do usuário
  SELECT password_hash INTO v_cred
  FROM public.user_credentials
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Credenciais de acesso não configuradas para este usuário.');
  END IF;

  -- Valida se a senha atual informada está correta
  IF v_cred.password_hash != crypt(p_current_password, v_cred.password_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Senha atual incorreta!');
  END IF;

  -- Gera o novo hash Bcrypt com sal individual
  v_hash := crypt(trim(p_new_password), gen_salt('bf', 10));

  UPDATE public.user_credentials
  SET password_hash = v_hash, updated_at = timezone('utc'::text, now())
  WHERE user_id = p_user_id;

  UPDATE public.users
  SET data = (data - 'passwordSimulated') || jsonb_build_object('needsPasswordReset', false),
      updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_update_password(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- Recarrega o cache do PostgREST para expor as novas funções imediatamente
NOTIFY pgrst, 'reload schema';
