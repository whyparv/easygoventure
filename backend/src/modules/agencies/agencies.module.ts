import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Agency, AgencySchema } from './schemas/agency.schema';
import { AgenciesRepository } from './agencies.repository';
import { AgenciesService } from './agencies.service';
import { AgenciesController } from './agencies.controller';

/**
 * Agencies - tenant-scoped travel agency directory.
 * Exports AgenciesService so lead intake and other modules can auto-create agencies.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Agency.name, schema: AgencySchema }]),
  ],
  controllers: [AgenciesController],
  providers: [AgenciesService, AgenciesRepository],
  exports: [AgenciesService],
})
export class AgenciesModule {}
