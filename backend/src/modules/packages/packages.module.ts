import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VendorsModule } from '../vendors/vendors.module';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';
import { PackagesRepository } from './packages.repository';
import { PackageItemsRepository } from './package-items.repository';
import { PricingEngineService } from './pricing-engine.service';
import { Package, PackageSchema } from './schemas/package.schema';
import { PackageItem, PackageItemSchema } from './schemas/package-item.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Package.name, schema: PackageSchema },
      { name: PackageItem.name, schema: PackageItemSchema },
    ]),
    VendorsModule, // vendor-rate cost resolution
  ],
  controllers: [PackagesController],
  providers: [PackagesService, PackagesRepository, PackageItemsRepository, PricingEngineService],
  exports: [PackagesService, PricingEngineService, PackagesRepository, PackageItemsRepository],
})
export class PackagesModule {}
