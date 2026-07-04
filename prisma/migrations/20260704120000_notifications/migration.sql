-- Notificações pessoais (menção, atribuição) + base para tempo real via WebSocket.

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MENTION', 'ASSIGNED', 'COMMENT');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "taskId" TEXT,
    "commentId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_userId_read_createdAt_idx" ON "notifications"("userId", "read", "createdAt");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Segurança: RLS ligado (acesso só via Prisma/owner; bloqueia API pública do Supabase)
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
