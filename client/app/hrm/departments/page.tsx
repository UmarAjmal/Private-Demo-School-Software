'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type Department = {
    department_id: number;
    department_name: string;
    head_of_department: string;
    description: string;
    employee_count: number;
};

export default function DepartmentsPage() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        department_name: '',
        head_of_department: '',
        description: ''
    });

    const { hasPermission } = useAuth();

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/hrm/departments`);
            if (res.ok) setDepartments(await res.json());
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/hrm/departments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                fetchDepartments();
                setShowModal(false);
                setFormData({ department_name: '', head_of_department: '', description: '' });
            }
        } catch (err) { alert('Failed to create department'); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure? This may affect employees linked to this department.')) return;
        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/hrm/departments/${id}`, { method: 'DELETE' });
            fetchDepartments();
        } catch (err) { alert('Failed to delete'); }
    };

    return (
        <div className="container-fluid animate__animated animate__fadeIn">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="h3 mb-0 text-primary-dark">Departments</h2>
                {hasPermission('hrm', 'write') && (
                    <button className="btn btn-primary-custom" onClick={() => setShowModal(true)}>
                        + Add Department
                    </button>
                )}
            </div>

            <div className="card border-0 shadow-sm">
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover mb-0">
                            <thead className="bg-light">
                                <tr>
                                    <th className="ps-4">Name</th>
                                    <th>Head of Dept</th>
                                    <th>Employees</th>
                                    <th>Description</th>
                                    <th className="text-end pe-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={5} className="text-center py-4">Loading...</td></tr>
                                ) : departments.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-4">No departments found.</td></tr>
                                ) : (
                                    departments.map(dept => (
                                        <tr key={dept.department_id}>
                                            <td className="ps-4 fw-medium">{dept.department_name}</td>
                                            <td>{dept.head_of_department || '-'}</td>
                                            <td>
                                                <span className="badge bg-light text-dark border">
                                                    {dept.employee_count} &nbsp; <i className="bi bi-people"></i>
                                                </span>
                                            </td>
                                            <td className="text-muted small">{dept.description}</td>
                                            <td className="text-end pe-4">
                                                {hasPermission('hrm', 'delete') && (
                                                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(dept.department_id)}>
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-backdrop-custom">
                    <div className="modal-content-custom animate__animated animate__zoomIn">
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <h4 className="mb-0">Add Department</h4>
                            <button onClick={() => setShowModal(false)} className="btn-close"></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="mb-3">
                                <label className="form-label">Department Name</label>
                                <input
                                    required
                                    type="text"
                                    className="form-control"
                                    value={formData.department_name}
                                    onChange={e => setFormData({ ...formData, department_name: e.target.value })}
                                />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Head of Department</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={formData.head_of_department}
                                    onChange={e => setFormData({ ...formData, head_of_department: e.target.value })}
                                    placeholder="e.g. Dr. John Doe"
                                />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Description</label>
                                <textarea
                                    className="form-control"
                                    rows={3}
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                ></textarea>
                            </div>
                            <div className="d-grid">
                                {hasPermission('hrm', 'write') && <button type="submit" className="btn btn-primary-custom">Create Department</button>}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx>{`
                .modal-backdrop-custom {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1050;
                }
                .modal-content-custom {
                    background: white; padding: 2rem; border-radius: 12px;
                    width: 100%; max-width: 500px;
                }
            `}</style>
        </div>
    );
}
