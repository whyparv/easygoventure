import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@shared/api/http';
import { queryKeys } from '@shared/api/query-keys';
import {
  packagesService,
  type CreatePackageInput,
  type CreatePackageItemInput,
  type UpdatePackageItemInput,
} from '@shared/services/packages.service';

const onError = (error: unknown) => {
  toast.error(error instanceof ApiError ? error.message : 'Something went wrong');
};

function useInvalidate() {
  const qc = useQueryClient();
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: queryKeys.packages.all });
    if (id) {
      void qc.invalidateQueries({ queryKey: queryKeys.packages.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.packages.items(id) });
    }
  };
}

export function useCreatePackage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreatePackageInput) => packagesService.create(input),
    onSuccess: (p) => {
      invalidate(p.id);
      toast.success('Package created');
    },
    onError,
  });
}

export function useAddPackageItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreatePackageItemInput }) =>
      packagesService.addItem(id, input),
    onSuccess: (_data, vars) => {
      invalidate(vars.id);
      toast.success('Item added');
    },
    onError,
  });
}

export function useUpdatePackageItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, itemId, input }: { id: string; itemId: string; input: UpdatePackageItemInput }) =>
      packagesService.updateItem(id, itemId, input),
    onSuccess: (_data, vars) => invalidate(vars.id),
    onError,
  });
}

export function useRemovePackageItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, itemId }: { id: string; itemId: string }) =>
      packagesService.removeItem(id, itemId),
    onSuccess: (_data, vars) => {
      invalidate(vars.id);
      toast.success('Item removed');
    },
    onError,
  });
}
