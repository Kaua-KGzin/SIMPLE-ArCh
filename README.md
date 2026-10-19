# SIMPLE ArCh

Plataforma de colaboração para equipes de desenvolvimento. Funciona de
forma independente (login por e-mail/senha, boards e tasks próprios) e,
**opcionalmente**, sincroniza bidirecionalmente com o GitHub: tasks viram
Issues, e PRs/issues no GitHub atualizam o board via webhooks. Board,
comentários (com @menções) e notificações pessoais (menção, atribuição de
task) atualizam em tempo real via WebSocket.

## Stack
- **Backend:** NestJS + Prisma + PostgreSQL (GitHub OAuth, JWT, webhooks HMAC, WebSocket via Socket.IO)
- **Frontend:** React + Vite + Tailwind (board kanban com drag & drop)

## Rodar em dev
```bash
docker compose up -d          # Postgres (porta 5433)
npm run build && node dist/main.js   # API na 3000
cd web && npm run dev         # UI na 5173
```

Guia completo de configuração (OAuth App, webhook, túnel): `docs/SETUP_GITHUB.md`.

## Linha Arch

O SIMPLE ArCh faz parte da **linha Arch** — sistemas independentes que se
enxergam pelo [Arch Hub](https://github.com/Kaua-KGzin/System-Arch/blob/main/docs/ARCH-LINE.md):

| Sistema | Papel | |
|---|---|---|
| [Arch Hub](https://github.com/Kaua-KGzin/System-Arch) | platform | catálogo central e status da linha |
| [ARCHNEXUS / System-PVD](https://github.com/Kaua-KGzin/System-PVD) | business | ERP & PDV |
| [SIMPLE ArCh](https://github.com/Kaua-KGzin/SIMPLE-ArCh) | collaboration | boards e tasks com sync GitHub |
| [ArchMAP](https://github.com/Kaua-KGzin/ArchMAP) | insight | análise estática de arquitetura |

Para aparecer no Hub, defina `ARCHHUB_URL` (e `ARCHHUB_TOKEN`, se o Hub exigir).
Sem ela, nada muda. Detalhes em `src/integrations/arch-hub.service.ts` e no
[contrato da linha](https://github.com/Kaua-KGzin/System-Arch/blob/main/docs/ARCH-LINE.md). Manifesto: `arch.json`.

## Deploy (Vercel + Supabase)

Passo a passo em `docs/DEPLOY_VERCEL_SUPABASE.md`.
