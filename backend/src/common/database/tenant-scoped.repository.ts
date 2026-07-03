import { ClientSession, FilterQuery, Model, SortOrder, UpdateQuery } from 'mongoose';

export interface PaginateOptions {
  skip: number;
  limit: number;
  sort: Record<string, SortOrder>;
}

/**
 * A tenant scope fragment merged into every query. Typically `{ organizationId }`
 * for a normal principal, or `{}` for a super-admin cross-organization view.
 * Because it is spread AFTER `_id` in write queries, a scope may also pin `_id`
 * (used by the Organization repository, where the tenant boundary IS the document).
 */
export type TenantScope<TDoc> = FilterQuery<TDoc>;

/**
 * Base class for every tenant-owned repository.
 *
 * It makes tenant isolation STRUCTURAL: reads, updates and soft-deletes all embed
 * the organization filter directly in the Mongo query, so a document outside the
 * caller's scope is never fetched or mutated. A future repository that extends
 * this base inherits tenant safety by default — it cannot accidentally perform an
 * unscoped by-id write, because the scoped methods are the only ones provided.
 *
 * Concrete repositories add their own `create()` and any bespoke finders; those
 * finders must likewise include the tenant fragment (verified by the safety audit).
 */
export abstract class TenantScopedRepository<TDoc> {
  protected constructor(protected readonly model: Model<TDoc>) {}

  /** Find one document by id within the tenant scope (excludes soft-deleted). */
  findByIdScoped(id: string, scope: TenantScope<TDoc> = {}): Promise<TDoc | null> {
    return this.model.findOne({ _id: id, ...scope, isDeleted: { $ne: true } }).exec();
  }

  /**
   * Paginate within the tenant scope. `scope` (the organization fragment) and
   * `filter` (per-request filters) are kept as separate arguments so the tenant
   * scope can never be forgotten inside a larger filter object.
   */
  async paginateScoped(
    scope: TenantScope<TDoc>,
    filter: FilterQuery<TDoc>,
    options: PaginateOptions,
  ): Promise<{ items: TDoc[]; total: number }> {
    const query: FilterQuery<TDoc> = { ...scope, ...filter, isDeleted: { $ne: true } };
    const [items, total] = await Promise.all([
      this.model.find(query).sort(options.sort).skip(options.skip).limit(options.limit).exec(),
      this.model.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  /** Count documents within the tenant scope (excludes soft-deleted). */
  countScoped(scope: TenantScope<TDoc>, filter: FilterQuery<TDoc> = {}): Promise<number> {
    return this.model
      .countDocuments({ ...scope, ...filter, isDeleted: { $ne: true } })
      .exec();
  }

  /** Update one document by id, constrained to the tenant scope. */
  updateScoped(
    id: string,
    data: UpdateQuery<TDoc>,
    scope: TenantScope<TDoc> = {},
    session?: ClientSession,
  ): Promise<TDoc | null> {
    return this.model
      .findOneAndUpdate({ _id: id, ...scope }, data, { new: true, session })
      .exec();
  }

  /** Soft-delete one document by id, constrained to the tenant scope. */
  softDeleteScoped(id: string, scope: TenantScope<TDoc> = {}): Promise<TDoc | null> {
    const update = { isDeleted: true, deletedAt: new Date() } as UpdateQuery<TDoc>;
    return this.model
      .findOneAndUpdate({ _id: id, ...scope }, update, { new: true })
      .exec();
  }
}
