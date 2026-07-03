import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ServiceCategory,
  ServiceCategorySchema,
} from './schemas/service-category.schema';
import { Service, ServiceSchema } from './schemas/service.schema';
import { ServiceCategoriesController } from './service-categories.controller';
import { ServicesController } from './services.controller';
import { ServiceCategoriesService } from './service-categories.service';
import { ServiceCategoriesRepository } from './service-categories.repository';
import { ServicesService } from './services.service';
import { ServicesRepository } from './services.repository';

/**
 * Service catalog — global {@link ServiceCategory} reference data plus the
 * tenant-scoped {@link Service} offerings that replace the legacy service enums.
 * AuditService is @Global, so it needs no import here.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ServiceCategory.name, schema: ServiceCategorySchema },
      { name: Service.name, schema: ServiceSchema },
    ]),
  ],
  controllers: [ServiceCategoriesController, ServicesController],
  providers: [
    ServiceCategoriesService,
    ServiceCategoriesRepository,
    ServicesService,
    ServicesRepository,
  ],
  exports: [ServiceCategoriesService, ServiceCategoriesRepository, ServicesService],
})
export class ServiceCatalogModule {}
