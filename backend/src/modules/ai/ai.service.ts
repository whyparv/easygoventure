import { Inject, Injectable } from '@nestjs/common';
import { BusinessException } from '../../common/exceptions/app.exceptions';
import { AI_PROVIDER, AIProvider, ChatMessage } from './providers/ai-provider.interface';
import {
  HotelRecommendationService,
  type HotelRecommendations,
} from '../hotels/hotel-recommendation.service';
import { BrainService } from '../brain/brain.service';
import { HotelsService } from '../hotels/hotels.service';
import { ServicesService } from '../service-catalog/services.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ProposalDraftDto } from './dto/proposal-draft.dto';
import { ParseInquiryDto } from './dto/parse-inquiry.dto';
import { FollowupSuggestionDto } from './dto/followup-suggestion.dto';
import { ProposalSummaryDto } from './dto/proposal-summary.dto';
import { ChatDto } from './dto/chat.dto';
import { LeadChatDto } from './dto/lead-chat.dto';
import { LeadIntakeChatDto, type LeadIntakeChatResponse } from './dto/lead-intake-chat.dto';
import { NextActionDto } from './dto/next-action.dto';

export interface ParsedInquiry {
  customerName: string | null;
  /** The travel agency / company the enquiry comes from. */
  agencyName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  destination: string | null;
  service: string | null;
  /** Requested services as free-form labels (Visa, Airport Transfer, Desert Safari…). */
  services: string[];
  /** Hotels the client named in the inquiry. */
  requestedHotels: string[];
  /** AI-authored "CLIENT REQUIREMENTS" brief preserving the original intent. */
  requirementsNote: string | null;
  travelers: number | null;
  adults: number | null;
  children: number | null;
  rooms: number | null;
  travelDate: string | null;
  returnDate: string | null;
  budget: number | null;
  /** 0–100 extraction confidence for the whole enquiry. */
  confidence: number;
  /** Human-readable labels of the important fields that could NOT be extracted. */
  missing: string[];
}

export type NextActionType =
  | 'create_followup'
  | 'add_note'
  | 'update_status'
  | 'create_proposal'
  | 'none';

export interface NextAction {
  summary: string;
  action: {
    type: NextActionType;
    // create_followup
    scheduledDate?: string;
    remarks?: string;
    nextAction?: string;
    // add_note
    note?: string;
    // update_status
    status?: string;
    // create_proposal
    title?: string;
    proposalType?: string;
    amount?: number;
    currency?: string;
    description?: string;
  };
}

const NEXT_ACTION_TYPES: NextActionType[] = [
  'create_followup',
  'add_note',
  'update_status',
  'create_proposal',
  'none',
];
const LEAD_STATUSES = [
  'NEW',
  'QUOTE_SENT',
  'FOLLOW_UP',
  'CONFIRMED',
  'ARRANGEMENTS',
  'VOUCHER_SENT',
  'COMPLETED',
  'REJECTED',
];
const PROPOSAL_TYPES = ['VISA', 'TRAVEL_PACKAGE', 'HOTEL', 'CUSTOM'];

/**
 * Shared persona for every prompt. Central place to tune the assistant's voice
 * and domain for travel & tour enquiries handled by a Destination Management
 * Company (DMC) selling to travel agencies.
 */
const DMC_ASSISTANT_PERSONA =
  'You are the AI operations assistant for a Destination Management Company (DMC) - ' +
  'a B2B travel wholesaler that arranges visas, hotels, airport transfers, tours & ' +
  'activities (e.g. desert safari, city tours, theme parks, yacht cruises) and holiday ' +
  'packages for travel agencies. You understand destinations, seasons, traveler counts ' +
  '(adults/children), nationalities and typical tour enquiry phrasing.';

