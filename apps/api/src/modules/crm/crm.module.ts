import { Module } from '@nestjs/common';
import { LeadController } from './leads/lead.controller';
import { LeadService } from './leads/lead.service';
import { OpportunityController } from './opportunities/opportunity.controller';
import { OpportunityService } from './opportunities/opportunity.service';
import { ActivityController } from './activities/activity.controller';
import { ActivityService } from './activities/activity.service';

@Module({
  controllers: [
    LeadController,
    OpportunityController,
    ActivityController,
  ],
  providers: [
    LeadService,
    OpportunityService,
    ActivityService,
  ],
  exports: [LeadService, OpportunityService, ActivityService],
})
export class CrmModule {}
