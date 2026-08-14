'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { notify } from '@/app/utils/notify';

interface Department { department_id: number; department_name: string; }
interface StaffRow {
    employee_id: number; first_name: string; last_name: string;
    designation: string; department_name: string; department_id: number;
    attendance_id: number | null; status: string | null;
}

const STATUS_OPTS = ['Present', 'Absent', 'Leave'] as const;
type StatusType = typeof STATUS_OPTS[number];

const S_COLOR: Record<StatusType, string> = { Present: '#0d9e6e', Absent: '#e13232', Leave: '#1a6fd4' };
const S_BG: Record<StatusType, string> = { Present: '#e6f9f3', Absent: '#fde8e8', Leave: '#e8f0fd' };
const S_ICON: Record<StatusType, string> = { Present: 'bi-check-circle-fill', Absent: 'bi-x-circle-fill', Leave: 'bi-calendar2-x-fill' };

export default function StaffAttendancePage() {
    const today = new Date().toISOString().split('T')[0];
    const [departments, setDepartments] = useState<Department[]>([]);
    const [deptId, setDeptId] = useState('');
    const [date, setDate] = useState(today);
    const [staff, setStaff] = useState<StaffRow[]>([]);
    const [statuses, setStatuses] = useState<Record<number, StatusType>>({});
    const [lockedIds, setLockedIds] = useState<Set<number>>(new Set()); // manually locked rows
    const [allSaved, setAllSaved] = useState(false); // after Save button clicked
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const { hasPermission, user } = useAuth();

    const isAdmin = (user?.role_level || 0) >= 90;
    const canEditLocked = isAdmin || hasPermission('attendance.edit_locked', 'write');
    const canMarkAdvance = isAdmin || hasPermission('attendance.mark_advance', 'write');

    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/hrm/departments`).then(r => r.json()).then(setDepartments).catch(() => { });
    }, []);

    const loadAttendance = useCallback(async () => {
        if (!date) return;
        setLoading(true);
        try {
            const url = `${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/attendance/staff/daily?date=${date}${deptId ? `&department_id=${deptId}` : ''}`;
            const res = await fetch(url);
            const data = await res.json();
            if (!Array.isArray(data)) { notify.error('Failed to load staff'); setLoading(false); return; }
            setStaff(data);
            const st: Record<number, StatusType> = {};
            const locked = new Set<number>();
            data.forEach((e: StaffRow) => {
                st[e.employee_id] = (e.status as StatusType) || 'Present';
                if (e.attendance_id !== null) locked.add(e.employee_id); // already in DB -> locked
            });
            setStatuses(st);
            setLockedIds(locked);
            setAllSaved(data.length > 0 && data.every((e: StaffRow) => e.attendance_id !== null));
        } catch { notify.error('Server error'); }
        setLoading(false);
    }, [date, deptId]);

    // Toggle lock on a single row
    const toggleLock = (id: number) => {
        setLockedIds(prev => {
            const s = new Set(prev);
            if (s.has(id)) {
                s.delete(id);
                setAllSaved(false);
            } else {
                s.add(id);
            }
            return s;
        });
    };

    // Mark all UNLOCKED rows with a status
    const markAll = (status: StatusType) => {
        setStatuses(prev => {
            const u = { ...prev };
            staff.forEach(e => { if (!lockedIds.has(e.employee_id)) u[e.employee_id] = status; });
            return u;
        });
    };

    const saveAttendance = async () => {
        if (!date || !staff.length) return;
        setSaving(true);
        try {
            // Save ALL staff regardless of lock status
            const records = staff.map(e => ({ employee_id: e.employee_id, status: statuses[e.employee_id] || 'Present' }));
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/attendance/staff/daily`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, records }) });
            const d = await res.json();
            if (res.ok) {
                // Lock all rows after save
                setLockedIds(new Set(staff.map(e => e.employee_id)));
                setAllSaved(true);
                notify.success(`Attendance saved for ${records.length} staff member${records.length !== 1 ? 's' : ''}!`);
            } else { notify.error(d.error || 'Save failed'); }
        } catch { notify.error('Server error'); }
        setSaving(false);
    };

    const counts = STATUS_OPTS.reduce((a, s) => { a[s] = staff.filter(e => (statuses[e.employee_id] || 'Present') === s).length; return a; }, {} as Record<string, number>);
    const total = staff.length;
    const pct = total ? Math.round(((counts.Present) / total) * 100) : 0;
    const unlockedCount = staff.filter(e => !lockedIds.has(e.employee_id)).length;
    const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // Group by department
    const groups = staff.reduce((acc, e) => {
        const key = e.department_name || 'Unknown';
        if (!acc[key]) acc[key] = [];
        acc[key].push(e);
        return acc;
    }, {} as Record<string, StaffRow[]>);

    return (
        <div className="container-fluid px-3 px-md-4 py-3 animate__animated animate__fadeIn">
            {/* HEADER */}
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <div>
                    <h2 className="fw-bold mb-1" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-person-badge-fill me-2" style={{ color: 'var(--accent-orange)' }} /> Staff Attendance
                    </h2>
                    <p className="text-muted mb-0 small">Mark and save daily staff attendance</p>
                </div>
                {unlockedCount > 0 && (
                    <div className="d-flex flex-wrap gap-2">
                        {STATUS_OPTS.map(s => (
                            <button key={s} onClick={() => markAll(s)} className="btn btn-sm fw-semibold"
                                style={{ background: S_BG[s], border: `1.5px solid ${S_COLOR[s]}`, color: S_COLOR[s], borderRadius: 8, fontSize: '0.78rem' }}>
                                <i className={`bi ${S_ICON[s]} me-1`} />All {s}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div>
                {/* FILTER */}
                <div className="card border-0 shadow-sm rounded-4 mb-4 animate__animated animate__fadeInUp">
                    <div className="card-body p-3 p-md-4">
                        <div className="row g-3 align-items-end">
                            <div className="col-md-4">
                                <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--primary-dark)', letterSpacing: '0.05em' }}>
                                    <i className="bi bi-building me-1" style={{ color: 'var(--primary-teal)' }} />Department
                                </label>
                                <select className="form-select rounded-3" value={deptId} onChange={e => setDeptId(e.target.value)} style={{ border: '1.5px solid #dee2e6', height: 42 }}>
                                    <option value="">All Departments</option>
                                    {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                                </select>
                            </div>
                            <div className="col-md-4">
                                <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--primary-dark)', letterSpacing: '0.05em' }}>
                                    <i className="bi bi-calendar3 me-1" style={{ color: 'var(--primary-teal)' }} />Date
                                </label>
                                <input type="date" className="form-control rounded-3" value={date} max={canMarkAdvance ? undefined : today}
                                    onChange={e => { setDate(e.target.value); setAllSaved(false); setLockedIds(new Set()); }} style={{ border: '1.5px solid #dee2e6', height: 42 }} />
                            </div>
                            <div className="col-md-4">
                                <button className="btn btn-primary-custom w-100 fw-bold rounded-3" style={{ height: 42 }}
                                    onClick={loadAttendance} disabled={loading}>
                                    {loading ? <><span className="spinner-border spinner-border-sm me-2" />Loading...</> : <><i className="bi bi-arrow-repeat me-2" />Load Attendance</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {staff.length > 0 && (
                    <>
                        {/* STAT CARDS */}
                        <div className="row g-3 mb-4">
                            {STATUS_OPTS.map((s, i) => (
                                <div key={s} className="col-12 col-md-4">
                                    <div className="card border-0 shadow-sm rounded-4 h-100 animate__animated animate__fadeInUp"
                                        style={{ animationDelay: `${i * 0.07}s`, borderBottom: `4px solid ${S_COLOR[s]}` }}>
                                        <div className="card-body d-flex align-items-center gap-3 p-3">
                                            <div className="rounded-3 d-flex align-items-center justify-content-center"
                                                style={{ width: 48, height: 48, background: S_BG[s], flexShrink: 0 }}>
                                                <i className={`bi ${S_ICON[s]} fs-4`} style={{ color: S_COLOR[s] }} />
                                            </div>
                                            <div>
                                                <div className="fw-bold" style={{ fontSize: '1.75rem', lineHeight: 1, color: S_COLOR[s] }}>{counts[s]}</div>
                                                <div style={{ fontSize: '0.76rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#adb5bd' }}>{s}</div>
                                                <div style={{ fontSize: '0.72rem', color: '#ced4da' }}>{total ? Math.round((counts[s] / total) * 100) : 0}% of staff</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* PROGRESS */}
                        <div className="card border-0 shadow-sm rounded-4 mb-4 animate__animated animate__fadeInUp">
                            <div className="card-body p-3 px-3 px-md-4">
                                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                                    <div className="fw-semibold" style={{ color: 'var(--primary-dark)', fontSize: '0.88rem' }}>
                                        <i className="bi bi-bar-chart-fill me-2" style={{ color: 'var(--accent-orange)' }} />
                                        {date ? fmtDate(date) : ''} &nbsp;·&nbsp; <span className="text-muted" style={{ fontWeight: 400 }}>{total} staff members</span>
                                    </div>
                                    <span className="badge rounded-pill px-3 py-2 fw-bold"
                                        style={{ background: pct >= 75 ? '#0d9e6e' : pct >= 50 ? '#e6860a' : '#e13232', fontSize: '0.85rem' }}>
                                        {pct}% Present
                                    </span>
                                </div>
                                <div className="progress rounded-pill" style={{ height: 10 }}>
                                    <div className="progress-bar" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,var(--primary-teal),#34d399)', borderRadius: 100, transition: 'width 0.8s ease' }} />
                                </div>
                                <div className="d-flex flex-wrap gap-3 mt-2">
                                    {STATUS_OPTS.map(s => (
                                        <small key={s} style={{ color: S_COLOR[s], fontWeight: 600 }}>
                                            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: S_COLOR[s], marginRight: 4 }} />
                                            {counts[s]} {s}
                                        </small>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* GROUPED TABLES */}
                        {Object.entries(groups).map(([deptName, members], gi) => (
                            <div key={deptName} className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4 animate__animated animate__fadeInUp"
                                style={{ animationDelay: `${gi * 0.05}s` }}>
                                <div className="card-header border-0 d-flex align-items-center justify-content-between flex-wrap gap-2 px-3 px-md-4 py-3"
                                    style={{ background: `linear-gradient(135deg,var(--primary-dark),var(--primary-teal))` }}>
                                    <div className="d-flex align-items-center gap-2">
                                        <div className="d-flex align-items-center justify-content-center rounded-2"
                                            style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.15)' }}>
                                            <i className="bi bi-building text-white" style={{ fontSize: '0.85rem' }} />
                                        </div>
                                        <span className="fw-bold text-white">{deptName}</span>
                                        <span className="badge rounded-pill ms-1" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.75rem' }}>{members.length} staff</span>
                                    </div>
                                    <div className="d-flex gap-1">
                                        {STATUS_OPTS.map(s => {
                                            const c = members.filter(e => (statuses[e.employee_id] || 'Present') === s).length;
                                            return c > 0 ? <span key={s} className="badge rounded-pill" style={{ background: S_BG[s], color: S_COLOR[s], fontSize: '0.72rem', border: `1px solid ${S_COLOR[s]}44` }}>{c} {s}</span> : null;
                                        })}
                                    </div>
                                </div>
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle mb-0">
                                        <thead style={{ background: '#f8f9fa' }}>
                                            <tr>
                                                {['#', 'Employee', 'Designation', 'Status', 'Lock'].map((h, i) => (
                                                    <th key={i} className="border-0 fw-semibold" style={{ color: 'var(--primary-dark)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '10px 16px', whiteSpace: 'nowrap' }}>
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {members.map((e, idx) => {
                                                const cur = (statuses[e.employee_id] || 'Present') as StatusType;
                                                const isLocked = lockedIds.has(e.employee_id);
                                                return (
                                                    <tr key={e.employee_id} style={{ borderLeft: `3px solid ${S_COLOR[cur]}`, background: isLocked ? (cur === 'Absent' ? '#fff0f0' : cur === 'Leave' ? '#f0f4ff' : '#f0fdf8') : cur === 'Absent' ? '#fff8f8' : cur === 'Leave' ? '#f5f8ff' : '#fff', transition: 'background 0.2s' }}>
                                                        <td className="ps-4 text-muted" style={{ fontSize: '0.8rem', width: 50 }}>
                                                            <span className="badge rounded-circle text-bg-secondary" style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem' }}>{idx + 1}</span>
                                                        </td>
                                                        <td style={{ padding: '10px 16px' }}>
                                                            <div className="d-flex align-items-center gap-2">
                                                                <div className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                                                                    style={{ width: 34, height: 34, background: 'linear-gradient(135deg,var(--primary-dark),var(--primary-teal))', fontSize: '0.72rem', flexShrink: 0 }}>
                                                                    {e.first_name[0]}{e.last_name[0]}
                                                                </div>
                                                                <div>
                                                                    <div className="fw-semibold" style={{ color: 'var(--primary-dark)', fontSize: '0.88rem' }}>{e.first_name} {e.last_name}</div>
                                                                    <div className="text-muted" style={{ fontSize: '0.7rem' }}>{e.designation || '—'}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td><span className="badge text-bg-light border" style={{ fontSize: '0.75rem' }}>{e.designation || '—'}</span></td>
                                                        <td style={{ padding: '10px 16px' }}>
                                                            {isLocked ? (
                                                                <span className="badge rounded-pill px-3 py-2 fw-semibold d-inline-flex align-items-center gap-1"
                                                                    style={{ background: S_BG[cur], color: S_COLOR[cur], border: `1.5px solid ${S_COLOR[cur]}55`, fontSize: '0.8rem' }}>
                                                                    <i className={`bi ${S_ICON[cur]}`} />
                                                                    <span className="ms-1">{cur}</span>
                                                                </span>
                                                            ) : (
                                                                <div className="btn-group">
                                                                    {STATUS_OPTS.map(opt => (
                                                                        <button key={opt} type="button"
                                                                            onClick={() => setStatuses(p => ({ ...p, [e.employee_id]: opt }))}
                                                                            className="btn btn-sm fw-semibold"
                                                                            style={{ padding: '3px 10px', fontSize: '0.75rem', background: cur === opt ? S_COLOR[opt] : S_BG[opt], border: `1.5px solid ${cur === opt ? S_COLOR[opt] : '#dee2e6'}`, color: cur === opt ? '#fff' : S_COLOR[opt], transition: 'all 0.15s' }}>
                                                                            <i className={`bi ${S_ICON[opt]}`} style={{ fontSize: '0.72rem' }} />
                                                                            <span className="d-none d-sm-inline ms-1">{opt}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </td>
                                                        {/* PER-ROW LOCK BUTTON */}
                                                        <td style={{ padding: '6px 12px', width: 48 }}>
                                                            <button
                                                                onClick={() => toggleLock(e.employee_id)}
                                                                title={isLocked ? 'Unlock row' : 'Lock row'}
                                                                className="btn btn-sm d-flex align-items-center justify-content-center"
                                                                style={{ width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${isLocked ? '#e13232' : '#dee2e6'}`, background: isLocked ? '#fde8e8' : '#f8f9fa', color: isLocked ? '#e13232' : '#adb5bd', transition: 'all 0.15s', padding: 0, cursor: 'pointer' }}>
                                                                <i className={`bi ${isLocked ? 'bi-lock-fill' : 'bi-unlock'}`} style={{ fontSize: '0.88rem' }} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}

                        {/* SAVE FOOTER */}
                        <div className="card border-0 shadow-sm rounded-4 animate__animated animate__fadeInUp">
                            <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-3 p-3 p-md-4">
                                <div className="d-flex gap-3 flex-wrap align-items-center">
                                    {STATUS_OPTS.map(s => (
                                        <span key={s} style={{ fontSize: '0.82rem', color: S_COLOR[s], fontWeight: 700 }}>
                                            <i className={`bi ${S_ICON[s]} me-1`} style={{ fontSize: '0.72rem' }} />{counts[s]} {s}
                                        </span>
                                    ))}
                                    {unlockedCount > 0 && (
                                        <span className="badge rounded-pill px-2 py-1" style={{ background: '#fff3cd', color: '#856404', fontSize: '0.75rem', border: '1px solid #ffc10766' }}>
                                            <i className="bi bi-unlock me-1" />{unlockedCount} unlocked
                                        </span>
                                    )}
                                </div>
                                {hasPermission('attendance', 'write') && (
                                    <button className="btn fw-bold px-4 rounded-3" onClick={saveAttendance}
                                        disabled={saving || (allSaved && !canEditLocked)}
                                        style={{ background: (allSaved && !canEditLocked) ? '#adb5bd' : 'var(--accent-orange)', color: '#fff', border: 'none', boxShadow: (allSaved && !canEditLocked) ? 'none' : '0 4px 14px rgba(254,127,45,0.4)', cursor: (allSaved && !canEditLocked) ? 'not-allowed' : 'pointer' }}>
                                        {saving
                                            ? <><span className="spinner-border spinner-border-sm me-2" />Saving…</>
                                            : (allSaved && !canEditLocked)
                                                ? <><i className="bi bi-lock-fill me-2" />Locked</>
                                                : <><i className="bi bi-cloud-check-fill me-2" />Save Attendance ({total})</>
                                        }
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* EMPTY */}
                {!staff.length && !loading && (
                    <div className="card border-0 shadow-sm rounded-4 text-center animate__animated animate__fadeIn">
                        <div className="card-body py-5">
                            <div className="mx-auto rounded-4 d-flex align-items-center justify-content-center mb-3"
                                style={{ width: 80, height: 80, background: 'rgba(33,94,97,0.08)' }}>
                                <i className="bi bi-person-badge fs-1" style={{ color: 'var(--primary-teal)' }} />
                            </div>
                            <h5 className="fw-bold mb-2" style={{ color: 'var(--primary-dark)' }}>Ready to Mark Staff Attendance</h5>
                            <p className="text-muted mb-0" style={{ maxWidth: 320, margin: '0 auto' }}>Select a department (optional) and date, then click <strong>Load Attendance</strong>.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}