# Guia de Configuração — Integração com o GitHub

Este guia leva o projeto do "código pronto" até "fluxo bidirecional funcionando com dados
reais". É dividido em 4 partes. Faça na ordem.

> **Conceito-chave:** o GitHub precisa de duas coisas distintas:
> 1. Uma **OAuth App** → para usuários fazerem login e nós agirmos em nome deles (criar Issues).
> 2. Um **Webhook** no repositório → para o GitHub nos avisar quando um PR é aberto.
> São configurações separadas, em telas diferentes.

---

## Parte 1 — Criar a OAuth App (login + criar Issues)

1. Acesse: **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**
   (link direto: https://github.com/settings/developers)
2. Preencha:
   - **Application name:** `SIMPLE ArCh (dev)`
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `http://localhost:3000/auth/github/callback`
     ⚠️ Precisa ser **idêntico** ao `GITHUB_CALLBACK_URL` do `.env`.
3. Clique em **Register application**.
4. Copie o **Client ID**.
5. Clique em **Generate a new client secret** e copie o valor (ele só aparece UMA vez).
6. No arquivo `.env`, preencha:
   ```env
   GITHUB_CLIENT_ID="<o client id copiado>"
   GITHUB_CLIENT_SECRET="<o client secret copiado>"
   ```

> **Por que precisamos disso?** O `client_secret` é o que prova ao GitHub que a troca
> `code → access_token` (passo 4 do OAuth) veio do nosso backend, e não de um impostor.
> Por isso ele NUNCA vai para o frontend.

### Escopos (scopes) que pedimos
No `auth.controller.ts` pedimos `read:user user:email repo`:
- `read:user` / `user:email` → ler o perfil e e-mail para criar o User.
- `repo` → criar Issues e ler PRs no repositório. (É um escopo amplo; em produção,
  considere migrar para um **GitHub App** com permissões granulares — ver Parte 4.)

---

## Parte 2 — Expor o backend local com um túnel (para o Webhook)

O GitHub roda na nuvem e precisa enviar o webhook para o **seu** computador. Mas
`http://localhost:3000` não é acessível pela internet. A solução é um **túnel** que cria
uma URL pública temporária apontando para a sua máquina.

### Opção A — ngrok (mais conhecido)
1. Instale: https://ngrok.com/download (ou `winget install ngrok`)
2. Crie conta grátis e copie seu authtoken; rode uma vez:
   ```bash
   ngrok config add-authtoken <SEU_TOKEN>
   ```
3. Com o backend rodando na 3000, abra outro terminal:
   ```bash
   ngrok http 3000
   ```
4. O ngrok mostra algo como:
   ```
   Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
   ```
   Guarde essa URL `https://abc123.ngrok-free.app` — é a **URL pública** do seu backend.

### Opção B — Cloudflare Tunnel (alternativa sem cadastro de token)
```bash
# instale o cloudflared, depois:
cloudflared tunnel --url http://localhost:3000
```
Também imprime uma URL pública `https://....trycloudflare.com`.

> **Atenção:** a URL do túnel **muda** cada vez que você reinicia o ngrok (no plano grátis).
> Sempre que mudar, atualize o webhook (Parte 3) e o `GITHUB_CALLBACK_URL` se for testar OAuth
> pelo túnel. Para o login, dá para continuar usando `localhost` no navegador.

---

## Parte 3 — Configurar o Webhook no repositório

1. Vá ao **repositório** que o Workspace vai representar →
   **Settings → Webhooks → Add webhook**.
2. Preencha:
   - **Payload URL:** `https://abc123.ngrok-free.app/api/webhooks/github`
     (a URL pública da Parte 2 + o caminho do nosso endpoint)
   - **Content type:** `application/json`  ⚠️ obrigatório (nosso parser espera JSON)
   - **Secret:** o MESMO valor de `GITHUB_WEBHOOK_SECRET` no `.env`
     (no dev está como `dev-webhook-secret` — troque por algo forte).
   - **Which events?** → **Let me select individual events** → marque **Pull requests**
     e **Issues**. Desmarque "Pushes" se estiver marcado.
3. **Add webhook**.

> **Por que o Secret?** É com ele que calculamos o HMAC (`X-Hub-Signature-256`).
> Sem o Secret correto dos dois lados, nosso backend responde **401** e ignora o evento —
> exatamente a proteção que testamos.

### Verificando
- Na própria tela do webhook, aba **Recent Deliveries**, o GitHub mostra cada entrega
  e a resposta do seu servidor. Um `202 Accepted` (nosso `@HttpCode(ACCEPTED)`) = sucesso.
- O GitHub envia um evento `ping` ao criar o webhook. Ele cairá no `default` do nosso
  switch (ignorado), mas a assinatura é validada — bom sinal se vier 202.

---

## Parte 4 — Testando o fluxo completo (ponta a ponta)

Pré-requisitos: banco no ar (`docker compose up -d`), `.env` preenchido, app rodando
(`npm run start:dev`) e o túnel ativo.

### 4.1 — Login (cria seu User com o token criptografado)
1. No navegador: `http://localhost:3000/auth/github/login`
2. Autorize o app no GitHub.
3. Você será redirecionado para `FRONTEND_URL/auth/success?token=<JWT>`.
   Como o frontend ainda não existe, a página dará erro — **mas o importante já aconteceu**:
   seu User foi criado no banco. Copie o `token` da URL (é o seu JWT para as próximas chamadas).

Confirme no banco:
```bash
npx prisma studio   # abre a GUI; veja a tabela users
```

### 4.2 — Criar um Workspace vinculado ao repo (seed manual, por enquanto)
Ainda não há endpoint de Workspace (está nos pendentes). Crie um direto via Prisma Studio
ou com este script rápido (`npx ts-node` ou cole no Studio):
- `name`: ex. "Backend"
- `slug`: "backend"
- `githubRepoId`: o ID numérico do repo (veja em `https://api.github.com/repos/OWNER/REPO` → campo `id`)
- `githubRepoFullName`: "OWNER/REPO"
- `ownerId`: o `id` do seu User (da etapa 4.1)

### 4.3 — Criar uma Task (dispara a criação da Issue no GitHub!)
Com o JWT do passo 4.1 e o `id` do workspace:
```bash
curl -X POST "http://localhost:3000/workspaces/<WORKSPACE_ID>/tasks" \
  -H "Authorization: Bearer <SEU_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Implementar login","description":"Tela de login com GitHub"}'
```
✅ Resultado esperado: uma **Issue nova aparece no repositório do GitHub**, e a resposta
traz a Task com `githubIssueNumber` preenchido. **Esse é o lado Plataforma → GitHub.**

### 4.4 — Abrir um PR (dispara o webhook → Task vira IN_REVIEW)
1. No repositório, crie uma branch seguindo o padrão do número da Issue:
   ```bash
   git checkout -b feature/issue-<N>   # N = número da Issue criada em 4.3
   git commit --allow-empty -m "wip"
   git push -u origin feature/issue-<N>
   ```
2. Abra um Pull Request dessa branch (pode pôr "Closes #N" na descrição também).
3. O GitHub envia o webhook → nosso backend lê o número e move a Task para **IN_REVIEW**.
4. Confirme no Prisma Studio (campo `status` da Task) ou nos logs do app.

### 4.5 — Mergear o PR (Task vira DONE)
Ao mergear o PR, o evento `pull_request` com `action=closed` e `merged=true` move a Task
para **DONE**. Ciclo completo. 🎉

---

## Resolução de problemas (troubleshooting)

| Sintoma | Causa provável | Solução |
|---|---|---|
| Webhook retorna **401** | `GITHUB_WEBHOOK_SECRET` diferente dos dois lados | Igualar o Secret no GitHub e no `.env`, reiniciar o app |
| Login redireciona com `client_id=preencher` | `.env` não preenchido / app não reiniciado | Preencher e reiniciar (o `.env` é lido no boot) |
| `redirect_uri mismatch` no GitHub | Callback URL difere | Igualar exatamente OAuth App ↔ `GITHUB_CALLBACK_URL` |
| Webhook não chega (Recent Deliveries vazio) | Túnel caiu / URL mudou | Reiniciar túnel e atualizar a Payload URL |
| Task não muda de status | Número da Issue não casou | Conferir padrão da branch/título (`feature/issue-N` ou `#N`) e se o `githubRepoId` do Workspace bate com o repo |
| `P1000 Authentication failed` no Prisma | Postgres local na 5432 conflitando | Já tratado: usamos a porta **5433** (ver `docker-compose.yml` e `.env`) |

---

## Evolução futura: OAuth App → GitHub App
Para produção, um **GitHub App** é superior à OAuth App:
- Permissões **granulares** (não precisa do escopo `repo` inteiro).
- Tokens de instalação de curta duração + **refresh tokens** (já temos a coluna no schema).
- Webhooks centralizados por instalação.
Fica como melhoria futura — a arquitetura atual já está preparada (campo `githubRefreshToken`).
