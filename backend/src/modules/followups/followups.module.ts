import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeadsModule } from '../leads/leads.module';
import { FollowUp, FollowUpSchema } from './schemas/followup.schema';
import { FollowUpsRepository } from './followups.repository';
import { FollowUpsService } from './followups.service';
import { FollowUpsController } from './followups.controller';

/**
 * Follow-ups — manually scheduled touch-points against a lead. No automation.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: FollowUp.name, schema: FollowUpSchema }]),
    LeadsModule,
  ],
  controllers: [FollowUpsController],
  providers: [FollowUpsRepository, FollowUpsService],
  exports: [FollowUpsService],
})
export class FollowupsModule {}
