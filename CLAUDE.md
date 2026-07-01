# CLAUDE.md — Memória do Projeto "SIMPLE ArCh"

> Memória persistente do projeto. Toda sessão do Claude Code deve ler este arquivo
> primeiro e mantê-lo atualizado ao final de cada trabalho relevante.

---

## 1. Visão Geral

Plataforma de colaboração de desenvolvimento (estilo Linear/Jira) **integrada nativamente ao
GitHub**. Diferencial: **sincronismo bidirecional**.
- Plataforma → GitHub (criar task cria uma Issue via API).
- GitHub → Plataforma (abrir PR via git atualiza a task via Webhook).

### Equipe
- **Dono/Admin** (líder): cria Workspace, vincula repo/org, dita as regras.
- **Colaborador** (dev iniciante): vê o quadro, recebe tasks, trabalha nas branches.
- **Tom esperado do Claude:** técnico, preciso, **didático**, sempre explicando o "porquê".

---

## 2. Stack
- **Backend:** Node.js + **NestJS** + TypeScript (Nest > Express puro por DI e POO nativas).
- **Banco:** PostgreSQL + **Prisma ORM**.
- **Auth:** GitHub OAuth + JWT próprio.
- **Frontend:** AINDA NÃO INICIADO (foco atual 100% backend).

---

## 3. Fluxo da Task (regra central)
```
[Criar Task na plataforma] -> API GitHub -> [Issue criada com nº]
        ^                                         |
        |                                         v
        |                          [Dev: branch feature/issue-12]
        |                                         |
        +----- Webhook "PR aberto" <-------- git push + abre PR
               => Task -> IN_REVIEW
```
PR mergeado → Task vai para **DONE**. O nº da Issue é lido do título/corpo/branch do PR.

---

## 4. Modelo de Dados (`prisma/schema.prisma`)
- **User** — `githubId` (imutável, usado p/ match), tokens OAuth **criptografados** (AES-256-GCM).
- **Workspace** — vínculo de repo (`githubRepoId`, `githubRepoFullName`) + `owner`.
- **WorkspaceMember** — pivô N:N (User↔Workspace) **com `role`** (OWNER/ADMIN/MEMBER).
- **Task** — `@@unique([workspaceId, githubIssueNumber])`. Status: BACKLOG/TODO/IN_PROGRESS/IN_REVIEW/DONE.

---

## 5. Segurança (não regredir)
- Token do GitHub nunca em texto puro → AES-256-GCM (`ENCRYPTION_KEY`, 32 bytes hex).
- OAuth: `state` anti-CSRF (cookie httpOnly), `client_secret` só no backend, emitimos JWT próprio.
- Webhook: validar HMAC SHA-256 (`X-Hub-Signature-256`) com `timingSafeEqual` sobre o **rawBody**.

---

## 6. Estrutura de Arquivos (estado atual)
```
prisma/schema.prisma               # FONTE DA VERDADE do modelo
src/main.ts                        # bootstrap + captura rawBody p/ HMAC
src/app.module.ts                  # módulo raiz / container DI
src/prisma/prisma.service.ts       # PrismaClient injetável (singleton)
src/common/crypto.util.ts          # AES-256-GCM
src/auth/auth.controller.ts        # GET /auth/github/login e /callback
src/auth/github-oauth.service.ts   # code->token, upsert User, emite JWT
src/auth/jwt.strategy.ts           # valida nosso JWT
src/webhooks/github-webhook.controller.ts  # POST /api/webhooks/github
src/webhooks/github-webhook.service.ts     # HMAC, roteamento, Task->IN_REVIEW
.env.example
```

---

## 7. Estado / Pendências (atualizar a cada sessão)

### Feito (sessão 2026-06-28)
- [x] Schema Prisma (User, Workspace, WorkspaceMember, Task + enums).
- [x] Fluxo OAuth GitHub (login, callback, troca de token, upsert, JWT).
- [x] Criptografia AES-256-GCM dos tokens.
- [x] Webhook `pull_request` → Task IN_REVIEW (e DONE no merge).
- [x] Setup do projeto: package.json, tsconfig, nest-cli.json, jest.config.js, .gitignore.
- [x] `npm install` + `prisma generate` OK. `tsc --noEmit` e `nest build` passam.
- [x] Parser de task extraído p/ util puro (`task-reference.util.ts`).
- [x] **13 testes passando** (extractTaskNumbers, CryptoUtil round-trip/tamper, verifySignature HMAC).
- [x] **Plataforma → GitHub:** `GithubApiService` + `TasksService` (cria Issue via API e persiste Task).
- [x] `JwtAuthGuard` + `@CurrentUser()` + `TasksController` (rotas protegidas) + `CreateTaskDto`.
- [x] **Docker Postgres** (`docker-compose.yml`) + **migration `init` aplicada** (tabelas criadas).
- [x] **App sobe e responde**: login→302 GitHub, webhook sem assinatura→401, rota protegida→401.

