import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@shared/components/ui/modal';
import { Button } from '@shared/components/ui/button';
import { Stepper } from '@shared/components/ui/stepper';
import { FormInput, FormSelect, FormTextarea } from '@shared/components/form';
import { useCreateLead } from '@shared/mutations/leads.mutations';
import { InquiryType, LeadSource } from '@shared/types/domain';
import { titleCase } from '@shared/lib/format';
import { createLeadSchema, STEP_FIELDS, type CreateLeadFormValues } from './lead.schema';

const STEPS = ['Customer', 'Inquiry', 'Review'];

const sourceOptions = LeadSource.map((s) => ({ label: titleCase(s), value: s }));
const inquiryOptions = InquiryType.map((s) => ({ label: titleCase(s), value: s }));

export function CreateLeadModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}) {
  const [step, setStep] = useState(0);
  const createLead = useCreateLead();

  const form = useForm<CreateLeadFormValues>({
    resolver: zodResolver(createLeadSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      companyName: '',
      source: 'WHATSAPP',
      inquiryType: 'VISA',
      notes: '',
      rawInquiry: '',
    },
  });

  const reset = () => {
    form.reset();
    setStep(0);
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const next = async () => {
    const valid = await form.trigger(STEP_FIELDS[step]);
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = form.handleSubmit((values) => {
    createLead.mutate(
      { ...values, email: values.email || undefined },
      {
        onSuccess: (lead) => {
          onCreated?.(lead.id);
          close();
        },
      },
    );
  });

  const values = form.watch();

  return (
    <Modal
      open={open}
      onOpenChange={(v) => (v ? onOpenChange(true) : close())}
      title="Create lead"
      description="Capture a new inquiry into the pipeline"
      className="max-w-xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => (step === 0 ? close() : setStep((s) => s - 1))}
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>Continue</Button>
          ) : (
            <Button loading={createLead.isPending} onClick={submit}>
              Create lead
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <Stepper steps={STEPS} current={step} />

        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput control={form.control} name="name" label="Full name" required placeholder="Acme Travels" />
            <FormInput control={form.control} name="phone" label="Phone" required placeholder="+971 50 000 0000" />
            <FormInput control={form.control} name="email" label="Email" type="email" placeholder="sales@acme.com" />
            <FormInput control={form.control} name="companyName" label="Company" placeholder="Acme Travels LLC" />
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormSelect control={form.control} name="source" label="Source" options={sourceOptions} />
            <FormSelect control={form.control} name="inquiryType" label="Inquiry type" options={inquiryOptions} />
            <div className="sm:col-span-2">
              <FormTextarea
                control={form.control}
                name="rawInquiry"
                label="Original message"
                placeholder="Hi, I need Dubai visa for 2 adults travelling on 15th July…"
              />
            </div>
            <div className="sm:col-span-2">
              <FormTextarea control={form.control} name="notes" label="Internal notes" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <Review label="Name" value={values.name} />
            <Review label="Phone" value={values.phone} />
            <Review label="Email" value={values.email || '—'} />
            <Review label="Company" value={values.companyName || '—'} />
            <Review label="Source" value={titleCase(values.source)} />
            <Review label="Inquiry" value={titleCase(values.inquiryType)} />
            {values.rawInquiry && <Review label="Message" value={values.rawInquiry} />}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
