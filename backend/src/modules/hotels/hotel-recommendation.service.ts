import { Injectable } from '@nestjs/common';
import { CatalogLoaderService } from './catalog/catalog-loader.service';
import type { HotelView } from './catalog/hotel-catalog-record';

export type BudgetTier = 'Budget' | 'Mid-range' | 'Premium' | 'Luxury';
export const BUDGET_TIERS: BudgetTier[] = ['Budget', 'Mid-range', 'Premium', 'Luxury'];

/**
 * Image-ready hotel card. `imageUrls` is intentionally present but empty — the
 * architecture supports hotel imagery without generating any today (Phase 3.7 #9).
 */
export interface HotelCard {
  id: string;
  name: string;
  rating: number;
  location: string;
  tier: BudgetTier;
  highlights: string[];
  imageUrls: string[];
}

export interface RecommendationCriteria {
  destination?: string;
  budget?: number;
  travelers?: number;
  nights?: number;
  perTier?: number;
}

export interface HotelRecommendations {
  destination: string | null;
  travelers: number;
  nights: number;
  budget: number | null;
  suggestedTier: BudgetTier | null;
  perNightBudget: number | null;
  tiers: Array<{ tier: BudgetTier; hotels: HotelCard[] }>;
}

/**
 * Ranks hotels from the catalog into budget tiers for proposal generation. Uses
 * the always-available in-memory catalog (no DB dependency), so it works even
 * during a database outage.
 */
@Injectable()
export class HotelRecommendationService {
  constructor(private readonly catalog: CatalogLoaderService) {}

  recommend(criteria: RecommendationCriteria): HotelRecommendations {
    const travelers = Math.max(1, criteria.travelers ?? 1);
    const nights = Math.max(1, criteria.nights ?? 3);
    const perTier = Math.max(1, criteria.perTier ?? 4);
    const destination = criteria.destination?.trim() || null;

    let pool = this.catalog.all();
    if (destination) {
      const q = destination.toLowerCase();
      const matches = pool.filter(
        (h) =>
          h.city.toLowerCase() === q ||
          (h.area ?? '').toLowerCase().includes(q) ||
          h.name.toLowerCase().includes(q) ||
          h.country.toLowerCase() === q,
      );
      // Fall back to the whole catalog if the destination isn't in it (so a
      // proposal still gets options rather than an empty list).
      if (matches.length) pool = matches;
    }

    const byTier = new Map<BudgetTier, HotelCard[]>(BUDGET_TIERS.map((t) => [t, []]));
    for (const h of pool) {
      const card = this.toCard(h);
      byTier.get(card.tier)?.push(card);
    }

    const tiers = BUDGET_TIERS.map((tier) => ({
      tier,
      hotels: (byTier.get(tier) ?? [])
        .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name))
        .slice(0, perTier),
    })).filter((t) => t.hotels.length > 0);

    const perNightBudget =
      criteria.budget && criteria.budget > 0
        ? Math.round(criteria.budget / (travelers * nights))
        : null;

    return {
      destination,
      travelers,
      nights,
      budget: criteria.budget ?? null,
      suggestedTier: perNightBudget !== null ? this.tierForPerNight(perNightBudget) : null,
      perNightBudget,
      tiers,
    };
  }

  private toCard(h: HotelView): HotelCard {
    const location = [h.area, h.city].filter(Boolean).join(', ');
    return {
      id: h.id,
      name: h.name,
      rating: h.starRating,
      location,
      tier: this.tierForStar(h.starRating),
      highlights: [`${h.starRating}-star`, h.area ?? h.city, h.category].filter(Boolean),
      imageUrls: [],
    };
  }

  private tierForStar(star: number): BudgetTier {
    if (star >= 5) return 'Luxury';
    if (star === 4) return 'Premium';
    if (star === 3) return 'Mid-range';
    return 'Budget';
  }

  /** Rough per-night, per-traveler budget in USD → the tier it best affords. */
  private tierForPerNight(perNight: number): BudgetTier {
    if (perNight < 110) return 'Budget';
    if (perNight < 220) return 'Mid-range';
    if (perNight < 410) return 'Premium';
    return 'Luxury';
  }
}
