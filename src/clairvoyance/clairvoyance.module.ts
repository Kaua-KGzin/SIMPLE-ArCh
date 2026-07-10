import { Module } from '@nestjs/common';
import { ClairvoyanceGateway } from './clairvoyance.gateway';
import { ClairvoyanceService } from './clairvoyance.service';

@Module({
  providers: [ClairvoyanceGateway, ClairvoyanceService],
})
export class ClairvoyanceModule {}
