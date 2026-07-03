import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BadgeInfo, Download, Receipt, Send } from 'lucide-react';
import { Card, SectionCard } from '@shared/components/ui/card';
import { Badge, StatusBadge } from '@shared/components/ui/badge';
import { Button } from '@shared/components/ui/button';
import { EmptyState } from '@shared/components/ui/empty-state';
import { formatCurrency, formatDateTime } from '@shared/lib/format';
import type { Tone } from '@shared/lib/status';

type InvoiceStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';
const STATUS_TONE: Record<InvoiceStatus, Tone> = {
  PENDING: 'warning',
  PARTIAL: 'info',
  PAID: 'success',
  OVERDUE: 'danger',
};

interface Txn {
  id: string;
  label: string;
  amount: number;
  at: string;
}

/**
 * Dummy payment module — FRONTEND ONLY, no gateway and no backend writes.
 * Everything here is local demo state to convey billing realism.
 */
export function PaymentTab({
  token,
  amount,
  currency,
  customer,
}: {
  token: string;
  amount: number;
  currency: string;
  customer: string;
}) {
  const [status, setStatus] = useState<InvoiceStatus>('PENDING');
  const [txns, setTxns] = useState<Txn[]>([]);
  const tax = useMemo(() => Math.round(amount * 0.05 * 100) / 100, [amount]);
  const total = amount + tax;
  const invoiceNo = `INV-${token.replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase()}`;

  const addTxn = (label: string, value: number) => {
    setTxns((prev) => [
      { id: `${prev.length + 1}`, label, amount: value, at: new Date().toISOString() },
      ...prev,
    ]);
  };

  const markPaid = () => {
    setStatus('PAID');
    addTxn('Full payment received', total);
    toast.success('Invoice marked paid (demo)');
  };
  const markPartial = () => {
    setStatus('PARTIAL');
    addTxn('Partial payment received', Math.round((total / 2) * 100) / 100);
    toast.success('Partial payment recorded (demo)');
  };
  const sendInvoice = () => toast.success('Invoice sent to customer (demo)');
  const download = () => window.print();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-sm text-info">
        <BadgeInfo className="size-4 shrink-0" />
        <span>Demo Mode — no real payment is processed and nothing is stored on the server.</span>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Invoice</p>
            <p className="text-lg font-semibold text-foreground">{invoiceNo}</p>
            <p className="text-sm text-muted-foreground">Proposal {token} · {customer}</p>
          </div>
          <StatusBadge status={status} tone={STATUS_TONE[status]} />
        </div>

        <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
          <Row label="Amount" value={formatCurrency(amount, currency)} />
          <Row label="VAT (5%)" value={formatCurrency(tax, currency)} />
          <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Total due</span>
            <span className="tabular-nums">{formatCurrency(total, currency)}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={markPaid} disabled={status === 'PAID'}>
            <Receipt /> Mark paid
          </Button>
          <Button size="sm" variant="secondary" onClick={markPartial} disabled={status === 'PAID'}>
            Mark partial
          </Button>
          <Button size="sm" variant="secondary" onClick={sendInvoice}>
            <Send /> Send invoice
          </Button>
          <Button size="sm" variant="ghost" onClick={download}>
            <Download /> Download
          </Button>
        </div>
      </Card>

      <SectionCard title="Transaction history">
        {txns.length === 0 ? (
          <EmptyState icon={Receipt} title="No transactions" description="Recorded payments will appear here." />
        ) : (
          <div className="space-y-2">
            {txns.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-foreground">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(t.at)}</p>
                </div>
                <span className="font-semibold tabular-nums text-success">
                  {formatCurrency(t.amount, currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Badge tone="neutral">Demo</Badge>
        Presentation layer only — integrate a real gateway (Stripe/Telr) in a later phase.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}
