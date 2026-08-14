'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface FeeHead {
    head_id: number;
    head_name: string;
    head_type: 'regular' | 'extra' | 'prev_balance';
    frequency: 'monthly' | 'yearly' | 'once';
    description: string;
    is_active: boolean;
}

const emptyHead: Omit<FeeHead, 'head_id'> = {
    head_name: '',
    head_type: 'regular',
    frequency: 'monthly',
    description: '',
    is_active: true
};

export default function FeeHeadsPage() {
    const [heads, setHeads] = useState<FeeHead[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [current, setCurrent] = useState<FeeHead | typeof emptyHead>(emptyHead);
    const [editId, setEditId] = useState<number | null>(null);
    const [error, setError] = useState('');

    const { hasPermission } = useAuth();

    useEffect(() => { fetchHeads(); }, []);

    const fetchHeads = async () => {
        try {
            const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/fee-heads`);
            setHeads(await r.json());
        } catch { setError('Failed to load fee heads'); }
        finally { setLoading(false); }
    };

    const openAdd = () => { setCurrent({ ...emptyHead }); setEditMode(false); setEditId(null); setError(''); setShowModal(true); };
    const openEdit = (h: FeeHead) => { setCurrent({ ...h }); setEditMode(true); setEditId(h.head_id); setError(''); setShowModal(true); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setError('');
        try {
            const url = editMode ? `${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/fee-heads/${editId}` : `${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/fee-heads`;
            const method = editMode ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(current) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setShowModal(false); fetchHeads();
        } catch (err: any) { setError(err.message); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this fee head?')) return;
        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/fee-heads/${id}`, { method: 'DELETE' });
            fetchHeads();
        } catch { alert('Failed to delete'); }
    };

    const regular = heads.filter(h => h.head_type === 'regular');
    const extra = heads.filter(h => h.head_type === 'extra');
    const opb = heads.filter(h => h.head_type === 'prev_balance');

    const typeBadge = (type: string) => {
        if (type === 'regular') return <span className="badge rounded-pill" style={{ backgroundColor: 'var(--primary-teal)' }}>Regular</span>;
        if (type === 'prev_balance') return <span className="badge rounded-pill" style={{ backgroundColor: '#6f42c1' }}>Previous Balance</span>;
        return <span className="badge rounded-pill bg-warning text-dark">Extra / Ad-hoc</span>;
    };

    const freqBadge = (f: string) => {
        const map: any = { monthly: 'bg-info text-dark', yearly: 'bg-secondary', once: 'bg-light text-dark border' };
        return <span className={`badge rounded-pill ${map[f] || 'bg-light'}`}>{f.charAt(0).toUpperCase() + f.slice(1)}</span>;
    };

    return (
        <div className="container-fluid p-4 animate__animated animate__fadeIn">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="fw-bold mb-1" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-tags me-2"></i>Fee Heads
                    </h2>
                    <p className="text-muted small mb-0">Manage all charge types Tuition, Transport, Exam Fee, etc.</p>
                </div>
                {hasPermission('fees', 'write') && (
                    <button className="btn btn-primary-custom shadow-sm d-flex align-items-center gap-2" onClick={openAdd}>
                        <i className="bi bi-plus-lg"></i> Add Fee Head
                    </button>
                )}
            </div>

            {/* Stats */}
            <div className="row g-3 mb-4">
                {[
                    { label: 'Total Heads', value: heads.length, color: 'var(--primary-dark)', icon: 'bi-collection' },
                    { label: 'Regular Heads', value: regular.length, color: 'var(--primary-teal)', icon: 'bi-arrow-repeat' },
                    { label: 'Extra / Ad-hoc', value: extra.length, color: 'var(--accent-orange)', icon: 'bi-plus-circle' },
                    { label: 'Opening Balance/PB', value: opb.length, color: '#6f42c1', icon: 'bi-clock-history' },
                    { label: 'Active Heads', value: heads.filter(h => h.is_active).length, color: '#198754', icon: 'bi-check-circle' },
                ].map((s, i) => (
                    <div className="col-md-3" key={i}>
                        <div className="card border-0 shadow-sm h-100 animate__animated animate__fadeInUp" style={{ animationDelay: `${i * 0.1}s`, borderLeft: `4px solid ${s.color}` }}>
                            <div className="card-body d-flex align-items-center gap-3">
                                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, backgroundColor: `${s.color}15` }}>
                                    <i className={`bi ${s.icon} fs-5`} style={{ color: s.color }}></i>
                                </div>
                                <div>
                                    <div className="text-muted small fw-bold text-uppercase">{s.label}</div>
                                    <div className="fw-bold fs-4" style={{ color: s.color }}>{s.value}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Table */}
            {['regular', 'extra'].map(type => {
                const list = type === 'regular' ? regular : extra;
                return (
                    <div className="card border-0 shadow-sm mb-4 animate__animated animate__fadeInUp" key={type}>
                        <div className="card-header bg-white py-3 border-bottom" style={{ borderLeft: `4px solid ${type === 'regular' ? 'var(--primary-teal)' : 'var(--accent-orange)'}` }}>
                            <h6 className="mb-0 fw-bold" style={{ color: type === 'regular' ? 'var(--primary-teal)' : 'var(--accent-orange)' }}>
                                <i className={`bi ${type === 'regular' ? 'bi-arrow-repeat' : 'bi-plus-circle'} me-2`}></i>
                                {type === 'regular' ? 'Regular Heads' : 'Extra / Ad-hoc Heads'}
                                <span className="badge ms-2 rounded-pill bg-light text-dark border">{list.length}</span>
                            </h6>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="bg-light">
                                        <tr>
                                            <th className="ps-4 py-3 text-secondary">Head Name</th>
                                            <th className="py-3 text-secondary">Frequency</th>
                                            <th className="py-3 text-secondary">Description</th>
                                            <th className="py-3 text-secondary">Status</th>
                                            <th className="pe-4 py-3 text-end text-secondary">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan={5} className="text-center py-4"><div className="spinner-border spinner-border-sm text-primary"></div></td></tr>
                                        ) : list.length === 0 ? (
                                            <tr><td colSpan={5} className="text-center py-4 text-muted">No heads found</td></tr>
                                        ) : list.map(head => (
                                            <tr key={head.head_id}>
                                                <td className="ps-4 fw-bold text-dark">{head.head_name}</td>
                                                <td>{freqBadge(head.frequency)}</td>
                                                <td className="text-muted small">{head.description || '—'}</td>
                                                <td>
                                                    <span className={`badge rounded-pill ${head.is_active ? 'bg-success' : 'bg-secondary'}`}>
                                                        {head.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="pe-4 text-end">
                                                    {hasPermission('fees', 'write') && <button className="btn btn-sm btn-light text-warning me-1" onClick={() => openEdit(head)} title="Edit"><i className="bi bi-pencil"></i></button>}
                                                    {hasPermission('fees', 'delete') && <button className="btn btn-sm btn-light text-danger" onClick={() => handleDelete(head.head_id)} title="Delete"><i className="bi bi-trash"></i></button>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Opening Balance (System) head */}
            {opb.length > 0 && (
                <div className="card border-0 shadow-sm mb-4 animate__animated animate__fadeInUp">
                    <div className="card-header bg-white py-3 border-bottom" style={{ borderLeft: '4px solid #6f42c1' }}>
                        <div className="d-flex justify-content-between align-items-center">
                            <h6 className="mb-0 fw-bold" style={{ color: '#6f42c1' }}>
                                <i className="bi bi-clock-history me-2"></i>Previous Balance Head
                                <span className="badge ms-2 rounded-pill bg-light text-dark border">{opb.length}</span>
                            </h6>
                            <span className="badge rounded-pill px-3 py-2" style={{ background: 'rgba(111,66,193,0.08)', color: '#6f42c1', border: '1px solid rgba(111,66,193,0.25)', fontSize: '0.75rem' }}>
                                <i className="bi bi-shield-lock me-1" />System Managed
                            </span>
                        </div>
                    </div>
                    <div className="card-body p-0">
                        <div className="alert border-0 m-3 mb-0 rounded-3 py-2 px-3" style={{ background: 'rgba(111,66,193,0.06)', fontSize: '0.83rem' }}>
                            <i className="bi bi-info-circle me-1" style={{ color: '#6f42c1' }} />
                            This head shows as <strong>"Previous Balance"</strong> on vouchers. It combines:
                            (1) Opening Balance (OPB) set on the family, and
                            (2) All unpaid/partial previous months\u2019 fees except admission fee.
                            Add it to any Fee Plan; the actual amount per family is calculated automatically at slip generation.
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="bg-light">
                                    <tr>
                                        <th className="ps-4 py-3 text-secondary">Head Name</th>
                                        <th className="py-3 text-secondary">Type</th>
                                        <th className="py-3 text-secondary">Frequency</th>
                                        <th className="py-3 text-secondary">Description</th>
                                        <th className="py-3 text-secondary">Status</th>
                                        <th className="pe-4 py-3 text-end text-secondary">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {opb.map(head => (
                                        <tr key={head.head_id} style={{ background: 'rgba(111,66,193,0.03)' }}>
                                            <td className="ps-4">
                                                <div className="fw-bold" style={{ color: '#6f42c1' }}>{head.head_name}</div>
                                            </td>
                                            <td>{typeBadge(head.head_type)}</td>
                                            <td>{freqBadge(head.frequency)}</td>
                                            <td className="text-muted small">{head.description || '—'}</td>
                                            <td>
                                                <span className={`badge rounded-pill ${head.is_active ? 'bg-success' : 'bg-secondary'}`}>
                                                    {head.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="pe-4 text-end">
                                                {hasPermission('fees', 'write') && <button className="btn btn-sm btn-light text-warning me-1" onClick={() => openEdit(head)} title="Edit"><i className="bi bi-pencil"></i></button>}
                                                {hasPermission('fees', 'delete') && <button className="btn btn-sm btn-light text-danger" onClick={() => handleDelete(head.head_id)} title="Delete"><i className="bi bi-trash"></i></button>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <>
                    <div className="modal-backdrop fade show"></div>
                    <div className="modal fade show d-block" tabIndex={-1}>
                        <div className="modal-dialog modal-dialog-centered">
                            <div className="modal-content border-0 shadow-lg">
                                <div className="modal-header text-white" style={{ backgroundColor: 'var(--primary-dark)' }}>
                                    <h5 className="modal-title">{editMode ? 'Edit Fee Head' : 'Add New Fee Head'}</h5>
                                    <button className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
                                </div>
                                <div className="modal-body p-4">
                                    {error && <div className="alert alert-danger">{error}</div>}
                                    <form onSubmit={handleSubmit} className="row g-3">
                                        <div className="col-12">
                                            <label className="form-label fw-bold small text-muted">Head Name <span className="text-danger">*</span></label>
                                            <input type="text" className="form-control" value={(current as any).head_name}
                                                onChange={e => setCurrent(p => ({ ...p, head_name: e.target.value }))} required placeholder="e.g. Tuition Fee" />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label fw-bold small text-muted">Type</label>
                                            <select className="form-select" value={(current as any).head_type}
                                                onChange={e => setCurrent(p => ({ ...p, head_type: e.target.value as any }))}
                                                disabled={(current as any).head_type === 'prev_balance'}>
                                                <option value="regular">Regular (Standard)</option>
                                                <option value="extra">Extra / Ad-hoc</option>
                                                <option value="prev_balance">Previous Balance (System)</option>
                                            </select>
                                            {(current as any).head_type === 'prev_balance' && (
                                                <small className="text-muted"><i className="bi bi-lock me-1" />Type is locked for system heads</small>
                                            )}
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label fw-bold small text-muted">Frequency</label>
                                            <select className="form-select" value={(current as any).frequency}
                                                onChange={e => setCurrent(p => ({ ...p, frequency: e.target.value as any }))}>
                                                <option value="monthly">Monthly</option>
                                                <option value="yearly">Yearly</option>
                                                <option value="once">One-time</option>
                                            </select>
                                        </div>
                                        <div className="col-12">
                                            <label className="form-label fw-bold small text-muted">Description</label>
                                            <textarea className="form-control" rows={2} value={(current as any).description}
                                                onChange={e => setCurrent(p => ({ ...p, description: e.target.value }))} placeholder="Optional details..."></textarea>
                                        </div>
                                        <div className="col-12">
                                            <div className="form-check form-switch">
                                                <input type="checkbox" className="form-check-input" id="isActive"
                                                    checked={(current as any).is_active}
                                                    onChange={e => setCurrent(p => ({ ...p, is_active: e.target.checked }))} />
                                                <label className="form-check-label" htmlFor="isActive">Active</label>
                                            </div>
                                        </div>
                                        <div className="col-12 d-flex justify-content-end gap-2 mt-2">
                                            <button type="button" className="btn btn-secondary-custom px-4" onClick={() => setShowModal(false)}>Cancel</button>
                                            {hasPermission('fees', 'write') && <button type="submit" className="btn btn-primary-custom px-4">Save Fee Head</button>}
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
