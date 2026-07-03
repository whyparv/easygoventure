import { Card } from '@shared/components/ui/card';
import { Badge } from '@shared/components/ui/badge';
import { EmptyState } from '@shared/components/ui/empty-state';
import { formatCurrency } from '@shared/lib/format';
import { Receipt } from 'lucide-react';
import type { PackageSnapshot } from '@shared/types/ops-domain';

export function CommercialBreakdown({
  snapshot,
  currency,
}: {
  snapshot?: PackageSnapshot | null;
  currency: string;
}) {
  if (!snapshot) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={Receipt}
          title="No commercial breakdown"
          description="This proposal has no frozen package snapshot. Breakdowns appear once a proposal is converted from an accepted quotation."
        />
      </Card>
    );
  }

  const margin =
    snapshot.totalSellPrice > 0
      ? Math.round((snapshot.expectedProfit / snapshot.totalSellPrice) * 100)
      : 0;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Service</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                <th className="px-4 py-2.5 text-right font-medium">Unit price</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.items.map((item) => (
                <tr key={item.itemId} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium text-foreground">{item.description}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone="neutral">{item.type}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{item.quantity}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(item.unitSellPrice, currency)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                    {formatCurrency(item.totalSellPrice, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryStat label="Total cost" value={formatCurrency(snapshot.totalCost, currency)} />
        <SummaryStat label="Markup" value={formatCurrency(snapshot.totalMarkup, currency)} />
        <SummaryStat label="Selling price" value={formatCurrency(snapshot.totalSellPrice, currency)} emphasis />
        <SummaryStat
          label="Expected profit"
          value={formatCurrency(snapshot.expectedProfit, currency)}
          tone="success"
        />
      </div>

      <Card className="p-4">
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Profit margin</span>
          <span className="font-semibold text-success">{margin}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, margin)}%` }} />
        </div>
      </Card>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  emphasis,
  tone,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: 'success';
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-semibold tabular-nums ${emphasis ? 'text-lg' : 'text-base'} ${
          tone === 'success' ? 'text-success' : 'text-foreground'
        }`}
      >
        {value}
      </p>
    </Card>
  );
}
