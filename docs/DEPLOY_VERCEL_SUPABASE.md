# Deploy — Vercel + Supabase

A aplicação sobe como **um único projeto na Vercel**: o frontend (Vite) é
servido como estático e a API NestJS roda como função serverless em
`api/index.js`. Mesma origem = sem CORS. O banco é um Postgres gerenciado
no **Supabase**.

## O que já está pronto

- Projeto Supabase **`simple-arch`** criado (região `sa-east-1`, São Paulo),
  com todas as migrations aplicadas e **RLS habilitado** em todas as tabelas
  (a API pública do Supabase fica bloqueada; só a nossa API, via Prisma,
  acessa o banco).
- `vercel.json` com build, rotas da API e fallback de SPA.
- `api/index.js` (entrada serverless) e `binaryTargets` do Prisma para o
  runtime da Vercel.

## Passos (uma vez, no painel da Vercel)

1. **Importar o repositório**: vercel.com > Add New > Project >
   `Kaua-KGzin/SIMPLE-ArCh`. A Vercel lê o `vercel.json` sozinha — não mude
   build command nem output directory.

2. **Variáveis de ambiente** (Settings > Environment Variables):

   | Nome | Valor |
   |---|---|
   | `DATABASE_URL` | String **Transaction pooler** do Supabase (painel do projeto > Connect) **com `?pgbouncer=true` no final**. A senha do banco pode ser redefinida em Settings > Database > Reset database password. |
   | `JWT_SECRET` | Gere: `openssl rand -hex 32` |
   | `ENCRYPTION_KEY` | Gere: `openssl rand -hex 32` (precisa ter exatamente 64 chars hex) |
   | `FRONTEND_URL` | A URL do próprio deploy, ex.: `https://simple-arch.vercel.app` |

   > Segurança: gere valores NOVOS para produção — nunca reuse os de dev,
   > nunca commite esses valores no repositório.

   Opcionais (só para "Entrar com GitHub" + sync de Issues em produção):
   ver a seção "GitHub em produção" abaixo.

3. **Deploy**: a Vercel builda a branch escolhida a cada push. Faça o merge
   da branch de trabalho na `main` (ou aponte o projeto para a branch) e o
   deploy sai sozinho.

## GitHub em produção (login GitHub + sync de Issues/PRs)

O login por e-mail/senha funciona sem nada disto. Configure só se quiser o
botão "Entrar com GitHub" e o espelhamento task ↔ Issue.

1. **OAuth App**: GitHub → Settings → Developer settings → OAuth Apps →
   **New OAuth App**:
   - Homepage URL: `https://simple-ar-ch.vercel.app`
   - Authorization callback URL:
     `https://simple-ar-ch.vercel.app/auth/github/callback`
   - Depois de criar: **Generate a new client secret** (copie na hora).

2. **Variáveis na Vercel** (Settings → Environment Variables, Production):

   | Nome | Valor |
   |---|---|
   | `GITHUB_CLIENT_ID` | Client ID do OAuth App |
   | `GITHUB_CLIENT_SECRET` | Client secret gerado |
   | `GITHUB_CALLBACK_URL` | `https://simple-ar-ch.vercel.app/auth/github/callback` |
   | `GITHUB_WEBHOOK_SECRET` | segredo novo (`openssl rand -hex 32`) |

   Depois: **Deployments → ⋯ → Redeploy** (variável nova exige deploy novo).

3. **Webhook em cada repositório sincronizado**: repo → Settings →
   Webhooks → **Add webhook**:
   - Payload URL: `https://simple-ar-ch.vercel.app/api/webhooks/github`
   - Content type: `application/json`
   - Secret: o MESMO valor de `GITHUB_WEBHOOK_SECRET`
   - Events: "Let me select individual events" → **Issues** e
     **Pull requests**.

4. **Vinculação de contas**: quem já tem conta local (e-mail/senha) e loga
   com GitHub usando o mesmo e-mail tem as contas unificadas
   automaticamente — passa a poder entrar dos dois jeitos.

## Verificação pós-deploy

1. Abra a URL do projeto → tela de login.
2. Crie uma conta por e-mail/senha, crie um workspace **sem** repositório e
   uma task — deve funcionar sem nenhuma configuração de GitHub.
3. Comente na task (com @menção) e abra o painel Atividade → aba Equipe.
4. Recarregue a página: os dados persistem (estão no Supabase).
5. Com GitHub configurado: "Entrar com GitHub" funciona, task criada em
   workspace com repo vira Issue, e PR com `feature/issue-N` move a task.
