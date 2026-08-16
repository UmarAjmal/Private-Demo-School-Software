'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { notify } from '@/app/utils/notify';
import { useAuth } from '@/contexts/AuthContext';

export default function AcademicApprovalsPage() {
    const { user } = useAuth();

    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pending_coordinator' | 'pending_vp' | 'pending_principal' | 'approved'>('pending_coordinator');
    const [actionLoading, setActionLoading] = useState(false);

    // Review Modal State
    const [selectedDoc, setSelectedDoc] = useState<any>(null);
    const [reviewRemarks, setReviewRemarks] = useState('');
    const [reviewAction, setReviewAction] = useState<'approve' | 'request_revision' | 'reject'>('approve');

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://shmool.onrender.com';

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/academic-studio/documents`);
            if (res.ok) {
                setDocuments(await res.json());
            }
        } catch (err: any) {
            console.error(err);
            notify.error('Failed to load review documents');
        } finally {
            setLoading(false);
        }
    };

    const handleExecuteReview = async () => {
        if (!selectedDoc) return;
        if (reviewAction === 'request_revision' && !reviewRemarks.trim()) {
            notify.error('Please enter specific revision remarks for the teacher');
            return;
        }

        setActionLoading(true);
        try {
            // Determine reviewer role based on logged in user or current tab
            const userRoleName = user?.role_name || (
                activeTab === 'pending_coordinator' ? 'Coordinator' :
                activeTab === 'pending_vp' ? 'Vice Principal' : 'Principal'
            );

            const res = await fetch(`${API_URL}/academic-studio/documents/${selectedDoc.id}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reviewer_user_id: user?.id,
                    reviewer_role: userRoleName,
                    action: reviewAction,
                    remarks: reviewRemarks.trim()
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            notify.success(`Review completed: Document ${reviewAction === 'approve' ? 'Approved' : reviewAction === 'request_revision' ? 'Sent back for Revisions' : 'Rejected'}`);
            setSelectedDoc(null);
            setReviewRemarks('');
            fetchDocuments();
        } catch (err: any) {
            notify.error(err.message || 'Failed to submit review');
        } finally {
            setActionLoading(false);
        }
    };

    // Filter documents by tab
    const tabDocs = documents.filter(d => {
        if (activeTab === 'approved') return d.status === 'approved';
        return d.status === activeTab;
    });

    const getRoleQueueTitle = (tab: string) => {
        switch (tab) {
            case 'pending_coordinator': return 'Level 1: Coordinator Review Queue';
            case 'pending_vp': return 'Level 2: Vice Principal Review Queue';
            case 'pending_principal': return 'Level 3: Principal Final Approval';
            case 'approved': return 'Approved Academic Repository';
            default: return 'Review Queue';
        }
    };

    return (
        <div className="container-fluid py-4 px-3 px-md-4 animate__animated animate__fadeIn">
            {/* Top Hero Banner */}
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4" style={{ background: 'linear-gradient(135deg, #1e293b 0%, var(--primary-dark, #195053) 100%)' }}>
                <div className="card-body p-4 p-lg-5 text-white">
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                        <div>
                            <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill bg-white bg-opacity-10 text-warning small fw-bold mb-2">
                                <i className="bi bi-shield-check"></i> Quality & Compliance Assurance Deck
                            </div>
                            <h2 className="fw-bold mb-1">📋 Academic Review & Approvals Deck</h2>
                            <p className="text-white-50 mb-0">Multi-tier evaluation deck for Coordinators, Vice Principals, and Principals to review and approve exams, notes, and packs.</p>
                        </div>
                        <div>
                            <Link href="/academic/studio" className="btn btn-warning rounded-pill px-4 py-2.5 fw-bold shadow-sm d-inline-flex align-items-center gap-2 text-dark">
                                <i className="bi bi-palette"></i> Academic Content Studio
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Role Queues Tabs */}
            <div className="card border-0 shadow-sm rounded-4 mb-4 bg-white">
                <div className="card-header bg-white border-bottom p-2.5">
                    <div className="d-flex align-items-center gap-2 overflow-x-auto text-nowrap scrollbar-none">
                        {[
                            { id: 'pending_coordinator', label: 'Coordinator Queue (L1)', icon: 'bi-1-circle-fill', count: documents.filter(d => d.status === 'pending_coordinator').length, badgeColor: 'bg-warning text-dark' },
                            { id: 'pending_vp', label: 'Vice Principal Queue (L2)', icon: 'bi-2-circle-fill', count: documents.filter(d => d.status === 'pending_vp').length, badgeColor: 'bg-info text-dark' },
                            { id: 'pending_principal', label: 'Principal Final Stamp (L3)', icon: 'bi-3-circle-fill', count: documents.filter(d => d.status === 'pending_principal').length, badgeColor: 'bg-primary text-white' },
                            { id: 'approved', label: 'Approved & Finalized', icon: 'bi-check-circle-fill', count: documents.filter(d => d.status === 'approved').length, badgeColor: 'bg-success text-white' }
                        ].map(tab => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className="btn btn-sm d-inline-flex align-items-center gap-2 px-3.5 py-2.5 rounded-3 fw-bold transition-all border-0"
                                    style={{
                                        fontSize: '0.88rem',
                                        backgroundColor: isActive ? 'var(--primary-teal, #195053)' : '#f8fafc',
                                        color: isActive ? '#ffffff' : '#64748b',
                                        boxShadow: isActive ? '0 4px 12px rgba(25, 80, 83, 0.25)' : 'none',
                                        border: isActive ? '1px solid var(--primary-teal, #195053)' : '1px solid #e2e8f0'
                                    }}
                                >
                                    <i className={`bi ${tab.icon}`} style={{ color: isActive ? '#ffffff' : '#64748b' }}></i>
                                    <span>{tab.label}</span>
                                    {tab.count > 0 && (
                                        <span className={`badge rounded-pill ${tab.badgeColor} ms-1`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="fw-bold text-dark mb-0">{getRoleQueueTitle(activeTab)}</h6>
                        <span className="text-muted small">{tabDocs.length} items in this queue</span>
                    </div>

                    {loading ? (
                        <div className="py-5 text-center">
                            <div className="spinner-border text-primary mb-2"></div>
                            <p className="text-muted small">Loading review items...</p>
                        </div>
                    ) : tabDocs.length === 0 ? (
                        <div className="py-5 text-center text-muted">
                            <i className="bi bi-check2-circle fs-1 text-success opacity-50 mb-2 d-block"></i>
                            <h6 className="fw-bold text-dark">Queue is All Clear!</h6>
                            <p className="small mb-0">No documents are currently awaiting action in this review tier.</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="bg-light">
                                    <tr>
                                        <th className="ps-3 py-3">Document Title</th>
                                        <th className="py-3">Type</th>
                                        <th className="py-3">Class & Subject</th>
                                        <th className="py-3">Submitted By</th>
                                        <th className="py-3">Date</th>
                                        <th className="py-3 text-center">Status</th>
                                        <th className="pe-3 py-3 text-end">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tabDocs.map((doc: any) => (
                                        <tr key={doc.id}>
                                            <td className="ps-3">
                                                <div className="fw-bold text-dark">{doc.title}</div>
                                                <div className="text-muted small">ID: #{doc.id} {doc.term_name ? `• ${doc.term_name}` : ''}</div>
                                            </td>
                                            <td>
                                                <span className="badge bg-light text-dark border text-uppercase" style={{ fontSize: '0.72rem' }}>
                                                    {doc.category.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="fw-semibold text-dark">{doc.class_name || 'General'}</span>
                                                <span className="text-muted ms-1.5">• {doc.subject_name || 'General'}</span>
                                            </td>
                                            <td>
                                                <div className="fw-medium text-dark">{doc.teacher_name || 'Teacher'}</div>
                                                <div className="text-muted small">{doc.teacher_email || '—'}</div>
                                            </td>
                                            <td className="small text-muted">
                                                {new Date(doc.updated_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="text-center">
                                                <span className={`badge px-3 py-1.5 rounded-pill ${doc.status === 'approved' ? 'bg-success bg-opacity-10 text-success border border-success' : 'bg-warning bg-opacity-10 text-warning border border-warning'}`}>
                                                    {doc.status.replace('_', ' ').toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="pe-3 text-end">
                                                <div className="d-flex justify-content-end gap-1.5">
                                                    <Link
                                                        href={`/academic/studio/${doc.id}`}
                                                        className="btn btn-sm btn-outline-primary rounded-pill px-3"
                                                        title="Open in Studio"
                                                    >
                                                        <i className="bi bi-box-arrow-in-up-right me-1"></i> Open
                                                    </Link>

                                                    {doc.status !== 'approved' && (
                                                        <button
                                                            onClick={() => { setSelectedDoc(doc); setReviewAction('approve'); }}
                                                            className="btn btn-sm btn-primary-custom rounded-pill px-3 fw-bold"
                                                        >
                                                            <i className="bi bi-check2-circle me-1"></i> Review
                                                        </button>
                                                    )}

                                                    {doc.google_file_id && (
                                                        <a
                                                            href={`${API_URL}/academic-studio/documents/${doc.id}/export-pdf`}
                                                            target="_blank"
                                                            className="btn btn-sm btn-light border rounded-pill px-2.5"
                                                            title="Download PDF"
                                                        >
                                                            <i className="bi bi-file-earmark-pdf text-danger"></i>
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Review Decision Modal */}
            {selectedDoc && (
                <>
                    <div className="modal-backdrop fade show" style={{ zIndex: 1060 }}></div>
                    <div className="modal fade show d-block" tabIndex={-1} style={{ zIndex: 1065 }}>
                        <div className="modal-dialog modal-dialog-centered modal-xl">
                            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden" style={{ maxHeight: '90vh' }}>
                                <div className="modal-header text-white p-3.5" style={{ backgroundColor: 'var(--primary-dark, #195053)' }}>
                                    <div>
                                        <h5 className="modal-title fw-bold mb-0">
                                            <i className="bi bi-shield-check me-2 text-warning"></i>
                                            Evaluating: {selectedDoc.title}
                                        </h5>
                                        <div className="small text-white-50 mt-1">
                                            Class: {selectedDoc.class_name} | Subject: {selectedDoc.subject_name} | Teacher: {selectedDoc.teacher_name}
                                        </div>
                                    </div>
                                    <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedDoc(null)}></button>
                                </div>

                                <div className="modal-body p-0 d-flex flex-column flex-lg-row" style={{ height: '70vh' }}>
                                    {/* Left: Google Workspace Live Preview */}
                                    <div className="flex-grow-1 h-100 bg-light border-end">
                                        <iframe
                                            src={selectedDoc.google_embed_link || `https://docs.google.com/document/d/${selectedDoc.google_file_id}/edit?embedded=true`}
                                            className="w-100 h-100 border-0"
                                            title="Document Preview"
                                        ></iframe>
                                    </div>

                                    {/* Right: Decision Panel */}
                                    <div className="p-4 d-flex flex-column justify-content-between bg-white" style={{ width: '380px', minWidth: '340px' }}>
                                        <div>
                                            <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">
                                                <i className="bi bi-pencil-square me-2 text-primary"></i>Review Decision
                                            </h6>

                                            {/* Decision Radio Selector */}
                                            <div className="d-flex flex-column gap-2 mb-3">
                                                <label className={`p-3 rounded-3 border cursor-pointer transition d-flex align-items-center gap-3 ${reviewAction === 'approve' ? 'border-success bg-success bg-opacity-10' : 'bg-light'}`} style={{ cursor: 'pointer' }}>
                                                    <input
                                                        type="radio"
                                                        name="reviewAction"
                                                        className="form-check-input mt-0"
                                                        checked={reviewAction === 'approve'}
                                                        onChange={() => setReviewAction('approve')}
                                                    />
                                                    <div>
                                                        <div className="fw-bold text-success">Approve & Forward</div>
                                                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>Pass to next authority or final stamp</div>
                                                    </div>
                                                </label>

                                                <label className={`p-3 rounded-3 border cursor-pointer transition d-flex align-items-center gap-3 ${reviewAction === 'request_revision' ? 'border-danger bg-danger bg-opacity-10' : 'bg-light'}`} style={{ cursor: 'pointer' }}>
                                                    <input
                                                        type="radio"
                                                        name="reviewAction"
                                                        className="form-check-input mt-0"
                                                        checked={reviewAction === 'request_revision'}
                                                        onChange={() => setReviewAction('request_revision')}
                                                    />
                                                    <div>
                                                        <div className="fw-bold text-danger">Request Changes / Revisions</div>
                                                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>Revert edit access to teacher with notes</div>
                                                    </div>
                                                </label>

                                                <label className={`p-3 rounded-3 border cursor-pointer transition d-flex align-items-center gap-3 ${reviewAction === 'reject' ? 'border-dark bg-dark bg-opacity-10' : 'bg-light'}`} style={{ cursor: 'pointer' }}>
                                                    <input
                                                        type="radio"
                                                        name="reviewAction"
                                                        className="form-check-input mt-0"
                                                        checked={reviewAction === 'reject'}
                                                        onChange={() => setReviewAction('reject')}
                                                    />
                                                    <div>
                                                        <div className="fw-bold text-dark">Reject Document</div>
                                                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>Mark as unapproved and archive</div>
                                                    </div>
                                                </label>
                                            </div>

                                            {/* Review Remarks */}
                                            <label className="form-label fw-bold small text-muted text-uppercase">
                                                Reviewer Remarks {reviewAction === 'request_revision' && <span className="text-danger">*</span>}
                                            </label>
                                            <textarea
                                                className="form-control rounded-3"
                                                rows={4}
                                                placeholder={reviewAction === 'request_revision' ? 'Specify what questions or formatting need correction...' : 'Optional approval comments...'}
                                                value={reviewRemarks}
                                                onChange={e => setReviewRemarks(e.target.value)}
                                            ></textarea>
                                        </div>

                                        <div className="d-flex gap-2 pt-3 border-top mt-3">
                                            <button className="btn btn-light rounded-pill px-4 flex-grow-1" onClick={() => setSelectedDoc(null)}>
                                                Close
                                            </button>
                                            <button
                                                className={`btn rounded-pill px-4 fw-bold flex-grow-1 ${reviewAction === 'approve' ? 'btn-success' : reviewAction === 'request_revision' ? 'btn-danger' : 'btn-dark'}`}
                                                onClick={handleExecuteReview}
                                                disabled={actionLoading}
                                            >
                                                {actionLoading ? <span className="spinner-border spinner-border-sm"></span> : 'Submit Decision'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
