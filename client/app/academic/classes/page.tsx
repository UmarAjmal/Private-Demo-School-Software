'use client';
import { useState, useEffect } from 'react';
import { notify, toast } from '@/app/utils/notify';
import { useAuth } from '@/contexts/AuthContext';

type ClassItem = { class_id: number; class_name: string; description: string; };

export default function ClassSettings() {
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    // Form State
    const [form, setForm] = useState({ class_name: '', description: '' });

    const { hasPermission } = useAuth();

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic`);
            if (res.ok) {
                const data = await res.json();
                setClasses(data);
            }
        } catch (err) { console.error("Fetch error:", err); }
        finally { setLoading(false); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const url = editMode ? `${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/${selectedId}` : `${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic`;
        const method = editMode ? 'PUT' : 'POST';

        const toastId = toast.loading(editMode ? "Updating class..." : "Creating class...");

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });

            if (res.ok) {
                fetchClasses();
                resetForm();
                toast.update(toastId, { render: editMode ? "Class updated successfully!" : "Class created successfully!", type: "success", isLoading: false, autoClose: 3000 });
            } else {
                const errData = await res.json();
                toast.update(toastId, { render: errData.error || "Operation failed. Please try again.", type: "error", isLoading: false, autoClose: 4000 });
            }
        } catch (err) {
            console.error("Submit error:", err);
            toast.update(toastId, { render: "Network error. Is server running?", type: "error", isLoading: false, autoClose: 4000 });
        }
    };

    const handleEdit = (c: ClassItem) => {
        setForm({ class_name: c.class_name, description: c.description || '' });
        setEditMode(true);
        setSelectedId(c.class_id);
        toast.info("Editing mode enabled", { autoClose: 2000 });
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Delete this class? Sections associated with it will be deleted.")) return;

        const toastId = toast.loading("Deleting class...");

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchClasses();
                toast.update(toastId, { render: "Class deleted successfully", type: "success", isLoading: false, autoClose: 3000 });
            } else {
                toast.update(toastId, { render: "Failed to delete class", type: "error", isLoading: false, autoClose: 3000 });
            }
        } catch (err) {
            toast.update(toastId, { render: "Error deleting class", type: "error", isLoading: false, autoClose: 3000 });
        }
    };

    const resetForm = () => {
        setForm({ class_name: '', description: '' });
        setEditMode(false);
        setSelectedId(null);
    };

    return (
        <div className="container-fluid p-4" style={{ animation: 'fadeIn 0.5s ease-in-out' }}>
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .hover-scale { transition: transform 0.2s; }
                .hover-scale:hover { transform: scale(1.02); }
                .list-group-item { transition: background-color 0.2s; border-left: 4px solid transparent; }
                .list-group-item:hover { background-color: #f8f9fa; border-left-color: var(--accent-orange); }
            `}</style>

            <div className="d-flex align-items-center mb-4">
                <div className="bg-white p-2 rounded-circle shadow-sm me-3 text-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>
                </div>
                <div>
                    <h2 className="mb-0 text-primary-dark fw-bold">Class Setup</h2>
                    <p className="text-muted mb-0 small">Manage academic classes and descriptions</p>
                </div>
            </div>

            <div className="row g-4">
                {/* Left: Form */}
                <div className="col-lg-4 col-md-5">
                    <div className="card shadow border-0 h-100">
                        <div className="card-header bg-white py-3 border-bottom-0">
                            <h5 className="mb-0 fw-bold text-primary-dark">
                                {editMode ? (
                                    <span className="d-flex align-items-center text-accent-orange">
                                        <svg className="me-2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                        Edit Class
                                    </span>
                                ) : (
                                    <span className="d-flex align-items-center text-primary-teal">
                                        <svg className="me-2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        Create Class
                                    </span>
                                )}
                            </h5>
                        </div>
                        <div className="card-body">
                            <form onSubmit={handleSubmit}>
                                <div className="mb-4">
                                    <label className="form-label text-muted small fw-bold text-uppercase">Class Name</label>
                                    <input
                                        required
                                        type="text"
                                        className="form-control form-control-lg border-2"
                                        placeholder="e.g. Grade 1"
                                        style={{ fontSize: '1rem' }}
                                        value={form.class_name}
                                        onChange={e => setForm({ ...form, class_name: e.target.value })}
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="form-label text-muted small fw-bold text-uppercase">Description</label>
                                    <textarea
                                        className="form-control border-2"
                                        rows={4}
                                        placeholder="Optional class details..."
                                        value={form.description}
                                        onChange={e => setForm({ ...form, description: e.target.value })}
                                    ></textarea>
                                </div>

                                {hasPermission('academic', 'write') && (
                                    <div className="d-grid gap-2">
                                        <button type="submit" className={`btn ${editMode ? 'btn-warning text-white' : 'btn-primary-custom'} py-2 shadow-sm`}>
                                            {editMode ? 'Update Class' : 'Create Class'}
                                        </button>
                                        {editMode && (
                                            <button type="button" onClick={resetForm} className="btn btn-light py-2">
                                                Cancel Editing
                                            </button>
                                        )}
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>
                </div>

                {/* Right: List */}
                <div className="col-lg-8 col-md-7">
                    <div className="card shadow border-0 h-100">
                        <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                            <h5 className="mb-0 fw-bold text-primary-dark">Existing Classes</h5>
                            <span className="badge bg-light text-dark border">{classes.length} Total</span>
                        </div>
                        <div className="card-body p-0 full-height-scroll">
                            {loading ? (
                                <div className="p-5 text-center text-muted">
                                    <div className="spinner-border text-primary mb-3" role="status"></div>
                                    <p>Loading classes...</p>
                                </div>
                            ) : classes.length === 0 ? (
                                <div className="p-5 text-center text-muted">
                                    <svg className="mb-3 text-gray-300" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>
                                    <p>No classes found. Add one on the left.</p>
                                </div>
                            ) : (
                                <div className="list-group list-group-flush">
                                    {classes.map((c, index) => (
                                        <div key={c.class_id}
                                            className="list-group-item p-3 d-flex justify-content-between align-items-center animate__animated animate__fadeIn"
                                            style={{ animationDelay: `${index * 0.05}s` }}
                                        >
                                            <div className="ms-2">
                                                <div className="d-flex align-items-center">
                                                    <h6 className="mb-0 fw-bold text-primary-dark fs-5">{c.class_name}</h6>
                                                    {editMode && selectedId === c.class_id && (
                                                        <span className="badge bg-warning text-dark ms-2 text-uppercase" style={{ fontSize: '0.65rem' }}>Editing</span>
                                                    )}
                                                </div>
                                                {c.description && <p className="text-muted mb-0 small mt-1">{c.description}</p>}
                                            </div>

                                            <div className="d-flex gap-2">
                                                {hasPermission('academic', 'write') && (
                                                    <button onClick={() => handleEdit(c)} className="btn btn-outline-primary btn-sm rounded-pill px-3 d-flex align-items-center">
                                                        <svg className="me-1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                                        Edit
                                                    </button>
                                                )}
                                                {hasPermission('academic', 'delete') && (
                                                    <button onClick={() => handleDelete(c.class_id)} className="btn btn-outline-danger btn-sm rounded-circle p-2" title="Delete">
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

