# SIMPLE ArCh

Plataforma de colaboração para equipes de desenvolvimento. Funciona de
forma independente (login por e-mail/senha, boards e tasks próprios) e,
**opcionalmente**, sincroniza bidirecionalmente com o GitHub: tasks viram
Issues, e PRs/issues no GitHub atualizam o board via webhooks.

## Stack
- **Backend:** NestJS + Prisma + PostgreSQL (GitHub OAuth, JWT, webhooks HMAC)
- **Frontend:** React + Vite + Tailwind (board kanban com drag & drop)

## Rodar em dev
```bash
docker compose up -d          # Postgres (porta 5433)
npm run build && node dist/main.js   # API na 3000
cd web && npm run dev         # UI na 5173
```

Guia completo de configuração (OAuth App, webhook, túnel): `docs/SETUP_GITHUB.md`.

## Deploy (Vercel + Supabase)

Passo a passo em `docs/DEPLOY_VERCEL_SUPABASE.md`.
