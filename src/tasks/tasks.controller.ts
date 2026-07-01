import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';

/**
 * Rotas de Task, aninhadas sob um workspace. Todas exigem autenticação (JWT).
 *   POST /workspaces/:workspaceId/tasks  -> cria Task (e a Issue no GitHub)
 *   GET  /workspaces/:workspaceId/tasks  -> lista o board
 */
@UseGuards(JwtAuthGuard)
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
}
