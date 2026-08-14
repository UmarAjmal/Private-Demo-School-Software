'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { notify } from '@/app/utils/notify';

const API = process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com";

interface SheetItem {
    sheet_type: 'term_exam' | 'class_test';
    term_id?: number;
    term_name?: string;
    class_id: number;
    class_name: string;
    section_id: number;
    section_name: string;
    subject_id: number;
    subject_name: string;
    test_id?: number;
    sheet_name: string;
    total_students: number;
    status: 'pending' | 'approved' | 'published';
    submitted_by: string;
    submitted_at: string;
    approved_by?: string;
    approved_at?: string;
    published_by?: string;
    published_at?: string;
}

interface StudentMarkRow {
    student_id: number;
    admission_no: string;
    roll_no: string;
    student_name: string;
    obtained_marks: number;
    total_marks: number;
    remarks?: string;
}

export default function MarksApprovalPage() {
    const { user } = useAuth();

    const [sheets, setSheets] = useState<SheetItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [roleLevel, setRoleLevel] = useState<number>(0);
    const [roleName, setRoleName] = useState<string>('');

    // Filters
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'published'>('all');
    const [typeFilter, setTypeFilter] = useState<'all' | 'term_exam' | 'class_test'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal Review State
    const [activeSheet, setActiveSheet] = useState<SheetItem | null>(null);
    const [sheetStudents, setSheetStudents] = useState<StudentMarkRow[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [updatingMarks, setUpdatingMarks] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Audio Sound Chime Helper
    const playChime = (type: 'success' | 'warning' | 'error') => {
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'success') {
                osc.frequency.setValueAtTime(523.25, ctx.currentTime);
                osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
                osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            } else if (type === 'warning') {
                osc.frequency.setValueAtTime(440, ctx.currentTime);
                osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.15);
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
            } else {
                osc.frequency.setValueAtTime(300, ctx.currentTime);
                osc.frequency.setValueAtTime(200, ctx.currentTime + 0.15);
                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
            }
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
        } catch (e) { }
    };

    // Load sheets list
    const fetchSheets = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const res = await fetch(`${API}/exams/approvals/list?user_id=${user.id}`);
            const data = await res.json();
            if (res.ok) {
                setSheets(data.sheets || []);
                setRoleLevel(data.role_level || 0);
                setRoleName(data.role_name || '');
            } else {
                notify.error(data.error || 'Failed to load approval sheets');
            }
        } catch (err) {
            console.error(err);
            notify.error('Network error loading approval sheets');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSheets();
    }, [user?.id]);

    // Filtered sheets
    const filteredSheets = useMemo(() => {
        return sheets.filter(item => {
            if (statusFilter !== 'all' && item.status !== statusFilter) return false;
            if (typeFilter !== 'all' && item.sheet_type !== typeFilter) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const name = (item.sheet_name || '').toLowerCase();
                const cls = (item.class_name || '').toLowerCase();
                const sec = (item.section_name || '').toLowerCase();
                const sub = (item.subject_name || '').toLowerCase();
                const teacher = (item.submitted_by || '').toLowerCase();
                return name.includes(q) || cls.includes(q) || sec.includes(q) || sub.includes(q) || teacher.includes(q);
            }
            return true;
        });
    }, [sheets, statusFilter, typeFilter, searchQuery]);

    // Stats
    const stats = useMemo(() => {
        const total = sheets.length;
        const pending = sheets.filter(s => s.status === 'pending').length;
        const approved = sheets.filter(s => s.status === 'approved').length;
        const published = sheets.filter(s => s.status === 'published').length;
        return { total, pending, approved, published };
    }, [sheets]);

    // Open sheet review modal
    const openReviewModal = async (sheet: SheetItem) => {
        setActiveSheet(sheet);
        setLoadingDetails(true);
        try {
            const params = new URLSearchParams({
                user_id: user?.id?.toString() || '',
                sheet_type: sheet.sheet_type,
            });
            if (sheet.term_id) params.append('term_id', sheet.term_id.toString());
            if (sheet.class_id) params.append('class_id', sheet.class_id.toString());
            if (sheet.section_id) params.append('section_id', sheet.section_id.toString());
            if (sheet.subject_id) params.append('subject_id', sheet.subject_id.toString());
            if (sheet.test_id) params.append('test_id', sheet.test_id.toString());

            const res = await fetch(`${API}/exams/approvals/sheet-details?${params.toString()}`);
            const data = await res.json();
            if (res.ok) {
                setSheetStudents(data.students || []);
                if (data.meta) {
                    setActiveSheet(prev => prev ? { ...prev, ...data.meta } : null);
                }
            } else {
                notify.error(data.error || 'Failed to load sheet details');
            }
        } catch (err) {
            console.error(err);
            notify.error('Network error loading sheet details');
        } finally {
            setLoadingDetails(false);
        }
    };

    // Handle student obtained_marks change in modal
    const handleMarksChange = (studentId: number, newMarks: string) => {
        const num = parseFloat(newMarks);
        setSheetStudents(prev => prev.map(s => {
            if (s.student_id === studentId) {
                return { ...s, obtained_marks: isNaN(num) ? 0 : num };
            }
            return s;
        }));
    };

    // Save adjusted marks
    const handleSaveAdjustedMarks = async () => {
        if (!activeSheet || !user?.id) return;
        setUpdatingMarks(true);
        try {
            const payload = {
                user_id: user.id,
                sheet_type: activeSheet.sheet_type,
                term_id: activeSheet.term_id,
                class_id: activeSheet.class_id,
                section_id: activeSheet.section_id,
                subject_id: activeSheet.subject_id,
                test_id: activeSheet.test_id,
                marks: sheetStudents.map(s => ({
                    student_id: s.student_id,
                    obtained_marks: s.obtained_marks,
                    total_marks: s.total_marks,
                    remarks: s.remarks
                }))
            };

            const res = await fetch(`${API}/exams/approvals/update-marks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok) {
                playChime('success');
                notify.success('Student marks adjusted and saved successfully!');
            } else {
                playChime('error');
                notify.error(data.error || 'Failed to save marks adjustment');
            }
        } catch (err) {
            console.error(err);
            playChime('error');
            notify.error('Network error saving marks adjustment');
        } finally {
            setUpdatingMarks(false);
        }
    };

    // Change status (approve / publish / unpublish)
    const handleStatusAction = async (action: 'approve' | 'publish' | 'unpublish') => {
        if (!activeSheet || !user?.id) return;

        // Role restriction check on frontend for early feedback
        if ((action === 'publish' || action === 'unpublish') && roleLevel < 90) {
            playChime('warning');
            notify.error('Access Restricted: Only Vice Principal, Principal, or Administrator can publish or unpublish marks to Student Portal!');
            return;
        }

        setActionLoading(true);
        try {
            const payload = {
                user_id: user.id,
                sheet_type: activeSheet.sheet_type,
                term_id: activeSheet.term_id,
                class_id: activeSheet.class_id,
                section_id: activeSheet.section_id,
                subject_id: activeSheet.subject_id,
                test_id: activeSheet.test_id,
                action
            };

            const res = await fetch(`${API}/exams/approvals/change-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok) {
                playChime('success');
                const targetStatus = action === 'approve' ? 'approved' : action === 'publish' ? 'published' : 'pending';
                notify.success(`Sheet ${action === 'publish' ? 'published to Student Portal' : action === 'approve' ? 'approved' : 'reverted'} successfully!`);

                setActiveSheet(prev => prev ? { ...prev, status: targetStatus } : null);
                fetchSheets();
            } else {
                playChime('error');
                notify.error(data.error || `Failed to ${action} sheet`);
            }
        } catch (err) {
            console.error(err);
            playChime('error');
            notify.error(`Network error executing ${action}`);
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="container-fluid p-2 p-sm-3 p-md-4 min-vh-100" style={{ background: 'var(--bg-main)' }}>
            {/* Header Banner */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-stretch align-items-md-center gap-2 gap-md-3 mb-3 mb-md-4 p-3 p-md-4 rounded-4 shadow-sm"
                style={{
                    background: 'linear-gradient(135deg, var(--primary-dark) 0%, #152d3e 60%, #0f2030 100%)',
                    color: 'white',
                    borderLeft: '5px solid var(--accent-orange)'
                }}>
                <div>
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                        <span className="badge px-2.5 py-1 rounded-pill" style={{ background: 'rgba(254,127,45,0.2)', color: 'var(--accent-orange)', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em' }}>
                            <i className="bi bi-shield-lock-fill me-1"></i>EXAMINATION GOVERNANCE
                        </span>
                        {roleName && (
                            <span className="badge bg-light text-dark fw-bold px-2 py-1" style={{ fontSize: 10 }}>
                                Role: {roleName} (Lvl {roleLevel})
                            </span>
                        )}
                    </div>
                    <h2 className="mb-1 fw-bold text-white" style={{ letterSpacing: '-0.5px', fontSize: 'clamp(1.1rem, 2.5vw, 1.75rem)' }}>
                        Marks Approval &amp; Publishing Portal
                    </h2>
                    <p className="text-white-50 mb-0 small" style={{ fontSize: 'clamp(10px, 1.8vw, 13px)' }}>
                        Review, adjust student marks, approve term sheets &amp; publish officially to Student/Parent Portals.
                    </p>
                </div>
            </div>

            {/* Stat Summary Cards - 2 per row on mobile, 4 on desktop */}
            <div className="row g-2 g-md-3 mb-3 mb-md-4">
                {/* 1. Total Sheets */}
                <div className="col-6 col-sm-6 col-lg-3">
                    <div className="card shadow-sm border-0 rounded-3 p-2.5 p-md-3 bg-white h-100" style={{ borderLeft: '4px solid var(--primary-dark)' }}>
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <span className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: 9, letterSpacing: '0.05em' }}>Total Sheets</span>
                                <h3 className="fw-bold mb-0 mt-1" style={{ color: 'var(--primary-dark)', fontSize: 'clamp(1.2rem, 3vw, 1.75rem)' }}>{stats.total}</h3>
                            </div>
                            <div className="rounded-circle p-2 p-md-2.5" style={{ background: '#f1f5f9', color: 'var(--primary-dark)' }}>
                                <i className="bi bi-folder-fill fs-5"></i>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Pending Approval */}
                <div className="col-6 col-sm-6 col-lg-3">
                    <div className="card shadow-sm border-0 rounded-3 p-2.5 p-md-3 bg-white h-100" style={{ borderLeft: '4px solid #f59e0b' }}>
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <span className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: 9, letterSpacing: '0.05em' }}>Pending</span>
                                <h3 className="fw-bold mb-0 mt-1 text-warning" style={{ fontSize: 'clamp(1.2rem, 3vw, 1.75rem)' }}>{stats.pending}</h3>
                            </div>
                            <div className="rounded-circle p-2 p-md-2.5" style={{ background: '#fef3c7', color: '#d97706' }}>
                                <i className="bi bi-hourglass-split fs-5"></i>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Approved (Unpublished) */}
                <div className="col-6 col-sm-6 col-lg-3">
                    <div className="card shadow-sm border-0 rounded-3 p-2.5 p-md-3 bg-white h-100" style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <span className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: 9, letterSpacing: '0.05em' }}>Approved</span>
                                <h3 className="fw-bold mb-0 mt-1" style={{ color: 'var(--primary-teal)', fontSize: 'clamp(1.2rem, 3vw, 1.75rem)' }}>{stats.approved}</h3>
                            </div>
                            <div className="rounded-circle p-2 p-md-2.5" style={{ background: '#ccfbf1', color: '#0d9488' }}>
                                <i className="bi bi-shield-check fs-5"></i>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Published to Portal */}
                <div className="col-6 col-sm-6 col-lg-3">
                    <div className="card shadow-sm border-0 rounded-3 p-2.5 p-md-3 bg-white h-100" style={{ borderLeft: '4px solid #10b981' }}>
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <span className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: 9, letterSpacing: '0.05em' }}>Published</span>
                                <h3 className="fw-bold mb-0 mt-1 text-success" style={{ fontSize: 'clamp(1.2rem, 3vw, 1.75rem)' }}>{stats.published}</h3>
                            </div>
                            <div className="rounded-circle p-2 p-md-2.5" style={{ background: '#dcfce7', color: '#16a34a' }}>
                                <i className="bi bi-globe fs-5"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="card border-0 shadow-sm rounded-3 mb-3 mb-md-4 bg-white">
                <div className="card-body p-2.5 p-md-3">
                    <div className="row g-2 align-items-center">
                        {/* Mobile Horizontal Scrollable Status Pills */}
                        <div className="col-12 col-md-6">
                            <div className="d-flex overflow-x-auto text-nowrap pb-1 pb-md-0 gap-1 p-1 bg-light rounded-3 border">
                                <button
                                    className={`btn btn-sm rounded-2 fw-semibold px-2.5 px-md-3 ${statusFilter === 'all' ? 'btn-dark text-white shadow-sm' : 'btn-light text-muted'}`}
                                    style={{ fontSize: '0.8rem' }}
                                    onClick={() => setStatusFilter('all')}
                                >
                                    All ({stats.total})
                                </button>
                                <button
                                    className={`btn btn-sm rounded-2 fw-semibold px-2.5 px-md-3 ${statusFilter === 'pending' ? 'btn-warning text-dark shadow-sm' : 'btn-light text-muted'}`}
                                    style={{ fontSize: '0.8rem' }}
                                    onClick={() => setStatusFilter('pending')}
                                >
                                    Pending ({stats.pending})
                                </button>
                                <button
                                    className={`btn btn-sm rounded-2 fw-semibold px-2.5 px-md-3 ${statusFilter === 'approved' ? 'btn-info text-white shadow-sm' : 'btn-light text-muted'}`}
                                    style={{ fontSize: '0.8rem' }}
                                    onClick={() => setStatusFilter('approved')}
                                >
                                    Approved ({stats.approved})
                                </button>
                                <button
                                    className={`btn btn-sm rounded-2 fw-semibold px-2.5 px-md-3 ${statusFilter === 'published' ? 'btn-success text-white shadow-sm' : 'btn-light text-muted'}`}
                                    style={{ fontSize: '0.8rem' }}
                                    onClick={() => setStatusFilter('published')}
                                >
                                    Published ({stats.published})
                                </button>
                            </div>
                        </div>

                        {/* Type & Search */}
                        <div className="col-12 col-md-6 d-flex flex-wrap gap-2 justify-content-md-end">
                            <select
                                className="form-select form-select-sm rounded-3 border bg-light flex-grow-1 flex-md-grow-0"
                                style={{ width: 'auto', minWidth: '130px', fontSize: '0.82rem' }}
                                value={typeFilter}
                                onChange={e => setTypeFilter(e.target.value as any)}
                            >
                                <option value="all">All Sheet Types</option>
                                <option value="term_exam">Term Exams</option>
                                <option value="class_test">Class Tests</option>
                            </select>

                            <div className="input-group input-group-sm flex-grow-1" style={{ maxWidth: '100%' }}>
                                <span className="input-group-text bg-light border-end-0">
                                    <i className="bi bi-search text-muted"></i>
                                </span>
                                <input
                                    type="text"
                                    className="form-control bg-light border-start-0"
                                    style={{ fontSize: '0.82rem' }}
                                    placeholder="Search class, subject, teacher..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button className="btn btn-light border-start-0" onClick={() => setSearchQuery('')}>
                                        <i className="bi bi-x text-muted"></i>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Desktop Table View (>= 768px) & Mobile Card View (< 768px) */}
            <div className="card border-0 shadow-sm rounded-3 overflow-hidden bg-white">
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-teal" role="status" style={{ color: 'var(--primary-teal)' }}></div>
                            <div className="text-muted small mt-2">Loading mark sheets for review...</div>
                        </div>
                    ) : filteredSheets.length === 0 ? (
                        <div className="text-center py-5 text-muted p-3">
                            <i className="bi bi-clipboard-x fs-1 d-block mb-2 opacity-50"></i>
                            <div className="fw-semibold">No mark sheets found.</div>
                            <small>Try selecting a different filter tab or clear search query.</small>
                        </div>
                    ) : (
                        <>
                            {/* 1. Desktop & Tablet Table View (Visible >= 768px) */}
                            <div className="table-responsive d-none d-md-block">
                                <table className="table align-middle mb-0" style={{ fontSize: '0.88rem' }}>
                                    <thead style={{ backgroundColor: 'var(--primary-dark)', color: '#fff' }}>
                                        <tr>
                                            <th style={{ padding: '12px 14px' }}>Sheet Type</th>
                                            <th style={{ padding: '12px 14px' }}>Sheet Name</th>
                                            <th style={{ padding: '12px 14px' }}>Class &amp; Section</th>
                                            <th style={{ padding: '12px 14px' }}>Subject</th>
                                            <th className="text-center" style={{ padding: '12px 14px' }}>Students</th>
                                            <th style={{ padding: '12px 14px' }}>Submitted By</th>
                                            <th className="text-center" style={{ padding: '12px 14px' }}>Status</th>
                                            <th className="text-center" style={{ padding: '12px 14px' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSheets.map((item, idx) => (
                                            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                                                <td style={{ padding: '12px 14px' }}>
                                                    {item.sheet_type === 'term_exam' ? (
                                                        <span className="badge rounded-pill bg-indigo bg-opacity-10 text-indigo border px-2.5 py-1" style={{ color: '#4338ca', backgroundColor: '#e0e7ff', fontSize: '0.75rem' }}>
                                                            <i className="bi bi-journal-bookmark-fill me-1"></i>Term Exam
                                                        </span>
                                                    ) : (
                                                        <span className="badge rounded-pill bg-teal bg-opacity-10 text-teal border px-2.5 py-1" style={{ color: '#0d9488', backgroundColor: '#ccfbf1', fontSize: '0.75rem' }}>
                                                            <i className="bi bi-file-earmark-text-fill me-1"></i>Class Test
                                                        </span>
                                                    )}
                                                </td>

                                                <td style={{ padding: '12px 14px' }}>
                                                    <div className="fw-bold text-dark">{item.sheet_name}</div>
                                                    {item.term_name && <small className="text-muted">{item.term_name}</small>}
                                                </td>

                                                <td style={{ padding: '12px 14px' }}>
                                                    <span className="fw-semibold text-dark">{item.class_name}</span>
                                                    <span className="text-muted ms-1">({item.section_name})</span>
                                                </td>

                                                <td style={{ padding: '12px 14px' }}>
                                                    <span className="badge bg-light text-dark border px-2 py-1" style={{ fontSize: '0.78rem' }}>
                                                        {item.subject_name}
                                                    </span>
                                                </td>

                                                <td className="text-center fw-bold text-secondary" style={{ padding: '12px 14px' }}>
                                                    {item.total_students}
                                                </td>

                                                <td style={{ padding: '12px 14px' }}>
                                                    <div className="small fw-semibold text-dark">{item.submitted_by}</div>
                                                    {item.submitted_at && (
                                                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                                                            {new Date(item.submitted_at).toLocaleDateString()}
                                                        </small>
                                                    )}
                                                </td>

                                                <td className="text-center" style={{ padding: '12px 14px' }}>
                                                    {item.status === 'published' ? (
                                                        <span className="badge rounded-pill bg-success bg-opacity-15 text-success border border-success px-2.5 py-1" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                                                            <i className="bi bi-globe me-1"></i>PUBLISHED
                                                        </span>
                                                    ) : item.status === 'approved' ? (
                                                        <span className="badge rounded-pill bg-teal bg-opacity-15 text-teal border border-teal px-2.5 py-1" style={{ color: '#0d9488', backgroundColor: '#ccfbf1', fontSize: '0.75rem', fontWeight: 700 }}>
                                                            <i className="bi bi-shield-check me-1"></i>APPROVED
                                                        </span>
                                                    ) : (
                                                        <span className="badge rounded-pill bg-warning bg-opacity-15 text-warning-emphasis border border-warning px-2.5 py-1" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                                                            <i className="bi bi-hourglass-split me-1"></i>PENDING
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="text-center" style={{ padding: '12px 14px' }}>
                                                    <button
                                                        className="btn btn-sm text-white fw-semibold d-inline-flex align-items-center gap-1 shadow-sm px-3"
                                                        style={{ backgroundColor: 'var(--primary-teal)', borderColor: 'var(--primary-teal)' }}
                                                        onClick={() => openReviewModal(item)}
                                                    >
                                                        <i className="bi bi-eye-fill"></i>
                                                        <span>Review &amp; Approve</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* 2. Mobile ListView Card Stack (Visible < 768px) */}
                            <div className="d-block d-md-none p-2">
                                {filteredSheets.map((item, idx) => (
                                    <div key={idx} className="card border rounded-3 p-3 mb-2.5 shadow-sm bg-white">
                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                            <div>
                                                {item.sheet_type === 'term_exam' ? (
                                                    <span className="badge rounded-pill bg-indigo bg-opacity-10 text-indigo border px-2 py-0.5" style={{ color: '#4338ca', backgroundColor: '#e0e7ff', fontSize: '0.7rem' }}>
                                                        <i className="bi bi-journal-bookmark-fill me-1"></i>Term Exam
                                                    </span>
                                                ) : (
                                                    <span className="badge rounded-pill bg-teal bg-opacity-10 text-teal border px-2 py-0.5" style={{ color: '#0d9488', backgroundColor: '#ccfbf1', fontSize: '0.7rem' }}>
                                                        <i className="bi bi-file-earmark-text-fill me-1"></i>Class Test
                                                    </span>
                                                )}
                                                <h6 className="fw-bold text-dark mt-1 mb-0">{item.sheet_name}</h6>
                                            </div>
                                            <div>
                                                {item.status === 'published' ? (
                                                    <span className="badge rounded-pill bg-success bg-opacity-15 text-success border border-success px-2 py-1" style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                                                        PUBLISHED
                                                    </span>
                                                ) : item.status === 'approved' ? (
                                                    <span className="badge rounded-pill bg-teal bg-opacity-15 text-teal border border-teal px-2 py-1" style={{ color: '#0d9488', backgroundColor: '#ccfbf1', fontSize: '0.68rem', fontWeight: 700 }}>
                                                        APPROVED
                                                    </span>
                                                ) : (
                                                    <span className="badge rounded-pill bg-warning text-dark border border-warning px-2 py-1" style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                                                        PENDING
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="row g-1 small text-muted mb-2.5" style={{ fontSize: '0.78rem' }}>
                                            <div className="col-6">
                                                <i className="bi bi-building me-1"></i>
                                                <span className="fw-semibold text-dark">{item.class_name} ({item.section_name})</span>
                                            </div>
                                            <div className="col-6 text-end">
                                                <i className="bi bi-book me-1"></i>
                                                <span className="fw-semibold text-dark">{item.subject_name}</span>
                                            </div>
                                            <div className="col-6 mt-1">
                                                <i className="bi bi-person me-1"></i>{item.submitted_by}
                                            </div>
                                            <div className="col-6 text-end mt-1">
                                                <i className="bi bi-people me-1"></i>{item.total_students} Students
                                            </div>
                                        </div>

                                        <button
                                            className="btn btn-sm text-white fw-semibold w-100 d-flex align-items-center justify-content-center gap-1 shadow-sm py-2"
                                            style={{ backgroundColor: 'var(--primary-teal)', borderColor: 'var(--primary-teal)', borderRadius: '8px' }}
                                            onClick={() => openReviewModal(item)}
                                        >
                                            <i className="bi bi-eye-fill"></i>
                                            <span>Review &amp; Approve Sheet</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Review & Approve Modal (100% Mobile Responsive Window) */}
            {activeSheet && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 1050 }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable my-2 my-sm-4 mx-auto" style={{ maxWidth: '95%' }}>
                        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                            {/* Modal Header */}
                            <div className="modal-header text-white p-2.5 p-sm-3" style={{ background: 'linear-gradient(135deg, var(--primary-dark) 0%, #152d3e 100%)' }}>
                                <div className="d-flex align-items-center gap-2">
                                    <div className="rounded-circle p-1.5 p-sm-2 bg-white bg-opacity-10">
                                        <i className="bi bi-shield-check fs-5 text-warning"></i>
                                    </div>
                                    <div>
                                        <h5 className="modal-title fw-bold mb-0 text-white" style={{ fontSize: 'clamp(0.95rem, 2vw, 1.15rem)' }}>
                                            {activeSheet.sheet_name}
                                        </h5>
                                        <div className="small text-white-50" style={{ fontSize: 'clamp(0.7rem, 1.5vw, 0.8rem)' }}>
                                            Class {activeSheet.class_name} ({activeSheet.section_name}) &bull; Subject: {activeSheet.subject_name}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => setActiveSheet(null)}
                                ></button>
                            </div>

                            {/* Modal Sub-Header Status Pill */}
                            <div className="bg-light p-2 p-sm-2.5 px-3 border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2" style={{ fontSize: '0.8rem' }}>
                                <div className="d-flex align-items-center gap-2">
                                    <span className="text-muted fw-semibold">Status:</span>
                                    {activeSheet.status === 'published' ? (
                                        <span className="badge bg-success text-white px-2.5 py-1 rounded-pill fw-bold">
                                            <i className="bi bi-globe me-1"></i>Published
                                        </span>
                                    ) : activeSheet.status === 'approved' ? (
                                        <span className="badge bg-info text-white px-2.5 py-1 rounded-pill fw-bold">
                                            <i className="bi bi-shield-check me-1"></i>Approved
                                        </span>
                                    ) : (
                                        <span className="badge bg-warning text-dark px-2.5 py-1 rounded-pill fw-bold">
                                            <i className="bi bi-hourglass-split me-1"></i>Pending
                                        </span>
                                    )}
                                </div>
                                <div className="text-muted small">
                                    Teacher: <strong>{activeSheet.submitted_by}</strong>
                                </div>
                            </div>

                            {/* Modal Body - Responsive Student Marks List */}
                            <div className="modal-body p-2 p-sm-3">
                                {loadingDetails ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-teal" role="status" style={{ color: 'var(--primary-teal)' }}></div>
                                        <div className="text-muted small mt-2">Loading student marks...</div>
                                    </div>
                                ) : sheetStudents.length === 0 ? (
                                    <div className="text-center py-4 text-muted">
                                        No student records found in this sheet.
                                    </div>
                                ) : (
                                    <>
                                        {/* Desktop & Tablet Table (>= 576px) */}
                                        <div className="table-responsive d-none d-sm-block">
                                            <table className="table align-middle table-hover mb-0" style={{ fontSize: '0.85rem' }}>
                                                <thead className="table-dark">
                                                    <tr>
                                                        <th className="text-center" style={{ width: '5%' }}>Roll</th>
                                                        <th style={{ width: '35%' }}>Student Name</th>
                                                        <th className="text-center" style={{ width: '15%' }}>Admission No</th>
                                                        <th className="text-center" style={{ width: '20%' }}>Total Marks</th>
                                                        <th className="text-center" style={{ width: '25%' }}>Obtained Marks</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sheetStudents.map((std, sIdx) => {
                                                        const initials = (std.student_name || '?').charAt(0).toUpperCase();
                                                        const bgColors = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a'];
                                                        const avatarColor = bgColors[sIdx % bgColors.length];

                                                        return (
                                                            <tr key={std.student_id}>
                                                                <td className="text-center fw-bold text-muted">{std.roll_no || '—'}</td>
                                                                <td>
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        <div
                                                                            className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                                                                            style={{ width: 28, height: 28, fontSize: 11, backgroundColor: avatarColor }}
                                                                        >
                                                                            {initials}
                                                                        </div>
                                                                        <span className="fw-semibold text-dark">{std.student_name}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="text-center">
                                                                    <span className="badge bg-light text-muted border">{std.admission_no}</span>
                                                                </td>
                                                                <td className="text-center fw-bold text-secondary">
                                                                    {std.total_marks}
                                                                </td>
                                                                <td className="text-center">
                                                                    <input
                                                                        type="number"
                                                                        step="0.5"
                                                                        min="0"
                                                                        max={std.total_marks}
                                                                        className="form-control form-control-sm text-center fw-bold mx-auto"
                                                                        style={{ width: '90px', borderColor: 'var(--primary-teal)' }}
                                                                        value={std.obtained_marks}
                                                                        onChange={e => handleMarksChange(std.student_id, e.target.value)}
                                                                    />
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Mobile Phone Card List (< 576px) */}
                                        <div className="d-block d-sm-none">
                                            {sheetStudents.map((std, sIdx) => {
                                                const initials = (std.student_name || '?').charAt(0).toUpperCase();
                                                const bgColors = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a'];
                                                const avatarColor = bgColors[sIdx % bgColors.length];

                                                return (
                                                    <div key={std.student_id} className="card border rounded-3 p-2.5 mb-2 bg-white shadow-xs">
                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                            <div className="d-flex align-items-center gap-2">
                                                                <div
                                                                    className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                                                                    style={{ width: 30, height: 30, fontSize: 12, backgroundColor: avatarColor }}
                                                                >
                                                                    {initials}
                                                                </div>
                                                                <div>
                                                                    <div className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>{std.student_name}</div>
                                                                    <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                                                                        Roll: <strong>{std.roll_no || '—'}</strong> &bull; Adm: <strong>{std.admission_no}</strong>
                                                                    </small>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                                                            <span className="small text-muted fw-semibold" style={{ fontSize: '0.78rem' }}>
                                                                Total: <strong className="text-dark">{std.total_marks}</strong>
                                                            </span>

                                                            <div className="d-flex align-items-center gap-1.5">
                                                                <span className="small text-muted" style={{ fontSize: '0.75rem' }}>Obtained:</span>
                                                                <input
                                                                    type="number"
                                                                    step="0.5"
                                                                    min="0"
                                                                    max={std.total_marks}
                                                                    className="form-control form-control-sm text-center fw-bold"
                                                                    style={{ width: '80px', borderColor: 'var(--primary-teal)' }}
                                                                    value={std.obtained_marks}
                                                                    onChange={e => handleMarksChange(std.student_id, e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Modal Footer Controls (Stacking Buttons on Mobile) */}
                            <div className="modal-footer bg-light p-2.5 p-sm-3 d-flex flex-column flex-sm-row justify-content-between align-items-stretch align-items-sm-center gap-2">
                                <div>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary w-100 w-sm-auto d-inline-flex align-items-center justify-content-center gap-1"
                                        onClick={handleSaveAdjustedMarks}
                                        disabled={updatingMarks}
                                    >
                                        <i className="bi bi-save"></i>
                                        <span>{updatingMarks ? 'Saving...' : 'Save Marks Adjustment'}</span>
                                    </button>
                                </div>

                                <div className="d-flex flex-column flex-sm-row gap-2">
                                    {/* Action 1: Approve (For Head Teacher, Coordinator, VP, Principal, Admin - level >= 65) */}
                                    {activeSheet.status !== 'approved' && activeSheet.status !== 'published' && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-info text-white fw-bold px-3 d-inline-flex align-items-center justify-content-center gap-1 shadow-sm"
                                            onClick={() => handleStatusAction('approve')}
                                            disabled={actionLoading}
                                        >
                                            <i className="bi bi-shield-check"></i>
                                            <span>Approve Sheet</span>
                                        </button>
                                    )}

                                    {/* Action 2: Publish (For Vice Principal, Principal, Admin - level >= 90) */}
                                    {activeSheet.status !== 'published' && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-success text-white fw-bold px-3 d-inline-flex align-items-center justify-content-center gap-1 shadow-sm"
                                            onClick={() => handleStatusAction('publish')}
                                            disabled={actionLoading}
                                        >
                                            <i className="bi bi-globe"></i>
                                            <span>Publish to Student Portal</span>
                                        </button>
                                    )}

                                    {/* Action 3: Unpublish / Revert (For VP, Principal, Admin - level >= 90) */}
                                    {activeSheet.status === 'published' && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-danger fw-bold px-3 d-inline-flex align-items-center justify-content-center gap-1"
                                            onClick={() => handleStatusAction('unpublish')}
                                            disabled={actionLoading}
                                        >
                                            <i className="bi bi-arrow-counterclockwise"></i>
                                            <span>Unpublish / Revert</span>
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        className="btn btn-sm btn-secondary"
                                        onClick={() => setActiveSheet(null)}
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
