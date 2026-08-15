'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const API = process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com";



interface FamilyOPB {
    family_id: string;
    family_name: string | null;
    father_name: string | null;
    father_phone: string | null;
    opening_balance: number;
    opening_balance_paid: number;
    opb_remaining: number;
    opb_notes: string | null;
    family_fee: number;
    total_members: number;
    member_names: string | null;
    class_names: string | null;
}
interface OPBPayment {
    payment_id: number;
    family_id: string;
    amount: number;
    payment_date: string;
    payment_method: string;
    received_by: string | null;
    reference_no: string | null;
    notes: string | null;
    created_at: string;
}
interface FamilyDetail extends FamilyOPB {
    members: { student_id: number; admission_no: string; first_name: string; last_name: string; class_name: string }[];
    payments: OPBPayment[];
}

function fmt(n: number) { return `PKR ${Number(n || 0).toLocaleString('en-PK')}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
function pct(paid: number, total: number) { return total > 0 ? Math.round((paid / total) * 100) : 0; }

export default function OpeningBalancePage() {
    const [families, setFamilies] = useState<FamilyOPB[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [toast, setToast] = useState<{ type: 'success' | 'danger'; msg: string } | null>(null);

    // Detail modal state
    const [detailFamily, setDetailFamily] = useState<FamilyDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);

    // Set OPB modal
    const [showSetModal, setShowSetModal] = useState(false);
    const [setTarget, setSetTarget] = useState<FamilyOPB | null>(null);
    const [setForm, setSetForm] = useState({ opening_balance: '', opb_notes: '' });

    const [saving, setSaving] = useState(false);
    const { hasPermission } = useAuth();

    const showToast = (type: 'success' | 'danger', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 4000);
    };

    const loadFamilies = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ filter });
            if (search) params.set('search', search);
            const res = await fetch(`${API}/students/opb/families?${params}`);
            const data = await res.json();
            if (res.ok) setFamilies(data);
            else showToast('danger', data.error || 'Failed to load');
        } catch { showToast('danger', 'Server connection failed'); }
        finally { setLoading(false); }
    }, [filter, search]);

    useEffect(() => { loadFamilies(); }, [loadFamilies]);

    const openDetail = async (fam: FamilyOPB) => {
        setShowDetailModal(true);
        setDetailLoading(true);
        setDetailFamily(null);
        try {
            const res = await fetch(`${API}/students/opb/families/${fam.family_id}`);
            const data = await res.json();
            if (res.ok) setDetailFamily(data);
            else showToast('danger', data.error);
        } catch { showToast('danger', 'Failed to load detail'); }
        finally { setDetailLoading(false); }
    };

    const openSet = (fam: FamilyOPB) => {
        setSetTarget(fam);
        setSetForm({ opening_balance: fam.opening_balance > 0 ? String(fam.opening_balance) : '', opb_notes: fam.opb_notes || '' });
        setShowSetModal(true);
    };

    const handleSaveOPB = async () => {
        if (!setTarget) return;
        if (!setForm.opening_balance || isNaN(parseFloat(setForm.opening_balance))) {
            showToast('danger', 'Please enter a valid amount'); return;
        }
        setSaving(true);
        try {
            const res = await fetch(`${API}/students/opb/families/${setTarget.family_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ opening_balance: parseFloat(setForm.opening_balance), opb_notes: setForm.opb_notes })
            });
            const data = await res.json();
            if (res.ok) {
                showToast('success', 'Opening balance saved successfully');
                setShowSetModal(false);
                loadFamilies();
            } else showToast('danger', data.error || 'Save failed');
        } catch { showToast('danger', 'Server error'); }
        finally { setSaving(false); }
    };

    const handleDeletePayment = async (familyId: string, paymentId: number) => {
        if (!confirm('Delete this payment? This will reverse the payment and add back to remaining balance.')) return;
        try {
            const res = await fetch(`${API}/students/opb/families/${familyId}/payment/${paymentId}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                showToast('success', 'Payment reversed');
                loadFamilies();
                if (detailFamily) openDetail(detailFamily);
            } else showToast('danger', data.error);
        } catch { showToast('danger', 'Server error'); }
    };

    // Summary stats
    const totalOPB = families.filter(f => f.opening_balance > 0).reduce((s, f) => s + parseFloat(String(f.opening_balance)), 0);
    const totalPaid = families.filter(f => f.opening_balance > 0).reduce((s, f) => s + parseFloat(String(f.opening_balance_paid)), 0);
    const totalRemaining = totalOPB - totalPaid;
    const familiesWithOPB = families.filter(f => f.opening_balance > 0).length;
    const clearedCount = families.filter(f => f.opening_balance > 0 && parseFloat(String(f.opb_remaining)) <= 0).length;

    const STATUS_COLOR: Record<string, string> = { cleared: '#0d9e6e', partial: '#e6860a', pending: '#e13232' };
    const getStatus = (f: FamilyOPB) => {
        if (f.opening_balance <= 0) return null;
        if (parseFloat(String(f.opb_remaining)) <= 0) return 'cleared';
        if (parseFloat(String(f.opening_balance_paid)) > 0) return 'partial';
        return 'pending';
    };

    return (
        <div className="container-fluid px-3 px-md-4 py-3 animate__animated animate__fadeIn">
            {/* HEADER */}
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <div>
                    <h2 className="fw-bold mb-1" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-clock-history me-2" style={{ color: 'var(--accent-orange)' }} /> Opening Balance
                    </h2>
                    <p className="text-muted mb-0 small">Set/view family previous dues payments are collected via Fee Slips</p>
                </div>
                {hasPermission('fees', 'write') && (
                    <button className="btn btn-sm fw-semibold rounded-3 px-3"
                        onClick={() => { setSetTarget(null); setSetForm({ opening_balance: '', opb_notes: '' }); setShowSetModal(true); }}
                        style={{ background: 'var(--accent-orange)', color: '#fff', border: 'none' }}>
                        <i className="bi bi-plus-circle-fill me-1" /> Set Family OPB
                    </button>
                )}
            </div>

            {/* HOW IT WORKS banner */}
            <div className="alert border-0 rounded-4 mb-4 d-flex align-items-start gap-3" style={{ background: 'rgba(33,94,97,0.08)', borderLeft: '4px solid var(--primary-teal) !important' }}>
                <i className="bi bi-info-circle-fill fs-4 mt-1" style={{ color: 'var(--primary-teal)', flexShrink: 0 }} />
                <div>
                    <strong style={{ color: 'var(--primary-dark)' }}>How Opening Balance works:</strong>
                    <ol className="mb-0 mt-1 ps-3" style={{ fontSize: '0.85rem', color: '#495057' }}>
                        <li>Set OPB for each family using the <strong>Set Family OPB</strong> button or <i className="bi bi-pencil-fill" /> icon below.</li>
                        <li>Go to <strong>Fee Heads</strong> the <em>Opening Balance</em> head is already created.</li>
                        <li>Open each <strong>Fee Plan</strong> and add the <em>Opening Balance</em> head (amount can be 0 system uses actual remaining OPB).</li>
                        <li><strong>Generate Slips</strong> OPB is auto-added as a line item for families with remaining balance.</li>
                        <li><strong>Collect Fee</strong> normally OPB reduces automatically as slips are paid.</li>
                    </ol>
                </div>
            </div>

            {/* TOAST */}
            {toast && (
                <div className={`alert alert-${toast.type} border-0 rounded-3 d-flex align-items-center gap-2 animate__animated animate__fadeInDown mb-3`}>
                    <i className={`bi ${toast.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} fs-5`} />
                    <span>{toast.msg}</span>
                </div>
            )}

            {/* STAT CARDS */}
            <div className="row g-3 mb-4">
                {[
                    { label: 'Total OPB Set', val: fmt(totalOPB), icon: 'bi-wallet2', color: 'var(--primary-dark)', bg: 'rgba(35,61,77,0.08)' },
                    { label: 'Total Collected', val: fmt(totalPaid), icon: 'bi-check-circle-fill', color: '#0d9e6e', bg: '#e6f9f3' },
                    { label: 'Still Remaining', val: fmt(totalRemaining), icon: 'bi-exclamation-circle-fill', color: '#e13232', bg: '#fde8e8' },
                    { label: 'Families with OPB', val: familiesWithOPB, icon: 'bi-people-fill', color: 'var(--primary-teal)', bg: 'rgba(33,94,97,0.1)' },
                    { label: 'Fully Cleared', val: clearedCount, icon: 'bi-star-fill', color: '#0d9e6e', bg: '#e6f9f3' },
                ].map((c, i) => (
                    <div key={i} className="col-6 col-lg">
                        <div className="card border-0 shadow-sm rounded-4 h-100 animate__animated animate__fadeInUp" style={{ animationDelay: `${i * 0.06}s`, borderBottom: `3px solid ${c.color}` }}>
                            <div className="card-body d-flex align-items-center gap-2 p-3">
                                <div className="rounded-3 d-flex align-items-center justify-content-center" style={{ width: 40, height: 40, background: c.bg, flexShrink: 0 }}>
                                    <i className={`bi ${c.icon}`} style={{ color: c.color, fontSize: '1.1rem' }} />
                                </div>
                                <div>
                                    <div className="fw-bold" style={{ fontSize: '1.25rem', lineHeight: 1, color: c.color }}>{c.val}</div>
                                    <div style={{ fontSize: '0.66rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#adb5bd' }}>{c.label}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* FILTERS */}
            <div className="card border-0 shadow-sm rounded-4 mb-4 animate__animated animate__fadeInUp">
                <div className="card-body p-3 p-md-4">
                    <div className="row g-3 align-items-end">
                        <div className="col-md-5">
                            <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--primary-dark)', letterSpacing: '0.05em' }}>
                                <i className="bi bi-search me-1" style={{ color: 'var(--primary-teal)' }} />Search Families
                            </label>
                            <input type="text" className="form-control rounded-3" placeholder="Father name, family ID, student name..."
                                value={search} onChange={e => setSearch(e.target.value)}
                                style={{ border: '1.5px solid #dee2e6', height: 42 }} />
                        </div>
                        <div className="col-md-4">
                            <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--primary-dark)', letterSpacing: '0.05em' }}>
                                <i className="bi bi-funnel me-1" style={{ color: 'var(--primary-teal)' }} />Filter
                            </label>
                            <select className="form-select rounded-3" value={filter} onChange={e => setFilter(e.target.value)} style={{ border: '1.5px solid #dee2e6', height: 42 }}>
                                <option value="all">All Families</option>
                                <option value="with_opb">With Opening Balance</option>
                                <option value="pending">Pending (Not Cleared)</option>
                                <option value="cleared">Cleared</option>
                            </select>
                        </div>
                        <div className="col-md-3">
                            <button className="btn btn-primary-custom w-100 fw-bold rounded-3" style={{ height: 42 }} onClick={loadFamilies} disabled={loading}>
                                {loading ? <><span className="spinner-border spinner-border-sm me-2" />Loading...</> : <><i className="bi bi-arrow-repeat me-2" />Refresh</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* TABLE */}
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden animate__animated animate__fadeInUp">
                <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center flex-wrap gap-2 px-3 px-md-4 py-3">
                    <span className="fw-bold" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-people-fill me-2" style={{ color: 'var(--accent-orange)' }} />{families.length} {filter === 'with_opb' ? 'Families with OPB' : filter === 'pending' ? 'Pending Families' : filter === 'cleared' ? 'Cleared Families' : 'Total Families'}
                    </span>
                    {totalRemaining > 0 && (
                        <span className="badge rounded-pill px-3 py-2" style={{ background: '#fde8e8', color: '#e13232', fontWeight: 600, fontSize: '0.8rem' }}>
                            <i className="bi bi-exclamation-circle me-1" />Remaining: {fmt(totalRemaining)}
                        </span>
                    )}
                </div>
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead style={{ background: 'var(--primary-dark)' }}>
                            <tr>
                                {['#', 'Family / Father', 'Members', 'Monthly Fee', 'Opening Balance', 'Collected', 'Remaining', 'Progress', 'Status', 'Actions'].map(h => (
                                    <th key={h} className="border-0 fw-semibold" style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={10} className="text-center py-5"><div className="spinner-border" style={{ color: 'var(--primary-teal)' }} /></td></tr>
                            ) : families.length === 0 ? (
                                <tr><td colSpan={10} className="text-center py-5 text-muted">
                                    <i className="bi bi-inbox fs-2 d-block mb-2" />No families found
                                </td></tr>
                            ) : families.map((f, idx) => {
                                const status = getStatus(f);
                                const p = pct(parseFloat(String(f.opening_balance_paid)), parseFloat(String(f.opening_balance)));
                                const hasOPB = f.opening_balance > 0;
                                return (
                                    <tr key={f.family_id} style={{
                                        borderLeft: hasOPB ? `3px solid ${STATUS_COLOR[status || 'pending']}` : '3px solid transparent',
                                        background: hasOPB && status === 'pending' ? '#fff8f8' : '#fff'
                                    }}>
                                        <td className="ps-3 text-muted" style={{ fontSize: '0.8rem', width: 40 }}>
                                            <span className="badge rounded-circle text-bg-secondary" style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem' }}>{idx + 1}</span>
                                        </td>
                                        <td style={{ padding: '10px 14px' }}>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                                                    style={{ width: 34, height: 34, background: 'linear-gradient(135deg,var(--primary-dark),var(--primary-teal))', fontSize: '0.72rem', flexShrink: 0 }}>
                                                    {(f.father_name || f.family_id || '?')[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="fw-semibold" style={{ color: 'var(--primary-dark)', fontSize: '0.88rem' }}>{f.father_name || 'Unknown Father'}</div>
                                                    <div className="text-muted" style={{ fontSize: '0.7rem' }}>{f.family_id} {f.father_phone ? `· ${f.father_phone}` : ''}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px 14px' }}>
                                            <div style={{ fontSize: '0.82rem', color: 'var(--primary-dark)', fontWeight: 600 }}>{f.total_members} student{f.total_members !== 1 ? 's' : ''}</div>
                                            <div className="text-muted" style={{ fontSize: '0.7rem', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.member_names || '—'}</div>
                                        </td>
                                        <td><span className="fw-semibold" style={{ color: 'var(--primary-teal)', fontSize: '0.85rem' }}>{fmt(parseFloat(String(f.family_fee)))}</span></td>
                                        <td>
                                            {hasOPB
                                                ? <span className="fw-bold" style={{ color: 'var(--primary-dark)', fontSize: '0.9rem' }}>{fmt(parseFloat(String(f.opening_balance)))}</span>
                                                : <span className="text-muted" style={{ fontSize: '0.8rem' }}>—</span>}
                                        </td>
                                        <td>
                                            {hasOPB
                                                ? <span style={{ color: '#0d9e6e', fontWeight: 700, fontSize: '0.85rem' }}>{fmt(parseFloat(String(f.opening_balance_paid)))}</span>
                                                : <span className="text-muted">—</span>}
                                        </td>
                                        <td>
                                            {hasOPB
                                                ? <span style={{ color: parseFloat(String(f.opb_remaining)) > 0 ? '#e13232' : '#0d9e6e', fontWeight: 700, fontSize: '0.9rem' }}>{fmt(parseFloat(String(f.opb_remaining)))}</span>
                                                : <span className="text-muted">—</span>}
                                        </td>
                                        <td style={{ minWidth: 100 }}>
                                            {hasOPB ? (
                                                <div>
                                                    <div className="progress rounded-pill mb-1" style={{ height: 6 }}>
                                                        <div className="progress-bar" style={{ width: `${p}%`, background: p >= 100 ? '#0d9e6e' : p > 0 ? '#e6860a' : '#e13232', borderRadius: 100 }} />
                                                    </div>
                                                    <small style={{ fontSize: '0.68rem', color: '#adb5bd' }}>{p}% cleared</small>
                                                </div>
                                            ) : <span className="text-muted" style={{ fontSize: '0.8rem' }}>No OPB</span>}
                                        </td>
                                        <td>
                                            {status ? (
                                                <span className="badge rounded-pill px-2 py-1" style={{
                                                    background: `${STATUS_COLOR[status]}20`,
                                                    color: STATUS_COLOR[status],
                                                    fontSize: '0.72rem', fontWeight: 700,
                                                    border: `1px solid ${STATUS_COLOR[status]}44`
                                                }}>
                                                    {status === 'cleared' ? '✓ Cleared' : status === 'partial' ? '◑ Partial' : '● Pending'}
                                                </span>
                                            ) : (
                                                <span className="badge rounded-pill px-2 py-1 text-bg-light border" style={{ fontSize: '0.72rem' }}>No OPB</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '10px 14px' }}>
                                            <div className="d-flex gap-1 flex-wrap">
                                                {hasPermission('fees', 'write') && (
                                                    <button title="Set Opening Balance" className="btn btn-sm rounded-2"
                                                        onClick={() => openSet(f)}
                                                        style={{ padding: '3px 8px', background: 'rgba(35,61,77,0.08)', color: 'var(--primary-dark)', border: 'none', fontSize: '0.75rem' }}>
                                                        <i className="bi bi-pencil-fill" />
                                                    </button>
                                                )}
                                                <button title="View History" className="btn btn-sm rounded-2"
                                                    onClick={() => openDetail(f)}
                                                    style={{ padding: '3px 8px', background: 'rgba(33,94,97,0.1)', color: 'var(--primary-teal)', border: 'none', fontSize: '0.75rem' }}>
                                                    <i className="bi bi-clock-history" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ═══ SET OPB MODAL ═══ */}
            {showSetModal && (
                <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)', position: 'fixed', inset: 0, zIndex: 1050, overflowY: 'auto' }}>
                    <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 480 }}>
                        <div className="modal-content border-0 rounded-4 shadow-lg">
                            <div className="modal-header border-0 px-4 pt-4 pb-2">
                                <h5 className="modal-title fw-bold" style={{ color: 'var(--primary-dark)' }}>
                                    <i className="bi bi-clock-history me-2" style={{ color: 'var(--accent-orange)' }} /> Set Opening Balance
                                </h5>
                                <button className="btn-close" onClick={() => setShowSetModal(false)} />
                            </div>
                            <div className="modal-body px-4 pb-4">
                                {setTarget && (
                                    <div className="alert border-0 rounded-3 mb-3 py-2 px-3" style={{ background: 'rgba(33,94,97,0.08)' }}>
                                        <strong style={{ color: 'var(--primary-dark)' }}>{setTarget.father_name || setTarget.family_id}</strong>
                                        <span className="text-muted ms-2" style={{ fontSize: '0.82rem' }}>{setTarget.total_members} member{setTarget.total_members !== 1 ? 's' : ''} · {setTarget.member_names}</span>
                                    </div>
                                )}
                                {!setTarget && (
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small">Family ID</label>
                                        <input type="text" className="form-control rounded-3" placeholder="e.g. FAM-2026-0001"
                                            value={setForm.opb_notes} // reusing field temporarily
                                            onChange={e => setSetForm({ ...setForm, opb_notes: e.target.value })}
                                            style={{ border: '1.5px solid #dee2e6' }} />
                                    </div>
                                )}
                                <div className="mb-3">
                                    <label className="form-label fw-semibold">Opening Balance Amount <span className="text-danger">*</span></label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-white"><i className="bi bi-wallet2" style={{ color: 'var(--accent-orange)' }} /></span>
                                        <span className="input-group-text bg-white fw-semibold">Rs.</span>
                                        <input type="number" className="form-control rounded-end-3" min="0" step="1" placeholder="0"
                                            onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                            value={setForm.opening_balance} onChange={e => setSetForm({ ...setForm, opening_balance: e.target.value })}
                                            style={{ border: '1.5px solid #dee2e6', borderLeft: 'none' }} autoFocus />
                                    </div>
                                    <small className="text-muted">Total previous dues of this family before software was installed.</small>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-semibold">Notes (Optional)</label>
                                    <textarea className="form-control rounded-3" rows={2} placeholder="E.g. Dues from Jan-Dec 2024…"
                                        value={setForm.opb_notes} onChange={e => setSetForm({ ...setForm, opb_notes: e.target.value })}
                                        style={{ border: '1.5px solid #dee2e6' }} />
                                </div>
                                <div className="d-flex gap-2 justify-content-end">
                                    <button className="btn rounded-3 px-3" onClick={() => setShowSetModal(false)} style={{ border: '1.5px solid #dee2e6', color: '#6c757d' }}>Cancel</button>
                                    {hasPermission('fees', 'write') && (
                                        <button className="btn fw-bold rounded-3 px-4" onClick={handleSaveOPB} disabled={saving}
                                            style={{ background: 'var(--accent-orange)', color: '#fff', border: 'none' }}>
                                            {saving ? <><span className="spinner-border spinner-border-sm me-2" />Saving…</> : <><i className="bi bi-check-circle-fill me-2" />Save OPB</>}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ DETAIL / HISTORY MODAL ═══ */}
            {showDetailModal && (
                <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)', position: 'fixed', inset: 0, zIndex: 1050, overflowY: 'auto' }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 rounded-4 shadow-lg">
                            <div className="modal-header border-0 px-4 pt-4 pb-2">
                                <h5 className="modal-title fw-bold" style={{ color: 'var(--primary-dark)' }}>
                                    <i className="bi bi-clock-history me-2" style={{ color: 'var(--primary-teal)' }} /> Family OPB History
                                </h5>
                                <button className="btn-close" onClick={() => setShowDetailModal(false)} />
                            </div>
                            <div className="modal-body px-4 pb-4">
                                {detailLoading ? (
                                    <div className="text-center py-4"><div className="spinner-border" style={{ color: 'var(--primary-teal)' }} /></div>
                                ) : !detailFamily ? (
                                    <div className="text-center text-muted py-4">No data</div>
                                ) : (
                                    <>
                                        {/* Family info */}
                                        <div className="row g-3 mb-4">
                                            <div className="col-md-4">
                                                <div className="card border-0 rounded-3 text-center p-3" style={{ background: 'rgba(35,61,77,0.05)' }}>
                                                    <div className="fw-bold" style={{ fontSize: '1.5rem', color: 'var(--primary-dark)' }}>{fmt(parseFloat(String(detailFamily.opening_balance)))}</div>
                                                    <small className="text-muted text-uppercase" style={{ letterSpacing: '0.05em' }}>Original OPB</small>
                                                </div>
                                            </div>
                                            <div className="col-md-4">
                                                <div className="card border-0 rounded-3 text-center p-3" style={{ background: '#e6f9f3' }}>
                                                    <div className="fw-bold" style={{ fontSize: '1.5rem', color: '#0d9e6e' }}>{fmt(parseFloat(String(detailFamily.opening_balance_paid)))}</div>
                                                    <small style={{ color: '#0d9e6e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collected</small>
                                                </div>
                                            </div>
                                            <div className="col-md-4">
                                                <div className="card border-0 rounded-3 text-center p-3" style={{ background: parseFloat(String(detailFamily.opb_remaining)) > 0 ? '#fde8e8' : '#e6f9f3' }}>
                                                    <div className="fw-bold" style={{ fontSize: '1.5rem', color: parseFloat(String(detailFamily.opb_remaining)) > 0 ? '#e13232' : '#0d9e6e' }}>{fmt(parseFloat(String(detailFamily.opb_remaining)))}</div>
                                                    <small style={{ color: parseFloat(String(detailFamily.opb_remaining)) > 0 ? '#e13232' : '#0d9e6e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Remaining</small>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Progress */}
                                        {detailFamily.opening_balance > 0 && (
                                            <div className="mb-4">
                                                <div className="d-flex justify-content-between mb-1">
                                                    <small className="fw-semibold" style={{ color: 'var(--primary-dark)' }}>Collection Progress</small>
                                                    <small className="fw-bold" style={{ color: 'var(--primary-teal)' }}>{pct(parseFloat(String(detailFamily.opening_balance_paid)), parseFloat(String(detailFamily.opening_balance)))}%</small>
                                                </div>
                                                <div className="progress rounded-pill" style={{ height: 10 }}>
                                                    <div className="progress-bar" style={{
                                                        width: `${pct(parseFloat(String(detailFamily.opening_balance_paid)), parseFloat(String(detailFamily.opening_balance)))}%`,
                                                        background: 'linear-gradient(90deg,var(--primary-teal),#34d399)', borderRadius: 100
                                                    }} />
                                                </div>
                                            </div>
                                        )}
                                        {/* Members */}
                                        {detailFamily.members.length > 0 && (
                                            <div className="mb-4">
                                                <div className="fw-semibold mb-2" style={{ color: 'var(--primary-dark)', fontSize: '0.88rem' }}>
                                                    <i className="bi bi-people me-1" style={{ color: 'var(--accent-orange)' }} />Students ({detailFamily.members.length})
                                                </div>
                                                <div className="d-flex flex-wrap gap-2">
                                                    {detailFamily.members.map(m => (
                                                        <span key={m.student_id} className="badge rounded-pill border" style={{ background: 'rgba(33,94,97,0.08)', color: 'var(--primary-dark)', fontWeight: 600, fontSize: '0.78rem', padding: '5px 10px' }}>
                                                            {m.first_name} {m.last_name} <span className="ms-1 opacity-75">({m.class_name})</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {/* Payment history */}
                                        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                                            <div className="fw-semibold" style={{ color: 'var(--primary-dark)', fontSize: '0.88rem' }}>
                                                <i className="bi bi-receipt me-1" style={{ color: 'var(--accent-orange)' }} />Payment History ({detailFamily.payments.length})
                                            </div>
                                            <span className="badge rounded-pill px-2 py-1" style={{ background: 'rgba(33,94,97,0.1)', color: 'var(--primary-teal)', fontSize: '0.72rem' }}>
                                                <i className="bi bi-info-circle me-1" />Auto-collected via fee slips
                                            </span>
                                        </div>
                                        {detailFamily.payments.length === 0 ? (
                                            <div className="text-center py-3">
                                                <i className="bi bi-receipt d-block fs-3 mb-2 text-muted" />
                                                <p className="text-muted small mb-1">No OPB payments collected yet.</p>
                                                <p className="text-muted" style={{ fontSize: '0.78rem' }}>OPB payments are recorded here automatically when fee slips containing the <strong>Opening Balance</strong> head are collected in Collect Fee.</p>
                                            </div>
                                        ) : (
                                            <div className="table-responsive">
                                                <table className="table table-sm table-hover align-middle mb-0 rounded-3 overflow-hidden">
                                                    <thead style={{ background: '#f8f9fa' }}>
                                                        <tr>
                                                            {['Date', 'Amount', 'Method', 'Received By', 'Ref#', 'Notes', ''].map(h => (
                                                                <th key={h} className="border-0 fw-semibold" style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--primary-dark)', letterSpacing: '0.05em', padding: '8px 12px' }}>{h}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {detailFamily.payments.map(p => (
                                                            <tr key={p.payment_id}>
                                                                <td style={{ fontSize: '0.82rem', padding: '8px 12px' }}>{fmtDate(p.payment_date)}</td>
                                                                <td><strong style={{ color: '#0d9e6e', fontSize: '0.88rem' }}>{fmt(parseFloat(String(p.amount)))}</strong></td>
                                                                <td><span className="badge text-bg-light border" style={{ fontSize: '0.72rem', textTransform: 'capitalize' }}>{p.payment_method}</span></td>
                                                                <td style={{ fontSize: '0.8rem' }}>{p.received_by || '—'}</td>
                                                                <td style={{ fontSize: '0.8rem' }}>{p.reference_no || '—'}</td>
                                                                <td style={{ fontSize: '0.8rem' }}>{p.notes || '—'}</td>
                                                                <td>
                                                                    {hasPermission('fees', 'delete') && (
                                                                        <button title="Delete payment" className="btn btn-sm rounded-2"
                                                                            onClick={() => handleDeletePayment(detailFamily.family_id, p.payment_id)}
                                                                            style={{ padding: '2px 7px', background: '#fde8e8', color: '#e13232', border: 'none', fontSize: '0.75rem' }}>
                                                                            <i className="bi bi-trash3" />
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
