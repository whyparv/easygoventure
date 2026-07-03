import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@shared/api/query-keys';
import { ApiError } from '@shared/api/http';
import {
  followupsService,
  type CreateFollowUpInput,
  type UpdateFollowUpInput,
} from '@shared/services/followups.service';

const onError = (error: unknown) =>
  toast.error(error instanceof ApiError ? error.message : 'Something went wrong');

function useInvalidate() {
  const qc = useQueryClient();
  return (leadId?: string) => {
    void qc.invalidateQueries({ queryKey: queryKeys.followups.all });
    void qc.invalidateQueries({ queryKey: queryKeys.leads.all });
    if (leadId) {
      void qc.invalidateQueries({ queryKey: queryKeys.leads.detail(leadId) });
      void qc.invalidateQueries({ queryKey: queryKeys.leads.activities(leadId) });
    }
  };
}

export function useCreateFollowup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateFollowUpInput) => followupsService.create(input),
    onSuccess: (f) => {
      invalidate(f.leadId);
      toast.success('Follow-up scheduled');
    },
    onError,
  });
}

export function useUpdateFollowup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateFollowUpInput }) =>
      followupsService.update(id, input),
    onSuccess: (f) => {
      invalidate(f.leadId);
      toast.success('Follow-up updated');
    },
    onError,
  });
}
