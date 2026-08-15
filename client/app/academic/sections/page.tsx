'use client';
import { useState, useEffect } from 'react';
import { notify, toast } from '@/app/utils/notify';
import { useAuth } from '@/contexts/AuthContext';

type SectionItem = {
    section_id: number;
    section_name: string;
    class_id: number;
    class_name: string;
};

type ClassItem = { class_id: number; class_name: string; };

export default function SectionSettings() {
    // Data States
    const [sections, setSections] = useState<SectionItem[]>([]);
    const [classes, setClasses] = useState<ClassItem[]>([]);

    // UI States
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    // Form
    const [form, setForm] = useState({
        section_name: '',
        class_id: ''
    });

    const { hasPermission } = useAuth();

    useEffect(() => {
        const init = async () => {
            await Promise.all([fetchClasses(), fetchSections()]);
            setLoading(false);
        };
        init();
    }, []);

    const fetchClasses = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic`);
            if (res.ok) setClasses(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchSections = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/sections`);
            if (res.ok) setSections(await res.json());
        } catch (e) { console.error(e); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const url = editMode ? `${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/sections/${selectedId}` : `${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/sections`;
        const method = editMode ? 'PUT' : 'POST';

        const toastId = toast.loading("Processing...");

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });

            if (res.ok) {
                fetchSections();
                resetForm();
                toast.update(toastId, { render: editMode ? "Section updated successfully!" : "Section created successfully!", type: "success", isLoading: false, autoClose: 3000 });
            } else {
                const err = await res.json();
                toast.update(toastId, { render: err.error || "Operation failed", type: "error", isLoading: false, autoClose: 4000 });
            }
        } catch (err) {
            toast.update(toastId, { render: "Error saving section. Check server.", type: "error", isLoading: false, autoClose: 4000 });
        }
    };

    const handleEdit = (s: SectionItem) => {
        setForm({
            section_name: s.section_name,
            class_id: s.class_id.toString()
        });
        setEditMode(true);
        setSelectedId(s.section_id);
        toast.info("Editing mode enabled", { autoClose: 2000 });
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this section?")) return;

        const toastId = toast.loading("Deleting...");
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/sections/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchSections();
                toast.update(toastId, { render: "Section deleted successfully", type: "success", isLoading: false, autoClose: 3000 });
            } else {
                toast.update(toastId, { render: "Failed to delete section", type: "error", isLoading: false, autoClose: 3000 });
            }
        } catch (err) {
            toast.update(toastId, { render: "Error deleting section", type: "error", isLoading: false, autoClose: 3000 });
        }
    };

    const resetForm = () => {
        setForm({ section_name: '', class_id: '' });
        setEditMode(false);
        setSelectedId(null);
    };

    // Grouping for Tree View
    const groupedSections = sections.reduce((acc, section) => {
        const cls = section.class_name;
        if (!acc[cls]) acc[cls] = [];
        acc[cls].push(section);
        return acc;
    }, {} as Record<string, SectionItem[]>);

    return (
        <div className="container-fluid p-4" style={{ animation: 'fadeIn 0.5s ease-in-out' }}>
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .section-item:hover { background-color: #f8f9fa; }
            `}</style>

            <div className="d-flex align-items-center mb-4">
                <div className="bg-white p-2 rounded-circle shadow-sm me-3 text-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                </div>
                <div>
                    <h2 className="mb-0 text-primary-dark fw-bold">Section Setup</h2>
                    <p className="text-muted mb-0 small">Organize classes into sections</p>
                </div>
            </div>

            <div className="row g-4">
                {/* Left: Form */}
                <div className="col-lg-4 col-md-5">
                    <div className="card shadow border-0 h-100 sticky-top" style={{ top: '20px', zIndex: 1 }}>
                        <div className="card-header bg-white py-3 border-bottom-0">
                            <h5 className="mb-0 fw-bold text-primary-dark">
                                {editMode ? (
                                    <span className="d-flex align-items-center text-accent-orange">
                                        <svg className="me-2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                        Edit Section
                                    </span>
                                ) : (
                                    <span className="d-flex align-items-center text-primary-teal">
                                        <svg className="me-2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        Create Class Section
                                    </span>
                                )}
                            </h5>
                        </div>

                        <div className="card-body">
                            <form onSubmit={handleSubmit}>
                                <div className="mb-4">
                                    <label className="form-label text-muted small fw-bold text-uppercase">Select Class</label>
                                    <select
                                        required
                                        className="form-select form-select-lg border-2"
                                        style={{ fontSize: '1rem' }}
                                        value={form.class_id}
                                        onChange={e => setForm({ ...form, class_id: e.target.value })}
                                    >
                                        <option value="">Choose Class...</option>
                                        {classes.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                                    </select>
                                </div>
                                <div className="mb-4">
                                    <label className="form-label text-muted small fw-bold text-uppercase">Section Name</label>
                                    <input
                                        required
                                        type="text"
                                        className="form-control form-control-lg border-2"
                                        placeholder="e.g. A, Rose, Red"
                                        style={{ fontSize: '1rem' }}
                                        value={form.section_name}
                                        onChange={e => setForm({ ...form, section_name: e.target.value })}
                                    />
                                    <div className="form-text small">Use a unique name for this class section.</div>
                                </div>

                                {hasPermission('academic', 'write') && (
                                    <div className="d-grid gap-2">
                                        <button type="submit" className={`btn ${editMode ? 'btn-warning text-white' : 'btn-primary-custom'} py-2 shadow-sm`}>
                                            {editMode ? 'Update Section' : 'Create Section'}
                                        </button>
                                        {editMode && <button type="button" onClick={resetForm} className="btn btn-light py-2">Cancel Editing</button>}
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>
                </div>

                {/* Right: Tree List */}
                <div className="col-lg-8 col-md-7">
                    <div className="card shadow border-0 h-100">
                        <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                            <h5 className="mb-0 fw-bold text-primary-dark">Class Sections Structure</h5>
                            <span className="badge bg-light text-dark border">{sections.length} Sections</span>
                        </div>
                        <div className="card-body p-0 full-height-scroll">
                            {loading && (
                                <div className="p-5 text-center text-muted">
                                    <div className="spinner-border text-primary mb-3" role="status"></div>
                                    <p>Loading sections...</p>
                                </div>
                            )}

                            {!loading && Object.keys(groupedSections).length === 0 && (
                                <div className="p-5 text-center text-muted">
                                    <svg className="mb-3 text-gray-300" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                                    <p>No sections found. Add one on the left.</p>
                                </div>
                            )}

                            <div className="accordion accordion-flush" id="sectionsAccordion">
                                {Object.keys(groupedSections).map((clsName, idx) => (
                                    <div className="accordion-item border-0 border-bottom" key={idx}>
                                        <h2 className="accordion-header">
                                            <button className="accordion-button collapsed fw-bold text-dark bg-light" type="button" data-bs-toggle="collapse" data-bs-target={`#flush-${idx}`} aria-expanded="true">
                                                <span className="me-2 text-primary-teal">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>
                                                </span>
                                                {clsName}
                                                <span className="badge bg-white text-secondary border ms-3 rounded-pill px-2 small">{groupedSections[clsName].length} Sections</span>
                                            </button>
                                        </h2>
                                        <div id={`flush-${idx}`} className="accordion-collapse collapse show" data-bs-parent="#sectionsAccordion">
                                            <div className="accordion-body p-0">
                                                <ul className="list-group list-group-flush">
                                                    {groupedSections[clsName].map((sec, sIdx) => (
                                                        <li key={sec.section_id}
                                                            className="list-group-item section-item d-flex justify-content-between align-items-center py-3 ps-4 border-bottom-0 animate__animated animate__fadeIn"
                                                            style={{ animationDelay: `${sIdx * 0.05}s` }}
                                                        >
                                                            <div className="d-flex align-items-center">
                                                                <div className="bg-light p-2 rounded me-3 text-muted">
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                                                                </div>
                                                                <div>
                                                                    <span className="fw-bold text-dark">Section {sec.section_name}</span>
                                                                    {editMode && selectedId === sec.section_id && <span className="badge bg-warning text-dark ms-2" style={{ fontSize: '0.65rem' }}>EDITING</span>}
                                                                </div>
                                                            </div>
                                                            <div className="pe-3">
                                                                {hasPermission('academic', 'write') && (
                                                                    <button onClick={() => handleEdit(sec)} className="btn btn-sm btn-link text-decoration-none p-0 me-3 text-secondary hover-scale" title="Edit">
                                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                                                    </button>
                                                                )}
                                                                {hasPermission('academic', 'delete') && (
                                                                    <button onClick={() => handleDelete(sec.section_id)} className="btn btn-sm btn-link text-danger text-decoration-none p-0 hover-scale" title="Delete">
                                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

