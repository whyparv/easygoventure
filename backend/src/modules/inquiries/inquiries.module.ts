import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeadsModule } from '../leads/leads.module';
import { InquiriesController } from './inquiries.controller';
import { InquiriesService } from './inquiries.service';
import { InquiriesRepository } from './inquiries.repository';
import { InquiryReferenceService } from './inquiry-reference.service';
import { Inquiry, InquirySchema } from './schemas/inquiry.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Inquiry.name, schema: InquirySchema }]),
    LeadsModule, // for inquiry → lead conversion
  ],
  controllers: [InquiriesController],
  providers: [InquiriesService, InquiriesRepository, InquiryReferenceService],
  exports: [InquiriesService],
})
export class InquiriesModule {}
