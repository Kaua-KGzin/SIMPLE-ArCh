import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';

/**
 * ChecklistService — subtarefas marcáveis de uma task.
 *
 * Toda mutação re-emite a task no board (via TasksService.emitTaskUpdated),
 * para o progresso do checklist aparecer em tempo real sem F5.
 */
@Injectable()
export class ChecklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
  ) {}

  async add(workspaceId: string, taskId: string, dto: CreateChecklistItemDto) {
    await this.assertTask(workspaceId, taskId);
    // Novo item vai para o fim da lista (maior order + 1).
    const last = await this.prisma.checklistItem.findFirst({
      where: { taskId },
      orderBy: { order: 'desc' },
    });
    const item = await this.prisma.checklistItem.create({
      data: { taskId, text: dto.text, order: (last?.order ?? -1) + 1 },
    });
    await this.tasks.emitTaskUpdated(workspaceId, taskId);
    return item;
  }

  async update(
    workspaceId: string,
    taskId: string,
    itemId: string,
    dto: UpdateChecklistItemDto,
  ) {
    await this.assertTask(workspaceId, taskId);
    const existing = await this.prisma.checklistItem.findFirst({ where: { id: itemId, taskId } });
    if (!existing) throw new NotFoundException('Item de checklist não encontrado.');

    const item = await this.prisma.checklistItem.update({
      where: { id: itemId },
      data: { text: dto.text, done: dto.done },
    });
    await this.tasks.emitTaskUpdated(workspaceId, taskId);
    return item;
  }

  async remove(workspaceId: string, taskId: string, itemId: string): Promise<void> {
    await this.assertTask(workspaceId, taskId);
    const { count } = await this.prisma.checklistItem.deleteMany({ where: { id: itemId, taskId } });
    if (count === 0) throw new NotFoundException('Item de checklist não encontrado.');
    await this.tasks.emitTaskUpdated(workspaceId, taskId);
  }

  /** A task precisa existir E pertencer ao workspace da rota. */
  private async assertTask(workspaceId: string, taskId: string): Promise<void> {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, workspaceId } });
    if (!task) throw new NotFoundException('Task não encontrada neste workspace.');
  }
}
