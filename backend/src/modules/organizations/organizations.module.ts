import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrganizationsRepository } from './organizations.repository';
import { Organization, OrganizationSchema } from './schemas/organization.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Organization.name, schema: OrganizationSchema }]),
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationsRepository],
  exports: [OrganizationsService, OrganizationsRepository],
})
export class OrganizationsModule {}
