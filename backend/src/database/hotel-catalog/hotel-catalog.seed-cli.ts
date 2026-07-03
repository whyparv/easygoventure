import 'reflect-metadata';
import 'dotenv/config';
import mongoose from 'mongoose';
import {
  HotelCatalog,
  HotelCatalogSchema,
} from '../../modules/hotels/schemas/hotel-catalog.schema';
import { HotelCatalogSeeder } from './hotel-catalog.seeder';

/**
 * Standalone hotel-catalog seed command: `npm run seed:hotels`.
 *
 * Reads the file catalog (assets/catalog/hotels/dubai.hotels.json) and upserts it
 * into MongoDB. Idempotent — safe to run repeatedly. Generate the dataset first
 * with `npm run hotels:build` if it does not exist.
 */
async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME ?? 'dmc_crm' });
  const model = mongoose.model(HotelCatalog.name, HotelCatalogSchema);

  try {
    const stats = await new HotelCatalogSeeder(model).seed();
     
    console.log(
      `Hotel catalog seeded: ${stats.total} records ` +
        `(${stats.inserted} inserted, ${stats.updated} updated, ${stats.unchanged} unchanged)`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
   
  console.error(error);
  process.exit(1);
});
