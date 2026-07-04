import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLabelDto } from './dto/create-label.dto';

/**
 * LabelsService — etiquetas por workspace. A checagem de membership fica no
 * WorkspaceMembershipGuard do controller; aqui é só a regra de negócio.
 */
@Injectable()
export class LabelsService {
  constructor(private readonly prisma: PrismaService) {}

  list(workspaceId: string) {
    return this.prisma.label.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });
  }

  async create(workspaceId: string, dto: CreateLabelDto) {
    try {
      return await this.prisma.label.create({
        data: { workspaceId, name: dto.name.trim(), color: dto.color },
      });
    } catch (err: any) {
      // P2002 = viola o unique (workspaceId, name): já existe etiqueta com esse nome.
      if (err?.code === 'P2002') {
        throw new ConflictException(`Já existe uma etiqueta "${dto.name}" neste workspace.`);
      }
      throw err;
    }
  }

  async remove(workspaceId: string, labelId: string): Promise<void> {
    // deleteMany com workspaceId no filtro impede apagar etiqueta de outro
    // workspace mesmo que o id seja adivinhado. Cascade limpa os vínculos.
    const { count } = await this.prisma.label.deleteMany({
      where: { id: labelId, workspaceId },
    });
    if (count === 0) throw new NotFoundException('Etiqueta não encontrada neste workspace.');
  }
}
