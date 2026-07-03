import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { LinkRepoDto } from './dto/link-repo.dto';
import { InviteMemberDto } from './dto/invite-member.dto';

/**
 * Rotas de Workspace. Todas exigem JWT. Controller fino: só traduz HTTP
 * para chamadas do service — a autorização fina (roles) mora no service.
 *
 *   POST   /workspaces                       -> cria (criador vira OWNER)
 *   GET    /workspaces                       -> lista os meus
 *   GET    /workspaces/:id                   -> detalhe + membros
 *   PATCH  /workspaces/:id/repo              -> vincula/troca repo GitHub
 *   POST   /workspaces/:id/members           -> convida membro (por githubLogin)
 *   DELETE /workspaces/:id/members/:userId   -> remove membro
 *   DELETE /workspaces/:id                   -> apaga workspace (só OWNER)
 */
@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(user.id, dto);
  }

  @Get()
  listMine(@CurrentUser() user: AuthUser) {
    return this.workspacesService.listMine(user.id);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workspacesService.getById(user.id, id);
  }

  @Get(':id/activity')
  getActivity(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workspacesService.getActivity(user.id, id);
  }

  /** Feed nativo da plataforma (funciona mesmo sem repositório vinculado). */
  @Get(':id/feed')
  getFeed(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workspacesService.getFeed(user.id, id);
  }

  @Patch(':id/repo')
  linkRepo(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: LinkRepoDto,
  ) {
    return this.workspacesService.linkRepo(user.id, id, dto);
  }

  @Post(':id/members')
  inviteMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.workspacesService.inviteMember(user.id, id, dto);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') memberUserId: string,
  ) {
    return this.workspacesService.removeMember(user.id, id, memberUserId);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workspacesService.remove(user.id, id);
  }
}
