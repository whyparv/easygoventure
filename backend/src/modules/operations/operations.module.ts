import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProposalsModule } from '../proposals/proposals.module';
import { Traveler, TravelerSchema } from './schemas/traveler.schema';
import { Booking, BookingSchema } from './schemas/booking.schema';
import {
  GeneratedDocument,
  GeneratedDocumentSchema,
} from './schemas/generated-document.schema';
import { TravelersRepository } from './travelers.repository';
import { BookingsRepository } from './bookings.repository';
import { GeneratedDocumentsRepository } from './generated-documents.repository';
import { TravelersService } from './travelers.service';
import { BookingsService } from './bookings.service';
import { TravelTimelineService } from './travel-timeline.service';
import { OperationsDashboardService } from './operations-dashboard.service';
import { DocumentGenerationService } from './document-generation.service';
import { OperationalRiskService } from './operational-risk.service';
import { OperationsContextService } from './operations-context.service';
import { TravelersController } from './travelers.controller';
import { BookingsController } from './bookings.controller';
import { OperationsController } from './operations.controller';

/**
 * Operations Engine (Phase 3) — turns a booked proposal into managed real-world
 * travel execution: travelers, supplier bookings (hotel/transfer/visa/activity/
 * flight), a derived trip timeline, tenant-scoped dashboards, operational-risk
 * scoring, metadata-only document generation, and read-only AI operations context.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Traveler.name, schema: TravelerSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: GeneratedDocument.name, schema: GeneratedDocumentSchema },
    ]),
    ProposalsModule,
  ],
  controllers: [TravelersController, BookingsController, OperationsController],
  providers: [
    TravelersRepository,
    BookingsRepository,
    GeneratedDocumentsRepository,
    TravelersService,
    BookingsService,
    TravelTimelineService,
    OperationsDashboardService,
    DocumentGenerationService,
    OperationalRiskService,
    OperationsContextService,
  ],
  exports: [OperationsContextService],
})
export class OperationsModule {}
