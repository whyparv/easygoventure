import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersRepository extends TenantScopedRepository<UserDocument> {
  constructor(@InjectModel(User.name) model: Model<UserDocument>) {
    super(model);
  }

  create(data: Partial<User>, session?: ClientSession): Promise<UserDocument> {
    return this.model.create([data], { session }).then((docs) => docs[0]);
  }

  /**
   * Identity resolution by id (self profile, JWT principal). Intentionally NOT
   * tenant-scoped: the caller is resolving their own account from a verified
   * token, not querying another tenant's data. Tenant-scoped admin reads use the
   * base `findByIdScoped`.
   */
  findById(id: string): Promise<UserDocument | null> {
    return this.model.findOne({ _id: id, isDeleted: { $ne: true } }).exec();
  }

  /** Include the normally-hidden secret fields (for authentication only). */
  findByEmailWithSecrets(email: string): Promise<UserDocument | null> {
    return this.model
      .findOne({ email: email.toLowerCase(), isDeleted: { $ne: true } })
      .select('+passwordHash +mfaSecret')
      .exec();
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.model.findOne({ email: email.toLowerCase(), isDeleted: { $ne: true } }).exec();
  }

  findByIdWithSecrets(id: string): Promise<UserDocument | null> {
    return this.model
      .findOne({ _id: id, isDeleted: { $ne: true } })
      .select('+passwordHash')
      .exec();
  }
}
