import { useState } from 'react';
import { BedDouble, Car, FileText, Plane, Plus, Ticket } from 'lucide-react';
import { Card } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Modal } from '@shared/components/ui/modal';
import { Input } from '@shared/components/ui/input';
import { Select } from '@shared/components/ui/select';
import { StatusBadge } from '@shared/components/ui/badge';
import { EmptyState } from '@shared/components/ui/empty-state';
import { Skeleton } from '@shared/components/ui/skeleton';
import { useBookings } from '@shared/queries/operations.queries';
import {
  useCancelBooking,
  useConfirmBooking,
  useCreateBooking,
  useFailBooking,
} from '@shared/mutations/operations.mutations';
import { bookingTone } from '@shared/lib/status';
import { formatDate } from '@shared/lib/format';
import { BookingType } from '@shared/types/ops-domain';
import type { Booking } from '@shared/types/ops-domain';
import type { LucideIcon } from 'lucide-react';

const TYPE_ICON: Record<string, LucideIcon> = {
  HOTEL: BedDouble,
  TRANSFER: Car,
  VISA: FileText,
  ACTIVITY: Ticket,
  FLIGHT: Plane,
};
const TYPE_OPTIONS = BookingType.map((t) => ({ label: t[0] + t.slice(1).toLowerCase(), value: t }));

export function BookingsTab({ proposalId }: { proposalId: string }) {
  const { data: bookings, isLoading } = useBookings(proposalId);
  const create = useCreateBooking();
  const confirm = useConfirmBooking();
  const fail = useFailBooking();
  const cancel = useCancelBooking();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ bookingType: 'HOTEL', travelDate: '', bookingReference: '', notes: '' });

  const submit = () => {
    create.mutate(
      {
        proposalId,
        input: {
          bookingType: form.bookingType as Booking['bookingType'],
          travelDate: form.travelDate || undefined,
          bookingReference: form.bookingReference || undefined,
          notes: form.notes || undefined,
        },
      },
      {
        onSuccess: () => {
          setAddOpen(false);
          setForm({ bookingType: 'HOTEL', travelDate: '', bookingReference: '', notes: '' });
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{bookings?.length ?? 0} supplier booking(s)</p>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus /> New booking
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !bookings || bookings.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={BedDouble}
            title="No bookings yet"
            description="Create supplier bookings (hotel, transfer, visa, activity, flight) to track confirmations."
            action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus /> New booking</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => {
            const Icon = TYPE_ICON[b.bookingType] ?? FileText;
            const pending = b.status === 'PENDING' || b.status === 'REQUESTED';
            return (
              <Card key={b.id} className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {b.bookingType[0] + b.bookingType.slice(1).toLowerCase()}
                      {b.bookingReference ? ` · ${b.bookingReference}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.travelDate ? formatDate(b.travelDate) : 'No travel date'}
                      {b.supplierReference ? ` · Supplier ${b.supplierReference}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  <StatusBadge status={b.status} tone={bookingTone(b.status)} />
                  {pending && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={confirm.isPending}
                        onClick={() => confirm.mutate({ proposalId, id: b.id })}
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => fail.mutate({ proposalId, id: b.id })}
                      >
                        Fail
                      </Button>
                    </>
                  )}
                  {b.status === 'CONFIRMED' && (
                    <Button size="sm" variant="ghost" onClick={() => cancel.mutate({ proposalId, id: b.id })}>
                      Cancel
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="New supplier booking"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={create.isPending}>
              Create booking
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Type</span>
            <Select options={TYPE_OPTIONS} value={form.bookingType} onChange={(e) => setForm({ ...form, bookingType: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Travel date</span>
            <Input type="date" value={form.travelDate} onChange={(e) => setForm({ ...form, travelDate: e.target.value })} />
          </label>
          <label className="col-span-2 space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Booking reference</span>
            <Input value={form.bookingReference} onChange={(e) => setForm({ ...form, bookingReference: e.target.value })} placeholder="Optional" />
          </label>
        </div>
      </Modal>
    </div>
  );
}
