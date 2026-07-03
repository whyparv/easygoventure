import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@shared/api/query-keys';
import { ApiError } from '@shared/api/http';
import {
  fulfillmentsService,
  type CreateFulfillmentInput,
  type UpdateFulfillmentInput,
} from '@shared/services/fulfillments.service';

const onError = (error: unknown) =>
  toast.error(error instanceof ApiError ? error.message : 'Something went wrong');

function useInvalidate() {
  const qc = useQueryClient();
  return (leadId?: string) => {
    void qc.invalidateQueries({ queryKey: queryKeys.fulfillments.all });
    void qc.invalidateQueries({ queryKey: queryKeys.leads.all });
    if (leadId) {
      void qc.invalidateQueries({ queryKey: queryKeys.leads.detail(leadId) });
      void qc.invalidateQueries({ queryKey: queryKeys.leads.activities(leadId) });
    }
  };
}

export function useCreateFulfillment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateFulfillmentInput) => fulfillmentsService.create(input),
    onSuccess: (f) => {
      invalidate(f.leadId);
      toast.success('Fulfillment created');
    },
    onError,
  });
}

export function useUpdateFulfillment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateFulfillmentInput }) =>
      fulfillmentsService.update(id, input),
    onSuccess: (f) => {
      invalidate(f.leadId);
      toast.success('Fulfillment updated');
    },
    onError,
  });
}
