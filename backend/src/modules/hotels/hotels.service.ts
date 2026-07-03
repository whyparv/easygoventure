import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, FilterQuery, SortOrder, Types } from 'mongoose';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { NotFoundException, ValidationException } from '../../common/exceptions/app.exceptions';
import { escapeRegExp } from '../../common/utils/regex.util';
import { HotelsRepository } from './hotels.repository';
import { HotelCatalogDocument } from './schemas/hotel-catalog.schema';
import { QueryHotelDto } from './dto/query-hotel.dto';
import { CatalogLoaderService } from './catalog/catalog-loader.service';
import { HotelView } from './catalog/hotel-catalog-record';

/** A hotel served from either the database (document) or the file catalog (view). */
export type HotelResult = HotelCatalogDocument | HotelView;

/**
 * Hotel catalog reads are resilient: they use the database when it is reachable
 * and transparently fall back to the in-memory file catalog when it is not, so
 * browsing the reference catalog never depends on database availability.
 */
@Injectable()
export class HotelsService {
  private readonly logger = new Logger(HotelsService.name);

  constructor(
    private readonly hotels: HotelsRepository,
    private readonly catalog: CatalogLoaderService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async findAll(query: QueryHotelDto): Promise<PaginatedResponse<HotelResult>> {
    if (this.isDatabaseAvailable()) {
      try {
        return await this.findAllFromDatabase(query);
      } catch (error) {
        if (!this.isConnectivityError(error)) throw error;
        this.logger.warn(
          `Hotel DB query failed; serving from file catalog: ${(error as Error).message}`,
        );
      }
    }
    return this.findAllFromFile(query);
  }

  async findByIdOrThrow(id: string): Promise<HotelResult> {
    if (this.isDatabaseAvailable()) {
      try {
        if (!Types.ObjectId.isValid(id)) {
          // A file-catalog id is not a Mongo ObjectId — try the fallback below.
          if (this.catalog.isLoaded() && this.catalog.getById(id)) {
            return this.findByIdFromFile(id);
          }
          throw new ValidationException(`"${id}" is not a valid id`, 'INVALID_ID');
        }
        const hotel = await this.hotels.findById(id);
        if (!hotel) throw new NotFoundException(`Hotel "${id}" not found`, 'HOTEL_NOT_FOUND');
        return hotel;
      } catch (error) {
        if (!this.isConnectivityError(error)) throw error;
        this.logger.warn(
          `Hotel DB lookup failed; serving from file catalog: ${(error as Error).message}`,
        );
      }
    }
    return this.findByIdFromFile(id);
  }

  // ── Database path ────────────────────────────────────────────────────────

  private async findAllFromDatabase(
    query: QueryHotelDto,
  ): Promise<PaginatedResponse<HotelResult>> {
    const filter: FilterQuery<HotelCatalogDocument> = {};
    if (query.starRating) filter.starRating = query.starRating;
    if (query.city) filter.city = { $regex: `^${escapeRegExp(query.city)}$`, $options: 'i' };
    if (query.area) filter.area = { $regex: escapeRegExp(query.area), $options: 'i' };
    if (query.search) filter.name = { $regex: escapeRegExp(query.search), $options: 'i' };

    const sort: Record<string, SortOrder> = query.sortBy
      ? { [query.sortBy]: query.sortOrder }
      : { starRating: -1, name: 1 };

    const { items, total } = await this.hotels.paginate(filter, {
      skip: query.skip,
      limit: query.limit,
      sort,
    });
    return new PaginatedResponse<HotelResult>(items, total, query.page, query.limit);
  }

  // ── File fallback path ───────────────────────────────────────────────────

  private findAllFromFile(query: QueryHotelDto): PaginatedResponse<HotelResult> {
    let items = this.catalog.all();
    if (query.starRating) items = items.filter((h) => h.starRating === query.starRating);
    if (query.city) {
      const city = query.city.toLowerCase();
      items = items.filter((h) => h.city.toLowerCase() === city);
    }
    if (query.area) {
      const area = query.area.toLowerCase();
      items = items.filter((h) => (h.area ?? '').toLowerCase().includes(area));
    }
    if (query.search) {
      const term = query.search.toLowerCase();
      items = items.filter((h) => h.name.toLowerCase().includes(term));
    }

    const sorted = this.sortViews(items, query);
    const total = sorted.length;
    const paged = sorted.slice(query.skip, query.skip + query.limit);
    return new PaginatedResponse<HotelResult>(paged, total, query.page, query.limit);
  }

  private findByIdFromFile(id: string): HotelResult {
    const hotel = this.catalog.getById(id);
    if (!hotel) throw new NotFoundException(`Hotel "${id}" not found`, 'HOTEL_NOT_FOUND');
    return hotel;
  }

  private sortViews(items: HotelView[], query: QueryHotelDto): HotelView[] {
    const dir = query.sortOrder === 'asc' ? 1 : -1;
    const sorted = [...items];
    if (query.sortBy === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name) * dir);
    } else if (query.sortBy === 'starRating') {
      sorted.sort((a, b) => (a.starRating - b.starRating) * dir || a.name.localeCompare(b.name));
    } else {
      // Default catalog ordering: star rating desc, then name asc.
      sorted.sort((a, b) => b.starRating - a.starRating || a.name.localeCompare(b.name));
    }
    return sorted;
  }

  // ── Availability detection ───────────────────────────────────────────────

  /**
   * Prefer the database when its connection is live (readyState 1). If the file
   * catalog never loaded, still attempt the database so a load failure surfaces
   * rather than silently returning an empty fallback.
   */
  private isDatabaseAvailable(): boolean {
    // readyState is a mongoose ConnectionStates enum; 1 = connected.
    return Number(this.connection.readyState) === 1 || !this.catalog.isLoaded();
  }

  private isConnectivityError(error: unknown): boolean {
    const name = (error as { name?: string })?.name ?? '';
    return (
      name === 'MongooseServerSelectionError' ||
      name === 'MongoServerSelectionError' ||
      name === 'MongoNetworkError' ||
      name === 'MongoNotConnectedError' ||
      name === 'MongoTimeoutError' ||
      name === 'PoolClearedError'
    );
  }
}
