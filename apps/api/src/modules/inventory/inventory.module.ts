import { Module } from '@nestjs/common';
import { ItemController } from './items/item.controller';
import { ItemService } from './items/item.service';
import { WarehouseController } from './warehouses/warehouse.controller';
import { WarehouseService } from './warehouses/warehouse.service';
import { StockTxnController } from './transactions/stock-txn.controller';
import { StockTxnService } from './transactions/stock-txn.service';
import { StockCountController } from './counts/stock-count.controller';
import { StockCountService } from './counts/stock-count.service';

@Module({
  controllers: [
    ItemController,
    WarehouseController,
    StockTxnController,
    StockCountController,
  ],
  providers: [
    ItemService,
    WarehouseService,
    StockTxnService,
    StockCountService,
  ],
  exports: [ItemService, WarehouseService, StockTxnService],
})
export class InventoryModule {}
