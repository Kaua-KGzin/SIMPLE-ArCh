import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceMembershipGuard } from '../workspaces/workspace-membership.guard';
import { LabelsService } from './labels.service';
import { CreateLabelDto } from './dto/create-label.dto';

/** Etiquetas de um workspace. Exige JWT + membership (guard). */
@UseGuards(JwtAuthGuard, WorkspaceMembershipGuard)
@Controller('workspaces/:workspaceId/labels')
export class LabelsController {
  constructor(private readonly labels: LabelsService) {}

  @Get()
  list(@Param('workspaceId') workspaceId: string) {
    return this.labels.list(workspaceId);
  }

  @Post()
  create(@Param('workspaceId') workspaceId: string, @Body() dto: CreateLabelDto) {
    return this.labels.create(workspaceId, dto);
  }

  @Delete(':labelId')
  @HttpCode(204)
  remove(@Param('workspaceId') workspaceId: string, @Param('labelId') labelId: string) {
    return this.labels.remove(workspaceId, labelId);
  }
}
