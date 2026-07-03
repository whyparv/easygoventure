import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Session, SessionDocument } from './schemas/session.schema';
import { PasswordReset, PasswordResetDocument } from './schemas/password-reset.schema';

/** Persistence for refresh-token sessions. */
@Injectable()
export class SessionsRepository {
  constructor(@InjectModel(Session.name) private readonly model: Model<SessionDocument>) {}

  create(data: Partial<Session>): Promise<SessionDocument> {
    return this.model.create(data);
  }

  findActiveByHash(refreshTokenHash: string): Promise<SessionDocument | null> {
    return this.model
      .findOne({ refreshTokenHash, revokedAt: null, expiresAt: { $gt: new Date() } })
      .exec();
  }

  async revokeByHash(refreshTokenHash: string): Promise<void> {
    await this.model.updateOne({ refreshTokenHash }, { $set: { revokedAt: new Date() } }).exec();
  }

  async revokeById(id: string): Promise<void> {
    await this.model.updateOne({ _id: id }, { $set: { revokedAt: new Date() } }).exec();
  }

  async revokeAllForUser(userId: Types.ObjectId): Promise<void> {
    await this.model
      .updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } })
      .exec();
  }

  async touch(id: string): Promise<void> {
    await this.model.updateOne({ _id: id }, { $set: { lastUsedAt: new Date() } }).exec();
  }
}

/** Persistence for single-use password-reset grants. */
@Injectable()
export class PasswordResetsRepository {
  constructor(
    @InjectModel(PasswordReset.name) private readonly model: Model<PasswordResetDocument>,
  ) {}

  create(data: Partial<PasswordReset>): Promise<PasswordResetDocument> {
    return this.model.create(data);
  }

  findValidByHash(tokenHash: string): Promise<PasswordResetDocument | null> {
    return this.model
      .findOne({ tokenHash, usedAt: null, expiresAt: { $gt: new Date() } })
      .exec();
  }

  async markUsed(id: string): Promise<void> {
    await this.model.updateOne({ _id: id }, { $set: { usedAt: new Date() } }).exec();
  }

  async invalidateAllForUser(userId: Types.ObjectId): Promise<void> {
    await this.model
      .updateMany({ userId, usedAt: null }, { $set: { usedAt: new Date() } })
      .exec();
  }
}
