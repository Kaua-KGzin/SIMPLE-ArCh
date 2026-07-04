import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceMembershipGuard } from '../workspaces/workspace-membership.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

/**
 * Comentários de uma task. Exigem JWT + membership no workspace. O guard é
 * defesa em profundidade: o service também revalida membership, mas barrar já
 * no guard mantém o padrão uniforme com as rotas de Task.
 */
@UseGuards(JwtAuthGuard, WorkspaceMembershipGuard)
@Controller('workspaces/:workspaceId/tasks/:taskId/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Post()
  create(
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(workspaceId, taskId, user.id, dto);
  }

  @Get()
  list(
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.list(workspaceId, taskId, user.id);
  }

  @Delete(':commentId')
  @HttpCode(204)
  remove(
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.remove(workspaceId, taskId, commentId, user.id);
  }
}
