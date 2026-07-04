import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@shared/api/query-keys';
import { ApiError } from '@shared/api/http';
import {
  servicesService,
  type CreateServiceInput,
  type UpdateServiceInput,
} from '@shared/services/services.service';

const onError = (error: unknown) => {
  toast.error(error instanceof ApiError ? error.message : 'Something went wrong');
};

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateServiceInput) => servicesService.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.services.all });
      toast.success('Service created');
    },
    onError,
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateServiceInput }) =>
      servicesService.update(id, input),
    onSuccess: (service) => {
      void qc.invalidateQueries({ queryKey: queryKeys.services.all });
      void qc.invalidateQueries({ queryKey: queryKeys.services.detail(service.id) });
      toast.success('Service updated');
    },
    onError,
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => servicesService.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.services.all });
      toast.success('Service deleted');
    },
    onError,
  });
}
