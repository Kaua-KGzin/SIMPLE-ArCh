import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ArchLineService, ArchLineView } from './arch-line.service';

/** Status e score de arquitetura dos sistemas da linha Arch (via Arch Hub). */
@UseGuards(JwtAuthGuard)
@Controller('arch-line')
export class ArchLineController {
  constructor(private readonly archLine: ArchLineService) {}

  @Get()
  view(): Promise<ArchLineView> {
    return this.archLine.view();
  }
}
