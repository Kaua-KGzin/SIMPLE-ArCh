# SIMPLE ArCh

Plataforma de colaboração para equipes de desenvolvimento, **sincronizada
bidirecionalmente com o GitHub**: tasks criadas na plataforma viram Issues,
e PRs/issues no GitHub atualizam o board automaticamente via webhooks.

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
