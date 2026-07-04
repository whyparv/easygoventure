import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  ConciergeBell,
  FileText,
  PhoneCall,
  Sparkle,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import { format, isToday, parseISO, subDays } from 'date-fns';
import { PageHeader } from '@shared/components/layout/page-header';
import { MetricCard } from '@shared/components/ui/metric-card';
import { SectionCard } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { StatusBadge } from '@shared/components/ui/badge';
import { Avatar } from '@shared/components/ui/avatar';
import { EmptyState } from '@shared/components/ui/empty-state';
import { Skeleton } from '@shared/components/ui/skeleton';
import { useLeads } from '@shared/queries/leads.queries';
import { useProposals } from '@shared/queries/proposals.queries';
import { useFollowups } from '@shared/queries/followups.queries';
import { useServices } from '@shared/queries/services.queries';
import { LeadStatus } from '@shared/types/domain';
import { formatCurrency, formatRelative, titleCase } from '@shared/lib/format';
import { leadTone } from '@shared/lib/status';
import { ROUTES } from '@app/config/routes';

const FUNNEL_ORDER: LeadStatus[] = [
  'NEW',
  'QUOTE_SENT',
  'FOLLOW_UP',
  'CONFIRMED',
  'ARRANGEMENTS',
  'VOUCHER_SENT',
  'COMPLETED',
];

