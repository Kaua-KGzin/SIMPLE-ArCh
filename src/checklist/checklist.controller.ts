import { Body, Controller, Delete, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceMembershipGuard } from '../workspaces/workspace-membership.guard';
import { ChecklistService } from './checklist.service';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';

/** Checklist de uma task. Exige JWT + membership (guard). */
@UseGuards(JwtAuthGuard, WorkspaceMembershipGuard)
@Controller('workspaces/:workspaceId/tasks/:taskId/checklist')
export class ChecklistController {
  constructor(private readonly checklist: ChecklistService) {}

  @Post()
  add(
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateChecklistItemDto,
  ) {
    return this.checklist.add(workspaceId, taskId, dto);
  }

  @Patch(':itemId')
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateChecklistItemDto,
  ) {
    return this.checklist.update(workspaceId, taskId, itemId, dto);
  }

  @Delete(':itemId')
  @HttpCode(204)
  remove(
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.checklist.remove(workspaceId, taskId, itemId);
  }
}
