import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceMembershipGuard } from '../workspaces/workspace-membership.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

/**
 * Rotas de Task, aninhadas sob um workspace. Exigem autenticação (JWT) E
 * membership no workspace da URL — sem o segundo guard, qualquer conta
 * autenticada poderia mexer em tasks de um workspace ao qual não pertence.
 *   POST /workspaces/:workspaceId/tasks  -> cria Task (e a Issue no GitHub)
 *   GET  /workspaces/:workspaceId/tasks  -> lista o board
 */
@UseGuards(JwtAuthGuard, WorkspaceMembershipGuard)
@Controller('workspaces/:workspaceId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(workspaceId, user.id, dto);
  }

  @Get()
  list(@Param('workspaceId') workspaceId: string) {
    return this.tasksService.listByWorkspace(workspaceId);
  }

  @Get(':taskId/code')
  getCode(@Param('workspaceId') workspaceId: string, @Param('taskId') taskId: string) {
    return this.tasksService.getCode(workspaceId, taskId);
  }

  @Patch(':taskId')
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(workspaceId, taskId, dto, user.id);
  }

  @Delete(':taskId')
  @HttpCode(204)
  remove(
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.remove(workspaceId, taskId, user.id);
  }

  @Patch(':taskId/status')
  updateStatus(
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.tasksService.updateStatus(workspaceId, taskId, dto.status, user.id);
  }
}
