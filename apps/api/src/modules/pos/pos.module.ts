import { Module } from '@nestjs/common';
import { SessionController } from './sessions/session.controller';
import { SessionService } from './sessions/session.service';
import { OrderController } from './orders/order.controller';
import { OrderService } from './orders/order.service';

@Module({
  controllers: [SessionController, OrderController],
  providers: [SessionService, OrderService],
  exports: [SessionService, OrderService],
})
export class PosModule {}
