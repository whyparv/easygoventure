import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@shared/api/query-keys';
import { ApiError } from '@shared/api/http';
import {
  agencyService,
  type CreateAgencyInput,
  type UpdateAgencyInput,
  type FindOrCreateAgencyInput,
} from '@shared/services/agency.service';

const onError = (error: unknown) => {
  toast.error(error instanceof ApiError ? error.message : 'Something went wrong');
};

export function useCreateAgency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAgencyInput) => agencyService.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.agencies.all });
      toast.success('Agency created');
    },
    onError,
  });
}

export function useUpdateAgency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAgencyInput }) =>
      agencyService.update(id, input),
    onSuccess: (agency) => {
      void qc.invalidateQueries({ queryKey: queryKeys.agencies.all });
      void qc.invalidateQueries({ queryKey: queryKeys.agencies.detail(agency.id) });
      toast.success('Agency updated');
    },
    onError,
  });
}

export function useDeleteAgency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => agencyService.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.agencies.all });
      toast.success('Agency deleted');
    },
    onError,
  });
}

export function useFindOrCreateAgency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FindOrCreateAgencyInput) => agencyService.findOrCreate(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.agencies.all });
    },
    onError,
  });
}