### Feito (sessão 2026-07-01)
- [x] **CRUD de Workspace completo** (`src/workspaces/`): criar (slug único auto-gerado,
      criador vira OWNER via transação), listar meus, detalhe+membros, deletar (só OWNER).
- [x] **Vínculo de repo automático**: `PATCH /workspaces/:id/repo` — `GithubApiService.getRepo()`
      busca o `githubRepoId` via API com o token do usuário; conflito se repo já vinculado a outro WS.
- [x] **Convite de membros** por `githubLogin` (usuário precisa já ter logado) com role
      ADMIN/MEMBER; remoção de membro (OWNER não removível). Autorização por role no service.
- [x] `tsc --noEmit`, `nest build` e os 13 testes passam.
- [x] **Repo publicado no GitHub**: https://github.com/Kaua-KGzin/SIMPLE-ArCh (branch `main`).
      O passo 4.2 (seed manual) do SETUP_GITHUB.md está obsoleto — usar as rotas de workspace.

### Documentação
- **`docs/SETUP_GITHUB.md`** — guia passo a passo: criar OAuth App, túnel (ngrok), webhook
  do repo e teste ponta a ponta (login → criar Task → Issue → PR → IN_REVIEW → merge → DONE).

### Notas de ambiente (importante!)
- Há um **Postgres local na porta 5432** → nosso container usa **5433** (host). DATABASE_URL no .env aponta p/ 5433.
- Subir banco: `docker compose up -d`. Credenciais dev: simple / simple_dev_pwd / simple_arch.
- Rodar app: `npm run build && node dist/main.js` (ou `npm run start:dev`).

### ▶️ RETOMAR AQUI (próxima sessão)
Tudo compila/testa/sobe. Para voltar ao trabalho:
1. `docker compose up -d` (sobe o Postgres na 5433)
2. `npm run start:dev`
**Próxima tarefa decidida:** handler do evento **`issues`** no webhook (GitHub → Plataforma):
issue criada no GitHub cria Task; issue editada/fechada sincroniza a Task. Fecha de vez o
sincronismo bidirecional.

### Pendente (próximos passos)
- [ ] Handler do evento `issues` no webhook (GitHub → cria/atualiza Task).
- [ ] CRUD de Workspace + vínculo de repo + convite de membros (roles) — hoje só existe via seed manual.
- [ ] Preencher GITHUB_CLIENT_ID/SECRET reais p/ testar OAuth e criação de Issue de verdade.
- [ ] Testes e2e do webhook e do fluxo de criação de Task.
- [ ] Fila (BullMQ) p/ webhooks assíncronos.
- [ ] Frontend.
- [ ] Handler do evento `issues` (sincronizar Task quando a Issue muda no GitHub).
- [ ] CRUD de Workspace + vínculo de repo + convite de membros (roles).
- [ ] `JwtAuthGuard` + decorator `@CurrentUser()` nas rotas protegidas.
- [ ] DTOs com class-validator.
- [ ] Fila (BullMQ) p/ webhooks assíncronos/resilientes.
- [ ] Setup: `package.json`, `tsconfig.json`, `nest-cli.json`, scripts Prisma.
- [ ] Testes (unit: extractTaskNumbers, verifySignature; e2e: webhook).
- [ ] Frontend (só após backend estável).

---

## 8. Comandos úteis (quando o setup existir)
```bash
npx prisma migrate dev --name init
npx prisma generate
npx prisma studio
npm run start:dev
openssl rand -hex 32      # ENCRYPTION_KEY / JWT_SECRET
```

---

## 9. Convenções
- Branches: `feature/issue-<n>` (o webhook depende disso p/ casar a Task).
- Controllers finos (HTTP) + Services com a regra de negócio (Single Responsibility).
- Dependências sempre via injeção no construtor (não usar `new` para serviços).
- Erros via exceptions do Nest; nunca engolir silenciosamente.

---

## Apêndice — Especificação original do líder (preservada)

🛠️ O segredo da plataforma é o **sincronismo bidirecional**. O que acontece na plataforma
reflete no GitHub, e o que acontece no GitHub (via terminal/git) atualiza a plataforma.

👥 **Permissões:** Dono/Admin cria o Workspace e vincula o repo; Colaborador vê o quadro,
recebe tasks e trabalha nas branches.

🔄 **Fluxo:** Criar Task → backend cria Issue (o ID vira referência da Task) → dev cria branch
`feature/issue-12` → `git push` + abre PR → GitHub dispara Webhook → backend identifica o nº da
Issue e move a Task para "Em Revisão (Code Review)".

🗄️ **Entidades (mínimo 4):**
- **User:** id, github_id, email, avatar_url, access_token (criptografado).
- **Workspace/Project:** id, name, github_repo_url, owner_id.
- **Task:** id, github_issue_number, title, description, status, assigned_to.
- **WorkspaceMember:** pivô para associar múltiplos usuários ao projeto.
