import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Vendor, VendorSchema } from './schemas/vendor.schema';
import { VendorRate, VendorRateSchema } from './schemas/vendor-rate.schema';
import { VendorsRepository } from './vendors.repository';
import { VendorRatesRepository } from './vendor-rates.repository';
import { VendorsService } from './vendors.service';
import { VendorRatesService } from './vendor-rates.service';
import { VendorsController } from './vendors.controller';
import { VendorRatesController } from './vendor-rates.controller';

/**
 * Vendors — tenant-scoped supplier directory and their net rates. Foundation
 * storage + CRUD only (no pricing/markup/rate-resolution). Exports the services
 * so downstream pricing modules can read vendors and rates.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Vendor.name, schema: VendorSchema },
      { name: VendorRate.name, schema: VendorRateSchema },
    ]),
  ],
  controllers: [VendorsController, VendorRatesController],
  providers: [VendorsService, VendorsRepository, VendorRatesService, VendorRatesRepository],
  exports: [VendorsService, VendorRatesService],
})
export class VendorsModule {}
