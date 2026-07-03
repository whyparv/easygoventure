import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeadsModule } from '../leads/leads.module';
import { FulfillmentsModule } from '../fulfillments/fulfillments.module';
import { QuotationsModule } from '../quotations/quotations.module';
import { PackagesModule } from '../packages/packages.module';
import { InquiriesModule } from '../inquiries/inquiries.module';
import { Proposal, ProposalSchema } from './schemas/proposal.schema';
import { FulfillmentItem, FulfillmentItemSchema } from './schemas/fulfillment-item.schema';
import { ProposalsRepository } from './proposals.repository';
import { FulfillmentItemsRepository } from './fulfillment-items.repository';
import { ProposalTokenService } from './proposal-token.service';
import { ProposalsService } from './proposals.service';
import { QuotationConversionService } from './quotation-conversion.service';
import { BookingReadinessService } from './booking-readiness.service';
import { CommercialProposalsService } from './commercial-proposals.service';
import { ProposalsController } from './proposals.controller';
import { CommercialProposalsController } from './commercial-proposals.controller';

/**
 * Proposals. Legacy: a lead can have many; drives lead status and spawns a
 * fulfillment on acceptance. Phase 2.1: converts an accepted quotation into an
 * executable proposal (frozen commercial snapshot) and drives the operational
 * booking → fulfillment lifecycle.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Proposal.name, schema: ProposalSchema },
      { name: FulfillmentItem.name, schema: FulfillmentItemSchema },
    ]),
    LeadsModule,
    FulfillmentsModule,
    QuotationsModule,
    PackagesModule,
    InquiriesModule,
  ],
  controllers: [ProposalsController, CommercialProposalsController],
  providers: [
    ProposalsRepository,
    FulfillmentItemsRepository,
    ProposalTokenService,
    ProposalsService,
    QuotationConversionService,
    BookingReadinessService,
    CommercialProposalsService,
  ],
  exports: [ProposalsService, CommercialProposalsService, ProposalsRepository],
})
export class ProposalsModule {}
