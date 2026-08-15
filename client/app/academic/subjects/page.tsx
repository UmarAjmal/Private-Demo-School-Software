'use client';
import { useState, useEffect } from 'react';
import { notify, toast } from '@/app/utils/notify';
import { useAuth } from '@/contexts/AuthContext';

type SubjectItem = {
    subject_id: number;
    subject_name: string;
    subject_code: string;
    section_id: number;
    section_name: string;
    class_id: number;
    class_name: string;
    total_marks: number;
    passing_marks: number;
};

type ClassItem = {
    class_id: number;
    class_name: string;
};

type SectionItem = {
    section_id: number;
    section_name: string;
    class_id: number;
};

export default function SubjectSettings() {
    // Data State
    const [subjects, setSubjects] = useState<SubjectItem[]>([]);
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [sections, setSections] = useState<SectionItem[]>([]);

    // UI State
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    // Form State
    const [form, setForm] = useState({
        subject_name: '',
        subject_code: '',
        class_id: '',
        section_ids: [] as number[]
    });

    const { hasPermission } = useAuth();

    useEffect(() => {
        // Initialize Bootstrap JS for Accordions
        require('bootstrap/dist/js/bootstrap.bundle.min.js');

        const init = async () => {
            await Promise.all([fetchClasses(), fetchSections(), fetchSubjects()]);
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

    const fetchSubjects = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/subjects`);
            if (res.ok) setSubjects(await res.json());
        } catch (e) { console.error(e); }
    };

    // Derived Data for UI
    const filteredSections = form.class_id
        ? sections.filter(s => s.class_id === Number(form.class_id))
        : [];

    const handleCheckboxChange = (secId: number) => {
        setForm(prev => {
            const exists = prev.section_ids.includes(secId);
            if (exists) {
                // Should we allow deselecting in edit mode? Yes.
                return { ...prev, section_ids: prev.section_ids.filter(id => id !== secId) };
            } else {
                // In edit mode, if we force single selection, we might clear others.
                // But for now let's behave as standard multi-select.
                // Note: The PUT API only takes one section_id.
                if (editMode) {
                    // For edit mode, we essentially switch selection
                    return { ...prev, section_ids: [secId] };
                }
                return { ...prev, section_ids: [...prev.section_ids, secId] };
            }
        });
    };

    const resetForm = () => {
        setForm({
            subject_name: '',
            subject_code: '',
            class_id: '',
            section_ids: []
        });
        setEditMode(false);
        setSelectedId(null);
    };

    const handleEdit = (sub: SubjectItem) => {
        setForm({
            subject_name: sub.subject_name,
            subject_code: sub.subject_code,
            class_id: sub.class_id.toString(),
            section_ids: [sub.section_id]
        });
        setEditMode(true);
        setSelectedId(sub.subject_id);
        toast.info("Editing mode enabled", { autoClose: 2000 });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this subject?")) return;

        const toastId = toast.loading("Deleting...");
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/subjects/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchSubjects();
                toast.update(toastId, { render: "Subject deleted successfully", type: "success", isLoading: false, autoClose: 3000 });
            } else {
                toast.update(toastId, { render: "Failed to delete subject", type: "error", isLoading: false, autoClose: 3000 });
            }
        } catch (e) {
            toast.update(toastId, { render: "Error deleting subject", type: "error", isLoading: false, autoClose: 3000 });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (form.section_ids.length === 0) {
            notify.error("Please select at least one section");
            return;
        }

        const url = editMode
            ? `${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/subjects/${selectedId}`
            : `${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/subjects`;

        const method = editMode ? 'PUT' : 'POST';
        const toastId = toast.loading("Processing...");

        let bodyPayload;
        if (editMode) {
            // Edit Mode: Single Section Update
            bodyPayload = {
                subject_name: form.subject_name,
                subject_code: form.subject_code,
                section_id: form.section_ids[0]
            };
        } else {
            // Create Mode: Multi Section
            bodyPayload = {
                subject_name: form.subject_name,
                subject_code: form.subject_code,
                section_ids: form.section_ids
            };
        }

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload)
            });

            if (res.ok) {
                fetchSubjects();
                resetForm();
                toast.update(toastId, {
                    render: editMode ? "Subject updated!" : "Subjects created!",
                    type: "success",
                    isLoading: false,
                    autoClose: 3000
                });
            } else {
                const err = await res.json();
                toast.update(toastId, {
                    render: err.error || "Operation failed",
                    type: "error",
                    isLoading: false,
                    autoClose: 4000
                });
            }
        } catch (err) {
            toast.update(toastId, {
                render: "Server connection error",
                type: "error",
                isLoading: false,
                autoClose: 4000
            });
        }
    };

    // Grouping Logic
    const groupedData = subjects.reduce((acc, subject) => {
        const className = subject.class_name;
        const sectionName = subject.section_name;

        if (!acc[className]) acc[className] = {};
        if (!acc[className][sectionName]) acc[className][sectionName] = [];

        acc[className][sectionName].push(subject);
        return acc;
    }, {} as Record<string, Record<string, SubjectItem[]>>);

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center vh-100">
            <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
            </div>
        </div>
    );

    return (
        <div className="container-fluid p-4">
            <h2 className="mb-4 fw-bold animate__animated animate__fadeInDown" style={{ color: 'var(--primary-dark)' }}>
                <i className="bi bi-journal-bookmark-fill me-2"></i>Subject Settings
            </h2>

            <div className="row g-4">
                {/* LEFT COLUMN: FORM */}
                <div className="col-md-4 animate__animated animate__fadeInLeft">
                    <div className="card shadow-lg border-0 rounded-4">
                        <div className="card-header text-white p-3 rounded-top-4" style={{ backgroundColor: 'var(--primary-dark)' }}>
                            <h5 className="mb-0 card-title">
                                {editMode ? 'Edit Subject' : 'Create New Subject'}
                            </h5>
                        </div>
                        <div className="card-body p-4">
                            <form onSubmit={handleSubmit}>
                                {/* Class Selection */}
                                <div className="mb-3">
                                    <label className="form-label fw-bold" style={{ color: 'var(--primary-dark)' }}>Select Class (Filter)</label>
                                    <select
                                        className="form-select"
                                        value={form.class_id}
                                        onChange={e => setForm({ ...form, class_id: e.target.value, section_ids: [] })}
                                        required
                                    >
                                        <option value="">-- Choose Class --</option>
                                        {classes.map(c => (
                                            <option key={c.class_id} value={c.class_id}>
                                                {c.class_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Subject Name */}
                                <div className="mb-3">
                                    <label className="form-label fw-bold" style={{ color: 'var(--primary-dark)' }}>Subject Name</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. Mathematics"
                                        value={form.subject_name}
                                        onChange={e => setForm({ ...form, subject_name: e.target.value })}
                                        required
                                    />
                                </div>

                                {/* Subject Code */}
                                <div className="mb-3">
                                    <label className="form-label fw-bold" style={{ color: 'var(--primary-dark)' }}>Subject Code</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. MTH-101"
                                        value={form.subject_code}
                                        onChange={e => setForm({ ...form, subject_code: e.target.value })}
                                        required
                                    />
                                </div>

                                {/* Sections Selection (Multi-Select) */}
                                <div className="mb-4">
                                    <label className="form-label fw-bold d-block" style={{ color: 'var(--primary-dark)' }}>
                                        Select Sections <small className="text-muted fw-normal">(Multiple Supported)</small>
                                    </label>

                                    <div className="card p-2 bg-light border-0" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                        {filteredSections.length > 0 ? (
                                            filteredSections.map(s => (
                                                <div key={s.section_id} className="form-check mb-2">
                                                    <input
                                                        className="form-check-input"
                                                        type="checkbox"
                                                        id={`section-${s.section_id}`}
                                                        checked={form.section_ids.includes(s.section_id)}
                                                        onChange={() => handleCheckboxChange(s.section_id)}
                                                    />
                                                    <label className="form-check-label" htmlFor={`section-${s.section_id}`}>
                                                        {s.section_name}
                                                    </label>
                                                </div>
                                            ))
                                        ) : (
                                            <small className="text-muted text-center d-block py-2">
                                                {form.class_id ? "No sections found" : "Select a class first"}
                                            </small>
                                        )}
                                    </div>
                                </div>

                                {hasPermission('academic', 'write') && (
                                    <div className="d-grid gap-2 mt-4">
                                        <button
                                            type="submit"
                                            className="btn btn-lg shadow-sm text-white"
                                            style={{ backgroundColor: editMode ? 'var(--accent-orange)' : 'var(--primary-teal)' }}
                                        >
                                            {editMode ? 'Update Subject' : 'Add Subject(s)'}
                                        </button>
                                        {editMode && (
                                            <button
                                                type="button"
                                                className="btn btn-light border"
                                                onClick={resetForm}
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: LIST */}
                <div className="col-md-8 animate__animated animate__fadeInRight">
                    <div className="card shadow-lg border-0 rounded-4">
                        <div className="card-header bg-white p-4 border-bottom-0">
                            <h5 className="mb-0 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                                <i className="bi bi-list-task me-2" style={{ color: 'var(--primary-teal)' }}></i>
                                Subject List (Hierarchical)
                            </h5>
                        </div>
                        <div className="card-body p-0">
                            {/* Tree View */}
                            <div className="accordion accordion-flush" id="subjectsAccordion">
                                {Object.keys(groupedData).length === 0 ? (
                                    <div className="text-center p-5 text-muted">
                                        No subjects added yet. Start by adding one from the left panel.
                                    </div>
                                ) : (
                                    Object.entries(groupedData).map(([className, sectionMap], classIdx) => (
                                        <div className="accordion-item border-0 mb-2" key={className}>
                                            <h2 className="accordion-header">
                                                <button
                                                    className={`accordion-button rounded-3 fw-bold ${classIdx !== 0 ? 'collapsed' : ''}`}
                                                    type="button"
                                                    data-bs-toggle="collapse"
                                                    data-bs-target={`#collapseClass-${classIdx}`}
                                                    style={{ backgroundColor: 'var(--bg-main)', color: 'var(--primary-dark)' }}
                                                >
                                                    <i className="bi bi-mortarboard-fill me-2" style={{ color: 'var(--accent-orange)' }}></i>
                                                    {className}
                                                </button>
                                            </h2>
                                            <div
                                                id={`collapseClass-${classIdx}`}
                                                className={`accordion-collapse collapse ${classIdx === 0 ? 'show' : ''}`}
                                            >
                                                <div className="accordion-body p-0">
                                                    {Object.entries(sectionMap).map(([sectionName, classSubjects]) => (
                                                        <div key={sectionName} className="p-3 ps-5 border-bottom bg-white">
                                                            <h6 className="fw-bold text-uppercase fs-7 mb-3" style={{ color: 'var(--primary-teal)' }}>
                                                                <i className="bi bi-puzzle me-2"></i>
                                                                Section: {sectionName}
                                                            </h6>

                                                            <div className="table-responsive">
                                                                <table className="table table-hover align-middle table-sm border-start border-3" style={{ borderColor: 'var(--primary-teal)' }}>
                                                                    <thead className="table-light">
                                                                        <tr>
                                                                            <th className="ps-3">Subject Name</th>
                                                                            <th>Code</th>
                                                                            <th className="text-end pe-3">Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {classSubjects.map((sub) => (
                                                                            <tr key={sub.subject_id}>
                                                                                <td className="ps-3 fw-medium">{sub.subject_name}</td>
                                                                                <td><span className="badge" style={{ backgroundColor: 'var(--primary-dark)' }}>{sub.subject_code}</span></td>
                                                                                {/* Marks Removed */}
                                                                                <td className="text-end pe-3">
                                                                                    {hasPermission('academic', 'write') && (
                                                                                        <button
                                                                                            className="btn btn-sm btn-outline-warning me-2"
                                                                                            onClick={() => handleEdit(sub)}
                                                                                            title="Edit"
                                                                                        >
                                                                                            <i className="bi bi-pencil-fill"></i>
                                                                                        </button>
                                                                                    )}
                                                                                    {hasPermission('academic', 'delete') && (
                                                                                        <button
                                                                                            className="btn btn-sm btn-outline-danger"
                                                                                            onClick={() => handleDelete(sub.subject_id)}
                                                                                            title="Delete"
                                                                                        >
                                                                                            <i className="bi bi-trash-fill"></i>
                                                                                        </button>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

