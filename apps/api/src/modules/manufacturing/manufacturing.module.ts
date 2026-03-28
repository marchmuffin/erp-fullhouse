import { Module } from '@nestjs/common';
import { BomController } from './bom/bom.controller';
import { BomService } from './bom/bom.service';
import { WoController } from './work-orders/wo.controller';
import { WoService } from './work-orders/wo.service';
import { MrpController } from './mrp/mrp.controller';
import { MrpService } from './mrp/mrp.service';

@Module({
  controllers: [BomController, WoController, MrpController],
  providers: [BomService, WoService, MrpService],
  exports: [BomService, WoService, MrpService],
})
export class ManufacturingModule {}
