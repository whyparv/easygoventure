import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Lead, LeadSchema } from './schemas/lead.schema';
import { LeadActivity, LeadActivitySchema } from './schemas/lead-activity.schema';
import { LeadsRepository } from './leads.repository';
import { LeadActivitiesRepository } from './lead-activities.repository';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { AgenciesModule } from '../agencies/agencies.module';

/**
 * Leads - the primary workflow entity. Owns the lead record and its timeline.
 * Exports `LeadsService` so sibling modules can log activities and drive status.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lead.name, schema: LeadSchema },
      { name: LeadActivity.name, schema: LeadActivitySchema },
    ]),
    AgenciesModule,
  ],
  controllers: [LeadsController],
  providers: [LeadsRepository, LeadActivitiesRepository, LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
