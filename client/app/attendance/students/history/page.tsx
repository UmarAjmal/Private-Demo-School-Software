'use client';
import { useState, useEffect } from 'react';

interface ClassItem { class_id: number; class_name: string; }
interface StudentHistory {
    student_id: number; first_name: string; last_name: string;
    admission_no: string; roll_no: string | null;
    present: number; absent: number; late: number; leave: number;
    total_days: number; daily: Record<string, string>;
}

const S_COLOR: Record<string, string> = { Present: '#0d9e6e', Absent: '#e13232', Late: '#e6860a', Leave: '#1a6fd4' };
const S_ABBR: Record<string, string> = { Present: 'P', Absent: 'A', Late: 'L', Leave: 'V' };
const S_BG: Record<string, string> = { Present: '#e6f9f3', Absent: '#fde8e8', Late: '#fef6e4', Leave: '#e8f0fd' };

function AttBadge({ status }: { status: string }) {
    return (
        <span title={status} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 26, height: 26, borderRadius: '50%', fontSize: '0.68rem', fontWeight: 700,
            background: S_BG[status] ?? '#f1f3f5', color: S_COLOR[status] ?? '#6c757d',
            border: `1.5px solid ${(S_COLOR[status] ?? '#6c757d')}22`
        }}>{S_ABBR[status] ?? '—'}</span>
    );
}

