import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  HotelCatalogRecord,
  HotelView,
  readHotelCatalogFile,
  recordToView,
} from './hotel-catalog-record';

/**
 * CatalogLoaderService
 * --------------------
 * Loads the file-based hotel catalog (`assets/catalog/hotels/dubai.hotels.json`)
 * once at startup, validates every record, and caches the result in memory. This
 * lets the hotel APIs serve data even when the database is unavailable.
 *
 * Environment-independent: no database, no network — just a bundled JSON asset.
 * Loading never throws: a missing/invalid file simply leaves the cache empty and
 * logs an error, so an app boot is never blocked by the fallback dataset.
 */
@Injectable()
export class CatalogLoaderService implements OnModuleInit {
  private readonly logger = new Logger(CatalogLoaderService.name);
  private views: HotelView[] = [];
  private byId = new Map<string, HotelView>();
  private loaded = false;

  onModuleInit(): void {
    this.load();
  }

  /** (Re)load and validate the catalog from disk into memory. Never throws. */
  load(): void {
    try {
      const { records, issues, path } = readHotelCatalogFile();
      this.setRecords(records);
      this.loaded = true;
      if (issues.length > 0) {
        this.logger.warn(`Hotel catalog: skipped ${issues.length} invalid record(s) from ${path}`);
      }
      this.logger.log(`Hotel catalog loaded: ${records.length} record(s) cached from ${path}`);
    } catch (error) {
      this.loaded = false;
      this.views = [];
      this.byId.clear();
      this.logger.error(
        `Hotel catalog file could not be loaded — JSON fallback is unavailable: ${
          (error as Error).message
        }`,
      );
    }
  }

  private setRecords(records: HotelCatalogRecord[]): void {
    this.views = records.map(recordToView);
    this.byId = new Map(this.views.map((v) => [v.id, v]));
  }

  /** True once the catalog has been successfully loaded and cached. */
  isLoaded(): boolean {
    return this.loaded;
  }

  count(): number {
    return this.views.length;
  }

  /** All cached hotel views (already mapped to the API-facing shape). */
  all(): HotelView[] {
    return this.views;
  }

  getById(id: string): HotelView | undefined {
    return this.byId.get(id);
  }
}
