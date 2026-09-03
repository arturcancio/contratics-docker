# Guia Definitivo de Implantação do Contratics em Ubuntu Server Zerado

Este manual fornece o roteiro completo, testado e validado, para implantar o **Contratics** com sua stack completa (Aplicação Web React + Supabase Self-Hosted com PostgreSQL, Realtime WebSockets, PostgREST API, GoTrue Auth, Kong Gateway e Supabase Studio) em uma máquina virtual (VirtualBox, VMware, Proxmox, Hyper-V) ou servidor em nuvem/físico rodando **Ubuntu Server (22.04 LTS ou 24.04 LTS)**.

---

## Sumário
1. [Requisitos de Hardware e Portas de Rede](#1-requisitos-de-hardware-e-portas-de-rede)
2. [Preparação do Sistema Operacional](#2-preparação-do-sistema-operacional)
3. [Instalação Oficial do Docker Engine e Compose](#3-instalação-oficial-do-docker-engine-e-compose)
4. [Configuração de Repositório Privado (GitHub / GitLab Corporativo)](#4-configuração-de-repositório-privado-github--gitlab-corporativo)
5. [Configuração das Variáveis de Ambiente (.env)](#5-configuração-das-variáveis-de-ambiente-env)
6. [Carga Inicial Automática dos Dados Reais](#6-carga-inicial-automática-dos-dados-reais)
7. [Inicialização dos Containers e Validação](#7-inicialização-dos-containers-e-validação)
8. [Fluxo de Desenvolvimento Contínuo (Deploy sem Derrubar o Banco)](#8-fluxo-de-desenvolvimento-contínuo-deploy-sem-derrubar-o-banco)
9. [Como Migrar o Repositório para o Git da Empresa / Órgão](#9-como-migrar-o-repositório-para-o-git-da-empresa--órgão)
10. [Configuração de Produção: Domínio Institucional e SSL/HTTPS](#10-configuração-de-produção-domínio-institucional-e-sslhttps)
11. [Rotina de Backup e Restauração do Banco de Dados](#11-rotina-de-backup-e-restauração-do-banco-de-dados)

---

## 1. Requisitos de Hardware e Portas de Rede

### Hardware Recomendado:
- **CPU**: 2 vCPUs ou mais.
- **Memória RAM**: 4 GB (mínimo recomendado para acomodar PostgreSQL, Realtime Elixir e Node/Nginx com folga).
- **Disco**: 25 GB de espaço livre em SSD.

### Portas Utilizadas:
| Porta | Protocolo | Serviço | Descrição |
| :--- | :--- | :--- | :--- |
| **22** | TCP | SSH | Acesso remoto ao servidor |
| **3000** | TCP | Web Frontend | Interface do usuário do Contratics (Nginx) |
| **8000** | TCP | Kong Gateway | API PostgREST REST + WebSockets Realtime |
| **8001** | TCP | Supabase Studio | Painel visual administrativo do banco de dados |
| **5432** | TCP | PostgreSQL | Conexão direta ao banco (opcional/administração) |
| **80 / 443** | TCP | HTTP / HTTPS | Acesso web via Proxy Reverso Nginx com SSL |

---

## 2. Preparação do Sistema Operacional

Conecte-se à VM Ubuntu via terminal SSH:
```bash
ssh usuario@ip_da_sua_vm
```

### Atualize o sistema:
```bash
sudo apt update && sudo apt upgrade -y
```

### Instale ferramentas essenciais:
```bash
sudo apt install -y ca-certificates curl gnupg lsb-release git ufw htop nano
```

### Configure o Firewall do Ubuntu (UFW):
```bash
# Permite SSH prioritariamente (evita perda de acesso)
sudo ufw allow 22/tcp

# Libera as portas da aplicação
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 8000/tcp
sudo ufw allow 8001/tcp

# Ativa o firewall
sudo ufw --force enable
sudo ufw status verbose
```

---

## 3. Instalação Oficial do Docker Engine e Compose

> ⚠️ **Importante**: Utilize o repositório oficial da Docker (e não os pacotes `docker.io` do Ubuntu) para garantir a versão moderna do `docker compose` sem erros de compatibilidade.

### Passo 3.1: Adicionar a chave GPG oficial do Docker:
```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

### Passo 3.2: Configurar o repositório estável:
```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

### Passo 3.3: Instalar o Docker Engine e o Plugin Compose:
```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### Passo 3.4: Habilitar o serviço e dar permissão ao seu usuário:
```bash
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
```
*(Faça logout digitando `exit` e entre novamente via SSH para que o grupo `docker` tenha efeito sem precisar de `sudo`).*

Confirme a instalação:
```bash
docker --version
docker compose version
```

---

## 4. Configuração de Repositório Privado (GitHub / GitLab Corporativo)

Para proteger o código e dados do projeto, o repositório deve ser mantido como **Privado**.

### Opção A: Usando Personal Access Token (PAT) - Método Mais Rápido
1. No seu GitHub, clique na sua foto de perfil > **Settings** > **Developer Settings** > **Personal access tokens** > **Tokens (classic)**.
2. Clique em **Generate new token (classic)**, dê um nome (ex: `vm-contratics`) e marque a caixa de seleção **`repo`**.
3. Copie o token gerado (ex: `ghp_xxxxxxxxxxxxxxxxxxxx`).
4. Na VM Ubuntu, clone o projeto utilizando o token na URL:
   ```bash
   cd /opt
   sudo git clone https://ghp_SEU_TOKEN_AQUI@github.com/arturcancio/contratics-docker.git contratics
   sudo chown -R $USER:$USER /opt/contratics
   cd /opt/contratics
   ```
   *Dessa forma, todos os comandos futuros (`git pull`) funcionarão automaticamente sem pedir usuário ou senha.*

### Opção B: Usando Chave SSH (Deploy Key) - Método Ideal para Servidores Corporativos
1. Na VM Ubuntu, gere um par de chaves SSH:
   ```bash
   ssh-keygen -t ed25519 -C "servidor-contratics" -f ~/.ssh/id_contratics -N ""
   ```
2. Veja a chave pública gerada:
   ```bash
   cat ~/.ssh/id_contratics.pub
   ```
3. No GitHub/GitLab, abra o repositório > **Settings** > **Deploy Keys** > **Add deploy key**:
   - Cole o conteúdo da chave pública.
   - Deixe o acesso somente-leitura (read-only).
4. Na VM, configure o SSH para usar essa chave:
   ```bash
   nano ~/.ssh/config
   ```
   Adicione:
   ```text
   Host github.com
       IdentityFile ~/.ssh/id_contratics
   ```
5. Clone via SSH:
   ```bash
   cd /opt
   sudo git clone git@github.com:arturcancio/contratics-docker.git contratics
   sudo chown -R $USER:$USER /opt/contratics
   cd /opt/contratics
   ```

---

## 5. Configuração das Variáveis de Ambiente (.env)

Dentro da pasta `/opt/contratics`:
```bash
cp .env.example .env
nano .env
```

### Identificando o IP correto da sua máquina:
Execute no terminal:
```bash
hostname -I
```
> O comando mostrará os IPs da máquina (ex: `172.27.1.106 172.17.0.1`).
> - **Use o primeiro IP (`172.27.1.106`)**: É o IP da máquina na rede local ou corporativa.
> - **Nunca use `172.17.0.1`**: Esse é o IP interno da ponte virtual do Docker (`docker0`), inacessível fora da VM.

### Ajustando o `.env`:
```env
# ==============================================================================
# CONFIGURAÇÕES DO CONTRATICS
# ==============================================================================
POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=contratics_pg_secret_2026
JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long

API_PORT=8000
STUDIO_PORT=8001
WEB_PORT=3000

# Coloque aqui o IP da sua VM ou o domínio que será acessado pelo navegador:
VITE_SUPABASE_URL=http://172.27.1.106:8000

# Chave anônima padrão (gerada com o JWT_SECRET padrão acima):
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjcwMDAwMDAwLCJleHAiOjIwMDAwMDAwMDB9.UTHCBq0o_4VwW1RzPp0OOg8njzim5F3KAi7HCD-4bVc
```

Pressione `Ctrl + O` e `Enter` para salvar, e `Ctrl + X` para sair.

---

## 6. Carga Inicial Automática dos Dados Reais

Você **não** precisa rodar nenhum script manual no banco de dados!

O diretório `docker/volumes/db/init/` já contém os scripts pré-configurados que o container do PostgreSQL executa automaticamente na primeira inicialização:
1. `01_schema.sql`: 
   - Cria as roles de segurança (`postgres`, `anon`, `authenticated`, `service_role`).
   - Cria o schema `_realtime` para suporte a WebSockets.
   - Cria todas as **22 tabelas** relacionais em PostgreSQL com suporte a JSONB, índices GIN de alta performance e réplica em tempo real.
   - Aplica as políticas RLS (`Row Level Security`) e permissões de acesso para todos os perfis.
2. `02_real_data.sql`:
   - Insere todos os **475 registros reais** (15 contratos, 57 itens de SOF, 25 DFDs, 13 planejamentos, 77 tarefas, fornecedores e histórico).

---

## 7. Inicialização dos Containers e Validação

Suba todos os 7 containers com um único comando:
```bash
docker compose up -d --build
```

### Verifique o status dos serviços:
```bash
docker compose ps
```

Todos os 7 containers devem estar com status `Up`:
- `contratics-db` (PostgreSQL 15 - healthy)
- `contratics-rest` (PostgREST)
- `contratics-realtime` (WebSockets)
- `contratics-auth` (GoTrue)
- `contratics-kong` (API Gateway)
- `contratics-studio` (Painel Visual do Banco)
- `contratics-web` (Frontend Contratics)

### Acesso no Navegador:
Abra em seu computador:
- **Aplicação Contratics**: `http://<IP_DA_VM>:3000`
- **Supabase Studio (Administração Visual)**: `http://<IP_DA_VM>:8001`

Entre na aplicação com qualquer um dos e-mails institucionais já cadastrados:
- **E-mail**: `arturcancio@gmail.com` ou `artur.cancio@planejamento.gov.br`
- **Senha Inicial**: `sof123`

---

## 8. Fluxo de Desenvolvimento Contínuo (Deploy sem Derrubar o Banco)

**"Dá para continuar editando o projeto pelo meu computador quando ele estiver em produção?"**
**SIM!** Esse é o fluxo profissional padrão de trabalho:

```mermaid
graph LR
    Dev[Seu PC Windows / Antigravity] -->|git push| Git[(GitHub / GitLab)]
    Git -->|git pull| VM[VM Ubuntu / Produção]
    VM -->|docker compose up -d --build contratics-web| Web[Aplicação Atualizada]
```

### Como funciona no dia a dia:
1. Você faz alterações de código, telas ou melhorias no seu ambiente local (Windows com Antigravity).
2. Envia para o repositório Git:
   ```bash
   git add .
   git commit -m "Nova funcionalidade adicionada"
   git push origin main
   ```
3. No servidor Ubuntu (onde o Contratics está rodando), basta executar:
   ```bash
   cd /opt/contratics
   git pull
   docker compose up -d --build contratics-web
   ```
4. **O banco de dados não para e nenhum dado é perdido!** O Docker recompila apenas o container do frontend (`contratics-web`) em cerca de 15 segundos e substitui a aplicação no ar de forma suave. O volume de dados do PostgreSQL permanece 100% intacto e online.

---

## 9. Como Migrar o Repositório para o Git da Empresa / Órgão

**"Consigo transferir o repositório privado para o Git da minha empresa sem problemas?"**
**SIM!** Como o Git é descentralizado, o código e todo o histórico de commits podem ser enviados para qualquer outro servidor Git (GitLab corporativo, GitHub Enterprise, Azure DevOps, Bitbucket ou Gitea interno) com apenas dois comandos.

### Passo a passo no seu computador (Windows):
1. Crie um projeto vazio no Git corporativo da sua empresa (ex: `https://gitlab.planejamento.gov.br/seu-usuario/contratics.git`).
2. No terminal do seu projeto, altere o endereço de envio remoto:
   ```bash
   git remote set-url origin https://gitlab.planejamento.gov.br/seu-usuario/contratics.git
   ```
3. Envie todos os arquivos e branches:
   ```bash
   git push -u origin --all
   git push -u origin --tags
   ```
4. Na máquina virtual do trabalho, basta clonar a partir do novo endereço corporativo:
   ```bash
   git clone https://gitlab.planejamento.gov.br/seu-usuario/contratics.git /opt/contratics
   ```

---

## 10. Configuração de Produção: Domínio Institucional e SSL/HTTPS

Em ambiente de produção no órgão, configure um proxy reverso Nginx no host com certificado digital para acesso seguro via HTTPS (porta 443):

### Instale o Nginx e Certbot no Ubuntu:
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Crie o arquivo de configuração do site:
```bash
sudo nano /etc/nginx/sites-available/contratics.conf
```

Conteúdo recomendado:
```nginx
server {
    listen 80;
    server_name contratics.planejamento.gov.br;

    # Frontend Contratics
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API Supabase e WebSockets
    location /api/ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Ative e gere o certificado SSL:
```bash
sudo ln -s /etc/nginx/sites-available/contratics.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Emitir certificado SSL automático
sudo certbot --nginx -d contratics.planejamento.gov.br
```

> **Nota**: Ao usar domínio HTTPS, altere no `.env` da VM:
> ```env
> VITE_SUPABASE_URL=https://contratics.planejamento.gov.br/api
> ```
> E reconstrua a web: `docker compose up -d --build contratics-web`.

---

## 11. Rotina de Backup e Restauração do Banco de Dados

### Gerar Backup Imediato do PostgreSQL:
```bash
docker exec -t contratics-db pg_dump -U postgres -d postgres > backup_contratics_$(date +%Y%m%d_%H%M%S).sql
```

### Restaurar Backup:
```bash
cat backup_contratics_YYYYMMDD_HHMMSS.sql | docker exec -i contratics-db psql -U postgres -d postgres
```

### Configurar Backup Automático Diário (Cron):
Crie a pasta de backups:
```bash
sudo mkdir -p /var/backups/contratics
sudo chown $USER:$USER /var/backups/contratics
```

Abra o crontab:
```bash
crontab -e
```

Adicione a linha para executar todos os dias às 03:00 da madrugada, mantendo backups compactados:
```bash
0 3 * * * docker exec -t contratics-db pg_dump -U postgres -d postgres | gzip > /var/backups/contratics/contratics_$(date +\%Y\%m\%d).sql.gz 2>&1
```

---

## 12. Comandos de Manutenção Rápida

| Ação | Comando |
| :--- | :--- |
| **Verificar status de todos os serviços** | `docker compose ps` |
| **Ver logs da aplicação web** | `docker compose logs -f contratics-web` |
| **Ver logs do banco de dados** | `docker compose logs -f contratics-db` |
| **Reiniciar todos os serviços** | `docker compose restart` |
| **Parar a stack mantendo os dados** | `docker compose down` |
| **Subir novamente** | `docker compose up -d` |
| **Atualizar código da web após git pull** | `docker compose up -d --build contratics-web` |
