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
                return <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary px-2.5 py-1" style={{ borderRadius: '10px', fontSize: '0.72rem', fontWeight: 500 }}><i className="bi bi-pencil me-1"></i> Draft (Editable)</span>;
            case 'pending_coordinator':
                return <span className="badge bg-warning bg-opacity-10 text-warning border border-warning px-2.5 py-1" style={{ borderRadius: '10px', fontSize: '0.72rem', fontWeight: 500 }}><i className="bi bi-clock-history me-1"></i> Coordinator Review</span>;
            case 'pending_vp':
                return <span className="badge bg-info bg-opacity-10 text-info border border-info px-2.5 py-1" style={{ borderRadius: '10px', fontSize: '0.72rem', fontWeight: 500 }}><i className="bi bi-eye me-1"></i> VP Review</span>;
            case 'pending_principal':
                return <span className="badge bg-primary bg-opacity-10 text-primary border border-primary px-2.5 py-1" style={{ borderRadius: '10px', fontSize: '0.72rem', fontWeight: 500 }}><i className="bi bi-shield-check me-1"></i> Principal Review</span>;
            case 'approved':
                return <span className="badge bg-success bg-opacity-10 text-success border border-success px-2.5 py-1" style={{ borderRadius: '10px', fontSize: '0.72rem', fontWeight: 500 }}><i className="bi bi-check2-all me-1"></i> Approved</span>;
            case 'revision_requested':
                return <span className="badge bg-danger bg-opacity-10 text-danger border border-danger px-2.5 py-1" style={{ borderRadius: '10px', fontSize: '0.72rem', fontWeight: 500 }}><i className="bi bi-exclamation-triangle me-1"></i> Revisions Requested</span>;
            default:
                return <span className="badge bg-light text-dark" style={{ borderRadius: '10px' }}>{status}</span>;
        }
    };

    if (loading) {
        return (
            <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 bg-light p-4">
                <div className="spinner-border text-primary mb-3" style={{ width: '2.5rem', height: '2.5rem' }}></div>
                <h6 className="text-dark" style={{ fontWeight: 600 }}>Initializing Google Workspace Studio...</h6>
                <p className="text-muted small">Loading cloud document editor.</p>
            </div>
        );
    }

    if (!doc) {
        return (
            <div className="container py-5 text-center">
                <i className="bi bi-exclamation-octagon fs-1 text-danger mb-3 d-block"></i>
                <h5 style={{ fontWeight: 600 }}>Document Not Found</h5>
                <Link href="/academic/studio" className="btn btn-primary-custom mt-3" style={{ borderRadius: '12px' }}>Return to Academic Studio</Link>
            </div>
        );
    }

    const embedUrl = doc.google_embed_link || `https://docs.google.com/document/d/${doc.google_file_id}/edit?embedded=true`;
    const directEditUrl = doc.google_webview_link || `https://docs.google.com/document/d/${doc.google_file_id}/edit`;

    return (
        <div className="d-flex flex-column" style={{ height: 'calc(100vh - 70px)', background: '#f1f5f9' }}>
            {/* Top Studio Control Bar */}
            <div className="bg-white border-bottom shadow-sm px-3 px-lg-4 py-2.5 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 z-3">
                {/* Left: Back & Document Meta */}
                <div className="d-flex align-items-center gap-2.5 min-w-0">
                    <Link href="/academic/studio" className="btn btn-sm btn-light border px-3 text-muted d-inline-flex align-items-center gap-1.5 flex-shrink-0" style={{ borderRadius: '12px', fontSize: '0.82rem', fontWeight: 500 }}>
                        <i className="bi bi-arrow-left"></i> Studio
                    </Link>

                    <div className="min-w-0">
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                            <h6 className="text-dark mb-0 text-truncate" style={{ fontWeight: 600, maxWidth: '380px' }} title={doc.title}>
                                {doc.title}
                            </h6>
                            {getStatusHeaderBadge(doc.status)}
                        </div>

                        <div className="d-flex align-items-center gap-1.5 small text-muted mt-0.5" style={{ fontSize: '0.76rem' }}>
                            {doc.class_name && <span className="badge bg-light text-dark border" style={{ borderRadius: '6px' }}>{doc.class_name}</span>}
                            {doc.subject_name && <span className="badge bg-light text-dark border" style={{ borderRadius: '6px' }}>{doc.subject_name}</span>}
                            {doc.term_name && <span className="badge bg-light text-dark border" style={{ borderRadius: '6px' }}>{doc.term_name}</span>}
                            <span><i className="bi bi-person me-1"></i>{doc.teacher_name}</span>
                        </div>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="d-flex align-items-center gap-1.5 flex-wrap">
                    {/* Submit Button */}
                    {['draft', 'revision_requested'].includes(doc.status) && (
                        <button
                            onClick={() => setShowSubmitModal(true)}
                            className="btn btn-sm btn-warning shadow-sm text-dark d-inline-flex align-items-center gap-1.5 px-3 py-1.5"
                            style={{ borderRadius: '12px', fontSize: '0.82rem', fontWeight: 600 }}
                        >
                            <i className="bi bi-send-check-fill"></i> Submit for Review
                        </button>
                    )}

                    {/* Open in Google Docs Tab */}
                    <a
                        href={directEditUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5 px-3 py-1.5"
                        style={{ borderRadius: '12px', fontSize: '0.82rem', fontWeight: 500 }}
                        title="Open full Google Workspace editor in a new browser tab"
                    >
                        <i className="bi bi-box-arrow-up-right"></i> Google {doc.template_type === 'slide' ? 'Slides' : doc.template_type === 'sheet' ? 'Sheets' : 'Docs'}
                    </a>

                    {/* Download Official PDF */}
                    {doc.google_file_id && (
                        <a
                            href={`${API_URL}/academic-studio/documents/${doc.id}/export-pdf`}
                            target="_blank"
                            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1.5 px-2.5 py-1.5"
                            style={{ borderRadius: '12px', fontSize: '0.82rem', fontWeight: 500 }}
                            title="Export & Download PDF"
                        >
                            <i className="bi bi-file-earmark-pdf-fill text-danger"></i> PDF
                        </a>
                    )}

                    {/* Review History Drawer Toggle */}
                    <button
                        onClick={() => setShowDrawer(!showDrawer)}
                        className={`btn btn-sm d-inline-flex align-items-center gap-1.5 px-3 py-1.5 ${showDrawer ? 'btn-primary' : 'btn-light border'}`}
                        style={{ borderRadius: '12px', fontSize: '0.82rem', fontWeight: 500 }}
                    >
                        <i className="bi bi-chat-left-text"></i> Notes ({doc.approvals?.length || 0})
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
                        style={{ width: '340px', zIndex: 1040, minWidth: '300px' }}
                    >
                        <div className="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
                            <h6 className="mb-0 text-dark" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                <i className="bi bi-clock-history me-2 text-primary"></i>Review & Approval History
                            </h6>
                            <button className="btn-close" onClick={() => setShowDrawer(false)}></button>
                        </div>

                        <div className="p-3 overflow-y-auto flex-grow-1">
                            {doc.approvals && doc.approvals.length > 0 ? (
                                <div className="timeline-list">
                                    {doc.approvals.map((appr: any, idx: number) => (
                                        <div key={idx} className="mb-3 p-3 bg-light border position-relative" style={{ borderRadius: '14px' }}>
                                            <div className="d-flex justify-content-between align-items-start mb-1">
                                                <span className="badge bg-primary bg-opacity-10 text-primary border border-primary text-uppercase" style={{ borderRadius: '6px', fontSize: '0.68rem' }}>
                                                    {appr.reviewer_role}
                                                </span>
                                                <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                                                    {new Date(appr.created_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>

                                            <div className="small text-dark mt-1" style={{ fontWeight: 600 }}>
                                                Action: <span className="text-capitalize text-teal">{appr.action.replace('_', ' ')}</span>
                                            </div>

                                            {appr.remarks && (
                                                <p className="text-secondary small mb-0 mt-1.5 p-2 bg-white border fst-italic" style={{ borderRadius: '8px', fontSize: '0.8rem' }}>
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
                                    <i className="bi bi-chat-square-dots fs-2 opacity-50"></i>
                                    <p className="small mt-2 mb-0">No review remarks recorded yet.</p>
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
                            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '20px', overflow: 'hidden' }}>
                                <div className="modal-header text-white p-3.5" style={{ backgroundColor: 'var(--primary-dark, #195053)' }}>
                                    <h6 className="modal-title mb-0" style={{ fontWeight: 600 }}>
                                        <i className="bi bi-send-check me-2 text-warning"></i>Submit Document for Review
                                    </h6>
                                    <button className="btn-close btn-close-white" onClick={() => setShowSubmitModal(false)}></button>
                                </div>
                                <div className="modal-body p-3.5 p-sm-4">
                                    <p className="text-muted small mb-3">
                                        Submitting this document will lock your direct editing permissions and forward it to the <strong>Subject Coordinator</strong> for syllabus & format verification.
                                    </p>

                                    <label className="form-label text-muted text-uppercase mb-1" style={{ fontSize: '0.76rem', letterSpacing: '0.5px', fontWeight: 600 }}>
                                        Optional Notes / Remarks for Reviewer
                                    </label>
                                    <textarea
                                        className="form-control"
                                        rows={3}
                                        placeholder="e.g. All sections completed as per syllabus guidelines."
                                        value={submitRemarks}
                                        onChange={e => setSubmitRemarks(e.target.value)}
                                        style={{ borderRadius: '12px', fontSize: '0.88rem' }}
                                    ></textarea>

                                    <div className="d-flex justify-content-end gap-2 mt-4 pt-2 border-top">
                                        <button className="btn btn-light px-3.5" style={{ borderRadius: '12px', fontSize: '0.85rem' }} onClick={() => setShowSubmitModal(false)}>Cancel</button>
                                        <button className="btn btn-warning px-4 text-dark" style={{ borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600 }} onClick={handleSubmitForReview} disabled={submitting}>
                                            {submitting ? <><span className="spinner-border spinner-border-sm me-1.5"></span>Submitting...</> : 'Confirm & Submit'}
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
