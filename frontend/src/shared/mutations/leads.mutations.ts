import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@shared/api/query-keys';
import { ApiError } from '@shared/api/http';
import {
  leadsService,
  type CreateActivityInput,
  type CreateLeadInput,
  type UpdateLeadInput,
} from '@shared/services/leads.service';

const onError = (error: unknown) => {
  toast.error(error instanceof ApiError ? error.message : 'Something went wrong');
};

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLeadInput) => leadsService.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.leads.all });
      toast.success('Lead created');
    },
    onError,
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLeadInput }) =>
      leadsService.update(id, input),
    onSuccess: (lead) => {
      void qc.invalidateQueries({ queryKey: queryKeys.leads.all });
      void qc.invalidateQueries({ queryKey: queryKeys.leads.detail(lead.id) });
      void qc.invalidateQueries({ queryKey: queryKeys.leads.activities(lead.id) });
      toast.success('Lead updated');
    },
    onError,
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leadsService.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.leads.all });
      toast.success('Lead deleted');
    },
    onError,
  });
}

export function useAddLeadActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateActivityInput }) =>
      leadsService.addActivity(id, input),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.leads.activities(vars.id) });
      toast.success('Note added');
    },
    onError,
  });
}
