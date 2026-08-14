'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function EmployeeProfile() {
    const { id } = useParams();
    const router = useRouter();
    const { hasPermission } = useAuth();
    const [employee, setEmployee] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    // Attendance
    const now = new Date();
    const [attMonth, setAttMonth] = useState(String(now.getMonth() + 1));
    const [attYear, setAttYear] = useState(String(now.getFullYear()));
    const [attRecords, setAttRecords] = useState<any[]>([]);
    const [attStats, setAttStats] = useState<any>({ present: 0, absent: 0, late: 0, leave: 0, total: 0 });
    const [attLoading, setAttLoading] = useState(false);

    const fetchAttendance = async (m?: string, y?: string) => {
        setAttLoading(true);
        try {
            const month = m || attMonth;
            const year = y || attYear;
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/attendance/staff/${id}/history?month=${month}&year=${year}`);
            if (res.ok) {
                const data = await res.json();
                setAttRecords(data.records || []);
                setAttStats(data.stats || {});
            }
        } catch { }
        setAttLoading(false);
    };

    useEffect(() => { fetchEmployee(); }, [id]);

    const fetchEmployee = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/hrm/employees/${id}`);
            if (res.ok) {
                setEmployee(await res.json());
            } else {
                alert('Employee not found');
                router.push('/hrm/employees');
            }
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const toggleStatus = async () => {
        const newStatus = employee.status === 'Active' ? 'Inactive' : 'Active';
        if (!confirm(`Mark this employee as ${newStatus}?`)) return;
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/hrm/employees/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) fetchEmployee();
            else alert('Failed to update status');
        } catch { alert('Error updating status'); }
    };

    const handleChangePassword = async () => {
        const newPwd = prompt('Enter new password for this employee:');
        if (!newPwd) return;
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/users/${employee.user_id}/password`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPwd }),
            });
            if (res.ok) alert('Password updated successfully');
            else alert('Failed to update password');
        } catch { alert('Error changing password'); }
    };

    // ─── Loading / Not Found ──────────────────────────────────────────────────
    if (loading) return (
        <div className="d-flex justify-content-center align-items-center vh-100">
            <div className="spinner-border text-primary" role="status"></div>
        </div>
    );
    if (!employee) return <div className="p-5 text-center">Employee not found</div>;

    const initials = `${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`.toUpperCase();
    const fmt = (n: any) => n
        ? new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(parseFloat(n))
        : '—';

    const InfoRow = ({ icon, label, value }: { icon: string; label: string; value?: any }) => (
        <div className="d-flex align-items-start mb-3">
            <div className="me-3 text-secondary pt-1" style={{ width: '22px', flexShrink: 0 }}>
                <i className={`bi ${icon} fs-5`}></i>
            </div>
            <div>
                <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>{label}</small>
                <div className="fw-medium text-dark">{value || 'N/A'}</div>
            </div>
        </div>
    );

    return (
        <div className="bg-light min-vh-100">

            {/* ── HERO BANNER ─────────────────────────────────────────────── */}
            <div className="position-relative" style={{ height: '260px', background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-teal) 100%)' }}>
                <div className="position-absolute top-0 start-0 w-100 h-100 opacity-10"
                    style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                <div className="container-fluid px-4 position-relative h-100">
                    <button className="btn btn-outline-light position-absolute top-0 start-0 m-4 rounded-circle"
                        style={{ width: '40px', height: '40px', padding: 0 }}
                        onClick={() => router.push('/hrm/employees')}>
                        <i className="bi bi-arrow-left"></i>
                    </button>

                    <div className="d-flex flex-column justify-content-end h-100 pb-5 ps-2">
                        <div className="d-flex align-items-end gap-4" style={{ marginBottom: '-55px' }}>
                            {/* Initials avatar */}
                            <div className="position-relative flex-shrink-0">
                                <div className="rounded-circle border border-4 border-white shadow-lg d-flex align-items-center justify-content-center fw-bold text-white"
                                    style={{ width: '130px', height: '130px', fontSize: '2.8rem', background: 'var(--primary-dark)' }}>
                                    {initials}
                                </div>
                                <span className="position-absolute bottom-0 end-0 border border-3 border-white rounded-circle"
                                    style={{ width: '22px', height: '22px', background: employee.status === 'Active' ? '#198754' : '#6c757d' }}></span>
                            </div>

                            {/* Name / role */}
                            <div className="mb-5 text-white animate__animated animate__fadeInUp">
                                <h1 className="fw-bold mb-1 fs-3">{employee.first_name} {employee.last_name}</h1>
                                <div className="d-flex flex-wrap gap-2 align-items-center" style={{ opacity: 0.85 }}>
                                    <span className="badge bg-white bg-opacity-20 border border-white border-opacity-25">
                                        <i className="bi bi-briefcase me-1"></i>{employee.designation || 'Employee'}
                                    </span>
                                    {employee.department_name && (
                                        <span className="badge bg-white bg-opacity-20 border border-white border-opacity-25">
                                            <i className="bi bi-diagram-3 me-1"></i>{employee.department_name}
                                        </span>
                                    )}
                                    <span className={`badge ${employee.status === 'Active' ? 'bg-success' : 'bg-secondary'}`}>
                                        {employee.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── CONTENT ──────────────────────────────────────────────────── */}
            <div className="container-fluid px-4 pt-5 mt-4 pb-5">
                <div className="row g-4 emp-info-grid">

                    {/* ── LEFT SIDEBAR ───────────────────────────────────────── */}
                    <div className="col-lg-3 animate__animated animate__fadeInLeft">

                        {/* Quick Info */}
                        <div className="card border-0 shadow-sm rounded-4 mb-3">
                            <div className="card-body p-4">
                                <h6 className="fw-bold text-uppercase text-muted mb-4 small" style={{ letterSpacing: '1px' }}>Quick Info</h6>

                                {/* System Username */}
                                <div className="d-flex align-items-start mb-3">
                                    <div className="me-3 text-secondary pt-1" style={{ width: '22px', flexShrink: 0 }}>
                                        <i className="bi bi-person-badge fs-5"></i>
                                    </div>
                                    <div className="flex-grow-1">
                                        <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>System Username</small>
                                        {employee.system_username ? (
                                            <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
                                                <span className="font-monospace bg-light border px-2 py-1 rounded small text-primary">
                                                    {employee.system_username}
                                                </span>
                                                {hasPermission('hrm', 'write') && (
                                                    <button className="btn btn-sm text-warning p-0" title="Reset Password" onClick={handleChangePassword}>
                                                        <i className="bi bi-key-fill fs-6"></i>
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="badge bg-secondary bg-opacity-10 text-secondary border mt-1">No Account</span>
                                        )}
                                    </div>
                                </div>

                                <InfoRow icon="bi-telephone" label="Phone" value={employee.phone} />
                                <InfoRow icon="bi-envelope" label="Email" value={employee.email} />
                                <InfoRow icon="bi-phone" label="Emergency Contact" value={employee.emergency_contact} />
                                <InfoRow icon="bi-droplet" label="Blood Group" value={employee.blood_group} />
                                <InfoRow icon="bi-calendar-event" label="Joining Date" value={employee.joining_date ? employee.joining_date.substring(0, 10) : null} />

                                <hr className="text-secondary opacity-25" />
                                <div className="d-grid gap-2">
                                    <button className="btn btn-primary" style={{ background: 'var(--primary-dark)', border: 'none' }}
                                        onClick={() => router.push(`/hrm/employees`)}>
                                        <i className="bi bi-pencil-square me-2"></i>Edit Profile
                                    </button>
                                    <button className={`btn btn-outline-${employee.status === 'Active' ? 'danger' : 'success'}`} onClick={toggleStatus}>
                                        <i className={`bi bi-${employee.status === 'Active' ? 'slash-circle' : 'check-circle'} me-2`}></i>
                                        {employee.status === 'Active' ? 'Deactivate / Resign' : 'Re-Activate / Join'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Salary card */}
                        <div className="card border-0 shadow-sm rounded-4 bg-white">
                            <div className="card-body p-4 text-center">
                                <div className="rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center bg-success bg-opacity-10 text-success"
                                    style={{ width: '56px', height: '56px' }}>
                                    <i className="bi bi-wallet2 fs-3"></i>
                                </div>
                                <div className="small text-muted text-uppercase mb-1" style={{ letterSpacing: '1px' }}>Monthly Salary</div>
                                <h3 className="fw-bold text-dark mb-1">{fmt(employee.salary)}</h3>
                                <span className="badge bg-success bg-opacity-10 text-success border border-success">PKR</span>
                            </div>
                        </div>
                    </div>

                    {/* ── MAIN CONTENT ───────────────────────────────────────── */}
                    <div className="col-lg-9 animate__animated animate__fadeInUp">
                        <div className="card border-0 shadow-sm rounded-4 overflow-hidden" style={{ minHeight: '600px' }}>

                            {/* Tab nav */}
                            <div className="card-header bg-white border-bottom p-0">
                                <ul className="nav nav-tabs nav-fill" role="tablist">
                                    {[
                                        { key: 'overview', icon: 'bi-person-lines-fill', label: 'Overview' },
                                        { key: 'attendance', icon: 'bi-calendar-check', label: 'Attendance' },
                                    ].map(tab => (
                                        <li className="nav-item" key={tab.key}>
                                            <button
                                                className={`nav-link py-3 fw-bold border-0 rounded-0 ${activeTab === tab.key ? 'active border-bottom border-primary border-3 text-primary' : 'text-muted'}`}
                                                style={{ fontSize: '0.85rem', letterSpacing: '1px' }}
                                                onClick={() => {
                                                    setActiveTab(tab.key);
                                                    if (tab.key === 'attendance' && attRecords.length === 0) fetchAttendance();
                                                }}>
                                                <i className={`bi ${tab.icon} me-2`}></i>{tab.label}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="card-body p-4 p-lg-5 bg-light bg-opacity-50">

                                {/* ── OVERVIEW TAB ──────────────────────── */}
                                {activeTab === 'overview' && (
                                    <div className="animate__animated animate__fadeIn">

                                        <h5 className="fw-bold mb-4 text-dark border-start border-4 border-primary ps-3">Personal Details</h5>
                                        <div className="row g-4 mb-4">
                                            <div className="col-md-6">
                                                <div className="bg-white p-4 rounded-4 shadow-sm h-100">
                                                    <InfoRow icon="bi-person" label="Father / Husband Name" value={employee.father_name} />
                                                    <InfoRow icon="bi-gender-ambiguous" label="Gender" value={employee.gender} />
                                                    <InfoRow icon="bi-calendar-event" label="Date of Birth" value={employee.dob ? employee.dob.substring(0, 10) : null} />
                                                    <InfoRow icon="bi-heart" label="Marital Status" value={employee.marital_status} />
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div className="bg-white p-4 rounded-4 shadow-sm h-100">
                                                    <InfoRow icon="bi-credit-card-2-front" label="CNIC" value={employee.cnic} />
                                                    <InfoRow icon="bi-droplet" label="Blood Group" value={employee.blood_group} />
                                                    <InfoRow icon="bi-geo-alt" label="Address" value={employee.address} />
                                                </div>
                                            </div>
                                        </div>

                                        <h5 className="fw-bold mb-4 text-dark border-start border-4 border-primary ps-3">Job & Qualification</h5>
                                        <div className="row g-4 mb-4">
                                            <div className="col-md-6">
                                                <div className="bg-white p-4 rounded-4 shadow-sm h-100">
                                                    <InfoRow icon="bi-diagram-3" label="Department" value={employee.department_name || 'Unassigned'} />
                                                    <InfoRow icon="bi-briefcase" label="Designation" value={employee.designation} />
                                                    <InfoRow icon="bi-calendar-check" label="Joining Date" value={employee.joining_date ? employee.joining_date.substring(0, 10) : null} />
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div className="bg-white p-4 rounded-4 shadow-sm h-100">
                                                    <InfoRow icon="bi-mortarboard" label="Qualification" value={employee.qualification} />
                                                    <InfoRow icon="bi-clock-history" label="Total Experience" value={employee.experience} />
                                                    <InfoRow icon="bi-wallet2" label="Salary (PKR)" value={employee.salary ? fmt(employee.salary) : null} />
                                                </div>
                                            </div>
                                        </div>

                                        <h5 className="fw-bold mb-4 text-dark border-start border-4 border-primary ps-3">System Access</h5>
                                        <div className="bg-white p-4 rounded-4 shadow-sm">
                                            {employee.system_username ? (
                                                <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                                                    <div className="d-flex align-items-center gap-3">
                                                        <div className="rounded-circle bg-success bg-opacity-10 d-flex align-items-center justify-content-center text-success"
                                                            style={{ width: '48px', height: '48px' }}>
                                                            <i className="bi bi-shield-check fs-4"></i>
                                                        </div>
                                                        <div>
                                                            <div className="fw-bold text-dark">System Account Active</div>
                                                            <div className="small text-muted">
                                                                Username:&nbsp;
                                                                <span className="font-monospace text-primary bg-light border px-2 py-1 rounded ms-1">
                                                                    {employee.system_username}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button className="btn btn-outline-warning btn-sm" onClick={handleChangePassword}>
                                                        <i className="bi bi-key-fill me-2"></i>Reset Password
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="d-flex align-items-center gap-3 text-muted">
                                                    <div className="rounded-circle bg-secondary bg-opacity-10 d-flex align-items-center justify-content-center"
                                                        style={{ width: '48px', height: '48px' }}>
                                                        <i className="bi bi-shield-x fs-4"></i>
                                                    </div>
                                                    <div>
                                                        <div className="fw-bold">No System Account</div>
                                                        <div className="small">Go to <strong>Settings → Users</strong> to create a login for this employee.</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ── ATTENDANCE TAB ────────────────────── */}
                                {activeTab === 'attendance' && (
                                    <div className="animate__animated animate__fadeIn">
                                        {/* Filter */}
                                        <div className="d-flex gap-2 mb-4 align-items-end flex-wrap">
                                            <div>
                                                <label className="form-label fw-bold small text-muted mb-1">Month</label>
                                                <select className="form-select form-select-sm" value={attMonth}
                                                    onChange={e => setAttMonth(e.target.value)} style={{ minWidth: 130 }}>
                                                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((m, i) => (
                                                        <option key={m} value={m}>{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i]}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="form-label fw-bold small text-muted mb-1">Year</label>
                                                <select className="form-select form-select-sm" value={attYear}
                                                    onChange={e => setAttYear(e.target.value)} style={{ minWidth: 90 }}>
                                                    {[String(now.getFullYear() - 1), String(now.getFullYear()), String(now.getFullYear() + 1)].map(y => (
                                                        <option key={y} value={y}>{y}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <button className="btn btn-sm" onClick={() => fetchAttendance()}
                                                style={{ background: 'var(--primary-teal)', color: '#fff', borderRadius: 6 }}>
                                                {attLoading
                                                    ? <span className="spinner-border spinner-border-sm me-1" />
                                                    : <i className="bi bi-search me-1" />}
                                                Load
                                            </button>
                                        </div>

                                        {/* Stats */}
                                        <div className="row g-2 mb-4">
                                            {[
                                                { l: 'Present', v: attStats.present, c: '#198754' },
                                                { l: 'Absent', v: attStats.absent, c: '#dc3545' },
                                                { l: 'Late', v: attStats.late, c: '#fd7e14' },
                                                { l: 'Leave', v: attStats.leave, c: '#0d6efd' },
                                                { l: 'Total', v: attStats.total, c: '#6c757d' },
                                            ].map(s => (
                                                <div className="col" key={s.l}>
                                                    <div className="card border-0 shadow-sm text-center py-2 rounded-3"
                                                        style={{ borderTop: `3px solid ${s.c}` }}>
                                                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.c }}>{s.v ?? 0}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>{s.l}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Progress bar */}
                                        {attStats.total > 0 && (
                                            <div className="mb-3">
                                                <div className="progress" style={{ height: 8, borderRadius: 8 }}>
                                                    <div className="progress-bar bg-success"
                                                        style={{ width: `${Math.round(((attStats.present + attStats.late) / attStats.total) * 100)}%`, borderRadius: 8 }} />
                                                </div>
                                                <div className="small text-muted mt-1 text-end">
                                                    Attendance: {Math.round(((attStats.present + attStats.late) / attStats.total) * 100)}%
                                                </div>
                                            </div>
                                        )}

                                        {attRecords.length > 0 ? (
                                            <div className="bg-white rounded-4 shadow-sm">
                                                <div className="table-responsive">
                                                    <table className="table table-hover table-sm align-middle mb-0">
                                                        <thead style={{ background: 'var(--primary-dark)', color: '#fff' }}>
                                                            <tr>
                                                                <th className="ps-3">#</th><th>Date</th><th>Day</th><th>Status</th>
                                                                <th>Check In</th><th>Check Out</th><th>Remarks</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {attRecords.map((r: any, i: number) => {
                                                                const d = new Date(r.attendance_date);
                                                                const clr: Record<string, string> = { Present: '#198754', Absent: '#dc3545', Late: '#fd7e14', Leave: '#0d6efd' };
                                                                return (
                                                                    <tr key={r.attendance_id}>
                                                                        <td className="ps-3 text-muted small">{i + 1}</td>
                                                                        <td className="fw-medium">{d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                                        <td className="text-muted small">{d.toLocaleDateString('en-PK', { weekday: 'short' })}</td>
                                                                        <td>
                                                                            <span className="badge rounded-pill px-3"
                                                                                style={{ background: (clr[r.status] || '#6c757d') + '20', color: clr[r.status] || '#6c757d', border: `1px solid ${clr[r.status] || '#6c757d'}`, fontWeight: 700 }}>
                                                                                {r.status}
                                                                            </span>
                                                                        </td>
                                                                        <td className="small">{r.check_in_time ? r.check_in_time.substring(0, 5) : '—'}</td>
                                                                        <td className="small">{r.check_out_time ? r.check_out_time.substring(0, 5) : '—'}</td>
                                                                        <td className="text-muted small">{r.remarks || '—'}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ) : !attLoading ? (
                                            <div className="text-center py-5 text-muted">
                                                <i className="bi bi-calendar-x fs-1 opacity-50"></i>
                                                <p className="mt-2 mb-0">No attendance data found</p>
                                                <small>Select month &amp; year and click Load</small>
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
