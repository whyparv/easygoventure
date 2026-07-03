import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@shared/api/http';
import { queryKeys } from '@shared/api/query-keys';
import {
  inquiriesService,
  type CreateInquiryInput,
  type UpdateInquiryInput,
} from '@shared/services/inquiries.service';
import type { InquiryStatus } from '@shared/types/ops-domain';

const onError = (error: unknown) => {
  toast.error(error instanceof ApiError ? error.message : 'Something went wrong');
};

function useInvalidate() {
  const qc = useQueryClient();
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: queryKeys.inquiries.all });
    if (id) void qc.invalidateQueries({ queryKey: queryKeys.inquiries.detail(id) });
  };
}

export function useCreateInquiry() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateInquiryInput) => inquiriesService.create(input),
    onSuccess: (i) => {
      invalidate(i.id);
      toast.success(`Inquiry ${i.referenceNo} created`);
    },
    onError,
  });
}

export function useUpdateInquiry() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateInquiryInput }) =>
      inquiriesService.update(id, input),
    onSuccess: (i) => {
      invalidate(i.id);
      toast.success('Inquiry updated');
    },
    onError,
  });
}

export function useTransitionInquiry() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: InquiryStatus }) =>
      inquiriesService.transition(id, status),
    onSuccess: (i) => {
      invalidate(i.id);
      toast.success('Inquiry status updated');
    },
    onError,
  });
}
