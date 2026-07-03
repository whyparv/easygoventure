import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Inquiry, InquirySchema } from '../inquiries/schemas/inquiry.schema';
import { Package, PackageSchema } from '../packages/schemas/package.schema';
import { Quotation, QuotationSchema } from '../quotations/schemas/quotation.schema';
import { Proposal, ProposalSchema } from '../proposals/schemas/proposal.schema';
import { FulfillmentItem, FulfillmentItemSchema } from '../proposals/schemas/fulfillment-item.schema';
import { RevenuePipelineController } from './revenue-pipeline.controller';
import { RevenuePipelineService } from './revenue-pipeline.service';
import { RevenuePipelineRepository } from './revenue-pipeline.repository';

/**
 * Reporting — read-only commercial roll-ups. Registers the source schemas for
 * direct aggregation (models are shared with their owning modules by name).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Inquiry.name, schema: InquirySchema },
      { name: Package.name, schema: PackageSchema },
      { name: Quotation.name, schema: QuotationSchema },
      { name: Proposal.name, schema: ProposalSchema },
      { name: FulfillmentItem.name, schema: FulfillmentItemSchema },
    ]),
  ],
  controllers: [RevenuePipelineController],
  providers: [RevenuePipelineService, RevenuePipelineRepository],
  exports: [RevenuePipelineService],
})
export class ReportingModule {}
