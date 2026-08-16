'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { notify } from '@/app/utils/notify';
import { useAuth } from '@/contexts/AuthContext';

export default function DocumentEditorStudioPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();

    const [doc, setDoc] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showDrawer, setShowDrawer] = useState(false);
    const [submitRemarks, setSubmitRemarks] = useState('');
    const [showSubmitModal, setShowSubmitModal] = useState(false);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://shmool.onrender.com';

    useEffect(() => {
        if (params.id) {
            fetchDocument();
        }
    }, [params.id]);

    const fetchDocument = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/academic-studio/documents/${params.id}`);
            if (!res.ok) throw new Error('Document not found');
            const data = await res.json();
            setDoc(data);
        } catch (err: any) {
            console.error(err);
            notify.error(err.message || 'Error loading document');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitForReview = async () => {
        setSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/academic-studio/documents/${params.id}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user?.id,
                    remarks: submitRemarks || 'Ready for Coordinator Review'
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            notify.success('Document locked and submitted for Coordinator review!');
            setShowSubmitModal(false);
            fetchDocument();
        } catch (err: any) {
            notify.error(err.message || 'Submission failed');
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusHeaderBadge = (status: string) => {
        switch (status) {
            case 'draft':
                return <span className="badge bg-secondary text-white px-3 py-1.5 rounded-pill"><i className="bi bi-pencil me-1"></i> Draft (Editable)</span>;
            case 'pending_coordinator':
                return <span className="badge bg-warning text-dark px-3 py-1.5 rounded-pill"><i className="bi bi-clock-history me-1"></i> Under Coordinator Review (Locked)</span>;
            case 'pending_vp':
                return <span className="badge bg-info text-dark px-3 py-1.5 rounded-pill"><i className="bi bi-eye me-1"></i> Under Vice Principal Review</span>;
            case 'pending_principal':
                return <span className="badge bg-primary text-white px-3 py-1.5 rounded-pill"><i className="bi bi-shield-check me-1"></i> Awaiting Principal Final Approval</span>;
            case 'approved':
                return <span className="badge bg-success text-white px-3 py-1.5 rounded-pill"><i className="bi bi-check2-all me-1"></i> Approved & Finalized</span>;
            case 'revision_requested':
                return <span className="badge bg-danger text-white px-3 py-1.5 rounded-pill"><i className="bi bi-exclamation-triangle me-1"></i> Revisions Requested</span>;
            default:
                return <span className="badge bg-light text-dark">{status}</span>;
        }
    };

    if (loading) {
        return (
            <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 bg-light p-4">
                <div className="spinner-border text-primary mb-3" style={{ width: '3.5rem', height: '3.5rem' }}></div>
                <h5 className="fw-bold text-dark">Initializing Google Workspace Studio...</h5>
                <p className="text-muted small">Loading cloud document editor and authorization keys.</p>
            </div>
        );
    }

    if (!doc) {
        return (
            <div className="container py-5 text-center">
                <i className="bi bi-exclamation-octagon fs-1 text-danger mb-3 d-block"></i>
                <h3>Document Not Found</h3>
                <Link href="/academic/studio" className="btn btn-primary-custom mt-3">Return to Academic Studio</Link>
            </div>
        );
    }

    // Google embed link
    const embedUrl = doc.google_embed_link || `https://docs.google.com/document/d/${doc.google_file_id}/edit?embedded=true`;
    const directEditUrl = doc.google_webview_link || `https://docs.google.com/document/d/${doc.google_file_id}/edit`;

    return (
        <div className="d-flex flex-column" style={{ height: 'calc(100vh - 70px)', background: '#f1f5f9' }}>
            {/* Top Studio Control Bar */}
            <div className="bg-white border-bottom shadow-sm px-3 px-lg-4 py-2.5 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 z-3">
                {/* Left: Back & Document Meta */}
                <div className="d-flex align-items-center gap-3">
                    <Link href="/academic/studio" className="btn btn-sm btn-light border rounded-pill px-3 fw-bold text-muted d-inline-flex align-items-center gap-1.5">
                        <i className="bi bi-arrow-left"></i> Studio
                    </Link>

                    <div>
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                            <h5 className="fw-bold text-dark mb-0 text-truncate" style={{ maxWidth: '400px' }} title={doc.title}>
                                {doc.title}
                            </h5>
                            {getStatusHeaderBadge(doc.status)}
                        </div>

                        <div className="d-flex align-items-center gap-2 small text-muted mt-1">
                            {doc.class_name && <span className="badge bg-light text-dark border">{doc.class_name}</span>}
                            {doc.subject_name && <span className="badge bg-light text-dark border">{doc.subject_name}</span>}
                            {doc.term_name && <span className="badge bg-light text-dark border">{doc.term_name}</span>}
                            <span><i className="bi bi-person me-1"></i>{doc.teacher_name}</span>
                        </div>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="d-flex align-items-center gap-2 flex-wrap">
                    {/* Submit Button */}
                    {['draft', 'revision_requested'].includes(doc.status) && (
                        <button
                            onClick={() => setShowSubmitModal(true)}
                            className="btn btn-sm btn-warning fw-bold rounded-pill px-3.5 py-2 shadow-sm text-dark d-inline-flex align-items-center gap-1.5"
                        >
                            <i className="bi bi-send-check-fill"></i> Submit for Review
                        </button>
                    )}

                    {/* Open in Google Docs Tab */}
                    <a
                        href={directEditUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-primary rounded-pill px-3 py-2 fw-bold d-inline-flex align-items-center gap-1.5"
                        title="Open full Google Workspace editor in a new browser tab"
                    >
                        <i className="bi bi-box-arrow-up-right"></i> Open in Google {doc.template_type === 'slide' ? 'Slides' : doc.template_type === 'sheet' ? 'Sheets' : 'Docs'}
                    </a>

                    {/* Download Official PDF */}
                    {doc.google_file_id && (
                        <a
                            href={`${API_URL}/academic-studio/documents/${doc.id}/export-pdf`}
                            target="_blank"
                            className="btn btn-sm btn-outline-secondary rounded-pill px-3 py-2 fw-bold d-inline-flex align-items-center gap-1.5"
                            title="Export & Download PDF"
                        >
                            <i className="bi bi-file-earmark-pdf-fill text-danger"></i> PDF
                        </a>
                    )}

                    {/* Review History Drawer Toggle */}
                    <button
                        onClick={() => setShowDrawer(!showDrawer)}
                        className={`btn btn-sm rounded-pill px-3 py-2 fw-bold d-inline-flex align-items-center gap-1.5 ${showDrawer ? 'btn-primary' : 'btn-light border'}`}
                    >
                        <i className="bi bi-chat-left-text"></i> Review Notes ({doc.approvals?.length || 0})
                    </button>
                </div>
            </div>

            {/* Main Workspace Frame */}
            <div className="d-flex flex-grow-1 overflow-hidden position-relative">
                {/* Embedded Google Editor Iframe */}
                <div className="flex-grow-1 h-100 position-relative bg-white">
                    <iframe
                        src={embedUrl}
                        className="w-100 h-100 border-0"
                        title="Google Workspace Editor"
                        allow="clipboard-read; clipboard-write"
                    ></iframe>
                </div>

                {/* Review Notes & Comments Slide-Over Drawer */}
                {showDrawer && (
                    <div
                        className="border-start bg-white shadow-lg d-flex flex-column animate__animated animate__fadeInRight"
                        style={{ width: '360px', zIndex: 1040, minWidth: '320px' }}
                    >
                        <div className="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
                            <h6 className="fw-bold mb-0 text-dark">
                                <i className="bi bi-clock-history me-2 text-primary"></i>Review & Approval History
                            </h6>
                            <button className="btn-close" onClick={() => setShowDrawer(false)}></button>
                        </div>

                        <div className="p-3 overflow-y-auto flex-grow-1">
                            {doc.approvals && doc.approvals.length > 0 ? (
                                <div className="timeline-list">
                                    {doc.approvals.map((appr: any, idx: number) => (
                                        <div key={idx} className="mb-3 p-3 rounded-3 bg-light border position-relative">
                                            <div className="d-flex justify-content-between align-items-start mb-1">
                                                <span className="badge bg-primary bg-opacity-10 text-primary border border-primary text-uppercase" style={{ fontSize: '0.7rem' }}>
                                                    {appr.reviewer_role}
                                                </span>
                                                <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                    {new Date(appr.created_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>

                                            <div className="fw-bold small text-dark mt-1">
                                                Action: <span className="text-capitalize text-teal">{appr.action.replace('_', ' ')}</span>
                                            </div>

                                            {appr.remarks && (
                                                <p className="text-secondary small mb-0 mt-1.5 p-2 rounded bg-white border fst-italic">
                                                    "{appr.remarks}"
                                                </p>
                                            )}

                                            {appr.reviewer_name && (
                                                <div className="text-muted mt-1" style={{ fontSize: '0.72rem' }}>
                                                    By: {appr.reviewer_name}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-5 text-muted">
                                    <i className="bi bi-chat-square-dots fs-1 opacity-50"></i>
                                    <p className="small mt-2">No review remarks recorded yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Submit for Review Modal */}
            {showSubmitModal && (
                <>
                    <div className="modal-backdrop fade show" style={{ zIndex: 1060 }}></div>
                    <div className="modal fade show d-block" tabIndex={-1} style={{ zIndex: 1065 }}>
                        <div className="modal-dialog modal-dialog-centered">
                            <div className="modal-content border-0 shadow-lg rounded-4">
                                <div className="modal-header text-white" style={{ backgroundColor: 'var(--primary-dark, #195053)' }}>
                                    <h5 className="modal-title fw-bold"><i className="bi bi-send-check me-2 text-warning"></i>Submit Document for Review</h5>
                                    <button className="btn-close btn-close-white" onClick={() => setShowSubmitModal(false)}></button>
                                </div>
                                <div className="modal-body p-4">
                                    <p className="text-muted small mb-3">
                                        Submitting this document will lock your direct editing permissions and forward it to the <strong>Subject Coordinator</strong> for syllabus & format verification.
                                    </p>

                                    <label className="form-label fw-bold small text-muted text-uppercase">Optional Notes / Remarks for Reviewer</label>
                                    <textarea
                                        className="form-control rounded-3"
                                        rows={3}
                                        placeholder="e.g. All 3 sections completed as per Mid-Term syllabus guidelines."
                                        value={submitRemarks}
                                        onChange={e => setSubmitRemarks(e.target.value)}
                                    ></textarea>

                                    <div className="d-flex justify-content-end gap-2 mt-4 pt-2 border-top">
                                        <button className="btn btn-light rounded-pill px-4" onClick={() => setShowSubmitModal(false)}>Cancel</button>
                                        <button className="btn btn-warning rounded-pill px-4 fw-bold text-dark" onClick={handleSubmitForReview} disabled={submitting}>
                                            {submitting ? <><span className="spinner-border spinner-border-sm me-2"></span>Submitting...</> : 'Confirm & Submit'}
                                        </button>
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
