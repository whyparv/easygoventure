import { useState } from 'react';
import { BadgeCheck, Plus, Trash2, TriangleAlert, UserRound } from 'lucide-react';
import { Card } from '@shared/components/ui/card';
import { Badge } from '@shared/components/ui/badge';
import { Button } from '@shared/components/ui/button';
import { Modal } from '@shared/components/ui/modal';
import { Input } from '@shared/components/ui/input';
import { Select } from '@shared/components/ui/select';
import { EmptyState } from '@shared/components/ui/empty-state';
import { Skeleton } from '@shared/components/ui/skeleton';
import { Avatar } from '@shared/components/ui/avatar';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { useTravelers } from '@shared/queries/operations.queries';
import { useCreateTraveler, useRemoveTraveler } from '@shared/mutations/operations.mutations';
import { formatDate } from '@shared/lib/format';
import { TravelerGender } from '@shared/types/ops-domain';
import type { Traveler } from '@shared/types/ops-domain';

const GENDER_OPTIONS = TravelerGender.map((g) => ({ label: g[0] + g.slice(1).toLowerCase(), value: g }));

export function TravelersTab({ proposalId }: { proposalId: string }) {
  const { data: travelers, isLoading } = useTravelers(proposalId);
  const create = useCreateTraveler();
  const remove = useRemoveTraveler();
  const [addOpen, setAddOpen] = useState(false);
  const [toRemove, setToRemove] = useState<Traveler | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    gender: 'UNSPECIFIED',
    nationality: '',
    passportNumber: '',
    passportExpiry: '',
  });

  const submit = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) return;
    create.mutate(
      {
        proposalId,
        input: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          gender: form.gender as Traveler['gender'],
          nationality: form.nationality || undefined,
          passportNumber: form.passportNumber || undefined,
          passportExpiry: form.passportExpiry || undefined,
        },
      },
      {
        onSuccess: () => {
          setAddOpen(false);
          setForm({ firstName: '', lastName: '', gender: 'UNSPECIFIED', nationality: '', passportNumber: '', passportExpiry: '' });
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {travelers?.length ?? 0} traveler(s) on this trip
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus /> Add traveler
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !travelers || travelers.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={UserRound}
            title="No travelers yet"
            description="Add the people travelling under this proposal to build the manifest."
            action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus /> Add traveler</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {travelers.map((t) => {
            const hasPassport = Boolean(t.passportNumber);
            return (
              <Card key={t.id} className="flex items-start gap-3 p-4">
                <Avatar name={`${t.firstName} ${t.lastName}`} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold text-foreground">
                      {t.firstName} {t.lastName}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove traveler"
                      onClick={() => setToRemove(t)}
                    >
                      <Trash2 className="text-danger" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.nationality ?? 'Nationality unknown'}
                    {t.dateOfBirth ? ` · DOB ${formatDate(t.dateOfBirth)}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {hasPassport ? (
                      <Badge tone="success" dot>
                        <BadgeCheck className="mr-1 size-3" /> Passport {t.passportNumber}
                      </Badge>
                    ) : (
                      <Badge tone="warning" dot>
                        <TriangleAlert className="mr-1 size-3" /> Passport missing
                      </Badge>
                    )}
                    {t.passportExpiry && (
                      <span className="text-xs text-muted-foreground">exp {formatDate(t.passportExpiry)}</span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add traveler"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={create.isPending}>
              Add traveler
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required>
            <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </Field>
          <Field label="Last name" required>
            <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </Field>
          <Field label="Gender">
            <Select options={GENDER_OPTIONS} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} />
          </Field>
          <Field label="Nationality">
            <Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
          </Field>
          <Field label="Passport number">
            <Input value={form.passportNumber} onChange={(e) => setForm({ ...form, passportNumber: e.target.value })} />
          </Field>
          <Field label="Passport expiry">
            <Input type="date" value={form.passportExpiry} onChange={(e) => setForm({ ...form, passportExpiry: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(toRemove)}
        onOpenChange={(o) => !o && setToRemove(null)}
        title={`Remove ${toRemove?.firstName ?? ''} ${toRemove?.lastName ?? ''}?`}
        description="The traveler will be removed from this proposal's manifest."
        destructive
        confirmLabel="Remove"
        loading={remove.isPending}
        onConfirm={() => {
          if (toRemove) {
            remove.mutate(
              { proposalId, id: toRemove.id },
              { onSuccess: () => setToRemove(null) },
            );
          }
        }}
      />
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      {children}
    </label>
  );
}