@Injectable()
export class AIService {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AIProvider,
    private readonly hotelRecommendations: HotelRecommendationService,
    private readonly brain: BrainService,
    private readonly hotelsService: HotelsService,
    private readonly servicesService: ServicesService,
  ) {}

  /**
   * Endpoint 6 - generate a customer-facing proposal (Markdown) grounded in the
   * real hotel catalog. Uses destination/budget/travellers/dates to pull ranked
   * hotel recommendations, then drafts hotels + activities + transfers + visa.
   */
  async proposalDraft(
    dto: ProposalDraftDto,
  ): Promise<{ proposal: string; recommendations: HotelRecommendations }> {
    const recommendations = this.hotelRecommendations.recommend({
      destination: dto.destination,
      budget: dto.budget,
      travelers: dto.travelers,
      nights: dto.nights,
    });
    const hotelLines = recommendations.tiers
      .flatMap((t) => t.hotels.map((h) => `- [${t.tier}] ${h.name} - ${h.rating}-star, ${h.location}`))
      .join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          `${DMC_ASSISTANT_PERSONA} Today's date is ${this.today()}. Write a polished, ` +
          'customer-facing travel PROPOSAL in clean Markdown that a travel agency can forward ' +
          'to the traveller. Structure it with: a short warm intro; a "Recommended Hotels" ' +
          'section rendered as a Markdown table (Hotel | Tier | Rating | Location) using ONLY ' +
          'the hotels provided; a "Tours & Activities" bullet list of typical experiences for ' +
          'the destination; an "Airport Transfers" note; a "Visa" note describing the typical ' +
          'process (never claim guaranteed approval); and a friendly closing. Do NOT invent ' +
          'prices, availability, or hotels that are not listed. Use headings and bullet points.',
      },
      {
        role: 'user',
        content:
          `Customer: ${dto.customerName ?? 'the traveller'}\n` +
          `Destination: ${recommendations.destination ?? dto.destination}\n` +
          `Travellers: ${recommendations.travelers}\nNights: ${recommendations.nights}\n` +
          `Budget: ${recommendations.budget ?? 'not specified'}\n` +
          `Suggested tier: ${recommendations.suggestedTier ?? 'n/a'}\n` +
          `Travel date: ${dto.travelDate ?? 'n/a'}\n\nRecommended hotels to include:\n` +
          (hotelLines || '(no catalog matches - suggest suitable hotel categories generically)'),
      },
    ];

    const proposal = await this.provider.chat(messages, { temperature: 0.5 });
    return { proposal, recommendations };
  }

  /** Endpoint 1 - extract structured fields from a free-text inquiry. */
  async parseInquiry(dto: ParseInquiryDto): Promise<ParsedInquiry> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          `${DMC_ASSISTANT_PERSONA} Today's date is ${this.today()}. Extract structured ` +
          'data from a raw travel enquiry (which may be a pasted WhatsApp chat, an email, or ' +
          'free text). Respond ONLY with a JSON object with keys: ' +
          'customerName (the enquirer\'s / contact person\'s full name as a string | null), ' +
          'agencyName (the travel agency or company name, if mentioned | null), ' +
          'customerPhone (phone/WhatsApp number, digits and + only | null), ' +
          'customerEmail (email address | null), ' +
          'destination (city or country as a string, e.g. "Dubai" | null), service (the single ' +
          'primary service, one of Visa, Travel Package, Hotel, Transfer, Custom — map tours/' +
          'activities/sightseeing/desert safari to Travel Package, and anything unclear to Custom, ' +
          'or null), services (an ARRAY capturing EVERY service, activity or inclusion the client ' +
          'explicitly lists — one entry per listed item, preserving their wording, e.g. ' +
          '["Airport Transfer","UAE Visa","Daily Breakfast","Accommodation","Desert Safari with Dinner",' +
          '"Dolphin Show at Dubai Dolphinarium"]. Include named inclusions like "Daily Breakfast" and ' +
          '"Accommodation". Do not merge, summarise or omit lines; empty array if none stated), ' +
          'adults (number of adults as an integer | null), children (number of children | null), ' +
          'rooms (number of hotel rooms | null), ' +
          'travelers (total head count as an integer, summing adults and children | null), ' +
          'travelDate (ISO date YYYY-MM-DD | null; when a date has no year use the next future ' +
          'occurrence, never a past date, and pick the start/departure date for a range), ' +
          'returnDate (ISO date YYYY-MM-DD | null; the end/return date of a range if given), ' +
          'budget (total budget as a number in the stated or implied currency, digits only | null), ' +
          'requestedHotels (an ARRAY of hotel names the client explicitly named, e.g. ' +
          '["Al Khoory Sky Garden","Hilton Dubai Creek Residence"] — empty array if none), ' +
          'requirementsNote (a plain-text "CLIENT REQUIREMENTS" brief that preserves the ' +
          'operational intent for the sales staff. Use EXACTLY this structure with these ' +
          'headings, omitting a section only if it has no data:\\n' +
          'CLIENT REQUIREMENTS\\n\\nPassenger:\\n<name or "Not specified">\\n\\n' +
          'Travel Dates:\\n<e.g. 15 Jun - 19 Jun or "Not specified">\\n\\n' +
          'Requested Hotels:\\n- <hotel> (one per line, or "None specified")\\n\\n' +
          'Requested Services:\\n\\u2713 <service> (one per line prefixed with a check mark)\\n\\n' +
          'Notes:\\n<one short sentence interpreting what the client wants>. ' +
          'Base it ONLY on the enquiry — never invent hotels, services or dates), ' +
          'confidence (integer 0-100 for how confident you are in the overall extraction). ' +
          'Do not invent values — use null (or [] for arrays) when the enquiry does not state something.',
      },
      { role: 'user', content: dto.text },
    ];

    const raw = await this.provider.chat(messages, { json: true, temperature: 0 });
    const parsed = this.parseJson<Partial<ParsedInquiry>>(raw);

    const adults = this.asNumber(parsed.adults);
    const children = this.asNumber(parsed.children);
    const travelers =
      this.asNumber(parsed.travelers) ??
      (adults !== null || children !== null ? (adults ?? 0) + (children ?? 0) : null);

    const result = {
      customerName: this.asString(parsed.customerName),
      agencyName: this.asString(parsed.agencyName),
      customerPhone: this.asString(parsed.customerPhone),
      customerEmail: this.asString(parsed.customerEmail),
      destination: this.asString(parsed.destination),
      service: this.asString(parsed.service),
      services: this.asStringArray(parsed.services),
      requestedHotels: this.asStringArray(parsed.requestedHotels),
      requirementsNote: this.asString(parsed.requirementsNote),
      travelers,
      adults,
      children,
      rooms: this.asNumber(parsed.rooms),
      travelDate: this.asString(parsed.travelDate),
      returnDate: this.asString(parsed.returnDate),
      budget: this.asNumber(parsed.budget),
    };
    // Prefer the model's self-reported confidence; otherwise derive it from how
    // many scalar fields were actually extracted (so the UI always has a signal).
    const reported = this.asNumber(parsed.confidence);
    const scalars = Object.entries(result).filter(
      ([k]) => k !== 'services' && k !== 'requestedHotels' && k !== 'requirementsNote',
    );
    const filled = scalars.filter(([, v]) => v !== null).length;
    const confidence =
      reported !== null
        ? Math.max(0, Math.min(100, reported))
        : Math.round((filled / scalars.length) * 100);

    // Surface the important fields we could NOT extract so the agent can chase them.
    const IMPORTANT: Array<[keyof typeof result, string]> = [
      ['customerName', 'Contact Person'],
      ['agencyName', 'Agency'],
      ['customerPhone', 'Phone'],
      ['destination', 'Destination'],
      ['travelDate', 'Travel Date'],
    ];
    const missing = IMPORTANT.filter(([k]) => result[k] === null).map(([, label]) => label);

    return { ...result, confidence, missing };
  }

  /** Endpoint 2 - suggest a follow-up message for a lead. */
  async followupSuggestion(dto: FollowupSuggestionDto): Promise<{ message: string }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          `${DMC_ASSISTANT_PERSONA} Write a concise, professional, friendly follow-up ` +
          'message (max 3 sentences) the agent can send to the travel agency about their ' +
          'enquiry. Reference the destination/service where helpful, keep a warm B2B tone, ' +
          'and end with a clear next step. Return only the message text - no greeting ' +
          'placeholders like "[Name]" and no signature.',
      },
      {
        role: 'user',
        content:
          `Lead: ${dto.leadName}\nInquiry type: ${dto.inquiryType}\n` +
          `Current status: ${dto.status}\nContext: ${dto.context ?? 'n/a'}`,
      },
    ];

    const message = await this.provider.chat(messages, { temperature: 0.5 });
    return { message };
  }

  /** Endpoint 3 - turn proposal details into a client-friendly summary. */
  async proposalSummary(dto: ProposalSummaryDto): Promise<{ summary: string }> {
    const price =
      dto.amount !== undefined ? `${dto.currency ?? 'USD'} ${dto.amount}` : 'on request';
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          `${DMC_ASSISTANT_PERSONA} Write a clear, persuasive, client-friendly summary of ` +
          'the proposal (max 4 sentences) that the agency can forward to the traveler. ' +
          'Highlight the destination, what is included, and the value - keep it factual, ' +
          'do not invent inclusions or prices that are not provided. Return only the summary.',
      },
      {
        role: 'user',
        content:
          `Title: ${dto.title}\nType: ${dto.proposalType}\nPrice: ${price}\n` +
          `Details: ${dto.description ?? 'n/a'}`,
      },
    ];

    const summary = await this.provider.chat(messages, { temperature: 0.4 });
    return { summary };
  }

  /** Endpoint 4 - free-form conversational assistant for DMC operations. */
  async chat(dto: ChatDto): Promise<{ reply: string }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          `${DMC_ASSISTANT_PERSONA} Today's date is ${this.today()}. You help the DMC's ` +
          'agents with their day-to-day work: explaining visa requirements and documents, ' +
          'suggesting itineraries, packages, hotels, transfers, tours & activities for a ' +
          'destination, advising what to include in a quotation, drafting WhatsApp/email ' +
          'replies and follow-ups, and answering general travel-operations questions. You are ' +
          'also a CRM copilot: you CAN help capture leads. When a message contains customer ' +
          'details (name, phone, email, destination, dates, pax, budget), extract them, point ' +
          'out what is still missing, and tell the agent they can create the lead and its ' +
          'inquiry in one step via "Create → Lead" (AI Assisted) by pasting the message - ' +
          'NEVER reply that you cannot create leads or that this is outside your ability. Be ' +
          'accurate, concise and practical; use short paragraphs or bullet points. When a ' +
          'request is missing key details (destination, dates, nationality, pax, budget), ' +
          'ask a brief clarifying question. Do not invent specific prices, availability or ' +
          'visa approvals - describe typical ranges/processes and flag when live confirmation ' +
          'is needed. Stay within travel/DMC topics.',
      },
      ...(dto.context
        ? [
            {
              role: 'system' as const,
              content:
                'The agent is currently viewing this CRM record. Use it to answer ' +
                'specifically about this lead/deal; refer to real names, statuses, ' +
                `amounts and dates from it rather than generic advice.\n\n${dto.context}`,
            },
          ]
        : []),
      ...(dto.history ?? []).map((turn) => ({ role: turn.role, content: turn.content })),
      { role: 'user' as const, content: dto.message },
    ];

    const reply = await this.provider.chat(messages, { temperature: 0.5, maxTokens: 1200 });
    return { reply };
  }

  /** Endpoint 5 - recommend the single best next action for the current lead. */
  async nextAction(dto: NextActionDto): Promise<NextAction> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          `${DMC_ASSISTANT_PERSONA} Today's date is ${this.today()}. Recommend the SINGLE ` +
          'best next action to move this lead forward, grounded in the record below. ' +
          'Respond ONLY with a JSON object: { "summary": string (one sentence why), ' +
          '"action": { "type": one of "create_followup" | "add_note" | "update_status" | ' +
          '"create_proposal" | "none", ...fields } }. Fields by type: ' +
          'create_followup → scheduledDate (YYYY-MM-DD, a future date), remarks, nextAction; ' +
          'add_note → note; update_status → status (one of NEW, QUOTE_SENT, ' +
          'FOLLOW_UP, CONFIRMED, ARRANGEMENTS, VOUCHER_SENT, COMPLETED, REJECTED); create_proposal → ' +
          'title, proposalType (VISA | TRAVEL_PACKAGE | HOTEL | CUSTOM), amount (number, ' +
          'optional - omit if unknown, never guess a price), currency (default USD), ' +
          'description. Prefer a follow-up or note unless a proposal is clearly the next ' +
          'step. Use "none" if nothing is needed.',
      },
      { role: 'system', content: `CRM record:\n${dto.context}` },
      { role: 'user', content: dto.message?.trim() || 'What is the best next action?' },
    ];

    const raw = await this.provider.chat(messages, {
      json: true,
      temperature: 0.2,
      maxTokens: 700,
    });
    return this.normalizeNextAction(this.parseJson(raw));
  }

  /** Lead-specific chat that injects the org's brain prompt for the 'leads' section. */
  async leadChat(
    dto: LeadChatDto,
    actor: AuthenticatedUser,
  ): Promise<{ reply: string }> {
    const brainPrompt = await this.brain.getPrompt(actor, 'leads');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          `${DMC_ASSISTANT_PERSONA} Today's date is ${this.today()}. You are the dedicated ` +
          'AI assistant for a specific lead. You have full context about this lead\'s ' +
          'itinerary (locations, hotels per location), traveler roster, proposals, and ' +
          'follow-up history. Answer questions, suggest itinerary refinements, recommend ' +
          'hotels for each location, draft messages to the client, and help build a quote. ' +
          'Be specific - reference the real locations, hotels, and traveler details from ' +
          'the context. Never invent prices or availability; flag when live confirmation ' +
          'is needed.',
      },
      ...(brainPrompt.trim()
        ? [{ role: 'system' as const, content: `Additional instructions:\n${brainPrompt}` }]
        : []),
      ...(dto.context
        ? [
            {
              role: 'system' as const,
              content:
                'Current lead record (use this to answer specifically):\n\n' + dto.context,
            },
          ]
        : []),
      ...(dto.history ?? []).map((t) => ({ role: t.role, content: t.content })),
      { role: 'user' as const, content: dto.message },
    ];

    const reply = await this.provider.chat(messages, { temperature: 0.5, maxTokens: 1500 });
    return { reply };
  }

  /**
   * Conversational lead intake - the AI gathers missing fields through chat,
   * updates extracted data each turn, and marks complete when enough info exists.
   */
  async leadIntakeChat(
    dto: LeadIntakeChatDto,
    actor: AuthenticatedUser,
  ): Promise<LeadIntakeChatResponse> {
    const brainPrompt = await this.brain.getPrompt(actor, 'leads');
    const current = dto.extractedData ?? {};

    const systemPrompt = [
      `${DMC_ASSISTANT_PERSONA} Today's date is ${this.today()}.`,
      'You are an expert DMC lead-capture assistant for EasyGo Venture Tourism (UAE-based DMC).',
      'Your role: gather lead details conversationally AND extract hotels/services mentioned in real-time.',
      '',
      '━━ REQUIRED (must collect before lead can be created) ━━',
      'full name, phone number with country code.',
      '',
      '━━ IMPORTANT FIELDS ━━',
      'destination(s), travel dates, travelers breakdown (adults/children/infants), budget, inquiry type, nationality.',
      '',
      '━━ DMC DOMAIN RULES — always apply ━━',
      '1. INFANT RULE: Infants (0-23 months) fly on lap but need a separate infant fare. UAE entry requires at least one adult (18+) per infant. Always ask: "Are there any infants in the group?"',
      '2. NATIONALITY CHECK: Visa requirements vary critically. Indians, Pakistanis, Bangladeshis, Filipinos need UAE visa (can get on arrival or pre-arranged). Nigerians and most African nationals face strict scrutiny — need proof of funds ($1000+/person), strong return ties, employment letter; high refusal rate; warn the agency. Always ask nationality.',
      '3. TRAVELER COMPOSITION: Ask for exact split — "How many adults, children (ages), and infants?" This affects room allocation, visa costs, and activity eligibility.',
      '4. ACTIVITY AGE LIMITS: Skydiving 18+. ATV/quad bikes 16+. Hot-air balloon 10+. Helicopter 4+. Aquaventure 2+. Always flag if group has children near the limits.',
      '5. HOTEL PREFERENCES: Ask about star preference if not mentioned. 5-star, 4-star, budget? Any hotel requests?',
      '6. SERVICES NEEDED: Always clarify if they need airport transfers, visas, desert safari, city tours, dhow cruise, theme parks, etc.',
      '',
      '━━ HOTEL EXTRACTION ━━',
      'When user mentions any hotel name or type, add to hotels[]. Infer star rating from name (Atlantis/Burj Al Arab = 5★, Marriott/Hilton = 4-5★, Holiday Inn = 3-4★).',
      'Split-stay example: "3 nights Atlantis then 2 nights in JBR area" → two hotel entries.',
      '',
      '━━ SERVICE EXTRACTION & PRICING ━━',
      'When a service is mentioned, classify as PRIVATE or SHARED:',
      '  SHARED = one unit serves multiple people, cost divides by pax count (e.g., shared airport transfer, group desert safari, dhow cruise, group city tour)',
      '  PRIVATE = each person/booking pays the full rate (e.g., visa per person, private transfer, private city tour)',
      'SHARED pricing: pricePerPerson = (Math.ceil(pax / capacity) × basePricePerUnit) / pax',
      'PRIVATE pricing: pricePerPerson = basePricePerUnit, total = basePricePerUnit × pax',
      'Default rates to use when not stated (AED unless noted):',
      '  - Airport Transfer sedan (4-pax): SHARED, capacity=4, base=200',
      '  - Airport Transfer van/MPV (7-pax): SHARED, capacity=7, base=350',
      '  - Desert Safari (shared group): SHARED, capacity=40, base=150/person → base=150, capacity=1 (per-person)',
      '  - Dhow Cruise Dinner: SHARED, capacity=1 (per-person rate 130)',
      '  - UAE 30-day Tourist Visa: PRIVATE, base=350/person',
      '  - UAE 60-day Tourist Visa: PRIVATE, base=550/person',
      '  - Private City Tour (half-day): PRIVATE, base=600/group',
      '  - Desert Safari Private: PRIVATE, base=800/group',
      '  - Burj Khalifa 124F ticket: PRIVATE, base=149/person',
      '',
      '━━ WHAT TO ASK IF MISSING ━━',
      'After extracting what you can, ask ONE natural follow-up question for the most critical missing info.',
      'Priority order: name → phone → destination → travel dates → traveler count → nationality.',
      '',
      '━━ CRITICAL RULES ━━',
      '1. Return ONLY valid JSON. No markdown fences, no extra text before or after.',
      '2. ALWAYS merge with existing data. Never erase already-extracted fields.',
      '3. hotels[] and services[] MUST be populated whenever the user mentions hotels/activities/services — NEVER put this info in notes.',
      '4. For multi-city trips: create ONE hotel entry per city (each with correct city, nights, checkIn, checkOut).',
      '5. Calculate hotel dates sequentially: city1 checkIn=startDate, checkOut=startDate+nights1; city2 checkIn=city1.checkOut, checkOut=city2.checkIn+nights2.',
      '6. travelers = adults + children + infants (total headcount).',
      '7. destination = comma-separated city/country list (e.g. "Dubai, Doha").',
      '8. isComplete = true ONLY when name AND phone are both known.',
      '9. DO NOT put hotel info, city info, or service info in the notes field.',
      '',
      `EXAMPLE — if user says "Book Dubai + Doha trip for Parv Jain, 10-18 July, 2 pax (1 adult 1 child), 2 nights Dubai 4-star, 3 nights Doha 5-star, desert safari and skydiving":`,
      `{"reply":"Got it Parv! Dubai (2 nights, 4★) + Doha (3 nights, 5★), 10–18 July, 1 adult + 1 child. Desert safari and skydiving in Dubai noted. Could you share your phone number?","extractedData":{"name":"Parv Jain","phone":null,"email":null,"companyName":null,"inquiryType":"TRAVEL_PACKAGE","source":"MANUAL","destination":"Dubai, Doha","startDate":"${this.today().slice(0, 4)}-07-10","endDate":"${this.today().slice(0, 4)}-07-18","budget":null,"travelers":2,"adults":1,"children":1,"infants":0,"nationality":null,"notes":null,"hotels":[{"city":"Dubai","name":"4-Star Hotel Dubai","checkIn":"${this.today().slice(0, 4)}-07-10","checkOut":"${this.today().slice(0, 4)}-07-12","nights":2,"rating":4,"roomCount":1},{"city":"Doha","name":"5-Star Hotel Doha","checkIn":"${this.today().slice(0, 4)}-07-12","checkOut":"${this.today().slice(0, 4)}-07-15","nights":3,"rating":5,"roomCount":1}],"services":[{"name":"Desert Safari","serviceType":"tour","pricingType":"SHARED","capacity":40,"basePricePerUnit":150,"currency":"AED","date":null,"notes":null},{"name":"Skydiving","serviceType":"activity","pricingType":"PRIVATE","capacity":null,"basePricePerUnit":1800,"currency":"AED","date":null,"notes":null}]},"isComplete":false,"missingFields":["phone"],"whatsappGreeting":""}`,
      '',
      'Current extracted data (merge with this, never overwrite non-null fields with null):',
      JSON.stringify(current, null, 2),
      brainPrompt.trim() ? `\nOrg-specific instructions:\n${brainPrompt}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(dto.history ?? []).map((t) => ({ role: t.role, content: t.content })),
      { role: 'user', content: dto.message },
    ];

    const raw = await this.provider.chat(messages, { temperature: 0.3, maxTokens: 1200 });

    let parsed: LeadIntakeChatResponse;
    try {
      const jsonStr = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
      const obj = JSON.parse(jsonStr) as Partial<LeadIntakeChatResponse>;
      const merged = { ...current, ...((obj.extractedData as object) ?? {}) } as LeadIntakeChatResponse['extractedData'];
      // Accumulate hotels and services arrays (never overwrite with empty)
      if (Array.isArray((obj.extractedData as Record<string, unknown>)?.hotels)) {
        merged.hotels = (obj.extractedData as Record<string, unknown>).hotels as LeadIntakeChatResponse['extractedData']['hotels'];
      } else if (Array.isArray(current.hotels)) {
        merged.hotels = current.hotels as LeadIntakeChatResponse['extractedData']['hotels'];
      }
      if (Array.isArray((obj.extractedData as Record<string, unknown>)?.services)) {
        merged.services = (obj.extractedData as Record<string, unknown>).services as LeadIntakeChatResponse['extractedData']['services'];
      } else if (Array.isArray(current.services)) {
        merged.services = current.services as LeadIntakeChatResponse['extractedData']['services'];
      }
      parsed = {
        reply: this.asString(obj.reply) ?? 'Got it! Could you share more details?',
        extractedData: merged,
        isComplete: Boolean(obj.isComplete),
        missingFields: Array.isArray(obj.missingFields) ? (obj.missingFields as string[]) : [],
        whatsappGreeting: this.asString(obj.whatsappGreeting) ?? undefined,
      };
    } catch {
      parsed = {
        reply: raw,
        extractedData: current as unknown as LeadIntakeChatResponse['extractedData'],
        isComplete: false,
        missingFields: [],
      };
    }

    // Enrich extracted hotels/services with real catalog data
    parsed.extractedData = await this.enrichExtractedData(parsed.extractedData, actor);

    return parsed;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Validate/coerce the model's action JSON into a safe, typed shape. */
  private normalizeNextAction(raw: unknown): NextAction {
    const root = (raw ?? {}) as Record<string, unknown>;
    const rawAction = (root.action ?? {}) as Record<string, unknown>;

    const type = NEXT_ACTION_TYPES.includes(rawAction.type as NextActionType)
      ? (rawAction.type as NextActionType)
      : 'none';
    const summary = this.asString(root.summary) ?? 'No specific action recommended.';

    const action: NextAction['action'] = { type };
    switch (type) {
      case 'create_followup':
        action.scheduledDate = this.asString(rawAction.scheduledDate) ?? undefined;
        action.remarks = this.asString(rawAction.remarks) ?? undefined;
        action.nextAction = this.asString(rawAction.nextAction) ?? undefined;
        break;
      case 'add_note':
        action.note = this.asString(rawAction.note) ?? undefined;
        break;
      case 'update_status': {
        const status = this.asString(rawAction.status);
        action.status = status && LEAD_STATUSES.includes(status) ? status : undefined;
        break;
      }
      case 'create_proposal': {
        action.title = this.asString(rawAction.title) ?? undefined;
        const pType = this.asString(rawAction.proposalType);
        action.proposalType = pType && PROPOSAL_TYPES.includes(pType) ? pType : 'CUSTOM';
        action.amount = this.asNumber(rawAction.amount) ?? undefined;
        action.currency = (this.asString(rawAction.currency) ?? 'USD').slice(0, 3).toUpperCase();
        action.description = this.asString(rawAction.description) ?? undefined;
        break;
      }
      default:
        break;
    }

    // If a required field is missing, downgrade to a safe non-destructive action.
    if (type === 'update_status' && !action.status) return { summary, action: { type: 'none' } };
    if (type === 'create_proposal' && !action.title)
      return { summary, action: { type: 'none' } };

    return { summary, action };
  }

  async generateQuote(
    dto: import('./dto/generate-quote.dto').GenerateQuoteDto,
    actor: AuthenticatedUser,
  ): Promise<import('./dto/generate-quote.dto').GenerateQuoteResult> {
    const templatePrompt = await this.brain.getPrompt(actor, 'whatsapp_quote_template');
    const currency = dto.currency ?? 'AED';
    const markup = dto.markup ?? 0;
    const validityHours = dto.validityHours ?? 48;
    const travelers = dto.travelers;
    const services = dto.services ?? [];

    // Deterministic pricing: services cost per person (shared across all hotel options)
    const servicesPerPerson = services.reduce((sum, svc) => {
      if (svc.pricePerPerson != null) return sum + svc.pricePerPerson;
      if (!svc.basePricePerUnit) return sum;
      if (svc.pricingType === 'SHARED') {
        const cap = svc.capacity ?? 1;
        const units = Math.ceil(travelers / cap);
        return sum + (units * svc.basePricePerUnit) / travelers;
      }
      return sum + svc.basePricePerUnit;
    }, 0);

    // Pricing per hotel option
    const hotelPricing: import('./dto/generate-quote.dto').QuoteHotelResult[] = dto.hotels.map((h) => {
      const nights = h.nights ?? 1;
      const rooms = h.rooms ?? 1;
      let hotelPerPerson: number;
      if (h.pricePerPerson != null) {
        hotelPerPerson = h.pricePerPerson;
      } else if (h.pricePerNight != null) {
        hotelPerPerson = (h.pricePerNight * rooms * nights) / travelers;
      } else {
        // auto-price from hash + stars
        const stars = h.stars ?? 4;
        const ranges: Record<number, [number, number]> = {
          5: [800, 1200], 4: [400, 700], 3: [200, 350], 2: [100, 200], 1: [60, 100],
        };
        const [min, max] = ranges[Math.round(stars)] ?? [200, 400];
        let hash = 0;
        for (let i = 0; i < h.name.length; i++) hash = (hash * 31 + h.name.charCodeAt(i)) & 0xffffffff;
        const pricePerNight = min + (Math.abs(hash) % (max - min + 1));
        hotelPerPerson = (pricePerNight * rooms * nights) / travelers;
      }
      const base = hotelPerPerson + servicesPerPerson;
      const withMarkup = markup > 0 ? base * (1 + markup / 100) : base;
      const totalPerPerson = Math.round(withMarkup);
      return {
        name: h.name,
        stars: h.stars,
        location: h.location,
        roomType: h.roomType,
        nights,
        rooms,
        basePricePerPerson: Math.round(hotelPerPerson),
        servicesPricePerPerson: Math.round(servicesPerPerson),
        totalPricePerPerson: totalPerPerson,
        totalPrice: totalPerPerson * travelers,
        currency,
      };
    });

    // Format dates
    const formatDate = (d?: string) => {
      if (!d) return '';
      const dt = new Date(d);
      return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };
    const dateRange = dto.startDate
      ? `${formatDate(dto.startDate)}${dto.endDate ? `–${formatDate(dto.endDate)}` : ''}`
      : '';

    const serviceNames = services.map((s) => s.name);

    const defaultTemplate = `You are generating a WhatsApp quote message for a DMC package. Follow this EXACT format (use WhatsApp bold with *text*, emojis, no HTML):

*{DESTINATION} Package{DATE_RANGE}*
For: {CUSTOMER_NAME}{COMPANY}

{HOTEL_OPTIONS}
*Includes:* {SERVICES}

⚠️ {VALIDITY} hours validity · Non refundable · Subject to availability

To confirm: names + passports
— {BRAND_NAME}{AGENT}`;

    const systemMsg = templatePrompt?.trim()
      ? `${templatePrompt}\n\nAlso follow these format rules: use WhatsApp bold (*text*), emojis (📍, ⭐, ✅, ⚠️), no HTML. Each hotel is a numbered option with name, stars, location, room type, and price per person.`
      : defaultTemplate;

    const hotelLines = hotelPricing
      .map(
        (h, i) =>
          `${i + 1}. ${h.name}${h.stars ? ` (${h.stars}★)` : ''}${h.location ? `\n   📍 ${h.location}` : ''}${h.roomType ? `\n   ${h.roomType}` : ''}\n   ${currency} ${h.totalPricePerPerson.toLocaleString()}/person`,
      )
      .join('\n\n');

    const prompt = [
      `Generate a WhatsApp quote message for this DMC package:`,
      `Destination: ${dto.destination}`,
      `Dates: ${dateRange || 'TBD'}`,
      `Travelers: ${travelers} (${dto.adults ?? travelers} adults${dto.children ? `, ${dto.children} children` : ''})`,
      `Customer: ${dto.customerName}${dto.companyName ? ` (${dto.companyName})` : ''}`,
      `Hotel options and pricing (${currency}):`,
      hotelLines,
      serviceNames.length > 0 ? `Included services: ${serviceNames.join(', ')}` : '',
      `Quote validity: ${validityHours} hours`,
      `DMC Brand: ${dto.brandName ?? 'Easy Go Venture Tourism'}`,
      dto.agentName ? `Agent: ${dto.agentName}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const raw = await this.provider.chat(
      [
        { role: 'system', content: systemMsg },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.3, maxTokens: 800 },
    );

    return { message: raw.trim(), hotelPricing, currency, validityHours };
  }

  private async enrichExtractedData(
    data: LeadIntakeChatResponse['extractedData'],
    actor: AuthenticatedUser,
  ): Promise<LeadIntakeChatResponse['extractedData']> {
    const destination = data.destination ?? 'Dubai';
    const primaryCity = destination.split(',')[0].trim();

    // Enrich hotels: match generic "4-Star Hotel Dubai" with actual catalog names
    if (data.hotels?.length) {
      data.hotels = await Promise.all(
        data.hotels.map(async (h) => {
          try {
            const city = h.city ?? primaryCity;
            const starRating = h.rating ? (Math.round(h.rating) as 3 | 4 | 5) : undefined;
            // Only search by name if it's a real hotel name (not "4-star hotel ...")
            const isGenericName = !h.name || /\d[\s-]*star/i.test(h.name);
            const results = await this.hotelsService.findAll(
              Object.assign(Object.create(null), { city, starRating, search: isGenericName ? undefined : h.name, limit: 1, page: 1, sortOrder: 'desc' }) as import('../hotels/dto/query-hotel.dto').QueryHotelDto,
            );
            const match = results.data[0];
            if (match) {
              return {
                ...h,
                name: match.name,
                rating: 'starRating' in match ? match.starRating : (h.rating ?? 4),
                city: 'city' in match ? match.city : city,
              };
            }
          } catch {
            // DB unavailable — return as-is
          }
          return h;
        }),
      );
    }

    // Enrich services: get real pricing from catalog
    if (data.services?.length) {
      data.services = await Promise.all(
        data.services.map(async (s) => {
          if (!s.name) return s;
          try {
            const results = await this.servicesService.findAll(
              Object.assign(Object.create(null), { search: s.name, destination: primaryCity, isActive: 'true', limit: 1, page: 1, sortOrder: 'desc' }) as import('../service-catalog/dto/query-service.dto').QueryServiceDto,
              actor,
            );
            const match = results.data[0];
            if (match) {
              const price = match.defaultSellPrice ?? match.basePrice;
              return {
                ...s,
                name: match.name,
                basePricePerUnit: price != null ? price : s.basePricePerUnit,
                currency: match.currency ?? s.currency ?? 'AED',
              };
            }
          } catch {
            // DB unavailable — return as-is
          }
          return s;
        }),
      );
    }

    return data;
  }

  /** Current date as YYYY-MM-DD, injected so the model can resolve relative dates. */
  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private parseJson<T>(raw: string): T {
    const cleaned = raw
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/i, '')
      .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    const candidate = start >= 0 && end >= 0 ? cleaned.slice(start, end + 1) : cleaned;

    try {
      return JSON.parse(candidate) as T;
    } catch {
      throw new BusinessException('AI returned malformed JSON', 'AI_PARSE_ERROR');
    }
  }

  private asString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  private asNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      return Number(value);
    }
    return null;
  }

  /** Coerce a model value into a clean, de-duplicated array of service labels. */
  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of value) {
      const s = this.asString(item);
      if (s && !seen.has(s.toLowerCase())) {
        seen.add(s.toLowerCase());
        out.push(s);
      }
    }
    return out;
  }
}