export default function DashboardPage() {
  const navigate = useNavigate();

  const leadsQ = useLeads({ limit: 100, sortBy: 'createdAt', sortOrder: 'desc' });
  const proposalsQ = useProposals({ limit: 100 });
  const followupsQ = useFollowups({ limit: 100, completed: 'false' });
  // limit is capped at 100 by the API; meta.total still reflects the full count.
  const servicesQ = useServices({ limit: 100, sortBy: 'name', sortOrder: 'asc' });

  const leads = useMemo(() => leadsQ.data?.items ?? [], [leadsQ.data]);
  const proposals = useMemo(() => proposalsQ.data?.items ?? [], [proposalsQ.data]);
  const followups = useMemo(() => followupsQ.data?.items ?? [], [followupsQ.data]);
  const services = useMemo(() => servicesQ.data?.items ?? [], [servicesQ.data]);
  const loading = leadsQ.isLoading || proposalsQ.isLoading || followupsQ.isLoading;

  const serviceStats = useMemo(() => {
    const total = servicesQ.data?.meta.total ?? services.length;
    const active = services.filter((s) => s.isActive).length;
    // Most-used service name, tallied across every lead's attached service snapshots.
    const tally = new Map<string, number>();
    for (const l of leads) {
      for (const s of l.serviceItems ?? []) {
        tally.set(s.serviceName, (tally.get(s.serviceName) ?? 0) + 1);
      }
    }
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    return { total, active, topName: top?.[0], topCount: top?.[1] ?? 0 };
  }, [services, servicesQ.data, leads]);

  const metrics = useMemo(() => {
    const todayLeads = leads.filter((l) => isToday(parseISO(l.createdAt))).length;
    const openProposals = proposals.filter((p) => ['DRAFT', 'SENT', 'VIEWED'].includes(p.status)).length;
    const acceptedProposals = proposals.filter((p) => p.status === 'ACCEPTED');
    const completed = leads.filter((l) => l.status === 'COMPLETED').length;
    const revenue = acceptedProposals.reduce((sum, p) => sum + (p.amount ?? 0), 0);
    return {
      todayLeads,
      pendingFollowups: followups.length,
      openProposals,
      acceptedDeals: acceptedProposals.length,
      completed,
      revenue,
    };
  }, [leads, proposals, followups]);

  const statusData = useMemo(
    () =>
      FUNNEL_ORDER.map((status) => ({
        status: titleCase(status),
        raw: status,
        count: leads.filter((l) => l.status === status).length,
      })),
    [leads],
  );

  const trendData = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => subDays(new Date(), 13 - i));
    return days.map((day) => ({
      label: format(day, 'd MMM'),
      leads: leads.filter((l) => format(parseISO(l.createdAt), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'))
        .length,
    }));
  }, [leads]);

  const recentLeads = leads.slice(0, 6);
  const upcoming = [...followups]
    .sort((a, b) => +parseISO(a.scheduledDate) - +parseISO(b.scheduledDate))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Operational overview of your travel pipeline"
        breadcrumb={[{ label: 'Home' }, { label: 'Dashboard' }]}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Today's Leads" value={metrics.todayLeads} icon={UserPlus} loading={loading} />
        <MetricCard label="Pending Follow-ups" value={metrics.pendingFollowups} icon={PhoneCall} loading={loading} />
        <MetricCard label="Open Proposals" value={metrics.openProposals} icon={FileText} loading={loading} />
        <MetricCard label="Accepted Deals" value={metrics.acceptedDeals} icon={CheckCircle2} loading={loading} />
        <MetricCard label="Completed" value={metrics.completed} icon={TrendingUp} loading={loading} />
        <MetricCard
          label="Pipeline Value"
          value={formatCurrency(metrics.revenue)}
          icon={CircleDollarSign}
          hint="accepted proposals"
          loading={loading}
        />
        <MetricCard
          label="Total Services"
          value={serviceStats.total}
          icon={ConciergeBell}
          loading={servicesQ.isLoading}
        />
        <MetricCard
          label="Active Services"
          value={serviceStats.active}
          icon={CheckCircle2}
          loading={servicesQ.isLoading}
        />
        <MetricCard
          label="Most Used Service"
          value={serviceStats.topName ?? '—'}
          icon={Sparkle}
          hint={serviceStats.topName ? `${serviceStats.topCount} lead${serviceStats.topCount === 1 ? '' : 's'}` : undefined}
          loading={loading || servicesQ.isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Inquiry Trend" description="New leads · last 14 days" className="lg:col-span-2">
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <AreaChart data={trendData} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="leadFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" width={32} />
                <RTooltip
                  cursor={{ stroke: 'hsl(var(--border-strong))' }}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="leads" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#leadFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Pipeline Funnel" description="Leads by stage">
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <BarChart data={statusData} layout="vertical" margin={{ left: 24, right: 12 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="status" tickLine={false} axisLine={false} fontSize={11} width={92} stroke="hsl(var(--muted-foreground))" />
                <RTooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                  {statusData.map((entry) => (
                    <Cell key={entry.raw} fill="hsl(var(--primary))" fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Recent Leads"
          className="lg:col-span-2"
          actions={
            <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.leads)}>
              View all <ArrowRight className="size-4" />
            </Button>
          }
        >
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : recentLeads.length === 0 ? (
            <EmptyState title="No leads yet" description="Create your first lead to get started." />
          ) : (
            <ul className="divide-y divide-border">
              {recentLeads.map((lead) => (
                <li
                  key={lead.id}
                  className="flex cursor-pointer items-center gap-3 py-2.5 transition-colors hover:bg-muted/40"
                  onClick={() => navigate(`${ROUTES.leads}?lead=${lead.id}`)}
                >
                  <Avatar name={lead.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{lead.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {titleCase(lead.inquiryType)} · {lead.companyName ?? lead.phone}
                    </p>
                  </div>
                  <StatusBadge status={lead.status} tone={leadTone(lead.status)} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Upcoming Follow-ups">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <EmptyState icon={PhoneCall} title="All caught up" description="No pending follow-ups." />
          ) : (
            <ul className="space-y-3">
              {upcoming.map((f) => (
                <li key={f.id} className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-warning/10 text-warning">
                    <PhoneCall className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{f.remarks ?? 'Follow-up'}</p>
                    <p className="text-xs text-muted-foreground">{formatRelative(f.scheduledDate)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
