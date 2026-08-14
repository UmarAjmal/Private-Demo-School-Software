'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import {
  API, fmt, C,
  StatCard, Panel, DashShell, DashLoading, DashError, AttendanceDetailsModal,
} from './shared';

type TeacherData = {
  teacher: { name: string; designation: string; employee_id: string };
  classes: { id: number; class_name: string; section_name: string; total_students: number; subject_name: string; is_class_teacher: boolean }[];
  subjects: { id: number; subject_name: string; class_name: string; section_name: string }[];
  my_att_today: { status: string; check_in: string } | null;
  class_att_today: { class_id: number; class_name: string; section_name: string; total: number; present: number; absent: number; late: number; marked: number }[];
  recent_att: { date: string; class_name: string; section_name: string; total: number; present: number; absent: number }[];
};

const ATT_META: Record<string, { label: string; color: string; icon: string }> = {
  present: { label: 'Present', color: '#16a34a', icon: 'bi-patch-check-fill' },
  absent: { label: 'Absent', color: '#dc2626', icon: 'bi-x-circle-fill' },
  late: { label: 'Late', color: '#d97706', icon: 'bi-clock-fill' },
  on_leave: { label: 'On Leave', color: '#7c3aed', icon: 'bi-calendar-x-fill' },
  not_marked: { label: 'Not Marked', color: '#94a3b8', icon: 'bi-question-circle-fill' },
};