export default function StudentAttendanceHistoryPage() {
    const now = new Date();
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [classId, setClassId] = useState('');
    const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
    const [year, setYear] = useState(String(now.getFullYear()));
    const [data, setData] = useState<{ students: StudentHistory[]; working_dates: string[] } | null>(null);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'danger'; msg: string } | null>(null);
    const [search, setSearch] = useState('');
    const [filterDate, setFilterDate] = useState('');

    const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i));
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic`).then(r => r.json()).then(setClasses).catch(() => { });
    }, []);

    const showToast = (type: 'success' | 'danger', msg: string) => {
        setToast({ type, msg }); setTimeout(() => setToast(null), 4000);
    };

    const loadHistory = async () => {
        if (!classId || !month || !year) return;
        setLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/attendance/students/history?class_id=${classId}&month=${month}&year=${year}`);
            const d = await res.json();
            if (d.students) setData(d); else showToast('danger', 'Failed to load history');
        } catch { showToast('danger', 'Server error'); }
        setLoading(false);
    };

    const cls = classes.find(c => String(c.class_id) === classId);
    const students = data?.students ?? [];
    const dates = data?.working_dates ?? [];
    const visibleDates = filterDate ? dates.filter(d => d === filterDate) : dates;
    const totals = students.reduce((a, s) => ({ present: a.present + s.present, absent: a.absent + s.absent, late: a.late + s.late, leave: a.leave + s.leave }), { present: 0, absent: 0, late: 0, leave: 0 });
    const displayTotals = filterDate
        ? {
            present: students.filter(s => s.daily[filterDate] === 'Present').length,
            absent: students.filter(s => s.daily[filterDate] === 'Absent').length,
            late: students.filter(s => s.daily[filterDate] === 'Late').length,
            leave: students.filter(s => s.daily[filterDate] === 'Leave').length
        }
        : totals;
    const filtered = students.filter(s =>
        `${s.first_name} ${s.last_name} ${s.admission_no}`.toLowerCase().includes(search.toLowerCase())
    );
    const avgPct = students.length ? Math.round(students.reduce((a, s) => a + (s.total_days ? ((s.present + s.late) / s.total_days) * 100 : 0), 0) / students.length) : 0;

    const fmtDate = (d: string) => { const dt = new Date(d + 'T00:00:00'); return { day: dt.getDate(), dow: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dt.getDay()] }; };

    return (
        <div className="container-fluid px-3 px-md-4 py-3 animate__animated animate__fadeIn">
            {/* HEADER */}
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <div>
                    <h2 className="fw-bold mb-1" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-clock-history me-2" style={{ color: 'var(--accent-orange)' }} /> Student Attendance History
                    </h2>
                    <p className="text-muted mb-0 small">Monthly records with daily breakdown</p>
                </div>
                {data && cls && (
                    <span className="badge rounded-pill px-3 py-2" style={{ background: 'rgba(33,94,97,0.1)', color: 'var(--primary-teal)', fontWeight: 600, fontSize: '0.85rem' }}>
                        <i className="bi bi-mortarboard me-1" />{cls.class_name} · {monthNames[+month - 1]} {year}
                    </span>
                )}
            </div>

            <div>
                {/* FILTER */}
                <div className="card border-0 shadow-sm rounded-4 mb-4 animate__animated animate__fadeInUp">
                    <div className="card-body p-3 p-md-4">
                        <div className="row g-3 align-items-end">
                            <div className="col-md-3">
                                <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--primary-dark)', letterSpacing: '0.05em' }}>
                                    <i className="bi bi-mortarboard me-1" style={{ color: 'var(--primary-teal)' }} />Class
                                </label>
                                <select className="form-select rounded-3" value={classId} onChange={e => setClassId(e.target.value)} style={{ border: '1.5px solid #dee2e6', height: 42 }}>
                                    <option value="">— Select Class —</option>
                                    {classes.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                                </select>
                            </div>
                            <div className="col-md-3">
                                <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--primary-dark)', letterSpacing: '0.05em' }}>
                                    <i className="bi bi-calendar3 me-1" style={{ color: 'var(--primary-teal)' }} />Month
                                </label>
                                <select className="form-select rounded-3" value={month} onChange={e => setMonth(e.target.value)} style={{ border: '1.5px solid #dee2e6', height: 42 }}>
                                    {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m, i) => (
                                        <option key={m} value={m}>{monthNames[i]}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--primary-dark)', letterSpacing: '0.05em' }}>
                                    <i className="bi bi-calendar-event me-1" style={{ color: 'var(--primary-teal)' }} />Year
                                </label>
                                <select className="form-select rounded-3" value={year} onChange={e => setYear(e.target.value)} style={{ border: '1.5px solid #dee2e6', height: 42 }}>
                                    {years.map(y => <option key={y}>{y}</option>)}
                                </select>
                            </div>
                            <div className="col-md-4">
                                <button className="btn btn-primary-custom w-100 fw-bold rounded-3" style={{ height: 42 }}
                                    onClick={loadHistory} disabled={!classId || loading}>
                                    {loading ? <><span className="spinner-border spinner-border-sm me-2" />Loading...</> : <><i className="bi bi-arrow-repeat me-2" />Load History</>}
                                </button>
                            </div>
                            {/* SPECIFIC DATE FILTER */}
                            <div className="col-md-4">
                                <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--primary-dark)', letterSpacing: '0.05em' }}>
                                    <i className="bi bi-calendar-day me-1" style={{ color: 'var(--primary-teal)' }} />Specific Date <span className="text-muted fw-normal"></span>
                                </label>
                                <div className="input-group">
                                    <input type="date" className="form-control rounded-start-3" value={filterDate}
                                        onChange={e => { setFilterDate(e.target.value); if (e.target.value) { const d = new Date(e.target.value); setMonth(String(d.getMonth() + 1).padStart(2, '0')); setYear(String(d.getFullYear())); } }}
                                        style={{ border: '1.5px solid #dee2e6', height: 42 }} />
                                    {filterDate && (
                                        <button className="btn btn-outline-secondary" style={{ height: 42, border: '1.5px solid #dee2e6' }} onClick={() => setFilterDate('')} title="Clear date">
                                            <i className="bi bi-x-lg" style={{ fontSize: '0.8rem' }} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {toast && (
                    <div className={`alert alert-${toast.type} border-0 rounded-3 d-flex align-items-center gap-2 animate__animated animate__fadeInDown`} style={{ marginBottom: 20 }}>
                        <i className={`bi ${toast.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} fs-5`} />
                        <span>{toast.msg}</span>
                    </div>
                )}

                {data && (
                    <>
                        {/* STATS */}
                        <div className="row g-3 mb-4">
                            {[
                                { label: 'Present', count: displayTotals.present, color: '#0d9e6e', bg: '#e6f9f3', icon: 'bi-check-circle-fill' },
                                { label: 'Absent', count: displayTotals.absent, color: '#e13232', bg: '#fde8e8', icon: 'bi-x-circle-fill' },
                                { label: 'Late', count: displayTotals.late, color: '#e6860a', bg: '#fef6e4', icon: 'bi-clock-fill' },
                                { label: 'Leave', count: displayTotals.leave, color: '#1a6fd4', bg: '#e8f0fd', icon: 'bi-calendar2-x-fill' },
                                { label: 'Avg Attendance', count: filterDate ? `—` : `${avgPct}%`, color: 'var(--primary-teal)', bg: 'rgba(33,94,97,0.1)', icon: 'bi-bar-chart-fill' },
                                { label: filterDate ? 'Filtered Day' : 'Working Days', count: visibleDates.length, color: 'var(--primary-dark)', bg: 'rgba(35,61,77,0.08)', icon: 'bi-calendar-week' },
                            ].map((st, i) => (
                                <div key={st.label} className="col-6 col-lg-2">
                                    <div className="card border-0 shadow-sm rounded-4 h-100 animate__animated animate__fadeInUp"
                                        style={{ animationDelay: `${i * 0.06}s`, borderBottom: `3px solid ${st.color}` }}>
                                        <div className="card-body d-flex align-items-center gap-2 p-3">
                                            <div className="rounded-3 d-flex align-items-center justify-content-center"
                                                style={{ width: 40, height: 40, background: st.bg, flexShrink: 0 }}>
                                                <i className={`bi ${st.icon}`} style={{ color: st.color, fontSize: '1.1rem' }} />
                                            </div>
                                            <div>
                                                <div className="fw-bold" style={{ fontSize: '1.35rem', lineHeight: 1, color: st.color }}>{st.count}</div>
                                                <div style={{ fontSize: '0.66rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#adb5bd' }}>{st.label}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* SEARCH + LEGEND */}
                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-2 gap-2">
                            <div className="d-flex align-items-center gap-3 flex-wrap">
                                <span className="fw-semibold" style={{ color: 'var(--primary-dark)', fontSize: '0.88rem' }}>
                                    <i className="bi bi-people-fill me-1" style={{ color: 'var(--accent-orange)' }} />
                                    {students.length} students · {filterDate ? <span style={{ color: 'var(--accent-orange)' }}>1 day (filtered)</span> : `${dates.length} working days`}
                                </span>
                                <div className="d-flex gap-2 flex-wrap">
                                    {Object.entries(S_ABBR).map(([s, a]) => (
                                        <span key={s} style={{ fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                width: 20, height: 20, borderRadius: '50%', background: S_BG[s], color: S_COLOR[s], fontSize: '0.62rem', fontWeight: 700
                                            }}>{a}</span>
                                            {s}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="input-group w-100" style={{ maxWidth: 240 }}>
                                <span className="input-group-text bg-white border-end-0"><i className="bi bi-search text-muted" style={{ fontSize: '0.8rem' }} /></span>
                                <input type="text" className="form-control border-start-0" placeholder="Search…"
                                    value={search} onChange={e => setSearch(e.target.value)}
                                    style={{ boxShadow: 'none', fontSize: '0.85rem' }} />
                            </div>
                        </div>

                        {/* TABLE */}
                        <div className="card border-0 shadow-sm rounded-4 overflow-hidden animate__animated animate__fadeInUp">
                            <div className="table-responsive" style={{ maxHeight: '62vh', overflowY: 'auto' }}>
                                <table className="table table-hover align-middle mb-0" style={{ minWidth: 600 }}>
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--primary-dark)' }}>
                                        <tr>
                                            <th className="border-0 fw-semibold ps-4" style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '12px 16px', minWidth: 200 }}>Student</th>
                                            <th className="border-0 fw-semibold text-center" style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.72rem', textTransform: 'uppercase', padding: '12px 8px', minWidth: 56 }}>Att%</th>
                                            {visibleDates.map(d => {
                                                const { day, dow } = fmtDate(d); return (
                                                    <th key={d} className="border-0 text-center" style={{ color: filterDate ? '#ffd700' : 'rgba(255,255,255,0.7)', fontSize: '0.62rem', padding: '6px 3px', minWidth: 34, lineHeight: 1.2, background: filterDate ? 'rgba(255,215,0,0.15)' : undefined }}>
                                                        <div style={{ fontWeight: 400 }}>{dow}</div>
                                                        <div style={{ fontWeight: 700, fontSize: '0.7rem' }}>{day}</div>
                                                    </th>
                                                );
                                            })}
                                            {['P', 'A', 'L', 'V'].map(h => <th key={h} className="border-0 text-center" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', padding: '12px 6px', minWidth: 40 }}>{h}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((s, idx) => {
                                            const pct = s.total_days ? Math.round(((s.present + s.late) / s.total_days) * 100) : 0;
                                            return (
                                                <tr key={s.student_id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                                                    <td className="ps-4" style={{ padding: '10px 16px' }}>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <div className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                                                                style={{ width: 30, height: 30, background: 'linear-gradient(135deg,var(--primary-dark),var(--primary-teal))', fontSize: '0.65rem', flexShrink: 0 }}>
                                                                {s.first_name[0]}{s.last_name[0]}
                                                            </div>
                                                            <div>
                                                                <div className="fw-semibold" style={{ color: 'var(--primary-dark)', fontSize: '0.85rem' }}>{s.first_name} {s.last_name}</div>
                                                                <div className="text-muted" style={{ fontSize: '0.68rem' }}>{s.admission_no}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className="badge rounded-pill" style={{ fontSize: '0.72rem', background: pct >= 75 ? '#e6f9f3' : pct >= 50 ? '#fef6e4' : '#fde8e8', color: pct >= 75 ? '#0d9e6e' : pct >= 50 ? '#e6860a' : '#e13232', fontWeight: 700, padding: '3px 8px' }}>
                                                            {pct}%
                                                        </span>
                                                    </td>
                                                    {visibleDates.map(d => (
                                                        <td key={d} className="text-center" style={{ padding: '5px 3px', background: filterDate ? '#fffdf0' : undefined }}>
                                                            {s.daily[d] ? <AttBadge status={s.daily[d]} /> : <span style={{ color: '#dee2e6', fontSize: '0.65rem' }}>—</span>}
                                                        </td>
                                                    ))}
                                                    {[s.present, s.absent, s.late, s.leave].map((n, i) => (
                                                        <td key={i} className="text-center fw-semibold" style={{ fontSize: '0.78rem', color: Object.values(S_COLOR)[i] }}>{n}</td>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {filtered.length === 0 && (
                                <div className="text-center py-4">
                                    <i className="bi bi-search fs-3 text-muted" />
                                    <div className="text-muted mt-2">No students match</div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {!data && !loading && (
                    <div className="card border-0 shadow-sm rounded-4 text-center animate__animated animate__fadeIn">
                        <div className="card-body py-5">
                            <div className="mx-auto rounded-4 d-flex align-items-center justify-content-center mb-3"
                                style={{ width: 80, height: 80, background: 'rgba(33,94,97,0.08)' }}>
                                <i className="bi bi-clock-history fs-1" style={{ color: 'var(--primary-teal)' }} />
                            </div>
                            <h5 className="fw-bold mb-2" style={{ color: 'var(--primary-dark)' }}>View Attendance History</h5>
                            <p className="text-muted mb-0" style={{ maxWidth: 320, margin: '0 auto' }}>Select a class, month and year, then click <strong>Load History</strong>.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
