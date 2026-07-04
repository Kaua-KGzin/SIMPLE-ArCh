import { Controller, Get, HttpCode, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';

/** Notificações pessoais do usuário autenticado. */
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.listForUser(user.id);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.id).then((count) => ({ count }));
  }

  @Patch(':id/read')
  @HttpCode(204)
  markRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notifications.markRead(user.id, id);
  }

  @Patch('read-all')
  @HttpCode(204)
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }
}
