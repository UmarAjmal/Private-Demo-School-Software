'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { notify } from '@/app/utils/notify';
import { useAuth } from '@/contexts/AuthContext';

export default function AcademicStudioPage() {
    const { user } = useAuth();
    const router = useRouter();

    const [documents, setDocuments] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [academicTerms, setAcademicTerms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    // Filter states
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedStatus, setSelectedStatus] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formTitle, setFormTitle] = useState('');
    const [formCategory, setFormCategory] = useState('exam');
    const [formTemplateType, setFormTemplateType] = useState('doc');
    const [formClassId, setFormClassId] = useState('');
    const [formSubjectId, setFormSubjectId] = useState('');
    const [formYearId, setFormYearId] = useState('');
    const [formTermId, setFormTermId] = useState('');
    const [formMarks, setFormMarks] = useState('50');
    const [formScheduledDate, setFormScheduledDate] = useState('');
    const [formInstructions, setFormInstructions] = useState('');

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://shmool.onrender.com';

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [docsRes, templRes, clsRes, sbRes, yrRes] = await Promise.all([
                fetch(`${API_URL}/academic-studio/documents`),
                fetch(`${API_URL}/academic-studio/templates`),
                fetch(`${API_URL}/academic/classes`),
                fetch(`${API_URL}/academic/subjects`),
                fetch(`${API_URL}/academic/years`)
            ]);

            if (docsRes.ok) setDocuments(await docsRes.json());
            if (templRes.ok) setTemplates(await templRes.json());
            if (clsRes.ok) setClasses(await clsRes.json());
            if (sbRes.ok) setSubjects(await sbRes.json());
            if (yrRes.ok) {
                const yrData = await yrRes.json();
                setAcademicYears(yrData);
                const activeYear = yrData.find((y: any) => y.is_active);
                if (activeYear) {
                    setFormYearId(String(activeYear.id));
                    fetchTerms(activeYear.id);
                }
            }
        } catch (err: any) {
            console.error(err);
            notify.error('Failed to load Academic Studio data');
        } finally {
            setLoading(false);
        }
    };

    const fetchTerms = async (yearId: number | string) => {
        try {
            const res = await fetch(`${API_URL}/academic/years/${yearId}/terms`);
            if (res.ok) setAcademicTerms(await res.json());
        } catch { }
    };

    const handleCreateDocument = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formTitle.trim()) {
            notify.error('Please enter a document title');
            return;
        }

        setCreating(true);
        try {
            const res = await fetch(`${API_URL}/academic-studio/documents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: formTitle.trim(),
                    category: formCategory,
                    template_type: formTemplateType,
                    class_id: formClassId || null,
                    subject_id: formSubjectId || null,
                    academic_year_id: formYearId || null,
                    term_id: formTermId || null,
                    created_by_teacher_id: user?.id || null,
                    total_marks: formMarks,
                    scheduled_date: formScheduledDate || null,
                    instructions: formInstructions
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create document');

            notify.success('Document created in Google Workspace successfully!');
            setShowCreateModal(false);
            resetForm();
            router.push(`/academic/studio/${data.id}`);
        } catch (err: any) {
            console.error(err);
            notify.error(err.message || 'Error creating document');
        } finally {
            setCreating(false);
        }
    };

    const handleSubmitForReview = async (id: number) => {
        if (!confirm('Submit this document for Academic Review? Editing will be locked until review completes.')) return;
        try {
            const res = await fetch(`${API_URL}/academic-studio/documents/${id}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user?.id })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            notify.success('Document submitted to Coordinator for review!');
            fetchInitialData();
        } catch (err: any) {
            notify.error(err.message || 'Failed to submit document');
        }
    };

    const handleTogglePublish = async (id: number, currentStatus: boolean) => {
        try {
            const res = await fetch(`${API_URL}/academic-studio/documents/${id}/publish`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_published: !currentStatus })
            });
            if (res.ok) {
                notify.success(`Document ${!currentStatus ? 'published to' : 'hidden from'} Student Portal`);
                setDocuments(prev => prev.map(d => d.id === id ? { ...d, is_published_to_students: !currentStatus } : d));
            }
        } catch {
            notify.error('Error toggling publish state');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this document from the studio?')) return;
        try {
            const res = await fetch(`${API_URL}/academic-studio/documents/${id}`, { method: 'DELETE' });
            if (res.ok) {
                notify.success('Document removed successfully');
                setDocuments(prev => prev.filter(d => d.id !== id));
            }
        } catch {
            notify.error('Failed to delete document');
        }
    };

    const resetForm = () => {
        setFormTitle('');
        setFormCategory('exam');
        setFormTemplateType('doc');
        setFormClassId('');
        setFormSubjectId('');
        setFormMarks('50');
        setFormScheduledDate('');
        setFormInstructions('');
    };

    // Filtered documents
    const filteredDocs = documents.filter(d => {
        if (activeCategory !== 'all' && d.category !== activeCategory) return false;
        if (selectedClass && String(d.class_id) !== selectedClass) return false;
        if (selectedStatus && d.status !== selectedStatus) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (
                d.title?.toLowerCase().includes(q) ||
                d.class_name?.toLowerCase().includes(q) ||
                d.subject_name?.toLowerCase().includes(q) ||
                d.teacher_name?.toLowerCase().includes(q)
            );
        }
        return true;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'draft':
                return <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary px-2.5 py-1 rounded-pill"><i className="bi bi-pencil me-1"></i>Draft (Editable)</span>;
            case 'pending_coordinator':
                return <span className="badge bg-warning bg-opacity-10 text-warning border border-warning px-2.5 py-1 rounded-pill"><i className="bi bi-clock-history me-1"></i>Coordinator Review</span>;
            case 'pending_vp':
                return <span className="badge bg-info bg-opacity-10 text-info border border-info px-2.5 py-1 rounded-pill"><i className="bi bi-eye me-1"></i>Vice Principal Review</span>;
            case 'pending_principal':
                return <span className="badge bg-primary bg-opacity-10 text-primary border border-primary px-2.5 py-1 rounded-pill"><i className="bi bi-shield-check me-1"></i>Principal Approval</span>;
            case 'approved':
                return <span className="badge bg-success bg-opacity-10 text-success border border-success px-2.5 py-1 rounded-pill"><i className="bi bi-check-circle-fill me-1"></i>Approved</span>;
            case 'revision_requested':
                return <span className="badge bg-danger bg-opacity-10 text-danger border border-danger px-2.5 py-1 rounded-pill"><i className="bi bi-exclamation-triangle me-1"></i>Revisions Requested</span>;
            case 'rejected':
                return <span className="badge bg-dark bg-opacity-10 text-dark border border-dark px-2.5 py-1 rounded-pill"><i className="bi bi-x-circle me-1"></i>Rejected</span>;
            default:
                return <span className="badge bg-light text-dark">{status}</span>;
        }
    };

    const getToolIcon = (type: string) => {
        if (type === 'slide') return <i className="bi bi-file-earmark-easel-fill text-warning fs-4"></i>;
        if (type === 'sheet') return <i className="bi bi-file-earmark-spreadsheet-fill text-success fs-4"></i>;
        return <i className="bi bi-file-earmark-word-fill text-primary fs-4"></i>;
    };

    return (
        <div className="container-fluid py-4 px-3 px-md-4 animate__animated animate__fadeIn">
            {/* Top Hero Banner */}
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4" style={{ background: 'linear-gradient(135deg, var(--primary-dark, #195053) 0%, #233D4D 100%)' }}>
                <div className="card-body p-4 p-lg-5 text-white">
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                        <div>
                            <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill bg-white bg-opacity-10 text-warning small fw-bold mb-2">
                                <i className="bi bi-google"></i> Google Workspace for Education Engine
                            </div>
                            <h2 className="fw-bold mb-1">🎨 Academic Content Studio</h2>
                            <p className="text-white-50 mb-0">Create, edit, review, and print exams, tests, lecture notes, summer packs, and presentations directly in Google Docs & Slides.</p>
                        </div>
                        <div className="d-flex gap-2 flex-wrap">
                            <Link href="/academic/approvals" className="btn btn-outline-light rounded-pill px-4 py-2.5 fw-bold shadow-sm d-inline-flex align-items-center gap-2">
                                <i className="bi bi-shield-check"></i> Review & Approvals Deck
                            </Link>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="btn btn-warning rounded-pill px-4 py-2.5 fw-bold shadow-sm d-inline-flex align-items-center gap-2 text-dark"
                            >
                                <i className="bi bi-plus-circle-fill"></i> Create New Document
                            </button>
                        </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="row g-3 mt-3">
                        {[
                            { label: 'Total Content Created', val: documents.length, icon: 'bi-files', bg: 'rgba(255,255,255,0.1)' },
                            { label: 'Under Active Review', val: documents.filter(d => ['pending_coordinator', 'pending_vp', 'pending_principal'].includes(d.status)).length, icon: 'bi-hourglass-split', bg: 'rgba(254,127,45,0.2)' },
                            { label: 'Approved & Finalized', val: documents.filter(d => d.status === 'approved').length, icon: 'bi-check2-all', bg: 'rgba(13,158,110,0.2)' },
                            { label: 'Live on Student Portal', val: documents.filter(d => d.is_published_to_students).length, icon: 'bi-globe2', bg: 'rgba(56,189,248,0.2)' }
                        ].map((stat, i) => (
                            <div className="col-6 col-md-3" key={i}>
                                <div className="p-3 rounded-4" style={{ background: stat.bg }}>
                                    <div className="d-flex align-items-center gap-2 small text-white-50">
                                        <i className={`bi ${stat.icon}`}></i> {stat.label}
                                    </div>
                                    <div className="fs-3 fw-bold text-white mt-1">{stat.val}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="card border-0 shadow-sm rounded-4 mb-4 bg-white">
                <div className="card-body p-3">
                    <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                        {/* Category Badges */}
                        <div className="d-flex align-items-center gap-2 overflow-x-auto pb-2 pb-lg-0 scrollbar-none">
                            {[
                                { id: 'all', label: 'All Content', icon: 'bi-grid-fill' },
                                { id: 'exam', label: 'Exams', icon: 'bi-file-earmark-ruled' },
                                { id: 'test', label: 'Class Tests', icon: 'bi-journal-check' },
                                { id: 'notes', label: 'Lecture Notes', icon: 'bi-book' },
                                { id: 'summer_pack', label: 'Summer Vacation Packs', icon: 'bi-sun-fill' },
                                { id: 'presentation', label: 'Presentations', icon: 'bi-easel2' },
                                { id: 'marksheet', label: 'Assessment Sheets', icon: 'bi-table' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveCategory(tab.id)}
                                    className={`btn btn-sm rounded-pill px-3 py-2 fw-bold text-nowrap transition border-0 ${activeCategory === tab.id ? 'bg-primary text-white shadow-sm' : 'bg-light text-muted'}`}
                                    style={{ backgroundColor: activeCategory === tab.id ? 'var(--primary-teal, #195053)' : '#f8fafc' }}
                                >
                                    <i className={`bi ${tab.icon} me-1.5`}></i> {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Search & Class Filters */}
                        <div className="d-flex gap-2 flex-wrap">
                            <select
                                className="form-select form-select-sm rounded-3"
                                style={{ minWidth: '140px' }}
                                value={selectedClass}
                                onChange={e => setSelectedClass(e.target.value)}
                            >
                                <option value="">All Classes</option>
                                {classes.map(c => (
                                    <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
                                ))}
                            </select>

                            <select
                                className="form-select form-select-sm rounded-3"
                                style={{ minWidth: '140px' }}
                                value={selectedStatus}
                                onChange={e => setSelectedStatus(e.target.value)}
                            >
                                <option value="">All Statuses</option>
                                <option value="draft">Drafts (Editable)</option>
                                <option value="pending_coordinator">Under Review</option>
                                <option value="approved">Approved</option>
                                <option value="revision_requested">Revisions Needed</option>
                            </select>

                            <div className="input-group input-group-sm" style={{ maxWidth: '240px' }}>
                                <span className="input-group-text bg-light border-end-0"><i className="bi bi-search text-muted"></i></span>
                                <input
                                    type="text"
                                    className="form-control border-start-0 bg-light"
                                    placeholder="Search title, teacher..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Document Content Grid */}
            {loading ? (
                <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white">
                    <div className="spinner-border text-primary mx-auto mb-3" style={{ width: '3rem', height: '3rem' }}></div>
                    <h5 className="text-dark fw-bold">Loading Academic Studio...</h5>
                    <p className="text-muted small">Fetching your Google Workspace documents and cloud repositories.</p>
                </div>
            ) : filteredDocs.length === 0 ? (
                <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white">
                    <div className="avatar-placeholder rounded-circle bg-light text-muted mx-auto mb-3 d-flex align-items-center justify-content-center" style={{ width: '70px', height: '70px' }}>
                        <i className="bi bi-folder-plus fs-1"></i>
                    </div>
                    <h5 className="fw-bold text-dark mb-1">No Academic Documents Found</h5>
                    <p className="text-muted small mb-3">Get started by creating your first Google Doc exam paper, summer pack, or presentation.</p>
                    <button onClick={() => setShowCreateModal(true)} className="btn btn-primary-custom rounded-pill px-4 py-2 mx-auto">
                        <i className="bi bi-plus-lg me-1"></i> Create New Document
                    </button>
                </div>
            ) : (
                <div className="row g-3">
                    {filteredDocs.map((doc: any) => (
                        <div className="col-md-6 col-xl-4" key={doc.id}>
                            <div className="card border-0 shadow-sm rounded-4 h-100 bg-white hover-shadow transition">
                                <div className="card-body p-4 d-flex flex-column justify-content-between">
                                    <div>
                                        {/* Top Card Bar */}
                                        <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                                            <div className="d-flex align-items-center gap-2">
                                                {getToolIcon(doc.template_type)}
                                                <div>
                                                    <span className="badge bg-light text-dark border text-uppercase" style={{ fontSize: '0.7rem' }}>
                                                        {doc.category.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            </div>
                                            {getStatusBadge(doc.status)}
                                        </div>

                                        {/* Document Title */}
                                        <h5 className="fw-bold text-dark mb-2 text-truncate" title={doc.title}>
                                            {doc.title}
                                        </h5>

                                        {/* Metadata Tags */}
                                        <div className="d-flex flex-wrap gap-2 text-muted small mb-3">
                                            {doc.class_name && (
                                                <span className="badge bg-light text-dark border">
                                                    <i className="bi bi-mortarboard me-1 text-primary"></i>{doc.class_name}
                                                </span>
                                            )}
                                            {doc.subject_name && (
                                                <span className="badge bg-light text-dark border">
                                                    <i className="bi bi-book me-1 text-success"></i>{doc.subject_name}
                                                </span>
                                            )}
                                            {doc.term_name && (
                                                <span className="badge bg-light text-dark border">
                                                    <i className="bi bi-calendar3 me-1 text-info"></i>{doc.term_name}
                                                </span>
                                            )}
                                            {doc.total_marks > 0 && (
                                                <span className="badge bg-light text-dark border">
                                                    <i className="bi bi-award me-1 text-warning"></i>{doc.total_marks} Marks
                                                </span>
                                            )}
                                        </div>

                                        {/* Teacher Info */}
                                        <div className="d-flex align-items-center justify-content-between small text-muted border-top pt-2.5 mb-3">
                                            <span><i className="bi bi-person me-1"></i>{doc.teacher_name || 'Subject Teacher'}</span>
                                            <span>{new Date(doc.updated_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}</span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="d-flex align-items-center justify-content-between gap-2 border-top pt-3">
                                        <Link
                                            href={`/academic/studio/${doc.id}`}
                                            className="btn btn-sm btn-primary-custom rounded-3 d-inline-flex align-items-center gap-1.5 px-3"
                                        >
                                            <i className="bi bi-box-arrow-in-up-right"></i> Open In Studio
                                        </Link>

                                        <div className="d-flex gap-1.5">
                                            {/* Submit for Review */}
                                            {['draft', 'revision_requested'].includes(doc.status) && (
                                                <button
                                                    onClick={() => handleSubmitForReview(doc.id)}
                                                    className="btn btn-sm btn-outline-warning rounded-3"
                                                    title="Submit for Coordinator Review"
                                                >
                                                    <i className="bi bi-send-check"></i>
                                                </button>
                                            )}

                                            {/* Download PDF */}
                                            {doc.google_file_id && (
                                                <a
                                                    href={`${API_URL}/academic-studio/documents/${doc.id}/export-pdf`}
                                                    target="_blank"
                                                    className="btn btn-sm btn-outline-secondary rounded-3"
                                                    title="Download Official PDF"
                                                >
                                                    <i className="bi bi-file-earmark-pdf text-danger"></i>
                                                </a>
                                            )}

                                            {/* Publish Toggle for Study Materials */}
                                            {doc.status === 'approved' && ['notes', 'summer_pack', 'presentation'].includes(doc.category) && (
                                                <button
                                                    onClick={() => handleTogglePublish(doc.id, doc.is_published_to_students)}
                                                    className={`btn btn-sm rounded-3 ${doc.is_published_to_students ? 'btn-success' : 'btn-outline-secondary'}`}
                                                    title={doc.is_published_to_students ? 'Published to Student Portal' : 'Hidden from Student Portal'}
                                                >
                                                    <i className={`bi ${doc.is_published_to_students ? 'bi-globe' : 'bi-eye-slash'}`}></i>
                                                </button>
                                            )}

                                            {/* Delete */}
                                            <button
                                                onClick={() => handleDelete(doc.id)}
                                                className="btn btn-sm btn-outline-danger rounded-3"
                                                title="Delete Document"
                                            >
                                                <i className="bi bi-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Document Modal */}
            {showCreateModal && (
                <>
                    <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
                    <div className="modal fade show d-block" tabIndex={-1} style={{ zIndex: 1055 }}>
                        <div className="modal-dialog modal-dialog-centered modal-lg">
                            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                                <div className="modal-header text-white p-4" style={{ backgroundColor: 'var(--primary-dark, #195053)' }}>
                                    <div>
                                        <h5 className="modal-title fw-bold mb-1"><i className="bi bi-cloud-plus-fill me-2 text-warning"></i>Create New Academic Document</h5>
                                        <p className="small text-white-50 mb-0">Initializes a new Google Doc/Slide with automated school headers in your Google Drive.</p>
                                    </div>
                                    <button type="button" className="btn-close btn-close-white" onClick={() => setShowCreateModal(false)}></button>
                                </div>

                                <form onSubmit={handleCreateDocument} className="modal-body p-4">
                                    <div className="row g-3">
                                        {/* Document Type Cards */}
                                        <div className="col-12">
                                            <label className="form-label fw-bold small text-muted text-uppercase">1. Choose Document Type</label>
                                            <div className="row g-2">
                                                {[
                                                    { id: 'exam', type: 'doc', label: 'Examination Paper', desc: 'Google Doc with standard 50/100 marks layout', icon: 'bi-file-earmark-ruled', color: 'primary' },
                                                    { id: 'test', type: 'doc', label: 'Class Test', desc: 'Google Doc for quick weekly/monthly quiz', icon: 'bi-journal-check', color: 'info' },
                                                    { id: 'summer_pack', type: 'doc', label: 'Summer Vacation Pack', desc: 'Homework activities booklet', icon: 'bi-sun-fill', color: 'warning' },
                                                    { id: 'notes', type: 'doc', label: 'Lecture Notes', desc: 'Chapter summaries & study guide', icon: 'bi-book-half', color: 'success' },
                                                    { id: 'presentation', type: 'slide', label: 'Lecture Slides', desc: 'Google Slide deck for classroom display', icon: 'bi-easel2-fill', color: 'warning' },
                                                    { id: 'marksheet', type: 'sheet', label: 'Assessment Sheet', desc: 'Google Sheet gradebook with curves', icon: 'bi-table', color: 'success' }
                                                ].map(item => {
                                                    const isSelected = formCategory === item.id;
                                                    return (
                                                        <div className="col-6 col-md-4" key={item.id}>
                                                            <div
                                                                onClick={() => { setFormCategory(item.id); setFormTemplateType(item.type); }}
                                                                className={`p-3 rounded-4 border text-center cursor-pointer transition h-100 ${isSelected ? 'border-primary bg-primary bg-opacity-10 shadow-sm' : 'bg-light'}`}
                                                                style={{ cursor: 'pointer' }}
                                                            >
                                                                <i className={`bi ${item.icon} fs-3 text-${item.color} mb-1 d-block`}></i>
                                                                <div className="fw-bold small text-dark">{item.label}</div>
                                                                <div className="text-muted" style={{ fontSize: '0.72rem' }}>{item.desc}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Title */}
                                        <div className="col-12 mt-3">
                                            <label className="form-label fw-bold small text-muted text-uppercase">2. Document Title <span className="text-danger">*</span></label>
                                            <input
                                                type="text"
                                                className="form-control form-control-lg rounded-3 fw-bold"
                                                placeholder="e.g., Class 10 Physics Mid-Term Examination 2026"
                                                value={formTitle}
                                                onChange={e => setFormTitle(e.target.value)}
                                                required
                                            />
                                        </div>

                                        {/* Class & Subject */}
                                        <div className="col-md-6">
                                            <label className="form-label fw-bold small text-muted text-uppercase">Target Class</label>
                                            <select className="form-select rounded-3" value={formClassId} onChange={e => setFormClassId(e.target.value)}>
                                                <option value="">Select Class...</option>
                                                {classes.map(c => (
                                                    <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="col-md-6">
                                            <label className="form-label fw-bold small text-muted text-uppercase">Target Subject</label>
                                            <select className="form-select rounded-3" value={formSubjectId} onChange={e => setFormSubjectId(e.target.value)}>
                                                <option value="">Select Subject...</option>
                                                {subjects.map(s => (
                                                    <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Academic Year & Term */}
                                        <div className="col-md-6">
                                            <label className="form-label fw-bold small text-muted text-uppercase">Academic Year</label>
                                            <select className="form-select rounded-3" value={formYearId} onChange={e => { setFormYearId(e.target.value); fetchTerms(e.target.value); }}>
                                                {academicYears.map(y => (
                                                    <option key={y.id} value={y.id}>{y.year_name} {y.is_active ? '(Active)' : ''}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="col-md-6">
                                            <label className="form-label fw-bold small text-muted text-uppercase">Academic Term</label>
                                            <select className="form-select rounded-3" value={formTermId} onChange={e => setFormTermId(e.target.value)}>
                                                <option value="">Select Term...</option>
                                                {academicTerms.map(t => (
                                                    <option key={t.id} value={t.id}>{t.term_name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Marks & Scheduled Date */}
                                        {['exam', 'test'].includes(formCategory) && (
                                            <>
                                                <div className="col-md-6">
                                                    <label className="form-label fw-bold small text-muted text-uppercase">Total Marks</label>
                                                    <input
                                                        type="number"
                                                        className="form-control rounded-3"
                                                        value={formMarks}
                                                        onChange={e => setFormMarks(e.target.value)}
                                                    />
                                                </div>

                                                <div className="col-md-6">
                                                    <label className="form-label fw-bold small text-muted text-uppercase">Exam / Test Date</label>
                                                    <input
                                                        type="date"
                                                        className="form-control rounded-3"
                                                        value={formScheduledDate}
                                                        onChange={e => setFormScheduledDate(e.target.value)}
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {/* Instructions */}
                                        <div className="col-12">
                                            <label className="form-label fw-bold small text-muted text-uppercase">Special Instructions for Students</label>
                                            <textarea
                                                className="form-control rounded-3"
                                                rows={2}
                                                placeholder="e.g. Calculators are allowed. Attempt all 3 sections."
                                                value={formInstructions}
                                                onChange={e => setFormInstructions(e.target.value)}
                                            ></textarea>
                                        </div>
                                    </div>

                                    <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                                        <button type="button" className="btn btn-light rounded-pill px-4" onClick={() => setShowCreateModal(false)}>
                                            Cancel
                                        </button>
                                        <button type="submit" className="btn btn-primary-custom rounded-pill px-4 fw-bold" disabled={creating}>
                                            {creating ? (
                                                <><span className="spinner-border spinner-border-sm me-2"></span>Creating Google Doc...</>
                                            ) : (
                                                <><i className="bi bi-google me-1.5"></i> Launch in Studio</>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
