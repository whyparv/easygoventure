import type { Model } from 'mongoose';
import type { HotelCatalog } from '../../modules/hotels/schemas/hotel-catalog.schema';
import {
  HOTEL_CATALOG_FILE,
  HotelCatalogRecord,
  readHotelCatalogFile,
} from '../../modules/hotels/catalog/hotel-catalog-record';

export interface HotelSeedStats {
  total: number;
  inserted: number;
  updated: number;
  unchanged: number;
}

/**
 * HotelCatalogSeeder
 * ------------------
 * Stage 5 (final). Imports the file-based catalog — never the raw .docx — into
 * MongoDB. Idempotent by design: it upserts on `name + city`, so running it any
 * number of times converges to the same state (insert once, update thereafter).
 *
 * Reads the SAME canonical dataset the runtime JSON fallback uses
 * (`assets/catalog/hotels/dubai.hotels.json`), so the database and the fallback
 * can never drift. Consumed both by the standalone CLI (`npm run seed:hotels`)
 * and by the master catalog seed (`npm run seed:catalog`).
 */
export class HotelCatalogSeeder {
  constructor(
    private readonly model: Model<HotelCatalog>,
    private readonly datasetPath: string = HOTEL_CATALOG_FILE,
  ) {}

  /** Load + validate the canonical file catalog produced by the pipeline. */
  loadDataset(): HotelCatalogRecord[] {
    return readHotelCatalogFile(this.datasetPath).records;
  }

  /** Upsert every record. Safe to run repeatedly. */
  async seed(): Promise<HotelSeedStats> {
    const hotels = this.loadDataset();
    if (hotels.length === 0) return { total: 0, inserted: 0, updated: 0, unchanged: 0 };

    const operations = hotels.map((h) => ({
      updateOne: {
        filter: { name: h.name, city: h.city },
        update: {
          $set: {
            name: h.name,
            category: 'HOTEL',
            starRating: h.rating,
            area: h.address,
            city: h.city,
            country: h.country,
            isActive: true,
          },
          $setOnInsert: { isDeleted: false },
        },
        upsert: true,
      },
    }));

    const result = await this.model.bulkWrite(operations, { ordered: false });
    const inserted = result.upsertedCount ?? 0;
    const updated = result.modifiedCount ?? 0;
    return {
      total: hotels.length,
      inserted,
      updated,
      unchanged: hotels.length - inserted - updated,
    };
  }
}
