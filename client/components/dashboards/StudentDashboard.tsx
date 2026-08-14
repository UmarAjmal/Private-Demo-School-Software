'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { notify } from '@/app/utils/notify';
import { useAuth } from '@/contexts/AuthContext';
import { API } from './shared';
import { NotificationBell } from '../notifications/NotificationBell';
import { OfflineStorage } from '@/utils/offlineStorage';
import { apiCache } from '@/utils/apiCache';

export default function StudentDashboard({ user }: { user: any }) {
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [initError, setInitError] = useState('');
    const [student, setStudent] = useState<any>(null);
    const [siblings, setSiblings] = useState<any[]>([]);
    const [loadingSiblings, setLoadingSiblings] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const router = useRouter();
    const { hasPermission } = useAuth();

    // Auth related
    const [changePwdModalOpen, setChangePwdModalOpen] = useState(false);
    const [newAdminPwd, setNewAdminPwd] = useState('');
    const [isChangingPwd, setIsChangingPwd] = useState(false);
    const [showPwd, setShowPwd] = useState(false);

    // Attendance states
    const now = new Date();
    const [attMonth, setAttMonth] = useState(String(now.getMonth() + 1));
    const [attYear, setAttYear] = useState(String(now.getFullYear()));
    const [attRecords, setAttRecords] = useState<any[]>([]);
    const [attStats, setAttStats] = useState<any>({ present: 0, absent: 0, late: 0, leave: 0, total: 0 });
    const [attLoading, setAttLoading] = useState(false);

    // Academic performance states
    const [acad, setAcad] = useState<any>(null);
    const [acadLoading, setAcadLoading] = useState(false);
    const [acadTab, setAcadTab] = useState<'terms' | 'tests' | 'prediction'>('terms');

    const fetchAttendance = async (m?: string, y?: string) => {
        setAttLoading(true);
        try {
            const month = m || attMonth; const year = y || attYear;
            const res = await fetch(`${API}/attendance/students/${currentId}/history?month=${month}&year=${year}`);
            if (res.ok) { const data = await res.json(); setAttRecords(data.records || []); setAttStats(data.stats || {}); }
        } catch { }
        setAttLoading(false);
    };

    const fetchAcademics = async () => {
        setAcadLoading(true);
        try {
            const res = await fetch(`${API}/exams/student-academics/${currentId}`);
            if (res.ok) { const data = await res.json(); setAcad(data); }
        } catch { }
        setAcadLoading(false);
    };

    // Fee states
    const [admissionFee, setAdmissionFee] = useState<any>(null);
    const [familySlips, setFamilySlips] = useState<any[]>([]);
    const [loadingFamilySlips, setLoadingFamilySlips] = useState(false);
    const [admissionPayments, setAdmissionPayments] = useState<any[]>([]);
    const [loadingFees, setLoadingFees] = useState(false);
    const [showPayModal, setShowPayModal] = useState(false);
    const [payAmt, setPayAmt] = useState('');
    const [payMethod, setPayMethod] = useState('cash');
    const [payRef, setPayRef] = useState('');
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
    const [payError, setPayError] = useState('');
    const [paySuccess, setPaySuccess] = useState('');
    const [payingFee, setPayingFee] = useState(false);

    const fmt = (n: any) => new Intl.NumberFormat('en-PK', {
        style: 'currency', currency: 'PKR', minimumFractionDigits: 0
    }).format(parseFloat(n?.toString() || '0'));

    useEffect(() => {
        if (!user || currentId) return;
        const fetchMe = async () => {
            try {
                const rawUsername = user.username || '';
                const adm = rawUsername.replace(/^STU-/i, '').replace(/^FAM-/i, '');
                
                const res = await fetch(`${API}/students?keyword=${encodeURIComponent(adm || rawUsername)}`);
                if (res.ok) {
                    const data = await res.json();
                    const list = data.rows || data;
                    if (list && list.length > 0) {
                        setCurrentId(String(list[0].student_id));
                        return;
                    }
                }

                if (user.id) {
                    const resUser = await fetch(`${API}/students?user_id=${user.id}`);
                    if (resUser.ok) {
                        const dataUser = await resUser.json();
                        const listUser = dataUser.rows || dataUser;
                        if (listUser && listUser.length > 0) {
                            setCurrentId(String(listUser[0].student_id));
                            return;
                        }
                    }
                }

                setInitError('Profile not found.');
                setLoading(false);
            } catch (e) {
                setInitError('Error finding account');
                setLoading(false);
            }
        };
        fetchMe();
    }, [user, currentId]);

    useEffect(() => {
        if (!currentId) return;
        const fetchStudent = async () => {
            try {
                await apiCache.fetchWithCache(
                    `${API}/students/${currentId}`,
                    (data) => {
                        const s = data.rows ? data.rows[0] : (Array.isArray(data) ? data[0] : data);
                        setStudent(s);
                        OfflineStorage.set(`student_${currentId}`, s);
                        setLoading(false);
                    }
                );
            } catch (err) {
                const cached = OfflineStorage.get(`student_${currentId}`);
                if (cached) setStudent(cached);
                setLoading(false);
            }
        };

        const fetchSiblings = async () => {
            try {
                await apiCache.fetchWithCache(
                    `${API}/students/${currentId}/siblings`,
                    (data) => {
                        setSiblings(data);
                        OfflineStorage.set(`siblings_${currentId}`, data);
                        setLoadingSiblings(false);
                    }
                );
            } catch (err) {
                const cached = OfflineStorage.get(`siblings_${currentId}`);
                if (cached) setSiblings(cached);
                setLoadingSiblings(false);
            }
        };

        fetchStudent();
        fetchSiblings();
        fetchAdmissionFee();
        fetchFamilySlips();
        fetchAcademics();
    }, [currentId]);

    useEffect(() => {
        if (currentId) {
            fetchAttendance(attMonth, attYear);
        }
    }, [currentId, attMonth, attYear]);

    const fetchFamilySlips = async () => {
        if (!currentId) return;
        setLoadingFamilySlips(true);
        try {
            const res = await fetch(`${API}/fee-slips/family-summary/${currentId}`);
            const data = await res.json();
            if (res.ok) setFamilySlips(data.slips || []);
        } catch (e) {
            console.error(e);
        }
        setLoadingFamilySlips(false);
    };

    const fetchAdmissionFee = async () => {
        setLoadingFees(true);
        try {
            const res = await fetch(`${API}/fee-slips/admission-fees/student/${currentId}`);
            if (res.ok) {
                const data = await res.json();
                setAdmissionFee(data.ledger);
                setAdmissionPayments(data.payments || []);
            }
        } catch { }
        finally { setLoadingFees(false); }
    };

    const handleAdmissionPay = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!admissionFee) return;
        setPayingFee(true); setPayError(''); setPaySuccess('');
        try {
            const res = await fetch(`${API}/fee-slips/admission-fees/${admissionFee.ledger_id}/pay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount_paid: payAmt, payment_method: payMethod, reference_no: payRef, payment_date: payDate })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setPaySuccess(data.message);
            setTimeout(() => { setShowPayModal(false); fetchAdmissionFee(); }, 1000);
        } catch (err: any) { setPayError(err.message); }
        finally { setPayingFee(false); }
    };

    const handleToggleStatus = async () => {
        if (!confirm(`Are you sure you want to change status to ${student.status === 'Active' ? 'Inactive' : 'Active'}?`)) return;
        try {
            const newStatus = student.status === 'Active' ? 'Inactive' : 'Active';
            const res = await fetch(`${API}/students/${currentId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                setStudent({ ...student, status: newStatus });
                notify.success(`Status updated to ${newStatus}`);
            } else {
                notify.error('Failed to update status');
            }
        } catch (e) {
            console.error(e);
            notify.error('Error updating status');
        }
    };

    const handleGenerateCredentials = async () => {
        if (!confirm("Generate System Login Credentials for this student?")) return;
        try {
            const res = await fetch(`${API}/students/${currentId}/generate-credentials`, { method: 'PATCH' });
            const data = await res.json();
            if (res.ok) {
                notify.success(`Credentials Created! Username: ${data.username}`);
                setStudent({ ...student, username: data.username });
            } else {
                notify.error(data.error || "Failed");
            }
        } catch (e) { notify.error("Connection Error"); }
    };

    const handleChangePassword = async () => {
        if (!newAdminPwd.trim()) return;
        setIsChangingPwd(true);
        try {
            const res = await fetch(`${API}/students/${currentId}/change-password`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newAdminPwd })
            });
            if (res.ok) {
                notify.success("Password changed successfully");
                setChangePwdModalOpen(false);
                setNewAdminPwd('');
                setStudent({ ...student, system_pwd: newAdminPwd });
            } else {
                const d = await res.json();
                notify.error(d.error || "Failed to change password");
            }
        } catch (e) { notify.error("Connection Error"); }
        finally { setIsChangingPwd(false); }
    };

    // ── Academic helpers ─────────────────────────────────────────────────────
    function gradeColor(grade: string | null): string {
        const map: Record<string, string> = {
            'A+': '#1b5e20', 'A': '#2196f3', 'B': '#4caf50',
            'C': '#ff9800', 'D': '#ff5722', 'F': '#ef5350'
        };
        return map[grade || ''] || '#9e9e9e';
    }

    function gradeLabel(pct: number): string {
        if (pct >= 90) return 'A+';
        if (pct >= 80) return 'A';
        if (pct >= 70) return 'B';
        if (pct >= 60) return 'C';
        if (pct >= 50) return 'D';
        return 'F';
    }

    function GradeBadge({ grade }: { grade: string | null }) {
        const bg: Record<string, string> = {
            'A+': '#1b5e20', 'A': '#2196f3', 'B': '#4caf50',
            'C': '#ff9800', 'D': '#ff5722', 'F': '#ef5350'
        };
        const color = bg[grade || ''] || '#9e9e9e';
        return (
            <span className="badge fw-bold px-2 py-1" style={{ background: color + '20', color, border: `1px solid ${color}55`, borderRadius: 6, fontSize: '0.8rem', minWidth: 32 }}>
                {grade || '—'}
            </span>
        );
    }

    if (initError) return (
        <div className="d-flex justify-content-center align-items-center vh-100 flex-column">
            <i className="bi bi-exclamation-triangle fs-1 text-danger"></i>
            <h4 className="mt-3 text-danger">{initError}</h4>
        </div>
    );

    if (loading || !currentId) return (
        <div className="d-flex justify-content-center align-items-center vh-100">
            <div className="spinner-border text-primary" role="status"></div>
        </div>
    );

    if (!student) return <div className="p-5 text-center">Student not found</div>;

    const InfoRow = ({ icon, label, value }: any) => (
        <div className="d-flex align-items-center mb-3">
            <div className="me-3 text-secondary" style={{ width: '24px' }}>
                <i className={`bi ${icon} fs-5`}></i>
            </div>
            <div>
                <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>{label}</small>
                <div className="fw-medium text-dark">{value || 'N/A'}</div>
            </div>
        </div>
    );

    return (
        <div className="container-fluid p-0 bg-light min-vh-100">
            {/* Change Password Modal */}
            {changePwdModalOpen && (
                <>
                    <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
                    <div className="modal fade show d-block" tabIndex={-1} style={{ zIndex: 1050 }}>
                        <div className="modal-dialog modal-dialog-centered">
                            <div className="modal-content border-0 shadow-lg">
                                <div className="modal-header text-white" style={{ backgroundColor: 'var(--primary-dark)' }}>
                                    <h5 className="modal-title"><i className="bi bi-key-fill me-2"></i>Change Password</h5>
                                    <button className="btn-close btn-close-white" onClick={() => setChangePwdModalOpen(false)}></button>
                                </div>
                                <div className="modal-body p-4">
                                    <div className="mb-3">
                                        <label className="form-label text-secondary small text-uppercase fw-bold">New Password</label>
                                        <input type="text" className="form-control form-control-lg bg-light" value={newAdminPwd} onChange={e => setNewAdminPwd(e.target.value)} placeholder="Type new password" />
                                    </div>
                                    <div className="d-flex justify-content-end gap-2 mt-4">
                                        <button className="btn btn-light px-4" onClick={() => setChangePwdModalOpen(false)}>Cancel</button>
                                        <button className="btn btn-primary px-4" style={{ backgroundColor: 'var(--primary-dark)' }} onClick={handleChangePassword} disabled={isChangingPwd || !newAdminPwd.trim()}>
                                            {isChangingPwd ? <span className="spinner-border spinner-border-sm me-2"></span> : 'Change Password'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* HERO SECTION */}
            <div className="position-relative profile-hero py-4" style={{ background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-teal) 100%)', borderRadius: '0 0 24px 24px' }}>
                <div className="position-absolute top-0 start-0 w-100 h-100 opacity-10"
                    style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                <div className="container position-relative px-3 px-sm-4">
                    {/* Top Header Bar */}
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <button className="btn btn-outline-light rounded-circle shadow-sm" onClick={() => router.back()} style={{ width: 42, height: 42 }}>
                            <i className="bi bi-arrow-left fs-5"></i>
                        </button>
                        <div className="d-flex align-items-center gap-2">
                            <NotificationBell familyId={student?.family_id} studentId={student?.student_id} role="student" />
                        </div>
                    </div>

                    {/* Student Hero Header Block */}
                    <div className="d-flex flex-column flex-md-row align-items-center align-items-md-center gap-3 gap-md-4 py-2 text-center text-md-start">
                        {/* Avatar */}
                        <div className="position-relative flex-shrink-0">
                            <img
                                src={student.image_url ? `${API}/${student.image_url}` : "https://ui-avatars.com/api/?name=" + encodeURIComponent(student.first_name || 'Student') + "&background=195053&color=fff&size=150"}
                                className="rounded-circle border border-4 border-white shadow-lg bg-white"
                                style={{ width: '110px', height: '110px', objectFit: 'cover' }}
                                alt={student.first_name}
                            />
                            <span className={`position-absolute bottom-0 end-0 p-2 border border-3 border-white rounded-circle ${student.status === 'Active' ? 'bg-success' : 'bg-secondary'}`} title={student.status || 'Active'}></span>
                        </div>

                        {/* Title & Info */}
                        <div className="text-white animate__animated animate__fadeInUp">
                            <h2 className="fw-bold mb-1 fs-3 fs-md-2 text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>
                                {student.first_name} {student.last_name}
                            </h2>
                            <div className="d-flex flex-wrap justify-content-center justify-content-md-start gap-2 align-items-center mt-2">
                                <span className="badge px-3 py-1.5 rounded-pill fw-bold text-white shadow-sm" style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)', border: '1px solid rgba(255, 255, 255, 0.4)', fontSize: '0.85rem' }}>
                                    <i className="bi bi-mortarboard-fill me-1.5 text-warning"></i>
                                    {student.class_name || 'N/A'}{student.section_name ? ` • ${student.section_name}` : ''}
                                </span>
                                <span className="badge bg-white px-3 py-1.5 rounded-pill font-monospace fw-bold shadow-sm" style={{ border: '1px solid rgba(255, 255, 255, 0.8)', fontSize: '0.82rem', color: '#195053' }}>
                                    <i className="bi bi-upc-scan me-1 text-primary"></i>
                                    {student.admission_no}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTENT SECTION */}
            <div className="container pt-4 mt-1 pb-5 px-3 px-sm-4">
                <div className="row g-4 profile-side-grid">
                    {/* LEFT SIDEBAR */}
                    <div className="col-lg-3 animate__animated animate__fadeInLeft">
                        <div className="row g-4">
                            {/* Status Card */}
                            <div className="col-12 col-md-6 col-lg-12">
                                <div className="card border-0 shadow-sm rounded-4 h-100 overflow-hidden">
                                    <div className="card-body p-3 p-md-4">
                                        <h6 className="fw-bold text-uppercase text-muted mb-3 small">Quick Info</h6>
                                        
                                        {/* Credentials Block */}
                                        <div className="mb-3">
                                            <small className="text-muted d-block text-uppercase fw-bold mb-2" style={{ fontSize: '0.68rem', letterSpacing: '0.8px' }}>
                                                <i className="bi bi-shield-lock me-1"></i>System Credentials
                                            </small>
                                            {student.username ? (
                                                <div className="bg-light p-3 rounded-3 border">
                                                    {/* Username Row */}
                                                    <div className="d-flex align-items-center justify-content-between gap-2 mb-2 pb-2 border-bottom border-secondary border-opacity-10">
                                                        <div className="min-w-0 flex-grow-1">
                                                            <small className="text-muted text-uppercase fw-semibold d-block" style={{ fontSize: '0.62rem', letterSpacing: '0.5px' }}>User ID</small>
                                                            <span className="font-monospace text-primary fw-bold small text-truncate d-block" style={{ fontSize: '0.82rem' }}>
                                                                {student.username}
                                                            </span>
                                                        </div>
                                                        <div className="d-flex align-items-center gap-1 flex-shrink-0">
                                                            <button className="btn btn-sm btn-white border shadow-xs text-secondary p-1.5 rounded-2" title="Copy Username" onClick={() => { navigator.clipboard.writeText(student.username); notify.success('Username copied'); }}>
                                                                <i className="bi bi-copy" style={{ fontSize: '0.85rem' }}></i>
                                                            </button>
                                                            <button className="btn btn-sm btn-white border shadow-xs text-primary p-1.5 rounded-2" title="Change Password" onClick={() => setChangePwdModalOpen(true)}>
                                                                <i className="bi bi-key-fill" style={{ fontSize: '0.85rem' }}></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {/* Password Row */}
                                                    <div className="d-flex align-items-center justify-content-between gap-2">
                                                        <div className="min-w-0 flex-grow-1">
                                                            <small className="text-muted text-uppercase fw-semibold d-block" style={{ fontSize: '0.62rem', letterSpacing: '0.5px' }}>Password</small>
                                                            <span className="font-monospace text-dark fw-bold small text-truncate d-block" style={{ fontSize: '0.8rem' }}>
                                                                {showPwd ? (student.system_pwd || 'student123') : '••••••••'}
                                                            </span>
                                                        </div>
                                                        <div className="d-flex align-items-center gap-1 flex-shrink-0">
                                                            <button className="btn btn-sm btn-white border shadow-xs text-secondary p-1.5 rounded-2" title={showPwd ? 'Hide Password' : 'Show Password'} onClick={() => setShowPwd(!showPwd)}>
                                                                <i className={`bi bi-eye${showPwd ? '-slash' : ''}`} style={{ fontSize: '0.85rem' }}></i>
                                                            </button>
                                                            <button className="btn btn-sm btn-white border shadow-xs text-secondary p-1.5 rounded-2" title="Copy Password" onClick={() => { navigator.clipboard.writeText(student.system_pwd || 'student123'); notify.success('Password copied'); }}>
                                                                <i className="bi bi-copy" style={{ fontSize: '0.85rem' }}></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button className="btn btn-sm btn-outline-primary w-100 py-2 rounded-3 fw-bold" style={{ fontSize: '0.78rem' }} onClick={handleGenerateCredentials}>
                                                    <i className="bi bi-key me-1"></i>Generate Login Credentials
                                                </button>
                                            )}
                                        </div>

                                        <InfoRow icon="bi-person" label="Gender" value={student.gender} />
                                        <InfoRow icon="bi-calendar-event" label="Date of Birth" value={new Date(student.dob).toLocaleDateString()} />
                                        <InfoRow icon="bi-droplet" label="Blood Group" value={student.blood_group} />
                                        <InfoRow icon="bi-telephone" label="Mobile" value={student.student_mobile || student.mobile_no} />
                                        {student.family_id && (
                                            <div className="d-flex align-items-center mb-3">
                                                <div className="me-3 text-secondary" style={{ width: '24px' }}>
                                                    <i className="bi bi-people-fill fs-5"></i>
                                                </div>
                                                <div>
                                                    <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>Family ID</small>
                                                    <div className="fw-medium text-dark">
                                                        <span className="badge bg-info bg-opacity-10 text-info border border-info">{student.family_id}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <hr className="text-secondary opacity-25" />
                                        <div className="text-center text-success fw-bold py-2">
                                            <i className="bi bi-shield-check me-2"></i>Student Portal Verified
                                        </div>

                                        {student?.student_id && hasPermission('students', 'write') && (
                                            <div className="mt-3 pt-1">
                                                <Link
                                                    href={`/students/edit/${student.student_id}`}
                                                    className="btn w-100 py-2.5 rounded-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 text-white transition"
                                                    style={{
                                                        background: 'linear-gradient(135deg, var(--primary-teal, #215e61) 0%, var(--primary-dark, #0f1c24) 100%)',
                                                        border: 'none',
                                                        fontSize: '0.85rem'
                                                    }}
                                                >
                                                    <i className="bi bi-pencil-square fs-6"></i>
                                                    <span>Edit Student Profile</span>
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Fees Card */}
                            <div className="col-12 col-md-6 col-lg-12">
                                <div className="card border-0 shadow-sm rounded-4 bg-white h-100">
                                    <div className="card-body p-4 text-center d-flex flex-column justify-content-center">
                                        <div className="avatar-placeholder bg-success bg-opacity-10 text-success rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center" style={{ width: '56px', height: '56px' }}>
                                            <i className={`bi ${(student.family_size || 1) > 1 ? 'bi-people-fill' : 'bi-wallet2'} fs-3`}></i>
                                        </div>
                                        {(student.family_size || 1) > 1 ? (
                                            <>
                                                <div className="small text-muted text-uppercase">Family Monthly Fee</div>
                                                <h3 className="fw-bold text-dark my-1">{fmt(student.family_fee || 0)}</h3>
                                                <div className="badge bg-warning bg-opacity-10 text-warning mt-2 border border-warning">
                                                    <i className="bi bi-people-fill me-1"></i>{student.family_size} members
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="small text-muted text-uppercase">Monthly Fee</div>
                                                <h3 className="fw-bold text-dark my-1">{fmt(student.monthly_fee || 0)}</h3>
                                                <div className="badge bg-success bg-opacity-10 text-success mt-2">Individual</div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* MAIN CONTENT */}
                    <div className="col-lg-9 animate__animated animate__fadeInUp">
                        <div className="card border-0 shadow-sm rounded-4 overflow-hidden" style={{ minHeight: '600px' }}>
                            {/* Sleek Modern Horizontal Scrollable Tab Bar */}
                            <div className="card-header bg-white border-bottom p-2.5">
                                <div
                                    className="d-flex align-items-center gap-2 overflow-x-auto text-nowrap scrollbar-none"
                                    style={{
                                        WebkitOverflowScrolling: 'touch',
                                        scrollbarWidth: 'none',
                                        msOverflowStyle: 'none'
                                    }}
                                >
                                    {[
                                        { id: 'overview', label: 'Overview', icon: 'bi-person-badge-fill', perm: hasPermission('dash.student_kpi', 'read') },
                                        { id: 'academic', label: 'Academics', icon: 'bi-journal-bookmark-fill', perm: true },
                                        { id: 'family', label: 'Siblings', icon: 'bi-people-fill', perm: true },
                                        { id: 'fees', label: 'Fee History', icon: 'bi-receipt-cutoff', perm: hasPermission('dash.student_fees', 'read') },
                                        { id: 'attendance', label: 'Attendance', icon: 'bi-calendar-check-fill', perm: hasPermission('dash.student_att', 'read') },
                                        { id: 'documents', label: 'Documents', icon: 'bi-folder2-open', perm: true }
                                    ].filter(t => t.perm).map(tab => {
                                        const isActive = activeTab === tab.id;
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActiveTab(tab.id)}
                                                className="btn btn-sm d-inline-flex align-items-center gap-2 px-3 py-2 rounded-3 fw-bold transition-all border-0"
                                                style={{
                                                    fontSize: '0.85rem',
                                                    letterSpacing: '0.2px',
                                                    backgroundColor: isActive ? 'var(--primary-teal)' : '#f8fafc',
                                                    color: isActive ? '#ffffff' : '#64748b',
                                                    boxShadow: isActive ? '0 4px 12px rgba(25, 80, 83, 0.25)' : 'none',
                                                    border: isActive ? '1px solid var(--primary-teal)' : '1px solid #e2e8f0',
                                                }}
                                            >
                                                <i className={`bi ${tab.icon}`} style={{ fontSize: '0.95rem', color: isActive ? '#ffffff' : '#64748b' }}></i>
                                                <span>{tab.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="card-body p-4 p-lg-5 bg-light bg-opacity-50">
                                {activeTab === 'overview' && hasPermission('dash.student_kpi', 'read') && (
                                    <div className="animate__animated animate__fadeIn">
                                        <h5 className="fw-bold mb-4 text-dark border-start border-4 border-primary ps-3">Personal Details</h5>
                                        <div className="row g-4">
                                            <div className="col-md-6">
                                                <div className="bg-white p-4 rounded-4 shadow-sm h-100">
                                                    <InfoRow icon="bi-geo-alt" label="Current Address" value={`${student.current_address}, ${student.city}`} />
                                                    <InfoRow icon="bi-house" label="Permanent Address" value={student.permanent_address} />
                                                    <InfoRow icon="bi-envelope" label="Email" value={student.email} />
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div className="bg-white p-4 rounded-4 shadow-sm h-100">
                                                    <InfoRow icon="bi-star" label="Religion" value={student.religion} />
                                                    <InfoRow icon="bi-bookmark" label="Category" value={student.category} />
                                                    {student.has_disability && (
                                                        <div className="alert alert-warning mt-3 mb-0">
                                                            <i className="bi bi-exclamation-circle me-2"></i>
                                                            <strong>Disability:</strong> {student.disability_details}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'academic' && (
                                    <div className="animate__animated animate__fadeIn">
                                        {acadLoading ? (
                                            <div className="text-center py-5 text-muted">
                                                <span className="spinner-border spinner-border-sm me-2" />Loading academic data…
                                            </div>
                                        ) : !acad ? (
                                            <div className="text-center py-5 text-muted">
                                                <i className="bi bi-exclamation-circle fs-2 d-block mb-2" />
                                                <p>Failed to load academic performance.</p>
                                                <button className="btn btn-sm btn-outline-primary" onClick={fetchAcademics}>Retry</button>
                                            </div>
                                        ) : (
                                            <>
                                                {/* ── Prediction Banner ─────────────────────────────────── */}
                                                {acad.prediction && (() => {
                                                    const p = acad.prediction;
                                                    const levelColors: Record<string, { bg: string; text: string; border: string }> = {
                                                        'Outstanding': { bg: '#e8f5e9', text: '#1b5e20', border: '#4caf50' },
                                                        'Excellent': { bg: '#e3f2fd', text: '#0d47a1', border: '#2196f3' },
                                                        'Good': { bg: '#e8f5e9', text: '#2e7d32', border: '#66bb6a' },
                                                        'Average': { bg: '#fff8e1', text: '#f57f17', border: '#ffc107' },
                                                        'Below Average': { bg: '#fff3e0', text: '#e65100', border: '#ff9800' },
                                                        'Poor': { bg: '#ffebee', text: '#b71c1c', border: '#ef5350' },
                                                        'No Data': { bg: '#f5f5f5', text: '#616161', border: '#bdbdbd' },
                                                    };
                                                    const trendIcon: Record<string, string> = {
                                                        improving: 'bi-graph-up-arrow text-success',
                                                        declining: 'bi-graph-down-arrow text-danger',
                                                        stable: 'bi-dash-lg text-warning',
                                                        insufficient_data: 'bi-question-circle text-muted'
                                                    };
                                                    const trendLabel: Record<string, string> = {
                                                        improving: 'Improving', declining: 'Declining',
                                                        stable: 'Stable', insufficient_data: 'Not Enough Data'
                                                    };
                                                    const col = levelColors[p.level] || levelColors['No Data'];
                                                    return (
                                                        <div className="rounded-4 p-4 mb-4 border" style={{ background: col.bg, borderColor: col.border + ' !important' }}>
                                                            <div className="row g-3 align-items-center">
                                                                <div className="col-md-4 text-center border-end">
                                                                    <div className="fw-bold small text-muted text-uppercase mb-1">Overall Level</div>
                                                                    <div className="fw-bold" style={{ fontSize: '1.6rem', color: col.text }}>{p.level}</div>
                                                                    {p.composite_score !== null && (
                                                                        <div className="badge rounded-pill mt-1 px-3 py-2 fs-6 fw-bold"
                                                                            style={{ background: col.border, color: '#fff' }}>
                                                                            {p.composite_grade} {p.composite_score}%
                                                                        </div>
                                                                    )}
                                                                    <div className="small text-muted mt-2">Weighted score (terms 65% · tests 25% · attendance 10%)</div>
                                                                </div>
                                                                <div className="col-md-4 border-end">
                                                                    <div className="fw-bold small text-muted text-uppercase mb-2">Component Breakdown</div>
                                                                    {[
                                                                        { label: 'Term Marks Avg', val: p.term_avg, icon: 'bi-journal-check', color: '#2196f3' },
                                                                        { label: 'Test Marks Avg', val: p.test_avg, icon: 'bi-pencil-square', color: '#9c27b0' },
                                                                        { label: 'Attendance', val: p.attendance_pct, icon: 'bi-calendar-check', color: '#4caf50' },
                                                                    ].map(item => (
                                                                        <div key={item.label} className="d-flex align-items-center mb-2">
                                                                            <i className={`bi ${item.icon} me-2`} style={{ color: item.color, width: 18 }} />
                                                                            <span className="small text-muted flex-grow-1">{item.label}</span>
                                                                            {item.val !== null ? (
                                                                                <>
                                                                                    <div className="progress flex-grow-1 mx-2" style={{ height: 6, borderRadius: 4 }}>
                                                                                        <div className="progress-bar" style={{ width: `${item.val}%`, background: item.color, borderRadius: 4 }} />
                                                                                    </div>
                                                                                    <span className="fw-bold small" style={{ color: item.color, minWidth: 42, textAlign: 'right' }}>{item.val}%</span>
                                                                                </>
                                                                            ) : <span className="text-muted small ms-2">No data</span>}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <div className="col-md-4 text-center">
                                                                    <div className="fw-bold small text-muted text-uppercase mb-1">Trend</div>
                                                                    <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
                                                                        <i className={`bi ${trendIcon[p.trend]} fs-4`} />
                                                                        <span className="fw-bold fs-6">{trendLabel[p.trend]}</span>
                                                                    </div>
                                                                    {p.predicted_next !== null && (
                                                                        <div className="rounded-3 p-2 mt-1"
                                                                            style={{ background: 'rgba(255,255,255,0.6)', border: `1px solid ${col.border}` }}>
                                                                            <div className="small text-muted">Predicted Next Term</div>
                                                                            <div className="fw-bold fs-5" style={{ color: col.text }}>
                                                                                {p.predicted_grade} {p.predicted_next}%
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    <div className="small text-muted mt-2">
                                                                        Based on {p.data_points} term{p.data_points !== 1 ? 's' : ''} of data
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* ── Sub-tabs ──────────────────────────────────────────── */}
                                                <div className="d-flex gap-2 mb-4 flex-wrap">
                                                    {([
                                                        { key: 'terms', label: 'Term Exams', icon: 'bi-journal-check', count: acad.terms?.length },
                                                        {
                                                            key: 'tests', label: 'Tests & Quizzes', icon: 'bi-pencil-square',
                                                            count: acad.test_subjects?.reduce((a: number, s: any) => a + s.tests.length, 0)
                                                        },
                                                        { key: 'prediction', label: 'Performance Analysis', icon: 'bi-bar-chart-line-fill' },
                                                    ] as { key: any; label: string; icon: string; count?: number }[]).map(t => (
                                                        <button
                                                            key={t.key}
                                                            className={`btn btn-sm fw-semibold ${acadTab === t.key ? 'btn-primary' : 'btn-outline-secondary'}`}
                                                            style={{ borderRadius: 20 }}
                                                            onClick={() => setAcadTab(t.key)}
                                                        >
                                                            <i className={`bi ${t.icon} me-1`} />
                                                            {t.label}
                                                            {t.count !== undefined && (
                                                                <span className={`badge rounded-pill ms-1 ${acadTab === t.key ? 'bg-white text-primary' : 'bg-secondary'}`}>
                                                                    {t.count}
                                                                </span>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* ── Terms Tab ─────────────────────────────────────────── */}
                                                {acadTab === 'terms' && (
                                                    acad.terms?.length === 0 ? (
                                                        <div className="text-center py-5 text-muted">
                                                            <i className="bi bi-journal fs-1 opacity-50 d-block mb-2" />
                                                            No term marks recorded yet.
                                                        </div>
                                                    ) : (
                                                        <div className="d-flex flex-column gap-4">
                                                            {acad.terms?.map((term: any) => (
                                                                <div key={term.term_id} className="card border-0 shadow-sm rounded-4 overflow-hidden">
                                                                    <div className="card-header d-flex justify-content-between align-items-center py-3"
                                                                        style={{ borderLeft: `5px solid ${gradeColor(term.term_grade)}`, background: '#fff' }}>
                                                                        <div>
                                                                            <div className="fw-bold" style={{ color: 'var(--primary-dark)' }}>
                                                                                <i className="bi bi-calendar3 me-2" />
                                                                                {term.term_name}
                                                                                <span className="ms-2 text-muted fw-normal small">— {term.year_name}</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="d-flex align-items-center gap-3">
                                                                            <div className="text-end">
                                                                                <div className="small text-muted">Total</div>
                                                                                <div className="fw-bold">{term.total_obtained}/{term.total_possible}</div>
                                                                            </div>
                                                                            <div>
                                                                                <div className="small text-muted text-end">{term.term_percentage}%</div>
                                                                                <div className="progress mt-1" style={{ height: 6, width: 80, borderRadius: 4 }}>
                                                                                    <div className="progress-bar" style={{ width: `${term.term_percentage}%`, background: gradeColor(term.term_grade), borderRadius: 4 }} />
                                                                                </div>
                                                                            </div>
                                                                            <GradeBadge grade={term.term_grade} />
                                                                        </div>
                                                                    </div>
                                                                    <div className="card-body p-0">
                                                                        <div className="table-responsive">
                                                                            <table className="table table-hover mb-0 align-middle">
                                                                                <thead className="table-light">
                                                                                    <tr>
                                                                                        <th className="ps-4">Subject</th>
                                                                                        <th className="text-center">Obtained</th>
                                                                                        <th className="text-center">Total</th>
                                                                                        <th className="text-center">Percentage</th>
                                                                                        <th className="text-center pe-4">Grade</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {term.subjects.map((sub: any) => (
                                                                                        <tr key={sub.subject_id}>
                                                                                            <td className="ps-4 fw-semibold">
                                                                                                {sub.subject_name}
                                                                                                {sub.subject_code && <span className="ms-2 text-muted small">({sub.subject_code})</span>}
                                                                                            </td>
                                                                                            <td className="text-center fw-bold" style={{ color: gradeColor(sub.grade) }}>
                                                                                                {sub.obtained_marks}
                                                                                            </td>
                                                                                            <td className="text-center text-muted">{sub.total_marks}</td>
                                                                                            <td className="text-center">
                                                                                                <div className="d-flex align-items-center justify-content-center gap-2">
                                                                                                    <div className="progress" style={{ height: 6, width: 60, borderRadius: 4 }}>
                                                                                                        <div className="progress-bar" style={{ width: `${sub.percentage}%`, background: gradeColor(sub.grade), borderRadius: 4 }} />
                                                                                                    </div>
                                                                                                    <span className="small fw-semibold" style={{ color: gradeColor(sub.grade), minWidth: 38 }}>{sub.percentage}%</span>
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className="text-center pe-4">
                                                                                                <GradeBadge grade={sub.grade} />
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                                <tfoot style={{ background: '#f8f9fa' }}>
                                                                                    <tr>
                                                                                        <td className="ps-4 fw-bold">Total</td>
                                                                                        <td className="text-center fw-bold" style={{ color: gradeColor(term.term_grade) }}>{term.total_obtained}</td>
                                                                                        <td className="text-center fw-bold text-muted">{term.total_possible}</td>
                                                                                        <td className="text-center">
                                                                                            <span className="fw-bold" style={{ color: gradeColor(term.term_grade) }}>{term.term_percentage}%</span>
                                                                                        </td>
                                                                                        <td className="text-center pe-4"><GradeBadge grade={term.term_grade} /></td>
                                                                                    </tr>
                                                                                </tfoot>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )
                                                )}

                                                {/* ── Tests Tab ─────────────────────────────────────────── */}
                                                {acadTab === 'tests' && (
                                                    acad.test_subjects?.length === 0 ? (
                                                        <div className="text-center py-5 text-muted">
                                                            <i className="bi bi-pencil fs-1 opacity-50 d-block mb-2" />
                                                            No test marks recorded yet.
                                                        </div>
                                                    ) : (
                                                        <div className="d-flex flex-column gap-4">
                                                            {acad.test_subjects?.map((sub: any) => (
                                                                <div key={sub.subject_id} className="card border-0 shadow-sm rounded-4 overflow-hidden">
                                                                    <div className="card-header d-flex justify-content-between align-items-center py-3"
                                                                        style={{ borderLeft: `5px solid ${gradeColor(sub.avg_grade)}`, background: '#fff' }}>
                                                                        <div className="fw-bold" style={{ color: 'var(--primary-dark)' }}>
                                                                            <i className="bi bi-book me-2" />
                                                                            {sub.subject_name}
                                                                            {sub.subject_code && <span className="ms-2 text-muted fw-normal small">({sub.subject_code})</span>}
                                                                        </div>
                                                                        <div className="d-flex align-items-center gap-3">
                                                                            <div className="text-end">
                                                                                <div className="small text-muted">Tests Avg</div>
                                                                                <div className="fw-bold">{sub.avg_percentage}%</div>
                                                                            </div>
                                                                            <GradeBadge grade={sub.avg_grade} />
                                                                        </div>
                                                                    </div>
                                                                    <div className="card-body p-0">
                                                                        <div className="table-responsive">
                                                                            <table className="table table-hover mb-0 align-middle">
                                                                                <thead className="table-light">
                                                                                    <tr>
                                                                                        <th className="ps-4">#</th>
                                                                                        <th>Test Name</th>
                                                                                        <th>Description</th>
                                                                                        <th className="text-center">Obtained</th>
                                                                                        <th className="text-center">Total</th>
                                                                                        <th className="text-center">%</th>
                                                                                        <th className="text-center">Grade</th>
                                                                                        <th>Remarks</th>
                                                                                        <th className="pe-4">Date</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {sub.tests.map((t: any, idx: number) => (
                                                                                        <tr key={t.test_id}>
                                                                                            <td className="ps-4 text-muted">{idx + 1}</td>
                                                                                            <td className="fw-semibold">{t.test_name}</td>
                                                                                            <td className="text-muted small">{t.description || '—'}</td>
                                                                                            <td className="text-center fw-bold" style={{ color: gradeColor(t.grade) }}>{t.obtained_marks}</td>
                                                                                            <td className="text-center text-muted">{t.total_marks}</td>
                                                                                            <td className="text-center">
                                                                                                <span className="fw-semibold small" style={{ color: gradeColor(t.grade) }}>{t.percentage}%</span>
                                                                                            </td>
                                                                                            <td className="text-center"><GradeBadge grade={t.grade} /></td>
                                                                                            <td className="small text-muted">{t.remarks || '—'}</td>
                                                                                            <td className="pe-4 small text-muted">
                                                                                                {new Date(t.test_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )
                                                )}

                                                {/* ── Prediction / Analysis Tab ──────────────────────────── */}
                                                {acadTab === 'prediction' && acad.prediction && (() => {
                                                    const p = acad.prediction;
                                                    const termPcts: number[] = acad.terms?.map((t: any) => t.term_percentage) || [];
                                                    return (
                                                        <div className="row g-4">
                                                            {/* Algorithm explanation */}
                                                            <div className="col-12">
                                                                <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                                                                    <div className="card-header py-3 fw-bold" style={{ borderLeft: '5px solid var(--primary-teal)', background: '#fff', color: 'var(--primary-dark)' }}>
                                                                        <i className="bi bi-cpu me-2" style={{ color: 'var(--primary-teal)' }} />
                                                                        How Prediction Works
                                                                    </div>
                                                                    <div className="card-body py-3">
                                                                        <div className="row g-3">
                                                                            {[
                                                                                { icon: 'bi-journal-check', color: '#2196f3', title: 'Term Marks (65%)', desc: 'All recorded term/exam marks are averaged and weighted at 65% of the composite score.' },
                                                                                { icon: 'bi-pencil-square', color: '#9c27b0', title: 'Test/Quiz Marks (25%)', desc: 'All tests and quizzes are averaged. Short assessments contribute 25% to the overall score.' },
                                                                                { icon: 'bi-calendar-check', color: '#4caf50', title: 'Attendance (10%)', desc: 'Full present = 1.0, Late = 0.5, Absent = 0. Attendance rate contributes 10% to the score.' },
                                                                                { icon: 'bi-graph-up', color: '#ff9800', title: 'Trend (Linear Regression)', desc: 'Slope of term percentages over time. Positive slope = improving. Projected onto next term.' },
                                                                            ].map(item => (
                                                                                <div key={item.title} className="col-md-6">
                                                                                    <div className="d-flex gap-3 p-3 rounded-3" style={{ background: item.color + '12', border: `1px solid ${item.color}30` }}>
                                                                                        <div className="flex-shrink-0 d-flex align-items-start pt-1">
                                                                                            <i className={`bi ${item.icon} fs-5`} style={{ color: item.color }} />
                                                                                        </div>
                                                                                        <div>
                                                                                            <div className="fw-bold small" style={{ color: item.color }}>{item.title}</div>
                                                                                            <div className="small text-muted">{item.desc}</div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Term-by-term bar chart (visual) */}
                                                            <div className="col-md-7">
                                                                <div className="card border-0 shadow-sm rounded-4 h-100">
                                                                    <div className="card-header py-3 fw-bold" style={{ borderLeft: '5px solid #2196f3', background: '#fff', color: 'var(--primary-dark)' }}>
                                                                        <i className="bi bi-bar-chart-fill me-2 text-primary" />Term Performance Trend
                                                                    </div>
                                                                    <div className="card-body">
                                                                        {termPcts.length === 0 ? (
                                                                            <div className="text-center text-muted py-4">No term data yet.</div>
                                                                        ) : (
                                                                            <div className="d-flex flex-column gap-2">
                                                                                {acad.terms?.map((term: any, idx: number) => (
                                                                                    <div key={term.term_id}>
                                                                                        <div className="d-flex justify-content-between small mb-1">
                                                                                            <span className="fw-semibold text-muted">{term.term_name} <span className="fw-normal">({term.year_name})</span></span>
                                                                                            <span className="fw-bold" style={{ color: gradeColor(term.term_grade) }}>
                                                                                                {term.term_percentage}% {term.term_grade}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="progress" style={{ height: 20, borderRadius: 6 }}>
                                                                                            <div
                                                                                                className="progress-bar fw-bold small d-flex align-items-center ps-2"
                                                                                                style={{ width: `${term.term_percentage}%`, background: gradeColor(term.term_grade), borderRadius: 6, transition: 'width 0.7s ease' }}
                                                                                            >
                                                                                                {term.term_percentage >= 15 ? `${term.total_obtained}/${term.total_possible}` : ''}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                                {/* Predicted next */}
                                                                                {p.predicted_next !== null && (
                                                                                    <div className="mt-2" style={{ borderTop: '2px dashed #ccc', paddingTop: 8 }}>
                                                                                        <div className="d-flex justify-content-between small mb-1">
                                                                                            <span className="text-muted fst-italic"><i className="bi bi-stars me-1" />Predicted Next Term</span>
                                                                                            <span className="fw-bold" style={{ color: gradeColor(p.predicted_grade!) }}>
                                                                                                {p.predicted_next}% {p.predicted_grade}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="progress" style={{ height: 20, borderRadius: 6, border: '2px dashed #ccc', background: 'transparent' }}>
                                                                                            <div
                                                                                                className="progress-bar fw-bold small"
                                                                                                style={{ width: `${p.predicted_next}%`, background: gradeColor(p.predicted_grade!) + '88', borderRadius: 4 }}
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Summary stats */}
                                                            <div className="col-md-5">
                                                                <div className="card border-0 shadow-sm rounded-4 h-100">
                                                                    <div className="card-header py-3 fw-bold" style={{ borderLeft: '5px solid #9c27b0', background: '#fff', color: 'var(--primary-dark)' }}>
                                                                        <i className="bi bi-trophy me-2" style={{ color: '#9c27b0' }} />Performance Summary
                                                                    </div>
                                                                    <div className="card-body d-flex flex-column gap-3">
                                                                        {[
                                                                            { label: 'Composite Score', val: p.composite_score !== null ? `${p.composite_score}%` : '—', grade: p.composite_grade, icon: 'bi-star-fill', color: '#ff9800' },
                                                                            { label: 'Term Marks Average', val: p.term_avg !== null ? `${p.term_avg}%` : '—', grade: p.term_avg !== null ? gradeLabel(p.term_avg) : null, icon: 'bi-journal-check', color: '#2196f3' },
                                                                            { label: 'Test Marks Average', val: p.test_avg !== null ? `${p.test_avg}%` : '—', grade: p.test_avg !== null ? gradeLabel(p.test_avg) : null, icon: 'bi-pencil-square', color: '#9c27b0' },
                                                                            { label: 'Attendance Rate', val: p.attendance_pct !== null ? `${p.attendance_pct}%` : '—', grade: null, icon: 'bi-calendar-check', color: '#4caf50' },
                                                                            { label: 'Trend Slope', val: `${p.trend_slope > 0 ? '+' : ''}${p.trend_slope}`, grade: null, icon: 'bi-graph-up-arrow', color: p.trend === 'improving' ? '#4caf50' : p.trend === 'declining' ? '#ef5350' : '#ff9800' },
                                                                            { label: 'Predicted Next Term', val: p.predicted_next !== null ? `${p.predicted_next}%` : '—', grade: p.predicted_grade, icon: 'bi-stars', color: '#607d8b' },
                                                                        ].map(row => (
                                                                            <div key={row.label} className="d-flex align-items-center gap-3 p-2 rounded-3" style={{ background: row.color + '0f' }}>
                                                                                <i className={`bi ${row.icon} fs-5`} style={{ color: row.color, width: 20 }} />
                                                                                <div className="flex-grow-1">
                                                                                    <div className="small text-muted">{row.label}</div>
                                                                                    <div className="fw-bold" style={{ color: row.color }}>{row.val}</div>
                                                                                </div>
                                                                                {row.grade && <GradeBadge grade={row.grade} />}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'family' && (
                                    <div className="animate__animated animate__fadeIn">
                                        <div className="row g-4">
                                            <div className="col-md-6">
                                                <div className="card border-0 shadow-sm rounded-4 h-100 overflow-hidden">
                                                    <div className="card-header bg-primary text-white fw-bold"><i className="bi bi-gender-male me-2"></i>Father</div>
                                                    <div className="card-body">
                                                        <InfoRow icon="bi-person" label="Name" value={student.father_name} />
                                                        <InfoRow icon="bi-telephone" label="Phone" value={student.father_phone} />
                                                        <InfoRow icon="bi-briefcase" label="Occupation" value={student.father_occupation} />
                                                        <InfoRow icon="bi-card-heading" label="CNIC" value={student.father_cnic} />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div className="card border-0 shadow-sm rounded-4 h-100 overflow-hidden">
                                                    <div className="card-header bg-pink-500 text-white fw-bold" style={{ backgroundColor: '#e83e8c' }}><i className="bi bi-gender-female me-2"></i>Mother</div>
                                                    <div className="card-body">
                                                        <InfoRow icon="bi-person" label="Name" value={student.mother_name} />
                                                        <InfoRow icon="bi-telephone" label="Phone" value={student.mother_phone} />
                                                        <InfoRow icon="bi-card-heading" label="CNIC" value={student.mother_cnic} />
                                                    </div>
                                                </div>
                                            </div>
                                            {student.guardian_name && (
                                                <div className="col-12">
                                                    <div className="card border-0 shadow-sm rounded-4 bg-warning bg-opacity-10">
                                                        <div className="card-body">
                                                            <h6 className="fw-bold text-dark mb-3">Guardian Information ({student.guardian_relation})</h6>
                                                            <div className="row">
                                                                <div className="col-md-4"><InfoRow icon="bi-person" label="Name" value={student.guardian_name} /></div>
                                                                <div className="col-md-4"><InfoRow icon="bi-telephone" label="Phone" value={student.guardian_phone} /></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Siblings Section */}
                                            <div className="col-12">
                                                <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                                                    <div className="card-header bg-success bg-opacity-10 border-bottom border-success border-opacity-25">
                                                        <h6 className="fw-bold text-success mb-0">
                                                            <i className="bi bi-people-fill me-2"></i>
                                                            Siblings & Cousins
                                                            {siblings.length > 0 && (
                                                                <span className="badge bg-success ms-2">{siblings.length}</span>
                                                            )}
                                                        </h6>
                                                    </div>
                                                    <div className="card-body p-4">
                                                        {loadingSiblings ? (
                                                            <div className="text-center py-4">
                                                                <div className="spinner-border spinner-border-sm text-success" role="status"></div>
                                                                <p className="text-muted mt-2 mb-0">Loading siblings...</p>
                                                            </div>
                                                        ) : siblings.length > 0 ? (
                                                            <div className="row g-3">
                                                                {siblings.map((sibling: any) => (
                                                                    <div className="col-md-6" key={sibling.student_id}>
                                                                        <div
                                                                            className="card h-100 border-2 hover-shadow transition"
                                                                            style={{
                                                                                cursor: 'pointer',
                                                                                borderColor: sibling.relation_type === 'blood' ? '#0d6efd' : '#ffc107',
                                                                                transition: 'all 0.3s ease'
                                                                            }}
                                                                            onClick={() => { setActiveTab('overview'); setCurrentId(String(sibling.student_id)); }}
                                                                        >
                                                                            <div
                                                                                className="card-header border-0 p-3"
                                                                                style={{
                                                                                    backgroundColor: sibling.relation_type === 'blood' ? '#e7f1ff' : '#fff3cd'
                                                                                }}
                                                                            >
                                                                                <span className="badge" style={{
                                                                                    backgroundColor: sibling.relation_type === 'blood' ? '#0d6efd' : '#ffc107',
                                                                                    color: sibling.relation_type === 'blood' ? 'white' : '#000'
                                                                                }}>
                                                                                    <i className={`bi ${sibling.relation_type === 'blood' ? 'bi-people-fill' : 'bi-diagram-3-fill'} me-1`}></i>
                                                                                    {sibling.relation_type === 'blood' ? 'Blood Sibling' : 'Cousin'}
                                                                                </span>
                                                                            </div>
                                                                            <div className="card-body p-3">
                                                                                <div className="d-flex align-items-center mb-2">
                                                                                    <div className="me-3">
                                                                                        {sibling.image_url ? (
                                                                                            <img
                                                                                                src={`${API}/${sibling.image_url}`}
                                                                                                alt={sibling.first_name}
                                                                                                className="rounded-circle border border-2"
                                                                                                style={{
                                                                                                    width: '50px',
                                                                                                    height: '50px',
                                                                                                    objectFit: 'cover',
                                                                                                    borderColor: sibling.relation_type === 'blood' ? '#0d6efd' : '#ffc107'
                                                                                                }}
                                                                                            />
                                                                                        ) : (
                                                                                            <div
                                                                                                className="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white border border-2"
                                                                                                style={{
                                                                                                    width: '50px',
                                                                                                    height: '50px',
                                                                                                    borderColor: sibling.relation_type === 'blood' ? '#0d6efd' : '#ffc107'
                                                                                                }}
                                                                                            >
                                                                                                <i className="bi bi-person-fill"></i>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="flex-grow-1">
                                                                                        <h6 className="mb-1 fw-bold text-dark">
                                                                                            {sibling.first_name} {sibling.last_name}
                                                                                        </h6>
                                                                                        <span className="badge bg-primary bg-opacity-10 text-primary small">
                                                                                            {sibling.admission_no}
                                                                                        </span>
                                                                                    </div>
                                                                                    <i className="bi bi-arrow-right-circle text-primary fs-5"></i>
                                                                                </div>
                                                                                <div className="mt-3 pt-2 border-top">
                                                                                    <div className="row g-2 small text-muted">
                                                                                        <div className="col-6">
                                                                                            <i className="bi bi-book me-1"></i>
                                                                                            {sibling.class_name} {sibling.section_name && `- ${sibling.section_name}`}
                                                                                        </div>
                                                                                        <div className="col-6 text-end">
                                                                                            <i className="bi bi-person me-1"></i>
                                                                                            {sibling.gender}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-center py-5 text-muted">
                                                                <i className="bi bi-people fs-1 opacity-50"></i>
                                                                <p className="mt-3 mb-0">No siblings or cousins found</p>
                                                                <small>This student has no registered siblings in the system</small>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'fees' && hasPermission('dash.student_fees', 'read') && (
                                    <div className="animate__animated animate__fadeIn">
                                        {/* Monthly Fee Card */}
                                        <div className="row g-4 mb-4">
                                            {/* Monthly / Family Fee Card */}
                                            <div className="col-xl-4 col-lg-5 col-md-6">
                                                <div className="card border-0 shadow-sm rounded-4 text-center overflow-hidden h-100">
                                                    <div className="card-header text-white py-3" style={{ background: 'linear-gradient(135deg, var(--primary-dark), var(--primary-teal))' }}>
                                                        <i className={`bi ${(student.family_size || 1) > 1 ? 'bi-people-fill' : 'bi-arrow-repeat'} fs-4 d-block mb-1`}></i>
                                                        <h6 className="mb-0 fw-bold">{(student.family_size || 1) > 1 ? 'Family Monthly Fee' : 'Monthly Fee (Tuition)'}</h6>
                                                    </div>
                                                    <div className="card-body py-4 px-3 d-flex flex-column justify-content-center align-items-center">
                                                        <div className="fw-bold text-break" style={{ fontSize: 'calc(1.3rem + 0.6vw)', color: 'var(--primary-teal)', lineHeight: 1.2 }}>
                                                            {(student.family_size || 1) > 1 ? fmt(student.family_fee || 0) : fmt(student?.monthly_fee || 0)}
                                                        </div>
                                                        {(student.family_size || 1) > 1 ? (
                                                            <>
                                                                <div className="text-muted small mt-1">Shared by {student.family_size} family members</div>
                                                                <div className="badge bg-warning bg-opacity-10 text-warning border border-warning mt-3 text-wrap px-3 py-2" style={{ maxWidth: '100%', lineHeight: 1.4 }}>
                                                                    <i className="bi bi-people-fill me-1"></i>Family Slip (1 slip per family)
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="text-muted small mt-1">Billed every month</div>
                                                                <div className="badge bg-success bg-opacity-10 text-success border border-success mt-3 text-wrap px-3 py-2" style={{ maxWidth: '100%', lineHeight: 1.4 }}>
                                                                    Auto-applied on slip generation
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Admission Fee Card */}
                                            <div className="col-md-8">
                                                {loadingFees ? (
                                                    <div className="card border-0 shadow-sm rounded-4 d-flex align-items-center justify-content-center" style={{ minHeight: 180 }}>
                                                        <div className="spinner-border text-primary"></div>
                                                    </div>
                                                ) : !admissionFee ? (
                                                    <div className="card border-0 shadow-sm rounded-4 text-center py-5">
                                                        <i className="bi bi-receipt fs-1 text-muted d-block mb-2"></i>
                                                        <p className="text-muted mb-0">No admission fee recorded for this student.</p>
                                                    </div>
                                                ) : (
                                                    <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                                                        <div className="card-header py-3" style={{ borderLeft: admissionFee.status !== 'paid' ? '4px solid #dc3545' : '4px solid #198754', backgroundColor: 'white' }}>
                                                            <div className="d-flex justify-content-between align-items-center">
                                                                <h6 className="fw-bold mb-0" style={{ color: 'var(--primary-dark)' }}>
                                                                    <i className="bi bi-credit-card-2-front me-2"></i>Admission Fee
                                                                </h6>
                                                                {admissionFee.status !== 'paid' ? (
                                                                    <button className="btn btn-sm btn-primary-custom"
                                                                        onClick={() => { setPayAmt(admissionFee.remaining_amount?.toString() || ''); setPayError(''); setPaySuccess(''); setShowPayModal(true); }}>
                                                                        <i className="bi bi-cash-coin me-1"></i>Receive Payment
                                                                    </button>
                                                                ) : (
                                                                    <span className="badge rounded-pill bg-success fs-6 px-3 py-2">
                                                                        <i className="bi bi-check-circle me-1"></i>Fully Paid
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="card-body">
                                                            <div className="row g-3 text-center mb-3">
                                                                {[
                                                                    { label: 'Total Amount', value: fmt(admissionFee.total_amount), color: 'var(--primary-dark)' },
                                                                    { label: 'Paid', value: fmt(admissionFee.paid_amount), color: '#198754' },
                                                                    { label: 'Remaining', value: fmt(admissionFee.remaining_amount), color: admissionFee.status !== 'paid' ? '#dc3545' : '#198754' },
                                                                ].map((s, i) => (
                                                                    <div className="col-4" key={i}>
                                                                        <div className="rounded-3 py-3" style={{ backgroundColor: `${s.color}0f` }}>
                                                                            <div className="text-muted small">{s.label}</div>
                                                                            <div className="fw-bold fs-5" style={{ color: s.color }}>{s.value}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {/* Progress Bar */}
                                                            {admissionFee.total_amount > 0 && (
                                                                <div className="mb-3">
                                                                    <div className="d-flex justify-content-between small text-muted mb-1">
                                                                        <span>Collection Progress</span>
                                                                        <span>{Math.round((admissionFee.paid_amount / admissionFee.total_amount) * 100)}%</span>
                                                                    </div>
                                                                    <div className="progress" style={{ height: 10, borderRadius: 10 }}>
                                                                        <div className="progress-bar" role="progressbar"
                                                                            style={{ width: `${Math.min(100, Math.round((admissionFee.paid_amount / admissionFee.total_amount) * 100))}%`, backgroundColor: admissionFee.status === 'paid' ? '#198754' : 'var(--primary-teal)', borderRadius: 10 }}>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Payment History */}
                                        {admissionFee && admissionPayments.length > 0 && (
                                            <div className="card border-0 shadow-sm rounded-4">
                                                <div className="card-header bg-white py-3">
                                                    <h6 className="fw-bold mb-0" style={{ color: 'var(--primary-dark)' }}>
                                                        <i className="bi bi-clock-history me-2"></i>Admission Fee Payment History
                                                    </h6>
                                                </div>
                                                <div className="card-body p-0">
                                                    <div className="table-responsive">
                                                        <table className="table table-sm align-middle mb-0">
                                                            <thead className="bg-light">
                                                                <tr>
                                                                    <th className="ps-4 py-3">#</th>
                                                                    <th className="py-3">Date</th>
                                                                    <th className="py-3">Amount</th>
                                                                    <th className="py-3">Method</th>
                                                                    <th className="pe-4 py-3">Reference</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {admissionPayments.map((p: any, i: number) => (
                                                                    <tr key={p.payment_id}>
                                                                        <td className="ps-4 text-muted small">{i + 1}</td>
                                                                        <td className="small">{new Date(p.payment_date).toLocaleDateString()}</td>
                                                                        <td className="fw-bold text-success">{fmt(p.amount_paid)}</td>
                                                                        <td><span className="badge bg-light text-dark border">{p.payment_method}</span></td>
                                                                        <td className="pe-4 text-muted small">{p.reference_no || '—'}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Family Monthly Fee Slips */}
                                {activeTab === 'fees' && hasPermission('dash.student_fees', 'read') && (
                                    <div className="card bg-white border-0 shadow-sm rounded-4 mt-4 overflow-hidden animate__animated animate__fadeInUp">
                                        <div className="card-header py-3" style={{ borderLeft: '4px solid var(--primary-teal)', backgroundColor: 'white' }}>
                                            <h6 className="fw-bold mb-0" style={{ color: 'var(--primary-dark)' }}>
                                                <i className="bi bi-calendar-check me-2" style={{ color: 'var(--primary-teal)' }}></i>
                                                Family Monthly Fee History
                                            </h6>
                                        </div>
                                        <div className="card-body p-0">
                                            {loadingFamilySlips ? (
                                                <div className="p-4 text-center">
                                                    <span className="spinner-border spinner-border-sm text-primary"></span> <span className="ms-2">Loading fees...</span>
                                                </div>
                                            ) : familySlips.length === 0 ? (
                                                <div className="p-4 text-center text-muted">No fee records found for this family.</div>
                                            ) : (
                                                <div className="table-responsive">
                                                    <table className="table table-hover align-middle mb-0">
                                                        <thead style={{ backgroundColor: 'rgba(35,61,77,0.05)' }}>
                                                            <tr>
                                                                <th className="ps-4">Month/Year</th>
                                                                <th>Students & Applied Heads</th>
                                                                <th className="text-end">Billed</th>
                                                                <th className="text-end">Received</th>
                                                                <th className="text-end">Remaining Balance</th>
                                                                <th className="text-center">Submission Date</th>
                                                                <th className="text-center pe-4">Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {familySlips.map((monthSlip, idx) => {
                                                                const remainingBalance = Math.max(0, Number(monthSlip.family_total_billed || 0) - Number(monthSlip.family_total_paid || 0));
                                                                const subDate = monthSlip.last_submission_date
                                                                    ? new Date(monthSlip.last_submission_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                                                    : '—';

                                                                return (
                                                                    <tr key={idx}>
                                                                        <td className="ps-4 fw-bold text-dark">
                                                                            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][monthSlip.month - 1]} {monthSlip.year}
                                                                        </td>
                                                                        <td>
                                                                            <div className="d-flex flex-column gap-2 py-2">
                                                                                {monthSlip.students.map((st: any, i: number) => {
                                                                                    const stRemaining = Math.max(0, Number(st.billed || 0) - Number(st.paid || 0));
                                                                                    const stSubDate = st.last_payment_date
                                                                                        ? new Date(st.last_payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                                                                        : '';
                                                                                    return (
                                                                                        <div key={i} className="d-flex flex-column bg-light p-2 rounded-3 border">
                                                                                            <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                                                                                                <div>
                                                                                                    <span className="fw-semibold text-dark mx-1 text-uppercase" style={{ fontSize: '0.8rem' }}>{st.admission_no}</span>
                                                                                                    <span className="fw-bold text-primary" style={{ fontSize: '0.8rem' }}>&bull; {st.name}</span>
                                                                                                </div>
                                                                                                <div className="small">
                                                                                                    <span className="text-muted me-2">Billed: {fmt(st.billed)}</span>
                                                                                                    <span className="text-success fw-semibold me-2">Paid: {fmt(st.paid)}</span>
                                                                                                    {stRemaining > 0 ? (
                                                                                                        <span className="text-danger fw-bold">Rem: {fmt(stRemaining)}</span>
                                                                                                    ) : (
                                                                                                        <span className="text-muted">Rem: 0</span>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="text-muted mt-1 d-flex justify-content-between align-items-center" style={{ fontSize: '0.75rem' }}>
                                                                                                <span>{st.heads?.map((h: any) => `${h.head_name} (${fmt(h.amount)})`).join(' • ') || 'No specific heads'}</span>
                                                                                                {stSubDate && <span className="text-dark fw-semibold ms-2"><i className="bi bi-clock me-1 text-primary"></i>Submitted: {stSubDate}</span>}
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </td>
                                                                        <td className="text-end fw-semibold" style={{ color: 'var(--primary-dark)' }}>{fmt(monthSlip.family_total_billed)}</td>
                                                                        <td className="text-end fw-bold" style={{ color: '#0d9e6e' }}>{fmt(monthSlip.family_total_paid)}</td>
                                                                        <td className="text-end fw-bold" style={{ color: remainingBalance > 0 ? '#dc3545' : '#6c757d' }}>
                                                                            {fmt(remainingBalance)}
                                                                        </td>
                                                                        <td className="text-center small">
                                                                            {subDate !== '—' ? (
                                                                                <span className="badge bg-light text-dark border fw-normal px-2 py-1">
                                                                                    <i className="bi bi-calendar-check me-1 text-success"></i>{subDate}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-muted">—</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="text-center pe-4">
                                                                            <span className={`badge px-3 py-2 rounded-pill ${monthSlip.status === 'paid' ? 'bg-success bg-opacity-10 text-success border border-success' : monthSlip.status === 'partial' ? 'bg-warning bg-opacity-10 text-warning border border-warning' : 'bg-danger bg-opacity-10 text-danger border border-danger'}`}>
                                                                                {monthSlip.status.toUpperCase()}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                 {/* Opening Balance (OPB) Section - Hidden on Student Portal as requested */}
                                 {/* 
                                 {activeTab === 'fees' && parseFloat(student.opening_balance || '0') > 0 && (
                                     <div className="card border-0 shadow-sm rounded-4 mt-4 overflow-hidden animate__animated animate__fadeInUp">
                                         <div className="card-header py-3 d-flex justify-content-between align-items-center"
                                             style={{ borderLeft: parseFloat(student.opb_remaining || '0') > 0 ? '4px solid #e13232' : '4px solid #0d9e6e', backgroundColor: 'white' }}>
                                             <h6 className="fw-bold mb-0" style={{ color: 'var(--primary-dark)' }}>
                                                 <i className="bi bi-clock-history me-2" style={{ color: 'var(--accent-orange)' }}></i>
                                                 Opening Balance <span className="fw-normal text-muted" style={{ fontSize: '0.8rem' }}>(Family Previous Dues)</span>
                                             </h6>
                                             {parseFloat(student.opb_remaining || '0') <= 0 ? (
                                                 <span className="badge rounded-pill bg-success bg-opacity-10 text-success border border-success px-3 py-2">
                                                     <i className="bi bi-check-circle-fill me-1" />Fully Cleared
                                                 </span>
                                             ) : (
                                                 <span className="badge rounded-pill px-3 py-2" style={{ background: '#fde8e8', color: '#e13232', border: '1px solid #e1323244', fontWeight: 600 }}>
                                                     <i className="bi bi-exclamation-circle-fill me-1" />
                                                     Remaining: {fmt(student.opb_remaining)}
                                                 </span>
                                             )}
                                         </div>
                                         <div className="card-body p-4">
                                             <div className="row g-3 text-center mb-3">
                                                 {[
                                                     { label: 'Original OPB', value: fmt(student.opening_balance), color: 'var(--primary-dark)', bg: 'rgba(35,61,77,0.07)' },
                                                     { label: 'Collected via Slips', value: fmt(student.opening_balance_paid), color: '#0d9e6e', bg: '#e6f9f3' },
                                                     { label: 'Still Remaining', value: fmt(student.opb_remaining), color: parseFloat(student.opb_remaining || '0') > 0 ? '#e13232' : '#0d9e6e', bg: parseFloat(student.opb_remaining || '0') > 0 ? '#fde8e8' : '#e6f9f3' },
                                                 ].map((s, i) => (
                                                     <div className="col-4" key={i}>
                                                         <div className="rounded-3 py-3" style={{ background: s.bg }}>
                                                             <div className="text-muted small">{s.label}</div>
                                                             <div className="fw-bold fs-6" style={{ color: s.color }}>{s.value}</div>
                                                         </div>
                                                     </div>
                                                 ))}
                                             </div>
                                             {parseFloat(student.opening_balance || '0') > 0 && (
                                                 <div className="mb-2">
                                                     <div className="d-flex justify-content-between small text-muted mb-1">
                                                         <span>OPB Collection Progress</span>
                                                         <span>{Math.round((parseFloat(student.opening_balance_paid || '0') / parseFloat(student.opening_balance)) * 100)}%</span>
                                                     </div>
                                                     <div className="progress" style={{ height: 10, borderRadius: 10 }}>
                                                         <div className="progress-bar" role="progressbar"
                                                             style={{
                                                                 width: `${Math.min(100, Math.round((parseFloat(student.opening_balance_paid || '0') / parseFloat(student.opening_balance)) * 100))}%`,
                                                                 background: parseFloat(student.opb_remaining || '0') <= 0 ? '#0d9e6e' : 'linear-gradient(90deg, var(--primary-teal), #34d399)',
                                                                 borderRadius: 10
                                                             }}>
                                                         </div>
                                                     </div>
                                                 </div>
                                             )}
                                             {student.opb_notes && (
                                                 <p className="text-muted mb-0 mt-2" style={{ fontSize: '0.82rem' }}>
                                                     <i className="bi bi-sticky me-1" style={{ color: 'var(--accent-orange)' }} /><em>{student.opb_notes}</em>
                                                 </p>
                                             )}
                                             {parseFloat(student.opb_remaining || '0') > 0 && (
                                                 <div className="alert border-0 rounded-3 mt-3 py-2 px-3 mb-0" style={{ background: 'rgba(254,127,45,0.1)', fontSize: '0.82rem' }}>
                                                     <i className="bi bi-info-circle me-1" style={{ color: 'var(--accent-orange)' }} />
                                                     OPB is the manually-set prior due. It is collected automatically when fee slips containing the <strong>Previous Balance</strong> head are paid via Collect Fee.
                                                 </div>
                                             )}
                                         </div>
                                     </div>
                                 )}
                                 */}

                                {/* Admission Fee Payment Modal (in profile) */}
                                {showPayModal && admissionFee && (
                                    <>
                                        <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
                                        <div className="modal fade show d-block" tabIndex={-1} style={{ zIndex: 1050 }}>
                                            <div className="modal-dialog modal-dialog-centered">
                                                <div className="modal-content border-0 shadow-lg">
                                                    <div className="modal-header text-white" style={{ backgroundColor: 'var(--primary-dark)' }}>
                                                        <h5 className="modal-title"><i className="bi bi-cash-coin me-2"></i>Receive Admission Fee</h5>
                                                        <button className="btn-close btn-close-white" onClick={() => setShowPayModal(false)}></button>
                                                    </div>
                                                    <div className="modal-body p-4">
                                                        <div className="rounded-3 p-3 mb-3" style={{ backgroundColor: 'var(--bg-main)' }}>
                                                            <div className="d-flex justify-content-between">
                                                                <span className="text-muted small">Remaining Amount</span>
                                                                <span className="fw-bold text-danger fs-5">{fmt(admissionFee.remaining_amount)}</span>
                                                            </div>
                                                        </div>
                                                        {payError && <div className="alert alert-danger py-2">{payError}</div>}
                                                        {paySuccess && <div className="alert alert-success py-2">{paySuccess}</div>}
                                                        <form onSubmit={handleAdmissionPay} className="row g-3">
                                                            <div className="col-12">
                                                                <label className="form-label fw-bold small text-muted">Amount Receiving (PKR) <span className="text-danger">*</span></label>
                                                                <input type="number" className="form-control fw-bold fs-5" required
                                                                    onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                                                    min="1" max={admissionFee.remaining_amount}
                                                                    value={payAmt} onChange={e => setPayAmt(e.target.value)} />
                                                            </div>
                                                            <div className="col-6">
                                                                <label className="form-label fw-bold small text-muted">Method</label>
                                                                <select className="form-select" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                                                                    <option value="cash">Cash</option>
                                                                    <option value="bank">Bank Transfer</option>
                                                                    <option value="online">Online</option>
                                                                    <option value="cheque">Cheque</option>
                                                                </select>
                                                            </div>
                                                            <div className="col-6">
                                                                <label className="form-label fw-bold small text-muted">Date</label>
                                                                <input type="date" className="form-control" value={payDate} onChange={e => setPayDate(e.target.value)} />
                                                            </div>
                                                            <div className="col-12">
                                                                <label className="form-label fw-bold small text-muted">Reference No (Optional)</label>
                                                                <input type="text" className="form-control" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Receipt / Ref No" />
                                                            </div>
                                                            <div className="col-12 d-flex gap-2 justify-content-end">
                                                                <button type="button" className="btn btn-secondary-custom px-4" onClick={() => setShowPayModal(false)}>Cancel</button>
                                                                {hasPermission('fees', 'write') && (
                                                                    <button type="submit" className="btn btn-primary-custom px-4" disabled={payingFee}>
                                                                        {payingFee ? <><span className="spinner-border spinner-border-sm me-2"></span>Processing...</> : 'Confirm'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </form>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {activeTab === 'attendance' && hasPermission('dash.student_att', 'read') && (
                                    <div className="animate__animated animate__fadeIn">
                                        {/* Filter row */}
                                        <div className="d-flex gap-2 mb-4 align-items-end flex-wrap">
                                            <div>
                                                <label className="form-label fw-bold small text-muted mb-1">Month</label>
                                                <select className="form-select form-select-sm" value={attMonth}
                                                    onChange={e => setAttMonth(e.target.value)}
                                                    style={{ minWidth: 130 }}>
                                                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((m, i) => (
                                                        <option key={m} value={m}>{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i]}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="form-label fw-bold small text-muted mb-1">Year</label>
                                                <select className="form-select form-select-sm" value={attYear}
                                                    onChange={e => setAttYear(e.target.value)}
                                                    style={{ minWidth: 90 }}>
                                                    {[String(now.getFullYear() - 1), String(now.getFullYear()), String(now.getFullYear() + 1)].map(y => (
                                                        <option key={y} value={y}>{y}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            {attLoading && (
                                                <div className="d-flex align-items-center text-teal small ms-2 pb-1">
                                                    <span className="spinner-border spinner-border-sm me-1" role="status" />
                                                    <span>Updating...</span>
                                                </div>
                                            )}
                                        </div>
                                        {/* Stats */}
                                        <div className="row g-2 mb-4">
                                            {[{ l: 'Present', v: attStats.present, c: '#198754' }, { l: 'Absent', v: attStats.absent, c: '#dc3545' }, { l: 'Late', v: attStats.late, c: '#fd7e14' }, { l: 'Leave', v: attStats.leave, c: '#0d6efd' }, { l: 'Total', v: attStats.total, c: '#6c757d' }].map(s => (
                                                <div className="col" key={s.l}>
                                                    <div className="card border-0 shadow-sm text-center py-2" style={{ borderTop: `3px solid ${s.c}` }}>
                                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.c }}>{s.v ?? 0}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>{s.l}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {/* % Badge */}
                                        {attStats.total > 0 && (
                                            <div className="mb-3">
                                                <div className="progress" style={{ height: 10, borderRadius: 10 }}>
                                                    <div className="progress-bar bg-success" style={{ width: `${Math.round(((attStats.present + attStats.late) / attStats.total) * 100)}%`, borderRadius: 10 }} />
                                                </div>
                                                <div className="small text-muted mt-1 text-end">
                                                    Attendance: {Math.round(((attStats.present + attStats.late) / attStats.total) * 100)}%
                                                </div>
                                            </div>
                                        )}
                                        {/* Records Table */}
                                        {attRecords.length > 0 ? (
                                            <div className="card border-0 shadow-sm rounded-4">
                                                <div className="table-responsive">
                                                    <table className="table table-hover table-sm mb-0">
                                                        <thead style={{ background: 'var(--primary-dark)', color: '#fff' }}>
                                                            <tr>
                                                                <th className="ps-4 py-2">#</th>
                                                                <th className="py-2">Date</th>
                                                                <th className="py-2">Day</th>
                                                                <th className="py-2">Status</th>
                                                                <th className="py-2">Class</th>
                                                                <th className="py-2">Remarks</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {attRecords.map((r: any, i: number) => {
                                                                const d = new Date(r.attendance_date);
                                                                const statusColor: Record<string, string> = { Present: '#198754', Absent: '#dc3545', Late: '#fd7e14', Leave: '#0d6efd' };
                                                                return (
                                                                    <tr key={r.attendance_id}>
                                                                        <td className="ps-4 text-muted small">{i + 1}</td>
                                                                        <td className="fw-medium">{d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                                        <td className="text-muted small">{d.toLocaleDateString('en-PK', { weekday: 'long' })}</td>
                                                                        <td>
                                                                            <span className="badge rounded-pill px-3"
                                                                                style={{ background: (statusColor[r.status] || '#6c757d') + '20', color: statusColor[r.status] || '#6c757d', border: `1px solid ${statusColor[r.status] || '#6c757d'}`, fontWeight: 700 }}>
                                                                                {r.status}
                                                                            </span>
                                                                        </td>
                                                                        <td className="text-muted small">{r.class_name || '—'}</td>
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
                                                <p className="mt-3 mb-0">No attendance data found</p>
                                                <small>No attendance recorded for the selected month</small>
                                            </div>
                                        ) : null}
                                    </div>
                                )}

                                {activeTab === 'documents' && (
                                    <div className="animate__animated animate__fadeIn">
                                        <div className="row g-3">
                                            {student.documents && (JSON.parse(student.documents).map((doc: string, i: number) => (
                                                <div className="col-md-4" key={i}>
                                                    <div className="card h-100 border-0 shadow-sm hover-shadow transition">
                                                        <div className="card-body text-center p-4">
                                                            <i className="bi bi-file-earmark-pdf fs-1 text-danger mb-3"></i>
                                                            <h6 className="text-truncate">Document {i + 1}</h6>
                                                            <a href={`${API}/${doc}`} target="_blank" className="btn btn-sm btn-outline-primary mt-2">View</a>
                                                        </div>
                                                    </div>
                                                </div>
                                            )))}
                                            {(!student.documents || JSON.parse(student.documents).length === 0) && (
                                                <div className="text-center p-5 text-muted">
                                                    <i className="bi bi-folder-x fs-1 opacity-50"></i>
                                                    <p className="mt-2">No documents uploaded</p>
                                                </div>
                                            )}
                                        </div>
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
