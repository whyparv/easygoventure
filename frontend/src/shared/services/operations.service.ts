import { http } from '@shared/api/http';
import type {
  Booking,
  BookingType,
  DocumentGenerationResult,
  DocumentType,
  GeneratedDocument,
  HotelBookingDetails,
  OperationsDashboard,
  ProposalRisk,
  Traveler,
  TravelerGender,
  TransferBookingDetails,
  TripTimeline,
  VisaProcessing,
} from '@shared/types/ops-domain';

export interface CreateTravelerInput {
  firstName: string;
  lastName: string;
  gender?: TravelerGender;
  dateOfBirth?: string;
  nationality?: string;
  passportNumber?: string;
  passportExpiry?: string;
  email?: string;
  phone?: string;
  notes?: string;
}
export type UpdateTravelerInput = Partial<CreateTravelerInput> & { status?: string };

export interface CreateBookingInput {
  bookingType: BookingType;
  vendorId?: string;
  fulfillmentItemId?: string;
  bookingReference?: string;
  supplierReference?: string;
  travelDate?: string;
  notes?: string;
}
export interface ConfirmBookingInput {
  bookingReference?: string;
  supplierReference?: string;
  confirmationDate?: string;
}

export const operationsService = {
  // Travelers
  listTravelers: (proposalId: string) =>
    http.get<Traveler[]>(`/proposals/${proposalId}/travelers`),
  createTraveler: (proposalId: string, input: CreateTravelerInput) =>
    http.post<Traveler>(`/proposals/${proposalId}/travelers`, input),
  updateTraveler: (id: string, input: UpdateTravelerInput) =>
    http.patch<Traveler>(`/travelers/${id}`, input),
  removeTraveler: (id: string) => http.delete<{ id: string }>(`/travelers/${id}`),

  // Bookings
  listBookings: (proposalId: string) => http.get<Booking[]>(`/proposals/${proposalId}/bookings`),
  createBooking: (proposalId: string, input: CreateBookingInput) =>
    http.post<Booking>(`/proposals/${proposalId}/bookings`, input),
  confirmBooking: (id: string, input: ConfirmBookingInput = {}) =>
    http.post<Booking>(`/bookings/${id}/confirm`, input),
  failBooking: (id: string, reason?: string) => http.post<Booking>(`/bookings/${id}/fail`, { reason }),
  cancelBooking: (id: string) => http.post<Booking>(`/bookings/${id}/cancel`),
  updateHotelDetails: (id: string, input: HotelBookingDetails) =>
    http.patch<Booking>(`/bookings/${id}/hotel-details`, input),
  updateTransferDetails: (id: string, input: TransferBookingDetails) =>
    http.patch<Booking>(`/bookings/${id}/transfer-details`, input),
  updateVisaProcessing: (id: string, input: VisaProcessing) =>
    http.patch<Booking>(`/bookings/${id}/visa-processing`, input),

  // Derived views
  timeline: (proposalId: string) => http.get<TripTimeline>(`/proposals/${proposalId}/timeline`),
  risk: (proposalId: string) => http.get<ProposalRisk>(`/proposals/${proposalId}/risk`),
  dashboard: () => http.get<OperationsDashboard>('/operations/dashboard'),

  // Documents
  listDocuments: (proposalId: string) =>
    http.get<GeneratedDocument[]>(`/proposals/${proposalId}/documents`),
  generateDocument: (proposalId: string, type: DocumentType) =>
    http.post<DocumentGenerationResult>(`/proposals/${proposalId}/documents/${type}`, {}),
};
