'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  API, MONTHS, fmt, fmtPKR, C,
  StatCard, Panel, DashShell, DashLoading, DashError, EmptyChart, RecentPaymentsTable, MaskedAmount, DailyFeeReceipts
} from './shared';

type AccountantData = {
  stats: {
    today_collected: number; month_collected: number; pending_fees: number; total_students: number;
    this_month_tuition_billed?: number;
    this_month_remaining_dues?: number;
    this_month_expenses?: number;
  };
  fee_chart: { date: string; label: string; amount: number }[];
  monthly_chart: { label: string; amount: number }[];
  recent_payments: any[];
};

const CUSTOM_TOOLTIP = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 12, padding: '10px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.orange }}>{<MaskedAmount amount={payload[0]?.value ?? 0} />}</div>
    </div>
  );
};

export default function AccountantDashboard({ userName }: { userName: string }) {
  const { hasPermission } = useAuth();
  const [data, setData] = useState<AccountantData | null>(null);
  const [loading, setLoad] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(API + '/dashboard/accountant')
      .then(async r => {
        if (r.ok) return r.json();
        const errJson = await r.json().catch(() => null);
        return Promise.reject(errJson?.error || r.statusText || `HTTP ${r.status}`);
      })
      .then(d => { setData(d); setLoad(false); })
      .catch(e => { setErr(String(e)); setLoad(false); });
  }, []);

  if (loading) return <DashLoading />;
  if (err || !data) return <DashError msg={err || 'Dashboard data is missing'} />;

  const s = data.stats;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const curMonth = MONTHS[new Date().getMonth()];
  const maxAmt = Math.max(...(data.monthly_chart || []).map(r => r.amount), 1);

  return (
    <DashShell
      title="Finance & Fees"
      subtitle={today}
    >
      {/* KPI Row */}
      {hasPermission('dash.acc_kpi', 'read') && (
        <div className="dash-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 14, marginBottom: 20 }}>
          <StatCard icon="bi-cash-stack" label="Today Collected" value={<MaskedAmount amount={s.today_collected} />} sub="Received today" accent={C.green} />
          <StatCard icon="bi-graph-up-arrow" label={curMonth + ' Collected'} value={<MaskedAmount amount={s.month_collected} />} sub="This month total" accent={C.teal} />
          <StatCard icon="bi-piggy-bank-fill" label={curMonth + ' Billed'} value={<MaskedAmount amount={s.this_month_tuition_billed || 0} />} sub="Tuition fee billed" accent={C.teal} />
          <StatCard icon="bi-exclamation-octagon-fill" label={curMonth + ' Dues'} value={<MaskedAmount amount={s.this_month_remaining_dues || 0} />} sub="Current month unpaid" accent={C.red} />
          <StatCard icon="bi-receipt-cutoff" label={curMonth + ' Expenses'} value={<MaskedAmount amount={s.this_month_expenses || 0} />} sub="Current month expenses" accent="#ea580c" />
          <StatCard icon="bi-exclamation-circle-fill" label="Total Pending" value={<MaskedAmount amount={s.pending_fees} />} sub="All time unpaid" accent={C.red} />
          <StatCard icon="bi-people-fill" label="Total Students" value={fmt(s.total_students)} sub="Enrolled" accent={C.orange} />
        </div>
      )}

      {/* Daily chart + Recent Payments */}
      {hasPermission('dash.acc_charts', 'read') && (
        <div className="dash-side-grid dash-side-grid-right" style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 14, marginBottom: 20, alignItems: 'start' }}>
          <Panel title="Daily Collection Last 14 Days" icon="bi-graph-up-arrow"
            action={<span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{<MaskedAmount amount={s.month_collected} />} this month</span>}>
            {data!.fee_chart?.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data!.fee_chart?.slice(-14)} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dayGrd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.orange} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={C.orange} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip content={<CUSTOM_TOOLTIP />} />
                  <Area type="monotone" dataKey="amount"
                    stroke={C.orange} strokeWidth={2.5} fill="url(#dayGrd)"
                    dot={{ r: 3.5, fill: '#fff', stroke: C.orange, strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: C.orange, stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <Panel title="Recent Payments" icon="bi-receipt" noPad
            action={
              <Link href="/fees/collect" style={{ fontSize: 12, color: C.orange, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                All <i className="bi bi-arrow-right-short" style={{ fontSize: 15 }} />
              </Link>
            }>
            <RecentPaymentsTable rows={(data!.recent_payments || []).slice(0, 7)} />
          </Panel>
        </div>
      )}

      {/* Monthly chart */}
      {hasPermission('dash.acc_charts', 'read') && (
        <div style={{ marginBottom: 20 }}>
          <Panel title="Monthly Collection Last 6 Months" icon="bi-calendar3">
            {!data!.monthly_chart?.length ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data!.monthly_chart} margin={{ top: 8, right: 16, left: 8, bottom: 0 }} barCategoryGap="40%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip content={<CUSTOM_TOOLTIP />} />
                  <Bar dataKey="amount" radius={[7, 7, 0, 0]} maxBarSize={48}>
                    {(data!.monthly_chart || []).map((r, i) => (
                      <Cell key={i} fill={r.amount === maxAmt ? C.orange : C.teal} fillOpacity={r.amount === maxAmt ? 1 : 0.65} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </div>
      )}

      {/* Quick Actions */}
      {/* <Panel title="Quick Actions" icon="bi-lightning-charge-fill">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '4px 0' }}>
          {[
            { href: '/fees/collect', icon: 'bi-cash-coin', label: 'Collect Fee', bg: C.orange },
            { href: '/fees/generate', icon: 'bi-file-earmark-plus', label: 'Generate Slips', bg: C.teal },
            { href: '/fees/vouchers', icon: 'bi-receipt', label: 'Fee Vouchers', bg: C.dark },
            { href: '/reports/fees', icon: 'bi-bar-chart-fill', label: 'Fee Reports', bg: C.green },
            { href: '/students', icon: 'bi-people-fill', label: 'Students', bg: C.purple },
          ].map(a => (
            <Link key={a.href} href={a.href} style={{
              display: 'flex', alignItems: 'center', gap: 9,
              background: '#fff', border: '1.5px solid ' + a.bg + '30',
              borderRadius: 13, padding: '11px 18px', textDecoration: 'none',
              boxShadow: '0 2px 8px ' + a.bg + '22',
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = a.bg; el.style.transform = 'translateY(-2px)';
                el.querySelectorAll<HTMLElement>('i,span').forEach(c => { c.style.color = '#fff'; });
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = '#fff'; el.style.transform = 'none';
                el.querySelectorAll<HTMLElement>('i,span').forEach(c => { c.style.color = ''; });
              }}
            >
              <i className={'bi ' + a.icon} style={{ fontSize: 17, color: a.bg, transition: 'color 0.2s' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', transition: 'color 0.2s' }}>{a.label}</span>
            </Link>
          ))}
        </div>
      </Panel> */}

    </DashShell>
  );
}