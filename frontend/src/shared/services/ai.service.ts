import { http } from '@shared/api/http';
import type { ParsedInquiry } from '@shared/types/domain';
import type { ProposalDraft } from '@shared/types/ops-domain';

export interface ProposalDraftInput {
  destination: string;
  customerName?: string;
  travelers?: number;
  nights?: number;
  budget?: number;
  travelDate?: string;
}

export interface FollowupSuggestionInput {
  leadName: string;
  inquiryType: string;
  status: string;
  context?: string;
}

export interface ProposalSummaryInput {
  title: string;
  proposalType: string;
  amount?: number;
  currency?: string;
  description?: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatInput {
  message: string;
  history?: ChatTurn[];
  context?: string;
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
    scheduledDate?: string;
    remarks?: string;
    nextAction?: string;
    note?: string;
    status?: string;
    title?: string;
    proposalType?: string;
    amount?: number;
    currency?: string;
    description?: string;
  };
}

export interface NextActionInput {
  context: string;
  message?: string;
}

export interface LeadChatInput {
  message: string;
  history?: ChatTurn[];
  context?: string;
}

export interface ExtractedHotel {
  city?: string;
  name?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  rating?: number;
  roomCount?: number;
}

export interface ExtractedService {
  name?: string;
  serviceType?: string;
  /** PRIVATE = each booking/person pays full; SHARED = split by pax count */
  pricingType?: 'PRIVATE' | 'SHARED';
  /** For SHARED: capacity of one unit (e.g. 4 for sedan) */
  capacity?: number;
  /** Full cost of one unit (one cab, one ticket, one visa) */
  basePricePerUnit?: number;
  currency?: string;
  date?: string;
  notes?: string;
}

export interface ExtractedLeadData {
  name?: string;
  phone?: string;
  email?: string;
  companyName?: string;
  inquiryType?: string;
  source?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  travelDate?: string; // legacy fallback from parseInquiry
  budget?: number;
  travelers?: number;
  adults?: number;
  children?: number;
  infants?: number;
  nationality?: string;
  notes?: string;
  hotels?: ExtractedHotel[];
  services?: ExtractedService[];
}

export interface LeadIntakeChatInput {
  message: string;
  history?: ChatTurn[];
  extractedData?: ExtractedLeadData;
}

export interface LeadIntakeChatResponse {
  reply: string;
  extractedData: ExtractedLeadData;
  isComplete: boolean;
  missingFields: string[];
  whatsappGreeting?: string;
}

export interface HotelOptionForQuote {
  name: string;
  location?: string;
  stars?: number;
  roomType?: string;
  pricePerNight?: number;
  rooms?: number;
  nights?: number;
  pricePerPerson?: number;
}

export interface ServiceForQuote {
  name: string;
  pricingType?: 'PRIVATE' | 'SHARED';
  capacity?: number;
  basePricePerUnit?: number;
  currency?: string;
  pricePerPerson?: number;
}

export interface GenerateQuoteInput {
  customerName: string;
  companyName?: string;
  destination: string;
  startDate?: string;
  endDate?: string;
  travelers: number;
  adults?: number;
  children?: number;
  hotels: HotelOptionForQuote[];
  services?: ServiceForQuote[];
  markup?: number;
  validityHours?: number;
  agentName?: string;
  brandName?: string;
  currency?: string;
}

export interface QuoteHotelResult {
  name: string;
  stars?: number;
  location?: string;
  roomType?: string;
  nights: number;
  rooms: number;
  basePricePerPerson: number;
  servicesPricePerPerson: number;
  totalPricePerPerson: number;
  totalPrice: number;
  currency: string;
}

export interface GenerateQuoteResult {
  message: string;
  hotelPricing: QuoteHotelResult[];
  currency: string;
  validityHours: number;
}

export const aiService = {
  parseInquiry: (text: string) => http.post<ParsedInquiry>('/ai/parse-inquiry', { text }),
  followupSuggestion: (input: FollowupSuggestionInput) =>
    http.post<{ message: string }>('/ai/followup-suggestion', input),
  proposalSummary: (input: ProposalSummaryInput) =>
    http.post<{ summary: string }>('/ai/proposal-summary', input),
  chat: (input: ChatInput) => http.post<{ reply: string }>('/ai/chat', input),
  leadChat: (input: LeadChatInput) => http.post<{ reply: string }>('/ai/lead-chat', input),
  leadIntakeChat: (input: LeadIntakeChatInput) =>
    http.post<LeadIntakeChatResponse>('/ai/lead-intake-chat', input),
  nextAction: (input: NextActionInput) => http.post<NextAction>('/ai/next-action', input),
  proposalDraft: (input: ProposalDraftInput) =>
    http.post<ProposalDraft>('/ai/proposal-draft', input),
  generateQuote: (input: GenerateQuoteInput) =>
    http.post<GenerateQuoteResult>('/ai/generate-quote', input),
};
