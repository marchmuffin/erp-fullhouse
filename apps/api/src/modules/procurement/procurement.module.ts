import { Module } from '@nestjs/common';
import { SupplierController } from './suppliers/supplier.controller';
import { SupplierService } from './suppliers/supplier.service';
import { PurchaseRequisitionController } from './requisitions/pr.controller';
import { PurchaseRequisitionService } from './requisitions/pr.service';
import { PurchaseOrderController } from './orders/po.controller';
import { PurchaseOrderService } from './orders/po.service';
import { GoodsReceiptController } from './receipts/gr.controller';
import { GoodsReceiptService } from './receipts/gr.service';

@Module({
  controllers: [
    SupplierController,
    PurchaseRequisitionController,
    PurchaseOrderController,
    GoodsReceiptController,
  ],
  providers: [
    SupplierService,
    PurchaseRequisitionService,
    PurchaseOrderService,
    GoodsReceiptService,
  ],
  exports: [SupplierService, PurchaseOrderService],
})
export class ProcurementModule {}
