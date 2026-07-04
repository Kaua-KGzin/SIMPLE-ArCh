-- tokenVersion no usuário: permite revogar todos os JWTs (sair de todos os
-- dispositivos / troca de senha) sem tabela de sessão.
ALTER TABLE "users" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
