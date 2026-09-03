# Contratics - Gestão Integrada de TIC (SOF/MPO)

Sistema de Gestão Orçamentária, Contratual e de Planejamento de TIC para o Setor Público.

## Arquitetura Moderna com Supabase Self-Hosted e Docker
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons + Recharts
- **Banco de Dados**: PostgreSQL 15 (Supabase Self-Hosted) com suporte completo a dados relacionais e JSONB
- **Tempo Real**: Supabase Realtime (WebSockets) com resposta reativa imediata para DFDs, renovações contratuais e quadro Kanban
- **Infraestrutura**: Conteinerização completa com Docker Compose (Web, PostgreSQL, PostgREST, Realtime, GoTrue Auth, Kong Gateway e Supabase Studio)

---

## Como Executar Localmente com Docker

1. Copie o arquivo de variáveis de ambiente:
   ```bash
   cp .env.example .env
   ```
2. Inicie a stack completa:
   ```bash
   docker compose up -d --build
   ```
3. Acesse os serviços no navegador:
   - **Contratics Web**: [http://localhost:3000](http://localhost:3000)
   - **Supabase Studio (Dashboard)**: [http://localhost:8001](http://localhost:8001)
   - **API Gateway Supabase**: [http://localhost:8000](http://localhost:8000)

---

## Como Instalar em Servidor Ubuntu Server Zerado

Consulte o guia completo e detalhado passo a passo em:
👉 **[DEPLOY_UBUNTU.md](./DEPLOY_UBUNTU.md)**

---

## Scripts Disponíveis

- `npm run dev`: Executa o frontend em modo de desenvolvimento Vite
- `npm run build`: Compila a aplicação para produção
- `npm run lint`: Verificação de tipos TypeScript (`tsc --noEmit`)
- `npm run migrate:export-firestore`: Exporta dados reais do Firestore
- `npm run migrate:generate-sql`: Gera os scripts de inicialização SQL
- `npm run migrate:supabase`: Importa os dados reais exportados para o Supabase via API
