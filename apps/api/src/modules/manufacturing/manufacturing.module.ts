import { Module } from '@nestjs/common';
import { BomController } from './bom/bom.controller';
import { BomService } from './bom/bom.service';
import { WoController } from './work-orders/wo.controller';
import { WoService } from './work-orders/wo.service';

@Module({
  controllers: [BomController, WoController],
  providers: [BomService, WoService],
  exports: [BomService, WoService],
})
export class ManufacturingModule {}
