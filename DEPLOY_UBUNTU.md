# Guia Completo de Instalação e Implantação do Contratics em Ubuntu Server Zerado

Este guia fornece instruções detalhadas, passo a passo, para instalar e executar a stack completa do **Contratics** (aplicação web + Supabase Self-Hosted com PostgreSQL, Realtime WebSockets, PostgREST, GoTrue Auth, Kong Gateway e Supabase Studio) em uma máquina virtual ou servidor físico **Ubuntu Server (22.04 LTS ou 24.04 LTS)** recém-instalado.

---

## 1. Requisitos Mínimos Recomendados

- **Sistema Operacional**: Ubuntu Server 22.04 LTS ou 24.04 LTS (64 bits)
- **CPU**: 2 núcleos (vCPU)
- **Memória RAM**: 4 GB (mínimo recomendado para rodar PostgreSQL, Realtime e Studio confortavelmente)
- **Armazenamento**: 25 GB SSD livres
- **Portas de Rede**:
  - `22/tcp`: Acesso SSH
  - `80/tcp`: Acesso HTTP (Contratics ou Nginx reverso)
  - `443/tcp`: Acesso HTTPS (SSL Certbot)
  - `3000/tcp`: Aplicação Web Contratics
  - `8000/tcp`: Supabase API Gateway (PostgREST + Realtime WebSockets)
  - `8001/tcp`: Supabase Studio (Painel de Gestão Visual do Banco)

---

## 2. Preparação do Servidor Ubuntu

Conecte-se via SSH ao servidor como usuário `root` ou com privilégios `sudo`:

```bash
ssh usuario@seu_servidor_ip
```

### Atualize os pacotes do sistema:
```bash
sudo apt update && sudo apt upgrade -y
```

### Instale pacotes auxiliares essenciais:
```bash
sudo apt install -y ca-certificates curl gnupg lsb-release git ufw htop
```

---

## 3. Instalação Oficial do Docker e Docker Compose

Recomenda-se utilizar o repositório oficial da Docker para garantir as versões mais estáveis e recentes do Docker Engine e do plugin Compose.

### Passo 3.1: Adicionar a chave GPG oficial do Docker:
```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

### Passo 3.2: Configurar o repositório estável do Docker:
```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

### Passo 3.3: Instalar Docker Engine, CLI, Containerd e Docker Compose:
```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### Passo 3.4: Habilitar o Docker para iniciar no boot e adicionar seu usuário ao grupo docker:
```bash
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
```
*(Se necessário, faça logout e login novamente para aplicar a permissão de grupo).*

### Verifique a instalação:
```bash
docker --version
docker compose version
```

---

## 4. Configuração do Firewall (UFW)

Proteja seu servidor liberando apenas as portas necessárias:

```bash
# Permitir SSH (evite perder o acesso remoto!)
sudo ufw allow 22/tcp

# Permitir portas do Contratics
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 8000/tcp
sudo ufw allow 8001/tcp

# Ativar firewall
sudo ufw enable
sudo ufw status verbose
```

---

## 5. Clonagem e Configuração do Projeto Contratics

### Passo 5.1: Clonar o repositório no diretório de sua preferência:
```bash
cd /opt
sudo git clone <URL_DO_SEU_REPOSITORIO_GIT> contratics
cd /opt/contratics
```
*(Ou envie os arquivos via `scp` ou `rsync`).*

### Passo 5.2: Configurar as Variáveis de Ambiente (`.env`):
Copie o modelo de ambiente:
```bash
cp .env.example .env
```

Abra o arquivo `.env` para edição:
```bash
nano .env
```

Se você estiver acessando o servidor por IP (rede local, VirtualBox ou IP público), ajuste `VITE_SUPABASE_URL`:
```env
# Exemplo com IP da máquina / VirtualBox (veja com 'hostname -I'):
VITE_SUPABASE_URL=http://172.27.1.106:8000

