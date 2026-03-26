import { Module } from '@nestjs/common';
import { CustomerController } from './customers/customer.controller';
import { CustomerService } from './customers/customer.service';
import { SalesOrderController } from './orders/so.controller';
import { SalesOrderService } from './orders/so.service';
import { DeliveryOrderController } from './delivery/do.controller';
import { DeliveryOrderService } from './delivery/do.service';

@Module({
  controllers: [CustomerController, SalesOrderController, DeliveryOrderController],
  providers: [CustomerService, SalesOrderService, DeliveryOrderService],
  exports: [CustomerService, SalesOrderService],
})
export class SalesModule {}
