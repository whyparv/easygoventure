import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@shared/api/query-keys';
import { operationsService } from '@shared/services/operations.service';
import { reportingService } from '@shared/services/reporting.service';

export function useOperationsDashboard() {
  return useQuery({
    queryKey: queryKeys.operations.dashboard,
    queryFn: () => operationsService.dashboard(),
  });
}

export function useTravelers(proposalId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.operations.travelers(proposalId ?? ''),
    queryFn: () => operationsService.listTravelers(proposalId as string),
    enabled: Boolean(proposalId),
  });
}

export function useBookings(proposalId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.operations.bookings(proposalId ?? ''),
    queryFn: () => operationsService.listBookings(proposalId as string),
    enabled: Boolean(proposalId),
  });
}

export function useTimeline(proposalId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.operations.timeline(proposalId ?? ''),
    queryFn: () => operationsService.timeline(proposalId as string),
    enabled: Boolean(proposalId),
  });
}

export function useProposalRisk(proposalId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.operations.risk(proposalId ?? ''),
    queryFn: () => operationsService.risk(proposalId as string),
    enabled: Boolean(proposalId),
  });
}

export function useProposalDocuments(proposalId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.operations.documents(proposalId ?? ''),
    queryFn: () => operationsService.listDocuments(proposalId as string),
    enabled: Boolean(proposalId),
  });
}

export function useRevenuePipeline() {
  return useQuery({
    queryKey: queryKeys.reporting.revenue,
    queryFn: () => reportingService.revenuePipeline(),
  });
}
