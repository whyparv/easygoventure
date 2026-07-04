import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '@shared/components/ui/modal';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Textarea } from '@shared/components/ui/textarea';
import { Select } from '@shared/components/ui/select';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import {
  useCreateService,
  useUpdateService,
  useDeleteService,
} from '@shared/mutations/services.mutations';
import type { CreateServiceInput } from '@shared/services/services.service';
import type { Service, ServiceCategory } from '@shared/types/domain';

const CURRENCIES = ['USD', 'AED', 'EUR', 'GBP', 'NGN'];

interface FormState {
  categoryCode: string;
  name: string;
  code: string;
  destination: string;
  serviceType: string;
  variantGroup: string;
  supplier: string;
  description: string;
  currency: string;
  costPrice: string;
  defaultSellPrice: string;
  isActive: boolean;
}

const toNum = (v: string) => {
  const t = v.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

function toForm(s: Service | null, defaultCategory: string): FormState {
  return {
    categoryCode: s?.categoryCode ?? defaultCategory,
    name: s?.name ?? '',
    code: s?.code ?? '',
    destination: s?.destination ?? 'Dubai',
    serviceType: s?.serviceType ?? '',
    variantGroup: s?.variantGroup ?? '',
    supplier: s?.supplier ?? '',
    description: s?.description ?? '',
    currency: s?.currency ?? 'USD',
    costPrice: s?.costPrice != null ? String(s.costPrice) : '',
    defaultSellPrice: s?.defaultSellPrice != null ? String(s.defaultSellPrice) : s?.basePrice != null ? String(s.basePrice) : '',
    isActive: s?.isActive ?? true,
  };
}

/** Create or edit a catalog service. `service = null` → create; a Service → edit. */
export function ServiceEditorModal({
  service,
  categories,
  onClose,
}: {
  service: Service | null;
  categories: ServiceCategory[];
  onClose: () => void;
}) {
  const isEdit = Boolean(service);
  const create = useCreateService();
  const update = useUpdateService();
  const remove = useDeleteService();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<FormState>(() =>
    toForm(service, categories[0]?.code ?? 'OTHER'),
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const saving = create.isPending || update.isPending;
  const canSave = form.name.trim().length >= 2 && Boolean(form.categoryCode);

  const submit = () => {
    const input: CreateServiceInput = {
      categoryCode: form.categoryCode,
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      destination: form.destination.trim() || 'Dubai',
      serviceType: form.serviceType.trim() || undefined,
      variantGroup: form.variantGroup.trim() || undefined,
      supplier: form.supplier.trim() || undefined,
      description: form.description.trim() || undefined,
      currency: form.currency || undefined,
      costPrice: toNum(form.costPrice),
      defaultSellPrice: toNum(form.defaultSellPrice),
      isActive: form.isActive,
    };
    if (isEdit && service) {
      update.mutate({ id: service.id, input }, { onSuccess: onClose });
    } else {
      create.mutate(input, { onSuccess: onClose });
    }
  };

  const categoryOptions = categories.map((c) => ({ label: c.name, value: c.code }));

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={isEdit ? 'Edit service' : 'Create service'}
      description="Services power lead quotes. Cost vs. sell price drives your margin."
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
              {isEdit ? 'Save changes' : 'Create service'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="Name">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="96hr UAE Visa" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select
              value={form.categoryCode}
              onChange={(e) => set('categoryCode', e.target.value)}
              options={categoryOptions}
            />
          </Field>
          <Field label="Destination">
            <Input value={form.destination} onChange={(e) => set('destination', e.target.value)} placeholder="Dubai" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Service type">
            <Input value={form.serviceType} onChange={(e) => set('serviceType', e.target.value)} placeholder="Tourist Visa" />
          </Field>
          <Field label="Code">
            <Input value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="DXB-VISA-96H" />
          </Field>
        </div>
        <Field label="Variant group">
          <Input
            value={form.variantGroup}
            onChange={(e) => set('variantGroup', e.target.value)}
            placeholder="Airport Transfer — groups this with other variants"
          />
        </Field>
        <Field label="Supplier">
          <Input value={form.supplier} onChange={(e) => set('supplier', e.target.value)} placeholder="VFS Global" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Currency">
            <Select
              value={form.currency}
              onChange={(e) => set('currency', e.target.value)}
              options={CURRENCIES.map((c) => ({ label: c, value: c }))}
            />
          </Field>
          <Field label="Cost price">
            <Input type="number" min={0} value={form.costPrice} onChange={(e) => set('costPrice', e.target.value)} placeholder="0" />
          </Field>
          <Field label="Sell price">
            <Input type="number" min={0} value={form.defaultSellPrice} onChange={(e) => set('defaultSellPrice', e.target.value)} placeholder="0" />
          </Field>
        </div>
        <Field label="Description">
          <Textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 pt-1 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
            className="size-4 rounded border-input accent-primary"
          />
          <span className="text-foreground">Active</span>
          <span className="text-xs text-muted-foreground">— inactive services are hidden from the lead picker</span>
        </label>
      </div>

      {isEdit && service && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete this service?"
          description="It will be soft-deleted. Existing lead quotes keep their snapshot and are unaffected."
          destructive
          confirmLabel="Delete"
          loading={remove.isPending}
          onConfirm={() =>
            remove.mutate(service.id, {
              onSuccess: () => {
                setConfirmDelete(false);
                onClose();
              },
            })
          }
        />
      )}
    </Modal>
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
