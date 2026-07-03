import { Module } from '@nestjs/common';
import { InquiriesModule } from '../inquiries/inquiries.module';
import { PackagesModule } from '../packages/packages.module';
import { QuotationsModule } from '../quotations/quotations.module';
import { VendorsModule } from '../vendors/vendors.module';
import { ProposalsModule } from '../proposals/proposals.module';
import { OperationsModule } from '../operations/operations.module';
import { CommercialContextController } from './commercial-context.controller';
import { CommercialContextService } from './commercial-context.service';
import { SalesContextService } from './sales-context.service';

/**
 * AI commercial-context infrastructure. Assembles read-only context (commercial,
 * sales + operations) for future AI workflows; does not change any existing AI
 * behavior.
 */
@Module({
  imports: [
    InquiriesModule,
    PackagesModule,
    QuotationsModule,
    VendorsModule,
    ProposalsModule,
    OperationsModule,
  ],
  controllers: [CommercialContextController],
  providers: [CommercialContextService, SalesContextService],
  exports: [CommercialContextService, SalesContextService],
})
export class AiContextModule {}
