import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@shared/components/layout/page-header';
import { SectionCard } from '@shared/components/ui/card';
import { MetricCard } from '@shared/components/ui/metric-card';
import { Skeleton } from '@shared/components/ui/skeleton';
import { useLeads } from '@shared/queries/leads.queries';
import { useProposals } from '@shared/queries/proposals.queries';
import { InquiryType } from '@shared/types/domain';
import { formatCurrency, titleCase } from '@shared/lib/format';

// Sage Luxury categorical palette (brand set) — no generic blues.
const PIE_COLORS = ['#3F6F63', '#5F8E83', '#E9A7A2', '#D9A441', '#4F8A5B', '#C65B5B'];

export default function AnalyticsPage() {
  const leadsQ = useLeads({ limit: 100 });
  const proposalsQ = useProposals({ limit: 100 });
  const leads = useMemo(() => leadsQ.data?.items ?? [], [leadsQ.data]);
  const proposals = useMemo(() => proposalsQ.data?.items ?? [], [proposalsQ.data]);
  const loading = leadsQ.isLoading || proposalsQ.isLoading;

  const typeData = useMemo(
    () =>
      InquiryType.map((t) => ({
        name: titleCase(t),
        value: leads.filter((l) => l.inquiryType === t).length,
      })).filter((d) => d.value > 0),
    [leads],
  );

  const valueByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of proposals.filter((x) => x.status === 'ACCEPTED')) {
      map.set(p.proposalType, (map.get(p.proposalType) ?? 0) + (p.amount ?? 0));
    }
    return Array.from(map.entries()).map(([type, value]) => ({ type: titleCase(type), value }));
  }, [proposals]);

  const won = leads.filter((l) => l.status === 'ACCEPTED' || l.status === 'COMPLETED').length;
  const conversion = leads.length ? Math.round((won / leads.length) * 100) : 0;
  const acceptedValue = proposals.filter((p) => p.status === 'ACCEPTED').reduce((s, p) => s + (p.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Performance across leads and proposals"
        breadcrumb={[{ label: 'Insights' }, { label: 'Reports' }]}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Total Leads" value={leads.length} loading={loading} />
        <MetricCard label="Won Leads" value={won} loading={loading} />
        <MetricCard label="Conversion" value={`${conversion}%`} loading={loading} />
        <MetricCard label="Won Value" value={formatCurrency(acceptedValue)} loading={loading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Inquiry Type Distribution">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : typeData.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={256}>
              <PieChart>
                <Pie data={typeData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={92} paddingAngle={2}>
                  {typeData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RTooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Won Value by Service">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : valueByType.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No accepted proposals yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={256}>
              <BarChart data={valueByType} margin={{ left: -8, right: 8, top: 8 }}>
                <XAxis dataKey="type" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" width={48} />
                <RTooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
