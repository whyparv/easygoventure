import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeadsModule } from '../leads/leads.module';
import { Fulfillment, FulfillmentSchema } from './schemas/fulfillment.schema';
import { FulfillmentsRepository } from './fulfillments.repository';
import { FulfillmentsService } from './fulfillments.service';
import { FulfillmentsController } from './fulfillments.controller';

/**
 * Fulfillments — the post-acceptance workstream (visa cases, bookings, transfers).
 * Exports `FulfillmentsService` so the proposals module can open one on acceptance.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Fulfillment.name, schema: FulfillmentSchema }]),
    LeadsModule,
  ],
  controllers: [FulfillmentsController],
  providers: [FulfillmentsRepository, FulfillmentsService],
  exports: [FulfillmentsService],
})
export class FulfillmentsModule {}
