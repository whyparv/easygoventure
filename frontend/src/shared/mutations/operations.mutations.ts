import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@shared/api/http';
import { queryKeys } from '@shared/api/query-keys';
import {
  operationsService,
  type ConfirmBookingInput,
  type CreateBookingInput,
  type CreateTravelerInput,
  type UpdateTravelerInput,
} from '@shared/services/operations.service';
import type {
  DocumentType,
  HotelBookingDetails,
  TransferBookingDetails,
  VisaProcessing,
} from '@shared/types/ops-domain';

const onError = (error: unknown) => {
  toast.error(error instanceof ApiError ? error.message : 'Something went wrong');
};

/** Invalidate every proposal-scoped operational view (travelers, bookings, timeline, risk). */
function useInvalidateOps() {
  const qc = useQueryClient();
  return (proposalId: string) => {
    void qc.invalidateQueries({ queryKey: queryKeys.operations.travelers(proposalId) });
    void qc.invalidateQueries({ queryKey: queryKeys.operations.bookings(proposalId) });
    void qc.invalidateQueries({ queryKey: queryKeys.operations.timeline(proposalId) });
    void qc.invalidateQueries({ queryKey: queryKeys.operations.risk(proposalId) });
    void qc.invalidateQueries({ queryKey: queryKeys.operations.dashboard });
  };
}

// ── Travelers ────────────────────────────────────────────────────────────────
export function useCreateTraveler() {
  const invalidate = useInvalidateOps();
  return useMutation({
    mutationFn: ({ proposalId, input }: { proposalId: string; input: CreateTravelerInput }) =>
      operationsService.createTraveler(proposalId, input),
    onSuccess: (_d, vars) => {
      invalidate(vars.proposalId);
      toast.success('Traveler added');
    },
    onError,
  });
}

export function useUpdateTraveler() {
  const invalidate = useInvalidateOps();
  return useMutation({
    mutationFn: ({ id, input }: { proposalId: string; id: string; input: UpdateTravelerInput }) =>
      operationsService.updateTraveler(id, input),
    onSuccess: (_d, vars) => {
      invalidate(vars.proposalId);
      toast.success('Traveler updated');
    },
    onError,
  });
}

export function useRemoveTraveler() {
  const invalidate = useInvalidateOps();
  return useMutation({
    mutationFn: ({ id }: { proposalId: string; id: string }) => operationsService.removeTraveler(id),
    onSuccess: (_d, vars) => {
      invalidate(vars.proposalId);
      toast.success('Traveler removed');
    },
    onError,
  });
}

// ── Bookings ─────────────────────────────────────────────────────────────────
export function useCreateBooking() {
  const invalidate = useInvalidateOps();
  return useMutation({
    mutationFn: ({ proposalId, input }: { proposalId: string; input: CreateBookingInput }) =>
      operationsService.createBooking(proposalId, input),
    onSuccess: (_d, vars) => {
      invalidate(vars.proposalId);
      toast.success('Booking created');
    },
    onError,
  });
}

export function useConfirmBooking() {
  const invalidate = useInvalidateOps();
  return useMutation({
    mutationFn: ({ id, input }: { proposalId: string; id: string; input?: ConfirmBookingInput }) =>
      operationsService.confirmBooking(id, input),
    onSuccess: (_d, vars) => {
      invalidate(vars.proposalId);
      toast.success('Booking confirmed');
    },
    onError,
  });
}

export function useFailBooking() {
  const invalidate = useInvalidateOps();
  return useMutation({
    mutationFn: ({ id, reason }: { proposalId: string; id: string; reason?: string }) =>
      operationsService.failBooking(id, reason),
    onSuccess: (_d, vars) => {
      invalidate(vars.proposalId);
      toast.success('Booking marked failed');
    },
    onError,
  });
}

export function useCancelBooking() {
  const invalidate = useInvalidateOps();
  return useMutation({
    mutationFn: ({ id }: { proposalId: string; id: string }) => operationsService.cancelBooking(id),
    onSuccess: (_d, vars) => {
      invalidate(vars.proposalId);
      toast.success('Booking cancelled');
    },
    onError,
  });
}

export function useUpdateHotelDetails() {
  const invalidate = useInvalidateOps();
  return useMutation({
    mutationFn: ({ id, input }: { proposalId: string; id: string; input: HotelBookingDetails }) =>
      operationsService.updateHotelDetails(id, input),
    onSuccess: (_d, vars) => {
      invalidate(vars.proposalId);
      toast.success('Hotel details updated');
    },
    onError,
  });
}

export function useUpdateTransferDetails() {
  const invalidate = useInvalidateOps();
  return useMutation({
    mutationFn: ({ id, input }: { proposalId: string; id: string; input: TransferBookingDetails }) =>
      operationsService.updateTransferDetails(id, input),
    onSuccess: (_d, vars) => {
      invalidate(vars.proposalId);
      toast.success('Transfer details updated');
    },
    onError,
  });
}

export function useUpdateVisaProcessing() {
  const invalidate = useInvalidateOps();
  return useMutation({
    mutationFn: ({ id, input }: { proposalId: string; id: string; input: VisaProcessing }) =>
      operationsService.updateVisaProcessing(id, input),
    onSuccess: (_d, vars) => {
      invalidate(vars.proposalId);
      toast.success('Visa processing updated');
    },
    onError,
  });
}

// ── Documents ────────────────────────────────────────────────────────────────
export function useGenerateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ proposalId, type }: { proposalId: string; type: DocumentType }) =>
      operationsService.generateDocument(proposalId, type),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.operations.documents(vars.proposalId) });
      toast.success('Document generated');
    },
    onError,
  });
}
