#!/bin/bash
# ==============================================================================
# Script de Importação dos Dados Reais no Contratics (PostgreSQL / Supabase)
# ==============================================================================

set -e

echo "=========================================================="
echo "Importando Schema e Dados Reais para o Contratics..."
echo "=========================================================="

# 1. Executa o Schema DDL (Tabelas, RLS, Realtime, Views, Roles)
echo "-> 1. Criando tabelas, roles e schema..."
docker exec -i contratics-db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U supabase_admin -d postgres' < docker/volumes/db/init/01_schema.sql

# 2. Executa os Inserts de 100% dos dados reais exportados
echo "-> 2. Inserindo 475 registros reais (Contratos, DFDs, SIOP, etc)..."
docker exec -i contratics-db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U supabase_admin -d postgres' < docker/volumes/db/init/02_real_data.sql

# 3. Notifica o PostgREST para recarregar o cache de schemas
echo "-> 3. Recarregando schema do PostgREST..."
docker exec -i contratics-db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U supabase_admin -d postgres -c "NOTIFY pgrst, '\''reload schema'\'';"' || true
docker compose restart contratics-rest

echo ""
echo "=========================================================="
echo "Sucesso! Total de registros confirmados no banco:"
echo "=========================================================="
docker exec -i contratics-db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U supabase_admin -d postgres -c "
SELECT 
  (SELECT count(*) FROM users) AS usuarios,
  (SELECT count(*) FROM contratos) AS contratos,
  (SELECT count(*) FROM dfds) AS dfds,
  (SELECT count(*) FROM planejamentos) AS planejamentos,
  (SELECT count(*) FROM tarefas) AS tarefas_kanban;
"'
echo "Pronto! Recarregue a página no navegador (Ctrl + F5)."