# Se for domínio corporativo com SSL:
# VITE_SUPABASE_URL=https://api.contratics.planejamento.gov.br
```

> **Atenção ao IP no VirtualBox / Ubuntu**:
> Ao rodar `hostname -I`, o sistema costuma exibir dois IPs (ex: `172.27.1.106 172.17.0.1`).
> - **`172.27.1.106`**: É o IP real da VM na sua rede (o que deve ser colocado no `.env` e acessado pelo navegador).
> - **`172.17.0.1`**: É a interface virtual interna do Docker (`docker0`), que **não** é acessível pela sua máquina host Windows. Nunca utilize o IP `172.17.0.1` no navegador.

Salve o arquivo com `Ctrl + O` e saia com `Ctrl + X`.

---

## 6. Como os Dados Reais são Inicializados

A pasta `docker/volumes/db/init/` já contém dois scripts SQL gerados:
1. `01_schema.sql`: Cria todas as 22 tabelas relacionais em PostgreSQL, habilita `REPLICA IDENTITY FULL`, adiciona todas as tabelas à publicação `supabase_realtime`, cria índices GIN e a função `merge_document`.
2. `02_real_data.sql`: Contém **todos os 475 registros reais** exportados do Firestore (usuários institucionais, fornecedores, contratos, DFDs, históricos, SIOP, etc.).

Quando o PostgreSQL inicia pela primeira vez, o Docker executa esses scripts automaticamente, deixando o banco pronto com todos os dados reais.

---

## 7. Inicialização da Stack Contratics

Com o Docker Compose, basta um único comando para construir a imagem web e subir todos os 7 serviços em background:

```bash
cd /opt/contratics
docker compose up -d --build
```

### Acompanhando a subida dos containers:
```bash
docker compose ps
```

Você verá a seguinte saída:
- `contratics-db` (PostgreSQL 15) - Status: `Up (healthy)`
- `contratics-rest` (PostgREST) - Status: `Up`
- `contratics-realtime` (WebSockets) - Status: `Up`
- `contratics-auth` (GoTrue) - Status: `Up`
- `contratics-kong` (API Gateway) - Status: `Up`
- `contratics-studio` (Dashboard) - Status: `Up`
- `contratics-web` (Aplicação React Nginx) - Status: `Up`

### Verificando logs dos serviços:
```bash
# Ver todos os logs em tempo real
docker compose logs -f

# Ver logs apenas da aplicação web
docker compose logs -f contratics-web

# Ver logs do banco de dados
docker compose logs -f contratics-db
```

---

## 8. Acesso ao Sistema

Abra seu navegador:
- **Aplicação Contratics**: `http://<SEU_IP_OU_DOMINIO>:3000`
- **Painel Supabase Studio**: `http://<SEU_IP_OU_DOMINIO>:8001`
- **API Gateway Supabase**: `http://<SEU_IP_OU_DOMINIO>:8000`

### Como Entrar no Sistema:
Utilize os e-mails institucionais já cadastrados (por exemplo, `artur.cancio@planejamento.gov.br` ou `arturcancio@gmail.com`) com a senha padrão inicial `sof123`.

---

## 9. Validação da Reatividade em Tempo Real

O Contratics possui funcionalidades com resposta visual imediata que foram 100% mantidas e otimizadas com o Supabase:

1. **Ativação / Desativação de DFDs**:
   - Acesse o menu **Orçamento Atual** ou **DFDs**.
   - Alterne o interruptor de contabilização de um DFD em um ano específico.
   - **Resultado**: O cálculo total e o gráfico são recalculados no mesmo instante (0 ms de latência percebida graças ao cache otimista), e a alteração é persistida no PostgreSQL via `merge_document` e transmitida para qualquer outro usuário conectado via WebSocket.
2. **Perspectiva de Renovação de Contratos**:
   - Na lista de contratos ou no simulador plurianual, ative ou desative a perspectiva de renovação.
   - **Resultado**: O cálculo do saldo contratual e vigências é atualizado em tempo real.
3. **Quadro Kanban de Processos**:
   - Arraste um card de tarefa entre as colunas (ex: de *Em Elaboração* para *Aguardando Assinatura*).
   - **Resultado**: A posição atualiza instantaneamente e é sincronizada no Supabase.

---

## 10. Configuração de Domínio e SSL Gratuito (Opcional - Recomendado para Produção)

Para rodar em domínio institucional com certificado HTTPS (ex: `https://contratics.empresa.gov.br`):

### Passo 10.1: Instalar Nginx no host Ubuntu e Certbot:
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Passo 10.2: Criar arquivo de configuração do proxy reverso:
```bash
sudo nano /etc/nginx/sites-available/contratics.conf
```

Adicione o conteúdo:
```nginx
server {
    listen 80;
    server_name contratics.seu-dominio.gov.br;

    # Aplicação Web
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Supabase API e WebSockets
    location /supabase/ {
        rewrite ^/supabase/(.*) /$1 break;
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Passo 10.3: Ativar o site e emitir certificado SSL:
```bash
sudo ln -s /etc/nginx/sites-available/contratics.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Emitir certificado SSL Let's Encrypt
sudo certbot --nginx -d contratics.seu-dominio.gov.br
```

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

### Agendar Backup Diário Automático via Cron:
Abra o crontab:
```bash
crontab -e
```
Adicione a linha para rodar todos os dias às 03:00 da manhã:
```bash
0 3 * * * docker exec -t contratics-db pg_dump -U postgres -d postgres > /opt/backups/contratics_$(date +\%Y\%m\%d).sql 2>&1
```

---

## 12. Comandos Úteis de Manutenção

```bash
# Reiniciar todos os serviços
docker compose restart

# Parar todos os serviços
docker compose down

# Subir novamente
docker compose up -d

# Atualizar código após alterações no Git
git pull
docker compose up -d --build contratics-web
```
