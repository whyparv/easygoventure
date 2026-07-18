import { useMemo, useState } from 'react';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@shared/components/layout/page-header';
import { Card } from '@shared/components/ui/card';
import { Badge } from '@shared/components/ui/badge';
import { Button } from '@shared/components/ui/button';
import { Input, SearchInput } from '@shared/components/ui/input';
import { Textarea } from '@shared/components/ui/textarea';
import { Modal } from '@shared/components/ui/modal';
import { EmptyState } from '@shared/components/ui/empty-state';
import { Pagination } from '@shared/components/ui/pagination';
import { DataTable, type Column } from '@shared/components/data/data-table';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { useDebouncedValue } from '@shared/hooks/useDebouncedValue';
import { useAgencies } from '@shared/queries/agencies.queries';
import {
  useCreateAgency,
  useUpdateAgency,
  useDeleteAgency,
} from '@shared/mutations/agencies.mutations';
import type { Agency } from '@shared/types/domain';
import type { CreateAgencyInput } from '@shared/services/agency.service';

// ── Form ─────────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  country: string;
  address: string;
  website: string;
  notes: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  city: '',
  country: '',
  address: '',
  website: '',
  notes: '',
  isActive: true,
};

function toForm(agency: Agency | null): FormState {
  if (!agency) return EMPTY_FORM;
  return {
    name: agency.name,
    contactPerson: agency.contactPerson ?? '',
    phone: agency.phone ?? '',
    email: agency.email ?? '',
    city: agency.city ?? '',
    country: agency.country ?? '',
    address: agency.address ?? '',
    website: agency.website ?? '',
    notes: agency.notes ?? '',
    isActive: agency.isActive,
  };
}

function toInput(form: FormState): CreateAgencyInput {
  return {
    name: form.name.trim(),
    contactPerson: form.contactPerson.trim() || undefined,
    phone: form.phone.trim() || undefined,
    email: form.email.trim() || undefined,
    city: form.city.trim() || undefined,
    country: form.country.trim() || undefined,
    address: form.address.trim() || undefined,
    website: form.website.trim() || undefined,
    notes: form.notes.trim() || undefined,
    isActive: form.isActive,
  };
}

// ── Editor Modal ─────────────────────────────────────────────────────────────

function AgencyEditorModal({
  agency,
  onClose,
}: {
  agency: Agency | null;
  onClose: () => void;
}) {
  const isEdit = Boolean(agency);
  const create = useCreateAgency();
  const update = useUpdateAgency();
  const remove = useDeleteAgency();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<FormState>(() => toForm(agency));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const saving = create.isPending || update.isPending;
  const canSave = form.name.trim().length >= 1;

  const submit = () => {
    const input = toInput(form);
    if (isEdit && agency) {
      update.mutate({ id: agency.id, input }, { onSuccess: onClose });
    } else {
      create.mutate(input, { onSuccess: onClose });
    }
  };

  return (
    <>
      <Modal
        open
        onOpenChange={(v) => !v && onClose()}
        title={isEdit ? 'Edit agency' : 'Add agency'}
        description="Travel agencies and B2B partners that send inquiries."
        className="max-w-lg"
        footer={
          <div className="flex w-full items-center gap-2">
            {isEdit && (
              <Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" /> Delete
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button loading={saving} disabled={!canSave} onClick={submit}>
                {isEdit ? 'Save changes' : 'Add agency'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Name *">
            <Input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Acme Travels"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact person">
              <Input
                value={form.contactPerson}
                onChange={(e) => set('contactPerson', e.target.value)}
                placeholder="Aisha Khan"
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+971 50 000 0000"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="info@acmetravels.com"
              />
            </Field>
            <Field label="Website">
              <Input
                value={form.website}
                onChange={(e) => set('website', e.target.value)}
                placeholder="https://acmetravels.com"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <Input
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                placeholder="Dubai"
              />
            </Field>
            <Field label="Country">
              <Input
                value={form.country}
                onChange={(e) => set('country', e.target.value)}
                placeholder="UAE"
              />
            </Field>
          </div>
          <Field label="Address">
            <Input
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              placeholder="123 Sheikh Zayed Road"
            />
          </Field>
          <Field label="Notes">
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 pt-1 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            <span className="text-foreground">Active</span>
          </label>
        </div>
      </Modal>

      {isEdit && agency && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete this agency?"
          description="The agency record will be removed. Existing leads that reference this agency name are not affected."
          destructive
          confirmLabel="Delete"
          loading={remove.isPending}
          onConfirm={() =>
            remove.mutate(agency.id, {
              onSuccess: () => {
                setConfirmDelete(false);
                onClose();
              },
            })
          }
        />
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AgenciesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Agency | null | undefined>(undefined);
  const debouncedSearch = useDebouncedValue(search, 300);

  const params = useMemo(
    () => ({
      page,
      limit: 20,
      sortBy: 'name',
      sortOrder: 'asc' as const,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }),
    [page, debouncedSearch],
  );

  const { data, isLoading, isError, refetch } = useAgencies(params);
  const agencies = data?.items ?? [];

  const resetPageAnd = (fn: () => void) => {
    setPage(1);
    fn();
  };

  const columns: Column<Agency>[] = [
    {
      key: 'name',
      header: 'Agency',
      render: (a) => (
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Building2 className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{a.name}</p>
            {a.contactPerson && (
              <p className="truncate text-xs text-muted-foreground">{a.contactPerson}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (a) => a.phone ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (a) => a.email ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'city',
      header: 'City',
      render: (a) =>
        a.city
          ? [a.city, a.country].filter(Boolean).join(', ')
          : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (a) => (
        <Badge tone={a.isActive ? 'success' : 'neutral'}>
          {a.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (a: Agency) => (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Edit"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(a);
          }}
        >
          <Pencil className="size-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Agencies"
        description="Travel agencies and B2B partners that send inquiries."
        breadcrumb={[{ label: 'Operations' }, { label: 'Agencies' }]}
        actions={
          <Button onClick={() => setEditing(null)}>
            <Plus className="size-4" /> Add agency
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          className="sm:max-w-xs"
          placeholder="Search agencies…"
          value={search}
          onChange={(e) => resetPageAnd(() => setSearch(e.target.value))}
        />
      </div>

      {isError ? (
        <Card className="p-6">
          <EmptyState
            icon={Building2}
            title="Couldn't load agencies"
            description="The request failed. Check your connection and try again."
            action={<Button onClick={() => void refetch()}>Retry</Button>}
          />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <DataTable
              columns={columns}
              rows={agencies}
              getRowId={(a) => a.id}
              loading={isLoading}
              skeletonRows={8}
              onRowClick={(a) => setEditing(a)}
              empty={
                <EmptyState
                  icon={Building2}
                  title="No agencies yet"
                  description="Add your first agency to start tracking B2B partners."
                  action={
                    <Button onClick={() => setEditing(null)}>
                      <Plus className="size-4" /> Add agency
                    </Button>
                  }
                />
              }
            />
          </Card>
          {data && data.meta.total > 0 && (
            <Pagination meta={data.meta} onPageChange={setPage} />
          )}
        </>
      )}

      {editing !== undefined && (
        <AgencyEditorModal agency={editing} onClose={() => setEditing(undefined)} />
      )}
    </div>
  );
}
