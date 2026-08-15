'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  API, MONTHS, fmt, fmtPKR, C, MaskedAmount, DailyFeeReceipts,
  StatCard, Panel, DonutRing, DashShell, DashLoading, DashError, EmptyChart, RecentPaymentsTable,
} from './shared';

type AdminData = {
  stats: {
    total_students: number; total_staff: number; total_classes: number;
    pending_fees: number; this_month_collected: number; today_collected: number;
    this_month_tuition_billed?: number;
    this_month_remaining_dues?: number;
    this_month_expenses?: number;
  };
  today_student_att: { present: number; absent: number; late: number; on_leave: number; total: number };
  today_staff_att: { present: number; absent: number; late: number; total: number };
  fee_chart: { date: string; label: string; amount: number }[];
  student_att_chart: { date: string; label: string; present: number; absent: number; late: number }[];
  staff_att_chart: { date: string; label: string; present: number; absent: number; late: number }[];
  recent_payments: any[];
};

const CUSTOM_TOOLTIP = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 12, padding: '10px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ fontSize: 14, fontWeight: 700, color: p.color }}>
          {p.name}: {p.name === 'Collected' ? <MaskedAmount amount={p.value} /> : p.value}
        </div>
      ))}
    </div>
  );
};

function ActionBtn({ href, icon, label, primary }: { href: string; icon: string; label: string; primary?: boolean }) {
  const bg = primary ? C.orange : 'rgba(255,255,255,0.15)';
  const bdr = primary ? 'none' : '1px solid rgba(255,255,255,0.25)';
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 7,
      background: bg, color: '#fff', border: bdr,
      borderRadius: 12, padding: '10px 20px',
      fontWeight: 700, fontSize: 13, textDecoration: 'none',
      boxShadow: primary ? '0 4px 14px rgba(254,127,45,0.4)' : 'none',
      backdropFilter: 'blur(8px)',
      transition: 'all 0.2s',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; }}
    >
      <i className={'bi ' + icon} />{label}
    </Link>
  );
}

