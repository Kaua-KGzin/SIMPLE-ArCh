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
   `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`,
   `GITHUB_CALLBACK_URL` (`https://<sua-url>/auth/github/callback`) e
   `GITHUB_WEBHOOK_SECRET`. Requer criar um OAuth App de produção no GitHub
   com esse callback.

3. **Deploy**: a Vercel builda a branch escolhida a cada push. Faça o merge
   da branch de trabalho na `main` (ou aponte o projeto para a branch) e o
   deploy sai sozinho.

## Verificação pós-deploy

1. Abra a URL do projeto → tela de login.
2. Crie uma conta por e-mail/senha, crie um workspace **sem** repositório e
   uma task — deve funcionar sem nenhuma configuração de GitHub.
3. Recarregue a página: os dados persistem (estão no Supabase).
