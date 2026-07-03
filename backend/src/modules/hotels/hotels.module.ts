import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { HotelsRepository } from './hotels.repository';
import { CatalogLoaderService } from './catalog/catalog-loader.service';
import { HotelRecommendationService } from './hotel-recommendation.service';
import { HotelCatalog, HotelCatalogSchema } from './schemas/hotel-catalog.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: HotelCatalog.name, schema: HotelCatalogSchema }]),
  ],
  controllers: [HotelsController],
  providers: [HotelsService, HotelsRepository, CatalogLoaderService, HotelRecommendationService],
  exports: [HotelsService, CatalogLoaderService, HotelRecommendationService],
})
export class HotelsModule {}
