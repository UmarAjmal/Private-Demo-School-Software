'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { API, fmt, fmtPKR, C, StatCard, Panel, DashShell, DashLoading, DashError, MaskedAmount } from './shared';

type GenericData = {
  stats: { total_students:number; total_staff:number; total_classes:number; pending_fees:number; this_month_collected:number; today_collected:number };
};

const NAV_LINKS = [
  { href:'/students',              icon:'bi-people-fill',            label:'Students',      color:C.teal   },
  { href:'/academic/classes',      icon:'bi-building',               label:'Classes',       color:C.dark   },
  { href:'/academic/subjects',     icon:'bi-journal-bookmark-fill',  label:'Subjects',      color:C.purple },
  { href:'/attendance/students',   icon:'bi-calendar-check-fill',    label:'Attendance',    color:C.orange },
  { href:'/fees/collect',          icon:'bi-cash-coin',              label:'Fee Collect',   color:C.green  },
  { href:'/hrm/employees',         icon:'bi-person-badge-fill',      label:'Employees',     color:C.indigo },
  { href:'/settings',              icon:'bi-gear-fill',              label:'Settings',      color:'#64748b' },
  { href:'/reports/students',      icon:'bi-bar-chart-fill',         label:'Reports',       color:C.amber  },
];

export default function GenericDashboard({ userName, role }: { userName:string; role:string }) {
  const [data, setData]   = useState<GenericData | null>(null);
  const [loading, setLoad] = useState(true);
  const [err, setErr]     = useState('');

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

  const today = new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  if (loading) return <DashLoading />;
  if (err || !data) return <DashError msg={err || 'Dashboard data is missing'} />;

  const s = data.stats;
  return (
    <DashShell title="School Dashboard" subtitle={today}>

      {/* Stats */}
      <div className="dash-stat-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14, marginBottom:20 }}>
        <StatCard icon="bi-people-fill"       label="Students"        value={fmt(s.total_students)}         sub="Enrolled"      accent={C.teal}   />
        <StatCard icon="bi-person-badge-fill" label="Staff"           value={fmt(s.total_staff)}            sub="Active"        accent={C.dark}   />
        <StatCard icon="bi-building"          label="Classes"         value={fmt(s.total_classes)}          sub="Total"         accent={C.purple} />
        <StatCard icon="bi-graph-up-arrow"    label="Month Collected" value={<MaskedAmount amount={s.this_month_collected} />} sub="This month"   accent={C.orange} />
      </div>
    </DashShell>
  );
}