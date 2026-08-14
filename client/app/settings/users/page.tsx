'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastHelper';

type User = {
    id: number;
    username: string;
    full_name: string;
    email: string;
    role_id: number;
    role_name?: string;
    is_active: boolean;
    password?: string; // Only for creation/update
};

type Role = {
    id: number;
    role_name: string;
};

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'form'>('list');
    const { hasPermission } = useAuth();
    const [formData, setFormData] = useState<User>({
        id: 0, username: '', full_name: '', email: '', role_id: 0, is_active: true, password: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [uRes, rRes] = await Promise.all([
                fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/users`),
                fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/roles`)
            ]);
            const uData = await uRes.json();
            const rData = await rRes.json();
            setUsers(uData);
            setRoles(rData);
            setLoading(false);
        } catch (err) { console.error(err); }
    };

    const handleCreate = () => {
        setFormData({ id: 0, username: '', full_name: '', email: '', role_id: roles[0]?.id || 0, is_active: true, password: '' });
        setView('form');
    };

    const handleEdit = (user: User) => {
        setFormData({ ...user, password: '' }); // Don't show password, only allow reset
        setView('form');
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this user?")) return;
        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/users/${id}`, { method: 'DELETE' });
            fetchData();
        } catch (err) { console.error(err); }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const url = formData.id === 0 ? `${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/users` : `${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/users/${formData.id}`;
        const method = formData.id === 0 ? 'POST' : 'PUT';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.status === 400) {
                const msg = await res.json();
                showToast.error(msg?.error || msg || 'Operation failed');
                return;
            }

            showToast.success('User details saved successfully');
            setView('list');
            fetchData();
        } catch (err) { console.error(err); }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="container-fluid animate__animated animate__fadeIn">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="h3 mb-0 text-primary-dark">System Users</h2>
                {view === 'list' && hasPermission('settings', 'write') && (
                    <button className="btn btn-primary-custom" onClick={handleCreate}>
                        <i className="bi bi-person-plus me-2"></i>Create New User
                    </button>
                )}
            </div>

            {view === 'list' && (
                <div className="card card-custom">
                    <div className="card-body p-0">
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th className="px-4 py-3">User Details</th>
                                        <th className="py-3">Username</th>
                                        <th className="py-3">Role</th>
                                        <th className="py-3">Status</th>
                                        <th className="py-3 text-end px-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(user => (
                                        <tr key={user.id}>
                                            <td className="px-4">
                                                <div className="fw-bold text-dark">{user.full_name}</div>
                                                <div className="small text-muted">{user.email}</div>
                                            </td>
                                            <td><span className="font-monospace text-secondary">{user.username}</span></td>
                                            <td>
                                                <span className="badge badge-role">{user.role_name || 'No Role'}</span>
                                            </td>
                                            <td>
                                                <span className={`badge ${user.is_active ? 'bg-success' : 'bg-danger'} bg-opacity-75`}>
                                                    {user.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="text-end px-4">
                                                {hasPermission('settings', 'write') && (
                                                    <button className="btn btn-sm btn-link text-primary p-0 me-3" onClick={() => handleEdit(user)} title="Edit">
                                                        <i className="bi bi-pencil">✏️</i>
                                                    </button>
                                                )}
                                                {hasPermission('settings', 'delete') && (
                                                    <button className="btn btn-sm btn-link text-danger p-0" onClick={() => handleDelete(user.id)} title="Delete">
                                                        <i className="bi bi-trash">🗑️</i>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {view === 'form' && (
                <div className="card card-custom p-4 col-lg-8 mx-auto animate__animated animate__fadeInUp">
                    <div className="d-flex align-items-center mb-4 border-bottom pb-3">
                        <button className="btn btn-sm btn-light me-3" onClick={() => setView('list')}>
                            &larr; Back
                        </button>
                        <h3 className="h4 mb-0 text-primary-dark">{formData.id === 0 ? 'Create New User' : 'Edit User Details'}</h3>
                    </div>

                    <form onSubmit={handleSave}>
                        <div className="mb-3">
                            <label className="form-label fw-semibold">Full Name</label>
                            <input className="form-control" required value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} placeholder="John Doe" />
                        </div>

                        <div className="mb-3">
                            <label className="form-label fw-semibold">Email Address</label>
                            <input type="email" className="form-control" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="john@example.com" />
                        </div>

                        <div className="row g-3 mb-3">
                            <div className="col-12 col-md-6">
                                <label className="form-label fw-semibold">Username</label>
                                <input className="form-control" required value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} disabled={formData.id !== 0} />
                            </div>
                            <div className="col-12 col-md-6">
                                <label className="form-label fw-semibold">User Role</label>
                                <select className="form-select" value={formData.role_id} onChange={e => setFormData({ ...formData, role_id: parseInt(e.target.value) })}>
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.role_name}</option>)}
                                </select>
                            </div>
                        </div>

                        {formData.id === 0 && (
                            <div className="mb-3">
                                <label className="form-label fw-semibold">Password</label>
                                <input type="password" className="form-control" required value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                            </div>
                        )}

                        {formData.id !== 0 && (
                            <div className="mb-4 p-3 bg-light rounded border">
                                <label className="form-label fw-semibold text-muted small text-uppercase">Reset Password</label>
                                <input type="password" className="form-control" placeholder="Enter new password to change..." value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                                <div className="form-text">Leave blank to keep the current password.</div>
                            </div>
                        )}

                        {formData.id !== 0 && (
                            <div className="mb-4 form-check form-switch">
                                <input className="form-check-input" type="checkbox" role="switch" id="activeSwitch" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} />
                                <label className="form-check-label" htmlFor="activeSwitch">User Account is Active</label>
                            </div>
                        )}

                        <div className="d-flex justify-content-end gap-2 mt-4 flex-wrap">
                            <button type="button" className="btn btn-light" onClick={() => setView('list')}>Cancel</button>
                            {hasPermission('settings', 'write') && <button type="submit" className="btn btn-primary-custom px-4">Save User</button>}
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
