'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { notify } from '@/app/utils/notify';

interface ClassItem { class_id: number; class_name: string; }
interface SectionItem { section_id: number; section_name: string; class_id: number; }
interface StudentRow {
  student_id: number; first_name: string; last_name: string;
  admission_no: string; roll_no: string | null;
  status: string | null; remarks: string; attendance_id: number | null;
}

const STATUS_OPTS = ['Present', 'Absent', 'Leave'] as const;
type StatusType = typeof STATUS_OPTS[number];

const S_COLOR: Record<StatusType, string> = {
  Present: '#0d9e6e', Absent: '#e13232', Leave: '#1a6fd4'
};
const S_BG: Record<StatusType, string> = {
  Present: '#e6f9f3', Absent: '#fde8e8', Leave: '#e8f0fd'
};
const S_ICON: Record<StatusType, string> = {
  Present: 'bi-check-circle-fill', Absent: 'bi-x-circle-fill', Leave: 'bi-calendar2-x-fill'
};

export default function StudentAttendancePage() {
  const today = new Date().toISOString().split('T')[0];
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [date, setDate] = useState(today);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [statuses, setStatuses] = useState<Record<number, string>>({});
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const { hasPermission, user } = useAuth();

  const isAdmin = (user?.role_level || 0) >= 90;
  const canEditLocked = isAdmin || hasPermission('attendance.edit_locked', 'write');
  const canMarkAdvance = isAdmin || hasPermission('attendance.mark_advance', 'write');

  useEffect(() => {
    const loadMeta = async () => {
      const API = process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com";
      if (!user?.id) return;

      try {

        const res = await fetch(`${API}/exams/context/class-teacher?user_id=${user.id}`);
        const data = await res.json();

        if (Array.isArray(data.classes)) setClasses(data.classes);
        if (Array.isArray(data.sections)) setSections(data.sections);
      } catch {
        // keep existing empty state if loading fails
      }
    };

    loadMeta();
  }, [user?.id]);

  const loadAttendance = useCallback(async () => {
    if (!classId || !sectionId || !date) return;
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/attendance/students/daily?class_id=${classId}&section_id=${sectionId}&date=${date}&user_id=${user?.id}`);
      const data = await res.json();
      if (!Array.isArray(data)) { notify.error('Failed to load students'); setLoading(false); return; }
      setStudents(data);

      const alreadyMarked = data.some(s => s.attendance_id);
      setIsLocked(alreadyMarked && !canEditLocked);

      const st: Record<number, string> = {};
      const rm: Record<number, string> = {};
      data.forEach((s: StudentRow) => { st[s.student_id] = s.status || 'Present'; rm[s.student_id] = s.remarks || ''; });
      setStatuses(st); setRemarks(rm);
      if (alreadyMarked && !canEditLocked) {
        notify.warning('Attendance is locked for editing.');
      }
    } catch { notify.error('Server error'); }
    setLoading(false);
  }, [classId, sectionId, date, canEditLocked]);

  const markAll = (status: string) => {
    if (isLocked) return;
    const u: Record<number, string> = {};
    students.forEach(s => { u[s.student_id] = status; });
    setStatuses(p => ({ ...p, ...u }));
  };

  const saveAttendance = async () => {
    if (isLocked || !classId || !sectionId || !date || !students.length) return;
    setSaving(true);
    try {
      const records = students.map(s => ({
        student_id: s.student_id,
        status: statuses[s.student_id] || 'Present',
        remarks: remarks[s.student_id] || ''
      }));
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/attendance/students/daily`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_id: classId, section_id: sectionId, date, records, user_id: user?.id })
      });
      const d = await res.json();
      if (res.ok) notify.success(`Attendance saved for ${students.length} students!`);
      else notify.error(d.error || 'Save failed');
    } catch { notify.error('Server error'); }
    setSaving(false);
  };

  const counts = STATUS_OPTS.reduce((a, s) => {
    a[s] = students.filter(st => (statuses[st.student_id] || 'Present') === s).length;
    return a;
  }, {} as Record<string, number>);

  const total = students.length;
  const pct = total ? Math.round(((counts.Present) / total) * 100) : 0;
  const cls = classes.find(c => String(c.class_id) === classId);
  const sec = sections.find(s => String(s.section_id) === sectionId);
  const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const classSections = sections.filter(s => String(s.class_id) === String(classId));

  // Auto-select section if only one exists for the class; reset when class changes
  useEffect(() => {
    if (!classId) {
      setSectionId('');
      return;
    }

    if (classSections.length === 1 && !sectionId) {
      setSectionId(String(classSections[0].section_id));
    } else if (classSections.length > 1) {
      setSectionId('');
    }
  }, [classId, classSections.length]);

  return (
    <div className="container-fluid px-3 px-md-4 py-3 animate__animated animate__fadeIn">

      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h2 className="fw-bold mb-1" style={{ color: 'var(--primary-dark)' }}>
            <i className="bi bi-calendar-check-fill me-2" style={{ color: 'var(--accent-orange)' }} /> Student Attendance
          </h2>
          <p className="text-muted mb-0 small">Mark daily attendance &amp; track records</p>
        </div>
        {students.length > 0 && (
          <div className="d-flex flex-wrap gap-2">
            {STATUS_OPTS.map(s => (
              <button key={s} onClick={() => markAll(s)} disabled={isLocked}
                className="btn btn-sm fw-semibold"
                style={{ background: S_BG[s], border: `1.5px solid ${S_COLOR[s]}`, color: S_COLOR[s], borderRadius: 8, fontSize: '0.78rem', opacity: isLocked ? 0.5 : 1 }}>
                <i className={`bi ${S_ICON[s]} me-1`} />All {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>

        {/* ===== FILTER CARD ===== */}
        <div className="card border-0 shadow-sm rounded-4 mb-4 animate__animated animate__fadeInUp">
          <div className="card-body p-3 p-md-4">
            <div className="row g-3 align-items-end">
              <div className="col-md-3">
                <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--primary-dark)', letterSpacing: '0.05em' }}>
                  <i className="bi bi-mortarboard me-1" style={{ color: 'var(--primary-teal)' }} />Class
                </label>
                <select className="form-select rounded-3" value={classId} onChange={e => { setClassId(e.target.value); setSectionId(''); }}
                  style={{ border: '1.5px solid #dee2e6', height: 42 }}>
                  <option value="">— Select Class —</option>
                  {classes.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--primary-dark)', letterSpacing: '0.05em' }}>
                  <i className="bi bi-diagram-2 me-1" style={{ color: 'var(--primary-teal)' }} />Section
                </label>
                <select className="form-select rounded-3" value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={!classId}
                  style={{ border: '1.5px solid #dee2e6', height: 42 }}>
                  <option value="">— Select Section —</option>
                  {classSections.map(s => <option key={s.section_id} value={String(s.section_id)}>{s.section_name}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--primary-dark)', letterSpacing: '0.05em' }}>
                  <i className="bi bi-calendar3 me-1" style={{ color: 'var(--primary-teal)' }} />Date
                </label>
                <input type="date" className="form-control rounded-3" value={date} max={canMarkAdvance ? undefined : today}
                  onChange={e => setDate(e.target.value)} style={{ border: '1.5px solid #dee2e6', height: 42 }} />
              </div>
              <div className="col-md-3">
                <button className="btn btn-primary-custom w-100 fw-bold rounded-3" style={{ height: 42 }}
                  onClick={loadAttendance} disabled={!classId || !sectionId || loading}>
                  {loading
                    ? <><span className="spinner-border spinner-border-sm me-2" />Loading...</>
                    : <><i className="bi bi-arrow-repeat me-2" />Load Attendance</>}
                </button>
              </div>
            </div>
          </div>
        </div>

        {students.length > 0 && (
          <>
            {/* ===== STAT CARDS ===== */}
            <div className="row g-3 mb-4">
              {STATUS_OPTS.map((s, i) => (
                <div key={s} className="col-12 col-md-4">
                  <div className={`card border-0 shadow-sm rounded-4 h-100 animate__animated animate__fadeInUp`}
                    style={{ animationDelay: `${i * 0.07}s`, borderBottom: `4px solid ${S_COLOR[s]}`, background: '#fff' }}>
                    <div className="card-body d-flex align-items-center gap-3 p-3">
                      <div className="d-flex align-items-center justify-content-center rounded-3"
                        style={{ width: 48, height: 48, background: S_BG[s], flexShrink: 0 }}>
                        <i className={`bi ${S_ICON[s]} fs-4`} style={{ color: S_COLOR[s] }} />
                      </div>
                      <div>
                        <div className="fw-bold" style={{ fontSize: '1.75rem', lineHeight: 1, color: S_COLOR[s] }}>{counts[s]}</div>
                        <div className="text-muted" style={{ fontSize: '0.76rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s}</div>
                        <div style={{ fontSize: '0.72rem', color: '#adb5bd' }}>{total ? Math.round((counts[s] / total) * 100) : 0}% of class</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ===== PROGRESS BAR ===== */}
            <div className="card border-0 shadow-sm rounded-4 mb-4 animate__animated animate__fadeInUp">
              <div className="card-body p-3 px-3 px-md-4">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                  <div className="fw-semibold" style={{ color: 'var(--primary-dark)', fontSize: '0.88rem' }}>
                    <i className="bi bi-bar-chart-fill me-2" style={{ color: 'var(--accent-orange)' }} />
                    {cls?.class_name} {sec ? `— ${sec.section_name}` : ''} &nbsp;·&nbsp; <span style={{ color: 'var(--primary-teal)' }}>{date ? fmtDate(date) : ''}</span>
                  </div>
                  <span className="badge rounded-pill px-3 py-2 fw-bold"
                    style={{ background: pct >= 75 ? '#0d9e6e' : pct >= 50 ? '#e6860a' : '#e13232', fontSize: '0.85rem' }}>
                    {pct}% Present
                  </span>
                </div>
                <div className="progress rounded-pill" style={{ height: 10 }}>
                  <div className="progress-bar" role="progressbar" style={{
                    width: `${pct}%`, borderRadius: 100,
                    background: `linear-gradient(90deg, var(--primary-teal), #34d399)`, transition: 'width 0.8s ease'
                  }} />
                </div>
                <div className="d-flex flex-wrap gap-3 mt-2">
                  {STATUS_OPTS.map(s => (
                    <small key={s} style={{ color: S_COLOR[s], fontWeight: 600 }}>
                      <span className="me-1" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: S_COLOR[s] }} />
                      {counts[s]} {s}
                    </small>
                  ))}
                  <small className="ms-auto text-muted">{total} students total</small>
                </div>
              </div>
            </div>

            {/* ===== TABLE ===== */}
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden animate__animated animate__fadeInUp">
              <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center flex-wrap gap-2 px-3 px-md-4 py-3">
                <span className="fw-bold" style={{ color: 'var(--primary-dark)' }}>
                  <i className="bi bi-people-fill me-2" style={{ color: 'var(--accent-orange)' }} />
                  {total} Students {cls?.class_name} {sec ? `(${sec.section_name})` : ''}
                </span>
                <span className="badge" style={{ background: 'rgba(33,94,97,0.1)', color: 'var(--primary-teal)', fontWeight: 600, fontSize: '0.78rem', padding: '5px 12px', borderRadius: 8 }}>
                  <i className="bi bi-calendar3 me-1" />{date ? fmtDate(date) : ''}
                </span>
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead style={{ background: 'var(--primary-dark)' }}>
                    <tr>
                      {['#', 'Student', 'Roll', 'Attendance Status', 'Remarks'].map(h => (
                        <th key={h} className="fw-semibold border-0"
                          style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, idx) => {
                      const cur = (statuses[s.student_id] || 'Present') as StatusType;
                      return (
                        <tr key={s.student_id}
                          style={{
                            background: cur === 'Absent' ? '#fff8f8' : cur === 'Leave' ? '#f5f8ff' : '#fff',
                            borderLeft: `3px solid ${S_COLOR[cur]}`, transition: 'background 0.2s'
                          }}>
                          <td className="text-muted ps-4" style={{ fontSize: '0.82rem', width: 50 }}>
                            <span className="badge rounded-circle text-bg-secondary" style={{ width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem' }}>{idx + 1}</span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div className="d-flex align-items-center gap-2">
                              <div className="d-flex align-items-center justify-content-center rounded-circle fw-bold text-white"
                                style={{ width: 34, height: 34, background: `linear-gradient(135deg,var(--primary-dark),var(--primary-teal))`, fontSize: '0.75rem', flexShrink: 0 }}>
                                {s.first_name[0]}{s.last_name[0]}
                              </div>
                              <span className="fw-semibold" style={{ color: 'var(--primary-dark)', fontSize: '0.9rem' }}>{s.first_name} {s.last_name}</span>
                            </div>
                          </td>
                          <td className="text-muted" style={{ fontSize: '0.85rem' }}>{s.roll_no || '—'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div className="btn-group" role="group">
                              {STATUS_OPTS.map(opt => (
                                <button key={opt} type="button" disabled={isLocked}
                                  onClick={() => setStatuses(p => ({ ...p, [s.student_id]: opt }))}
                                  className="btn btn-sm fw-semibold"
                                  style={{
                                    padding: '4px 12px', fontSize: '0.78rem',
                                    background: cur === opt ? S_COLOR[opt] : S_BG[opt],
                                    border: `1.5px solid ${cur === opt ? S_COLOR[opt] : '#dee2e6'}`,
                                    color: cur === opt ? '#fff' : S_COLOR[opt],
                                    transition: 'all 0.15s',
                                    opacity: isLocked && cur !== opt ? 0.5 : 1
                                  }}>
                                  <i className={`bi ${S_ICON[opt]}`} style={{ fontSize: '0.72rem' }} />
                                  <span className="d-none d-sm-inline ms-1">{opt}</span>
                                </button>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', minWidth: 180 }}>
                            <input type="text" className="form-control form-control-sm rounded-3"
                              placeholder="Add remark…" disabled={isLocked}
                              value={remarks[s.student_id] || ''}
                              onChange={e => setRemarks(p => ({ ...p, [s.student_id]: e.target.value }))}
                              style={{ border: '1.5px solid #e9ecef', fontSize: '0.82rem' }} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Footer */}
              <div className="card-footer bg-white border-0 d-flex flex-wrap justify-content-between align-items-center gap-3 px-3 px-md-4 py-3">
                <div className="d-flex gap-3 flex-wrap">
                  {STATUS_OPTS.map(s => (
                    <span key={s} style={{ fontSize: '0.8rem', color: S_COLOR[s], fontWeight: 700 }}>
                      <i className={`bi ${S_ICON[s]} me-1`} style={{ fontSize: '0.7rem' }} />{counts[s]} {s}
                    </span>
                  ))}
                </div>
                {hasPermission('attendance', 'write') && (
                  <button className="btn fw-bold px-4 rounded-3" onClick={saveAttendance} disabled={saving || isLocked}
                    style={{ background: isLocked ? '#adb5bd' : 'var(--accent-orange)', color: '#fff', border: 'none', boxShadow: isLocked ? 'none' : '0 4px 14px rgba(254,127,45,0.4)', transition: 'opacity 0.2s', cursor: isLocked ? 'not-allowed' : 'pointer' }}>
                    {saving
                      ? <><span className="spinner-border spinner-border-sm me-2" />Saving…</>
                      : isLocked ? <><i className="bi bi-lock-fill me-2" />Locked</> : <><i className="bi bi-cloud-check-fill me-2" />Save Attendance</>}
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* ===== EMPTY STATE ===== */}
        {!students.length && !loading && (
          <div className="card border-0 shadow-sm rounded-4 text-center py-5 animate__animated animate__fadeIn">
            <div className="card-body py-5">
              <div className="mx-auto rounded-4 d-flex align-items-center justify-content-center mb-3"
                style={{ width: 80, height: 80, background: 'rgba(33,94,97,0.08)' }}>
                <i className="bi bi-calendar-check fs-1" style={{ color: 'var(--primary-teal)' }} />
              </div>
              <h5 className="fw-bold mb-2" style={{ color: 'var(--primary-dark)' }}>Ready to Mark Attendance</h5>
              <p className="text-muted mb-0" style={{ maxWidth: 320, margin: '0 auto' }}>
                Select a class, section AND date, then click <strong>Load Attendance</strong> to begin.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
