'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface FeeHead {
    head_id: number;
    head_name: string;
    head_type: string;
    frequency: string;
}

interface PlanHead {
    head_id: number;
    head_name: string;
    head_type: string;
    frequency: string;
    amount: string;
}

interface ClassItem {
    class_id: number;
    class_name: string;
}

interface FeePlan {
    plan_id: number;
    plan_name: string;
    applies_to_all: boolean;
    classes: ClassItem[];
    academic_year: string;
    description: string;
    is_active: boolean;
    heads: PlanHead[];
}

export default function FeePlansPage() {
    const router = useRouter();
    const { hasPermission } = useAuth();
    const [plans, setPlans] = useState<FeePlan[]>([]);
    const [allHeads, setAllHeads] = useState<FeeHead[]>([]);
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [error, setError] = useState('');

    const [form, setForm] = useState({
        plan_name: '',
        class_ids: [] as number[],
        applies_to_all: false,
        academic_year: '2026',
        description: '',
        is_active: true,
        heads: [] as PlanHead[]
    });

    useEffect(() => {
        Promise.all([fetchPlans(), fetchHeads(), fetchClasses()]);
    }, []);

    const fetchPlans = async () => {
        try {
            const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/fee-plans`);
            const data = await r.json();
            setPlans(Array.isArray(data) ? data : []);
        } catch { } finally { setLoading(false); }
    };

    const fetchHeads = async () => {
        try {
            const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/fee-heads/active`);
            setAllHeads(await r.json());
        } catch { }
    };

    const fetchClasses = async () => {
        try {
            const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic`);
            setClasses(await r.json());
        } catch { }
    };

    const openAdd = () => {
        setForm({ plan_name: '', class_ids: [], applies_to_all: false, academic_year: '2026', description: '', is_active: true, heads: [] });
        setEditMode(false); setEditId(null); setError(''); setShowModal(true);
    };

    const openEdit = (plan: FeePlan) => {
        setForm({
            plan_name: plan.plan_name,
            class_ids: (plan.classes || []).map(c => c.class_id),
            applies_to_all: !!plan.applies_to_all,
            academic_year: plan.academic_year,
            description: plan.description || '',
            is_active: plan.is_active,
            heads: (plan.heads || []).map(h => ({ ...h, amount: h.amount?.toString() || '0' }))
        });
        setEditMode(true); setEditId(plan.plan_id); setError(''); setShowModal(true);
    };

    const toggleClass = (cid: number) => {
        setForm(p => ({
            ...p,
            class_ids: p.class_ids.includes(cid)
                ? p.class_ids.filter(id => id !== cid)
                : [...p.class_ids, cid]
        }));
    };

    const toggleHead = (head: FeeHead) => {
        const exists = form.heads.find(h => h.head_id === head.head_id);
        if (exists) {
            setForm(p => ({ ...p, heads: p.heads.filter(h => h.head_id !== head.head_id) }));
        } else {
            setForm(p => ({ ...p, heads: [...p.heads, { ...head, amount: '0' }] }));
        }
    };

    const updateHeadAmount = (head_id: number, amount: string) => {
        setForm(p => ({ ...p, heads: p.heads.map(h => h.head_id === head_id ? { ...h, amount } : h) }));
    };

    const isTuitionHead = (name: string) => name.toLowerCase().includes('tuition');
    const isOpbHead = (type: string) => type === 'prev_balance';
    // Tuition (per-student) and Previous Balance (per-family) amounts are auto exclude from plan fixed total
    const totalAmount = form.heads
        .filter(h => !isTuitionHead(h.head_name) && !isOpbHead(h.head_type))
        .reduce((s, h) => s + (parseFloat(h.amount) || 0), 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setError('');
        if (!form.applies_to_all && form.class_ids.length === 0) {
            setError('Please select at least one class or choose "All Classes"');
            return;
        }
        try {
            const url = editMode ? `${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/fee-plans/${editId}` : `${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/fee-plans`;
            const method = editMode ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method, headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    heads: form.heads.map(h => ({ head_id: h.head_id, amount: parseFloat(h.amount) || 0 }))
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setShowModal(false); fetchPlans();
        } catch (err: any) { setError(err.message); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this fee plan?')) return;
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/fee-plans/${id}`, { method: 'DELETE' });
        fetchPlans();
    };

    const formatAmt = (n: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(n);

    return (
        <div className="container-fluid p-4 animate__animated animate__fadeIn">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="fw-bold mb-1" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-file-earmark-text me-2"></i>Fee Plans
                    </h2>
                    <p className="text-muted small mb-0">Assign fee heads with amounts per class. Used for monthly slip generation.</p>
                </div>
                {hasPermission('fees', 'write') && (
                    <button className="btn btn-primary-custom shadow-sm d-flex align-items-center gap-2" onClick={openAdd}>
                        <i className="bi bi-plus-lg"></i> New Fee Plan
                    </button>
                )}
            </div>

            {loading ? (
                <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>
            ) : plans.length === 0 ? (
                <div className="card border-0 shadow-sm text-center py-5">
                    <i className="bi bi-file-earmark-x fs-1 text-muted d-block mb-3"></i>
                    <p className="text-muted">No fee plans yet. Create one to get started.</p>
                    <div><button className="btn btn-primary-custom" onClick={openAdd}>Create First Plan</button></div>
                </div>
            ) : (
                <div className="row g-4">
                    {plans.map((plan, i) => {
                        const planTotal = (plan.heads || []).reduce((s, h) => s + parseFloat(h.amount?.toString() || '0'), 0);
                        return (
                            <div className="col-md-6 col-xl-4" key={plan.plan_id}>
                                <div className="card border-0 shadow-sm h-100 animate__animated animate__fadeInUp" style={{ animationDelay: `${i * 0.08}s` }}>
                                    <div className="card-header bg-white border-bottom py-3" style={{ borderTop: `4px solid var(--primary-teal)` }}>
                                        <div className="d-flex justify-content-between align-items-start">
                                            <div>
                                                <h6 className="fw-bold mb-2 text-dark">{plan.plan_name}</h6>
                                                <div className="d-flex flex-wrap gap-1">
                                                    {plan.applies_to_all ? (
                                                        <span className="badge rounded-pill" style={{ background: 'var(--primary-teal)', color: 'white' }}>
                                                            <i className="bi bi-grid me-1"></i>All Classes
                                                        </span>
                                                    ) : (plan.classes || []).length === 0 ? (
                                                        <span className="badge rounded-pill bg-light text-muted border">No Class</span>
                                                    ) : (
                                                        (plan.classes || []).map(c => (
                                                            <span key={c.class_id} className="badge rounded-pill bg-light text-dark border">
                                                                <i className="bi bi-mortarboard me-1"></i>{c.class_name}
                                                            </span>
                                                        ))
                                                    )}
                                                    <span className="badge rounded-pill bg-light text-dark border">{plan.academic_year}</span>
                                                </div>
                                            </div>
                                            <span className={`badge rounded-pill ms-2 ${plan.is_active ? 'bg-success' : 'bg-secondary'}`}>
                                                {plan.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="card-body p-3">
                                        {plan.heads && plan.heads.length > 0 ? (
                                            <div className="table-responsive">
                                                <table className="table table-sm mb-0">
                                                    <tbody>
                                                        {plan.heads.map(h => (
                                                            <tr key={h.head_id}>
                                                                <td className="text-muted small">{h.head_name}</td>
                                                                <td className="text-end small">
                                                                    {h.head_name.toLowerCase().includes('tuition') ? (
                                                                        <span className="badge bg-success rounded-pill">Per Student</span>
                                                                    ) : h.head_type === 'prev_balance' ? (
                                                                        <span className="badge rounded-pill" style={{ background: '#6f42c1' }}>Per Family</span>
                                                                    ) : (
                                                                        <span className="fw-bold">{formatAmt(parseFloat(h.amount?.toString() || '0'))}</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        <tr className="border-top">
                                                            <td className="fw-bold">Other Fees Total</td>
                                                            <td className="text-end fw-bold" style={{ color: 'var(--primary-teal)' }}>{formatAmt(plan.heads.filter(h => !h.head_name.toLowerCase().includes('tuition') && h.head_type !== 'prev_balance').reduce((s, h) => s + parseFloat(h.amount?.toString() || '0'), 0))}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <p className="text-muted small text-center py-2">No fee heads assigned</p>
                                        )}
                                    </div>
                                    <div className="card-footer bg-white border-top d-flex gap-2">
                                        {hasPermission('fees', 'write') && (
                                            <button className="btn btn-sm btn-secondary-custom flex-fill" onClick={() => openEdit(plan)}>
                                                <i className="bi bi-pencil me-1"></i>Edit
                                            </button>
                                        )}
                                        <button className="btn btn-sm btn-primary-custom flex-fill" onClick={() => router.push('/fees/generate')}>
                                            <i className="bi bi-lightning me-1"></i>Generate
                                        </button>
                                        {hasPermission('fees', 'delete') && (
                                            <button className="btn btn-sm btn-light text-danger" onClick={() => handleDelete(plan.plan_id)}>
                                                <i className="bi bi-trash"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <>
                    <div className="modal-backdrop fade show"></div>
                    <div className="modal fade show d-block" tabIndex={-1}>
                        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
                            <div className="modal-content border-0 shadow-lg">
                                <div className="modal-header text-white" style={{ backgroundColor: 'var(--primary-dark)' }}>
                                    <h5 className="modal-title">{editMode ? 'Edit Fee Plan' : 'Create Fee Plan'}</h5>
                                    <button className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
                                </div>
                                <div className="modal-body p-4">
                                    {error && <div className="alert alert-danger">{error}</div>}
                                    <form onSubmit={handleSubmit}>
                                        <div className="row g-3 mb-4">
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold small text-muted">Plan Name <span className="text-danger">*</span></label>
                                                <input type="text" className="form-control" value={form.plan_name}
                                                    onChange={e => setForm(p => ({ ...p, plan_name: e.target.value }))} required placeholder="e.g. Grade 5 - 2026" />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold small text-muted">Academic Year</label>
                                                <input type="text" className="form-control" value={form.academic_year}
                                                    onChange={e => setForm(p => ({ ...p, academic_year: e.target.value }))} />
                                            </div>

                                            {/* Classes Multi-Select */}
                                            <div className="col-12">
                                                <label className="form-label fw-bold small text-muted">Classes <span className="text-danger">*</span></label>

                                                {/* All Classes Toggle */}
                                                <div
                                                    className={`d-flex align-items-center gap-2 p-2 px-3 rounded border mb-2 cursor-pointer`}
                                                    style={{
                                                        background: form.applies_to_all ? 'var(--primary-teal)' : '#f8f9fa',
                                                        borderColor: form.applies_to_all ? 'var(--primary-teal)' : '#dee2e6',
                                                        cursor: 'pointer', transition: 'all 0.15s'
                                                    }}
                                                    onClick={() => setForm(p => ({ ...p, applies_to_all: !p.applies_to_all, class_ids: [] }))}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="form-check-input mt-0"
                                                        readOnly
                                                        checked={form.applies_to_all}
                                                    />
                                                    <i className="bi bi-grid" style={{ color: form.applies_to_all ? 'white' : 'var(--primary-teal)' }}></i>
                                                    <span className="fw-bold small" style={{ color: form.applies_to_all ? 'white' : '#333' }}>
                                                        All Classes (plan applies to every class)
                                                    </span>
                                                </div>

                                                {/* Individual Class Checkboxes */}
                                                {!form.applies_to_all && (
                                                    <div className="row g-2">
                                                        {classes.map(c => {
                                                            const checked = form.class_ids.includes(c.class_id);
                                                            return (
                                                                <div className="col-6 col-md-4" key={c.class_id}>
                                                                    <div
                                                                        className="d-flex align-items-center gap-2 p-2 px-3 rounded border"
                                                                        style={{
                                                                            background: checked ? 'rgba(33,94,97,0.08)' : '#fff',
                                                                            borderColor: checked ? 'var(--primary-teal)' : '#dee2e6',
                                                                            cursor: 'pointer', transition: 'all 0.15s'
                                                                        }}
                                                                        onClick={() => toggleClass(c.class_id)}
                                                                    >
                                                                        <input type="checkbox" className="form-check-input mt-0" readOnly checked={checked} />
                                                                        <span className="small" style={{ color: checked ? 'var(--primary-teal)' : '#333', fontWeight: checked ? 600 : 400 }}>
                                                                            {c.class_name}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                {!form.applies_to_all && form.class_ids.length > 0 && (
                                                    <div className="mt-2">
                                                        <small className="text-muted">
                                                            <i className="bi bi-check2-circle text-success me-1"></i>
                                                            {form.class_ids.length} class{form.class_ids.length > 1 ? 'es' : ''} selected
                                                        </small>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="col-md-6 d-flex align-items-end">
                                                <div className="form-check form-switch mb-2">
                                                    <input type="checkbox" className="form-check-input" id="planActive"
                                                        checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                                                    <label className="form-check-label" htmlFor="planActive">Active Plan</label>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Fee Heads Selection */}
                                        <div className="border rounded p-3 mb-3" style={{ backgroundColor: '#f8f9fa' }}>
                                            <h6 className="fw-bold mb-3" style={{ color: 'var(--primary-dark)' }}>
                                                <i className="bi bi-tags me-2"></i>Select Fee Heads & Set Amounts
                                            </h6>
                                            {allHeads.length === 0 ? (
                                                <p className="text-muted small">No active fee heads found. Create fee heads first.</p>
                                            ) : (
                                                <div className="row g-2">
                                                    {allHeads.map(head => {
                                                        const sel = form.heads.find(h => h.head_id === head.head_id);
                                                        return (
                                                            <div className="col-md-6" key={head.head_id}>
                                                                <div className={`p-3 rounded border cursor-pointer ${sel ? 'border-primary bg-white shadow-sm' : 'border-light bg-white'}`}
                                                                    style={{ borderColor: sel ? 'var(--primary-teal) !important' : '', cursor: 'pointer' }}>
                                                                    <div className="d-flex align-items-center gap-2 mb-2" onClick={() => toggleHead(head)}>
                                                                        <input type="checkbox" className="form-check-input mt-0" readOnly checked={!!sel} />
                                                                        <span className="fw-bold small">{head.head_name}</span>
                                                                        <span className={`badge rounded-pill ms-auto ${head.head_type === 'regular' ? 'bg-info text-dark' :
                                                                            head.head_type === 'prev_balance' ? 'text-white' :
                                                                                'bg-warning text-dark'}`}
                                                                            style={head.head_type === 'prev_balance' ? { background: '#6f42c1' } : {}}>
                                                                            {head.head_type === 'prev_balance' ? 'Prev. Balance' : head.head_type}
                                                                        </span>
                                                                    </div>
                                                                    {sel && (
                                                                        isTuitionHead(head.head_name) ? (
                                                                            <div className="d-flex align-items-center gap-2 p-2 rounded" style={{ backgroundColor: '#e8f5e9' }}>
                                                                                <i className="bi bi-person-check text-success"></i>
                                                                                <div>
                                                                                    <span className="badge bg-success rounded-pill me-1">Per Student</span>
                                                                                    <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Auto from each student&apos;s monthly fee profile</small>
                                                                                </div>
                                                                            </div>
                                                                        ) : isOpbHead(head.head_type) ? (
                                                                            <div className="d-flex align-items-center gap-2 p-2 rounded" style={{ backgroundColor: 'rgba(111,66,193,0.07)' }}>
                                                                                <i className="bi bi-clock-history" style={{ color: '#6f42c1' }}></i>
                                                                                <div>
                                                                                    <span className="badge rounded-pill me-1 text-white" style={{ background: '#6f42c1' }}>Per Family (Auto)</span>
                                                                                    <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Remaining OPB per family added automatically at slip generation</small>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="input-group input-group-sm">
                                                                                <span className="input-group-text bg-light">PKR</span>
                                                                                <input type="number" className="form-control" value={sel.amount} min="0"
                                                                                    onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                                                                    onChange={e => updateHeadAmount(head.head_id, e.target.value)}
                                                                                    placeholder="0.00" onClick={e => e.stopPropagation()} />
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Total */}
                                        {form.heads.length > 0 && (
                                            <div className="border-0 mb-3 rounded p-3" style={{ backgroundColor: 'var(--primary-teal)', color: 'white' }}>
                                                {form.heads.some(h => isTuitionHead(h.head_name)) && (
                                                    <div className="d-flex align-items-center gap-2 mb-2 pb-2 border-bottom border-white border-opacity-25">
                                                        <i className="bi bi-info-circle"></i>
                                                        <small>Tuition Fee: charged per student from their own monthly fee profile</small>
                                                    </div>
                                                )}
                                                {form.heads.some(h => isOpbHead(h.head_type)) && (
                                                    <div className="d-flex align-items-center gap-2 mb-2 pb-2 border-bottom border-white border-opacity-25">
                                                        <i className="bi bi-clock-history"></i>
                                                        <small>Opening Balance: remaining OPB per family added automatically on each slip</small>
                                                    </div>
                                                )}
                                                <div className="d-flex justify-content-between align-items-center">
                                                    <span className="fw-bold"><i className="bi bi-calculator me-2"></i>Other Fees Total</span>
                                                    <span className="fw-bold fs-5">{new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(totalAmount)}</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="d-flex justify-content-end gap-2">
                                            <button type="button" className="btn btn-secondary-custom px-4" onClick={() => setShowModal(false)}>Cancel</button>
                                            {hasPermission('fees', 'write') && <button type="submit" className="btn btn-primary-custom px-4">Save Plan</button>}
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
