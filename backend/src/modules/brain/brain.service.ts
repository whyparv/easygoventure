import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BrainConfig, BrainConfigDocument, BRAIN_SECTIONS } from './schemas/brain-config.schema';
import { UpsertBrainConfigDto } from './dto/brain-config.dto';
import { requireOrganizationId } from '../../common/tenant/tenant-scope';
import type { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class BrainService {
  constructor(
    @InjectModel(BrainConfig.name)
    private readonly model: Model<BrainConfigDocument>,
  ) {}

  async listAll(actor: AuthenticatedUser): Promise<BrainConfig[]> {
    const organizationId = requireOrganizationId(actor);
    const saved = await this.model
      .find({ organizationId, section: { $in: BRAIN_SECTIONS } })
      .lean()
      .exec();

    const map = new Map(saved.map((s) => [s.section, s]));
    return BRAIN_SECTIONS.map((section) => ({
      ...(map.get(section) ?? {
        organizationId,
        section,
        label: this.defaultLabel(section),
        prompt: this.defaultPrompt(section),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    })) as BrainConfig[];
  }

  async getSection(actor: AuthenticatedUser, section: string): Promise<BrainConfig | null> {
    const organizationId = requireOrganizationId(actor);
    return this.model.findOne({ organizationId, section }).lean().exec();
  }

  /** Returns the prompt string for a section (falls back to built-in default if not configured). */
  async getPrompt(actor: AuthenticatedUser, section: string): Promise<string> {
    const doc = await this.getSection(actor, section);
    return doc?.prompt || this.defaultPrompt(section);
  }

  async upsert(
    actor: AuthenticatedUser,
    section: string,
    dto: UpsertBrainConfigDto,
  ): Promise<BrainConfig> {
    const organizationId = requireOrganizationId(actor);
    const doc = await this.model
      .findOneAndUpdate(
        { organizationId, section },
        {
          $set: {
            organizationId,
            section,
            prompt: dto.prompt,
            label: dto.label ?? this.defaultLabel(section),
          },
        },
        { upsert: true, new: true, runValidators: true },
      )
      .lean()
      .exec();
    return doc!;
  }

  private defaultLabel(section: string): string {
    return section.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private defaultPrompt(section: string): string {
    if (section === 'whatsapp_quote_template') {
      return `Generate a WhatsApp-formatted DMC package quote. Use this EXACT format:

*{DESTINATION} Package — {DATE_RANGE} | {TRAVELERS} pax*
For: {CUSTOMER_NAME}{COMPANY}

{HOTEL_OPTIONS_NUMBERED}

*Includes:* {SERVICE_LIST}

⚠️ {VALIDITY_HOURS} hours validity · Non refundable · Subject to availability

To confirm: names + passports
— {BRAND_NAME}{AGENT_NAME}

Rules:
- Use WhatsApp bold (*text*) for headings and hotel names
- Each hotel option: number, name (stars★), 📍 location on next line, room type, then price per person
- Mark selected/recommended hotel with ✅
- Services list separated by ·
- Keep it clean and professional`;
    }
    return '';
  }
}