export default function AdminDashboard({ userName }: { userName: string }) {
  const { hasPermission } = useAuth(); const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoad] = useState(true);
  const [err, setErr] = useState('');
  const [attTab, setAttTab] = useState<'students' | 'staff'>('students');

  useEffect(() => {
    fetch(API + '/dashboard')
      .then(async r => {
        if (r.ok) return r.json();
        const errJson = await r.json().catch(() => null);
        return Promise.reject(errJson?.error || r.statusText || `HTTP ${r.status}`);
      })
      .then(d => { setData(d); setLoad(false); })
      .catch(e => { setErr(String(e)); setLoad(false); });
  }, []);

  if (loading) return <DashLoading />;
  if (err || !data) return <DashError msg={err || 'Dashboard data is missing.'} />;

  const s = data.stats;
  const sa = data.today_student_att;
  const ea = data.today_staff_att;
  const attData = (attTab === 'students' ? data.student_att_chart : data.staff_att_chart).slice(-14);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <DashShell
      title="School Dashboard"
      subtitle={today}
    >
      {/* KPI Row */}
      {hasPermission('dash.admin_kpi', 'read') && (
        <div className="dash-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 14, marginBottom: 20 }}>
          <StatCard icon="bi-people-fill" label="Total Students" value={fmt(s.total_students)} sub="Active enrolled" accent={C.teal} />
          <StatCard icon="bi-person-badge-fill" label="Total Staff" value={fmt(s.total_staff)} sub="Active employees" accent={C.dark} />
          <StatCard icon="bi-building" label="Classes" value={fmt(s.total_classes)} sub="All sections" accent={C.purple} />
          <StatCard icon="bi-cash-coin" label="Today Collected" value={<MaskedAmount amount={s.today_collected} />} sub="Fee received today" accent={C.green} />
          <StatCard icon="bi-graph-up-arrow" label={MONTHS[new Date().getMonth()] + ' Collected'} value={<MaskedAmount amount={s.this_month_collected} />} sub="This month" accent={C.orange} />
          <StatCard icon="bi-piggy-bank-fill" label={MONTHS[new Date().getMonth()] + ' Billed'} value={<MaskedAmount amount={s.this_month_tuition_billed || 0} />} sub="Tuition fee billed" accent={C.teal} />
          <StatCard icon="bi-exclamation-octagon-fill" label={MONTHS[new Date().getMonth()] + ' Dues'} value={<MaskedAmount amount={s.this_month_remaining_dues || 0} />} sub="Current month unpaid" accent={C.red} />
          <StatCard icon="bi-receipt-cutoff" label={MONTHS[new Date().getMonth()] + ' Expenses'} value={<MaskedAmount amount={s.this_month_expenses || 0} />} sub="Current month expenses" accent="#ea580c" />
          <StatCard icon="bi-exclamation-circle-fill" label="Total Pending" value={<MaskedAmount amount={s.pending_fees} />} sub="All time unpaid" accent={C.red} />
        </div>
      )}

      {/* Attendance + Payments row */}
      <div className="dash-side-grid dash-side-grid-left" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 14, marginBottom: 20, alignItems: 'start' }}>

        {hasPermission('dash.admin_charts', 'read') && (
          <Panel title="Today's Attendance" icon="bi-calendar-check-fill">
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '12px 4px 6px' }}>
              <DonutRing present={sa.present} absent={sa.absent} late={sa.late} total={sa.total} label="Students" color={C.teal} />
              <div style={{ width: 1, background: '#f1f5f9', margin: '0 4px' }} />
              <DonutRing present={ea.present} absent={ea.absent} late={ea.late} total={ea.total} label="Staff" color={C.orange} />
            </div>
            <div style={{ marginTop: 14, padding: '10px 14px', background: '#f8fdf7', borderRadius: 10, fontSize: 12, color: '#64748b', display: 'flex', gap: 7, alignItems: 'center' }}>
              <i className="bi bi-info-circle" style={{ color: C.teal }} />
              Based on today's records
            </div>
          </Panel>
        )}

        {/* Recent Payments */}
        {hasPermission('dash.admin_recent', 'read') && (
          <Panel title="Recent Fee Payments" icon="bi-receipt" noPad
            action={
              <Link href="/fees/collect" style={{ fontSize: 12, color: C.orange, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                View All <i className="bi bi-arrow-right-short" style={{ fontSize: 15 }} />
              </Link>
            }>
            <RecentPaymentsTable rows={data!.recent_payments.slice(0, 6)} />
          </Panel>
        )}
      </div>

      {hasPermission('dash.admin_charts', 'read') && (
        <>
          <DailyFeeReceipts />
          {/* Fee Area Chart */}
          <div style={{ marginBottom: 20 }}>
            <Panel title="Daily Fee Collection    Last 14 Days" icon="bi-graph-up-arrow"
              action={<span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{<MaskedAmount amount={s.this_month_collected} />} this month</span>}>
              {data!.fee_chart.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={data!.fee_chart.slice(-14)} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="feeGrd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.orange} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={C.orange} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={50} />
                    <Tooltip content={<CUSTOM_TOOLTIP />} />
                    <Area type="monotone" dataKey="amount" name="Collected"
                      stroke={C.orange} strokeWidth={2.5} fill="url(#feeGrd)"
                      dot={{ r: 3.5, fill: '#fff', stroke: C.orange, strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: C.orange, stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>

          {/* Attendance Bar Chart */}
          <div style={{ marginBottom: 20 }}>
            <Panel title="Attendance Trend    Last 14 Days" icon="bi-person-check-fill"
              action={
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['students', 'staff'] as const).map(t => (
                    <button key={t} onClick={() => setAttTab(t)} style={{
                      padding: '5px 14px', borderRadius: 20, border: 'none', fontSize: 12,
                      fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                      background: attTab === t ? C.dark : '#f1f5f9',
                      color: attTab === t ? '#fff' : '#64748b',
                      boxShadow: attTab === t ? '0 2px 8px rgba(35,61,77,0.25)' : 'none',
                    }}>{t === 'students' ? 'Students' : 'Staff'}</button>
                  ))}
                </div>
              }>
              {attData.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={attData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barCategoryGap="32%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CUSTOM_TOOLTIP />} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 14 }} />
                    <Bar dataKey="present" name="Present" fill={C.teal} radius={[5, 5, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="absent" name="Absent" fill={C.red} radius={[5, 5, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="late" name="Late" fill={C.amber} radius={[5, 5, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>
        </>
      )}

      {/* Quick Actions */}
      {/* <Panel title="Quick Actions" icon="bi-lightning-charge-fill">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '4px 0' }}>
          {[
            { href: '/students/admission', icon: 'bi-person-plus-fill', label: 'New Admission', bg: C.teal },
            { href: '/attendance/students', icon: 'bi-calendar-check-fill', label: 'Take Attendance', bg: C.dark },
            { href: '/fees/generate', icon: 'bi-file-earmark-plus', label: 'Generate Slips', bg: C.orange },
            { href: '/fees/collect', icon: 'bi-cash-coin', label: 'Collect Fee', bg: C.green },
            { href: '/academic/classes', icon: 'bi-building', label: 'Manage Classes', bg: C.purple },
            { href: '/hrm/employees', icon: 'bi-person-badge-fill', label: 'Employees', bg: C.indigo },
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
                el.style.boxShadow = '0 6px 20px ' + a.bg + '45';
                el.querySelectorAll<HTMLElement>('i,span').forEach(c => { c.style.color = '#fff'; });
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = '#fff'; el.style.transform = 'none';
                el.style.boxShadow = '0 2px 8px ' + a.bg + '22';
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