import { Module } from '@nestjs/common';
import { InspectionController } from './inspection/inspection.controller';
import { InspectionService } from './inspection/inspection.service';
import { NcrController } from './ncr/ncr.controller';
import { NcrService } from './ncr/ncr.service';

@Module({
  controllers: [InspectionController, NcrController],
  providers: [InspectionService, NcrService],
  exports: [InspectionService, NcrService],
})
export class QualityModule {}
