-- Login local (email/senha) como alternativa ao GitHub OAuth:
-- githubId/githubLogin deixam de ser obrigatórios e ganhamos passwordHash.
ALTER TABLE "users" ALTER COLUMN "githubId" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "githubLogin" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "passwordHash" TEXT;
