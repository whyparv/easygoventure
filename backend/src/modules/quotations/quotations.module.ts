import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PackagesModule } from '../packages/packages.module';
import { VendorsModule } from '../vendors/vendors.module';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
import { QuotationsRepository } from './quotations.repository';
import { QuotationNumberService } from './quotation-number.service';
import { Quotation, QuotationSchema } from './schemas/quotation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Quotation.name, schema: QuotationSchema }]),
    PackagesModule, // package + item + pricing engine
    VendorsModule, // vendor + rate snapshots
  ],
  controllers: [QuotationsController],
  providers: [QuotationsService, QuotationsRepository, QuotationNumberService],
  exports: [QuotationsService],
})
export class QuotationsModule {}