export default function TeacherDashboard({ userId }: { userId: number }) {
  const { hasPermission } = useAuth();
  const [data, setData] = useState<TeacherData | null>(null);
  const [loading, setLoad] = useState(true);
  const [err, setErr] = useState('');
  const [modal, setModal] = useState<{ isOpen: boolean; status: string; classId?: number }>({ isOpen: false, status: '' });

  useEffect(() => {
    fetch(API + '/dashboard/teacher?user_id=' + userId)
      .then(async r => {
        if (r.ok) return r.json();
        const errJson = await r.json().catch(() => null);
        return Promise.reject(errJson?.error || r.statusText || `HTTP ${r.status}`);
      })
      .then(d => { setData(d); setLoad(false); })
      .catch(e => { setErr(String(e)); setLoad(false); });
  }, [userId]);

  if (loading) return <DashLoading />;
  if (err || !data) return <DashError msg={err || 'Dashboard data is missing'} />;

  const t = data.teacher;
  const myAtt = data.my_att_today;
  const attKey = myAtt?.status ?? 'not_marked';
  const attMeta = ATT_META[attKey] ?? ATT_META.not_marked;
  const classes = data.classes ?? [];
  const subjects = data.subjects ?? [];
  const classAttToday = data.class_att_today ?? [];
  const recentAtt = data.recent_att ?? [];
  const totalStudents = classes.reduce((a, c) => a + (c.total_students || 0), 0);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const markedToday = classAttToday.filter(c => c.marked).length;

  return (
    <DashShell
      title="Teacher Portal"
      subtitle={today}
    >
      {/* KPI Row */}
      {hasPermission('dash.teacher_kpi', 'read') && (
        <div className="dash-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14, marginBottom: 20 }}>
          <StatCard icon="bi-people-fill" label="My Students" value={fmt(totalStudents)} sub="Across all classes" accent={C.teal} />
          <StatCard icon="bi-building" label="Classes Assigned" value={fmt(classes.length)} sub="Teaching today" accent={C.dark} />
          <StatCard icon="bi-journal-bookmark" label="Subjects" value={fmt(subjects.length)} sub="Assigned to me" accent={C.orange} />
          <StatCard icon="bi-calendar-check-fill" label="Marked Today" value={fmt(markedToday) + ' / ' + fmt(classes.length)} sub="Attendance progress" accent={C.green} />

          {/* My attendance status card */}
          <div style={{
            background: '#fff', borderRadius: 18, padding: '22px 24px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06),0 4px 20px rgba(35,61,77,0.07)',
            border: '1px solid #f1f5f9', borderLeft: '4px solid ' + attMeta.color,
            display: 'flex', flexDirection: 'column' as const, gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>My Attendance</div>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: attMeta.color + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={'bi ' + attMeta.icon} style={{ fontSize: 17, color: attMeta.color }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: attMeta.color, lineHeight: 1 }}>{attMeta.label}</div>
              {myAtt?.check_in && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 5 }}>Check-in: {myAtt.check_in}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Today's class attendance table */}
      {hasPermission('dash.teacher_att', 'read') && (
        <div style={{ marginBottom: 20 }}>
          <Panel title="Today's Class Attendance" icon="bi-calendar-check-fill"
            action={<span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{today}</span>}
            noPad>
            {classAttToday.length === 0 ? (
              <div style={{ textAlign: 'center' as const, padding: '36px 0', color: '#94a3b8' }}>
                <i className="bi bi-inbox" style={{ fontSize: 30, display: 'block', marginBottom: 8 }} />
                <div style={{ fontSize: 13 }}>No attendance records for today yet</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Class', 'Section', 'Total', 'Present', 'Absent', 'Late', 'Status'].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px', textAlign: 'left' as const, color: '#64748b',
                        fontWeight: 700, fontSize: 11, textTransform: 'uppercase' as const,
                        letterSpacing: '0.05em', borderBottom: '2px solid #f1f5f9', whiteSpace: 'nowrap' as const,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classAttToday.map(r => (
                    <tr key={r.class_id}
                      style={{ borderBottom: '1px solid #f8fafc', transition: 'background 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8fdf7'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1a2e3b' }}>{r.class_name}</td>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>{r.section_name || ''}</td>
                      <td style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>{r.total}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span onClick={() => setModal({ isOpen: true, status: 'Present', classId: r.class_id })} title="Click to view Present list" style={{ cursor: 'pointer', fontWeight: 700, color: '#16a34a', background: '#16a34a1a', padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>{r.present}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span onClick={() => setModal({ isOpen: true, status: 'Absent', classId: r.class_id })} title="Click to view Absent list" style={{ cursor: 'pointer', fontWeight: 700, color: '#dc2626', background: '#dc26261a', padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>{r.absent}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span onClick={() => setModal({ isOpen: true, status: 'Late', classId: r.class_id })} title="Click to view Late list" style={{ cursor: 'pointer', fontWeight: 700, color: '#d97706', background: '#d976061a', padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>{r.late}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: 11, padding: '4px 12px', borderRadius: 20, fontWeight: 700,
                          background: r.marked ? '#16a34a1a' : '#94a3b81a',
                          color: r.marked ? '#16a34a' : '#94a3b8',
                        }}>{r.marked ? 'Marked' : 'Pending'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <AttendanceDetailsModal
            isOpen={modal.isOpen}
            onClose={() => setModal({ ...modal, isOpen: false })}
            type="student"
            status={modal.status}
            classId={modal.classId}
          />
        </div>
      )}

      {/* Classes + Subjects grid */}
      {hasPermission('dash.teacher_classes', 'read') && (
        <div className="dash-side-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          <Panel title="My Classes" icon="bi-building"
            action={
              <Link href="/attendance/students" style={{ fontSize: 12, color: C.orange, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                Take Attendance <i className="bi bi-arrow-right-short" style={{ fontSize: 15 }} />
              </Link>
            }>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {classes.length === 0 ? (
                <div style={{ textAlign: 'center' as const, padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>No classes assigned</div>
              ) : classes.map(c => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#f8fdf7', borderRadius: 12, padding: '12px 16px',
                  border: '1px solid #e8f5e9', transition: 'all 0.2s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f0faf1'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f8fdf7'; }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1a2e3b', display: 'flex', alignItems: 'center' }}>
                      {c.class_name}{c.section_name ? ' ' + c.section_name : ''}
                      {c.is_class_teacher && <i className="bi bi-star-fill ms-2 text-warning" style={{ fontSize: 12 }} title="Class Incharge" />}
                    </div>
                    {c.subject_name && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{c.subject_name}</div>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.teal, background: C.teal + '18', borderRadius: 20, padding: '4px 12px', whiteSpace: 'nowrap' as const }}>
                    {c.total_students || 0} students
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="My Subjects" icon="bi-journal-bookmark-fill">
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {subjects.length === 0 ? (
                <div style={{ textAlign: 'center' as const, padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>No subjects assigned</div>
              ) : subjects.map((s, i) => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#fafbff', borderRadius: 12, padding: '12px 16px',
                  border: '1px solid #eef2ff', transition: 'all 0.2s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                      background: [C.teal, C.orange, C.purple, C.indigo, C.green][i % 5] + '20',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 800, color: [C.teal, C.orange, C.purple, C.indigo, C.green][i % 5],
                    }}>
                      {s.subject_name.charAt(0)}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1a2e3b' }}>{s.subject_name}</div>
                  </div>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{s.class_name}{s.section_name ? ' · ' + s.section_name : ''}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* Recent Attendance */}
      {hasPermission('dash.teacher_att', 'read') && recentAtt.length > 0 && (
        <Panel title="Recent Attendance Records" icon="bi-clock-history" noPad>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
            <thead>
              <tr>
                {['Date', 'Class', 'Section', 'Total', 'Present', 'Absent'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left' as const, color: '#64748b', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.05em', borderBottom: '2px solid #f1f5f9', whiteSpace: 'nowrap' as const }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentAtt.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f8fafc', transition: 'background 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8fdf7'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td style={{ padding: '11px 16px', color: '#475569' }}>{new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
                  <td style={{ padding: '11px 16px', fontWeight: 700, color: '#1a2e3b' }}>{r.class_name}</td>
                  <td style={{ padding: '11px 16px', color: '#475569' }}>{r.section_name || ''}</td>
                  <td style={{ padding: '11px 16px', color: '#475569' }}>{r.total}</td>
                  <td style={{ padding: '11px 16px' }}><span style={{ fontWeight: 700, color: '#16a34a' }}>{r.present}</span></td>
                  <td style={{ padding: '11px 16px' }}><span style={{ fontWeight: 700, color: '#dc2626' }}>{r.absent}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </DashShell>
  );
}