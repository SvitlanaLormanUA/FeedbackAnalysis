import { Module } from '@nestjs/common';
import { AlertDispatcher } from './alert-dispatcher';
import { TelegramService } from './telegram.service';

@Module({
  providers: [AlertDispatcher, TelegramService],
  exports: [AlertDispatcher],
})
export class NotificationsModule {}
