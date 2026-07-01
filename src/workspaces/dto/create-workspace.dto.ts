import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * DTO para criar um Workspace.
 * O vínculo com o repositório é OPCIONAL na criação: dá para criar o workspace
 * primeiro e vincular o repo depois (PATCH /workspaces/:id/repo).
 */
export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  /**
   * "owner/repo" (ex.: "acme/backend"). Se vier, buscamos o githubRepoId
   * automaticamente via API do GitHub — nada de seed manual.
   */
  @IsString()
  @IsOptional()
  @Matches(/^[\w.-]+\/[\w.-]+$/, {
    message: 'repoFullName deve estar no formato "owner/repo".',
  })
  repoFullName?: string;
}
