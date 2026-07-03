import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@shared/api/http';
import { queryKeys } from '@shared/api/query-keys';
import { proposalsOpsService } from '@shared/services/proposals-ops.service';

const onError = (error: unknown) => {
  toast.error(error instanceof ApiError ? error.message : 'Something went wrong');
};

export function useConvertQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (quotationId: string) => proposalsOpsService.convert(quotationId),
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: queryKeys.proposals.all });
      void qc.invalidateQueries({ queryKey: queryKeys.quotations.all });
      toast.success(`Proposal ${p.generatedToken} created from quotation`);
    },
    onError,
  });
}

export function useCheckReadiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => proposalsOpsService.checkReadiness(id),
    onSuccess: (res, id) => {
      void qc.invalidateQueries({ queryKey: queryKeys.proposals.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.operations.risk(id) });
      toast[res.ready ? 'success' : 'message'](
        res.ready ? 'Proposal is ready for booking' : `Not ready — ${res.issues.length} issue(s)`,
      );
    },
    onError,
  });
}

export function useBookProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => proposalsOpsService.book(id),
    onSuccess: (_res, id) => {
      void qc.invalidateQueries({ queryKey: queryKeys.proposals.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.operations.bookings(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.operations.dashboard });
      toast.success('Proposal booked — fulfillment items generated');
    },
    onError,
  });
}
