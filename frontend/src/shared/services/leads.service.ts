import { http } from '@shared/api/http';
import type { ListParams } from '@shared/api/query-keys';
import type { Paginated } from '@shared/types/api';
import type {
  InquiryType,
  Lead,
  LeadActivity,
  LeadActivityType,
  LeadFlight,
  LeadHotelOption,
  LeadLocation,
  LeadServiceItem,
  LeadSource,
  LeadStatus,
  LeadTraveler,
} from '@shared/types/domain';

export interface CreateLeadInput {
  // Everything is optional — a lead can be captured from a partial inquiry.
  name?: string;
  phone?: string;
  email?: string;
  companyName?: string;
  source?: LeadSource;
  inquiryType?: InquiryType;
  status?: LeadStatus;
  startDate?: string;
  endDate?: string;
  notes?: string;
  rawInquiry?: string;
  // Inquiry requirements (the working brief)
  requirementsNote?: string;
  requestedServices?: string[];
  requestedHotels?: string[];
  serviceItems?: LeadServiceItem[];
  // Travel information
  destination?: string;
  travelDate?: string;
  returnDate?: string;
  adults?: number;
  children?: number;
  rooms?: number;
  nights?: number;
  services?: string[];
  // Hotel options & pricing
  hotelOptions?: LeadHotelOption[];
  markup?: number;
  currency?: string;
  quoteValidityHours?: number;
  // Internal tracking
  preparedBy?: string;
  whatsappMessage?: string;
  locations?: LeadLocation[];
  flights?: LeadFlight[];
  travelers?: LeadTraveler[];
}

export type UpdateLeadInput = Partial<CreateLeadInput>;

export interface CreateActivityInput {
  type: LeadActivityType;
  description: string;
  metadata?: Record<string, unknown>;
}

export const leadsService = {
  list: (params: ListParams) => http.get<Paginated<Lead>>('/leads', params),
  get: (id: string) => http.get<Lead>(`/leads/${id}`),
  create: (input: CreateLeadInput) => http.post<Lead>('/leads', input),
  update: (id: string, input: UpdateLeadInput) => http.patch<Lead>(`/leads/${id}`, input),
  remove: (id: string) => http.delete<{ id: string }>(`/leads/${id}`),
  activities: (id: string) => http.get<LeadActivity[]>(`/leads/${id}/activities`),
  addActivity: (id: string, input: CreateActivityInput) =>
    http.post<LeadActivity>(`/leads/${id}/activities`, input),
};
