import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@shared/api/http';
import { queryKeys } from '@shared/api/query-keys';
import { quotationsService, type CreateQuotationInput } from '@shared/services/quotations.service';

const onError = (error: unknown) => {
  toast.error(error instanceof ApiError ? error.message : 'Something went wrong');
};

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.quotations.all });
    void qc.invalidateQueries({ queryKey: queryKeys.packages.all });
  };
}

export function useCreateQuotationFromPackage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ packageId, input }: { packageId: string; input: CreateQuotationInput }) =>
      quotationsService.fromPackage(packageId, input),
    onSuccess: (q) => {
      invalidate();
      toast.success(`Quotation ${q.quotationNumber} created`);
    },
    onError,
  });
}

export function useSendQuotation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => quotationsService.send(id),
    onSuccess: () => {
      invalidate();
      toast.success('Quotation sent');
    },
    onError,
  });
}

export function useAcceptQuotation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => quotationsService.accept(id),
    onSuccess: () => {
      invalidate();
      toast.success('Quotation accepted');
    },
    onError,
  });
}

export function useRejectQuotation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      quotationsService.reject(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success('Quotation rejected');
    },
    onError,
  });
}
