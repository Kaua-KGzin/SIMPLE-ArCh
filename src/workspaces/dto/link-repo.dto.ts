import { IsNotEmpty, IsString, Matches } from 'class-validator';

/** DTO para vincular (ou trocar) o repositório GitHub de um Workspace. */
export class LinkRepoDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[\w.-]+\/[\w.-]+$/, {
    message: 'repoFullName deve estar no formato "owner/repo".',
  })
  repoFullName!: string;
}
