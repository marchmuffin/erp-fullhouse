import { Module } from '@nestjs/common';
import { LeadController } from './leads/lead.controller';
import { LeadService } from './leads/lead.service';
import { OpportunityController } from './opportunities/opportunity.controller';
import { OpportunityService } from './opportunities/opportunity.service';
import { ActivityController } from './activities/activity.controller';
import { ActivityService } from './activities/activity.service';
import { TicketController } from './tickets/ticket.controller';
import { TicketService } from './tickets/ticket.service';

@Module({
  controllers: [
    LeadController,
    OpportunityController,
    ActivityController,
    TicketController,
  ],
  providers: [
    LeadService,
    OpportunityService,
    ActivityService,
    TicketService,
  ],
  exports: [LeadService, OpportunityService, ActivityService, TicketService],
})
export class CrmModule {}
