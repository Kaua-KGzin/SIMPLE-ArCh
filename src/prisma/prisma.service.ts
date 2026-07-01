import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService — encapsula o PrismaClient como um provider injetável do Nest.
 *
 * POR QUÊ? Em vez de cada serviço instanciar `new PrismaClient()` (abrindo
 * várias conexões), criamos UMA instância gerenciada pelo container de DI.
 * Qualquer serviço que precisar do banco apenas declara `PrismaService` no
 * construtor e o Nest injeta a mesma instância (padrão Singleton).
 *
 * OnModuleInit/Destroy: conectamos quando o módulo sobe e desconectamos
 * graciosamente no shutdown — evita vazamento de conexões.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
