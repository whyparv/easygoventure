import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@shared/api/query-keys';
import { ApiError } from '@shared/api/http';
import { proposalsService, type CreateProposalInput } from '@shared/services/proposals.service';

const onError = (error: unknown) =>
  toast.error(error instanceof ApiError ? error.message : 'Something went wrong');

function useInvalidate() {
  const qc = useQueryClient();
  return (leadId?: string | null) => {
    void qc.invalidateQueries({ queryKey: queryKeys.proposals.all });
    void qc.invalidateQueries({ queryKey: queryKeys.leads.all });
    void qc.invalidateQueries({ queryKey: queryKeys.fulfillments.all });
    if (leadId) {
      void qc.invalidateQueries({ queryKey: queryKeys.leads.detail(leadId) });
      void qc.invalidateQueries({ queryKey: queryKeys.leads.activities(leadId) });
    }
  };
}

export function useCreateProposal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateProposalInput) => proposalsService.create(input),
    onSuccess: (p) => {
      invalidate(p.leadId);
      toast.success(`Proposal ${p.generatedToken} created`);
    },
    onError,
  });
}

export function useSendProposal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => proposalsService.send(id),
    onSuccess: (p) => {
      invalidate(p.leadId);
      toast.success('Proposal sent');
    },
    onError,
  });
}

export function useAcceptProposal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => proposalsService.accept(id),
    onSuccess: (res) => {
      invalidate(res.proposal.leadId);
      toast.success('Proposal accepted — fulfillment opened');
    },
    onError,
  });
}

export function useRejectProposal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      proposalsService.reject(id, reason),
    onSuccess: (p) => {
      invalidate(p.leadId);
      toast.success('Proposal rejected');
    },
    onError,
  });
}
