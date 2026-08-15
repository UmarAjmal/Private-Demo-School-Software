'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { notify } from '@/app/utils/notify';

interface ClassItem { class_id: number; class_name: string; }
interface FeeHead { head_id: number; head_name: string; head_type: string; }
interface ExtraHead { head_id: number | null; head_name: string; amount: string; note: string; }
interface PlanInfo {
    plan_id: number;
    plan_name: string;
    class_name: string;
    is_active: boolean;
    heads: { head_id: number; head_name: string; amount: number }[];
}
interface Slip {
    slip_id: number;
    student_id: number;
    first_name: string;
    last_name: string;
    admission_no: string;
    family_id: string;
    total_amount: number;
    paid_amount: number;
    status: 'paid' | 'partial' | 'unpaid';
    is_family_slip?: boolean;
    family_members?: { student_id: number; first_name: string; last_name: string; admission_no: string; class_name: string }[];
    line_items: { head_name: string; amount: number; note?: string }[];
}
interface Stats { total_students: number; total_amount: number; paid_amount: number; paid_count: number; unpaid_count: number; partial_count: number; }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const API = process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com";



export default function FeeGeneratePage() {
    const router = useRouter();
    const { hasPermission } = useAuth();
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [allHeads, setAllHeads] = useState<FeeHead[]>([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedMonths, setSelectedMonths] = useState<string[]>([(new Date().getMonth() + 1).toString()]);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [dueDate, setDueDate] = useState('');
    const [issueDate, setIssueDate] = useState('');
    const [extraHeads, setExtraHeads] = useState<ExtraHead[]>([]);
    const [slips, setSlips] = useState<Slip[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [generating, setGenerating] = useState(false);
    const [loadingSlips, setLoadingSlips] = useState(false);
    const [planInfo, setPlanInfo] = useState<any | null>(null);
    const [matchingPlans, setMatchingPlans] = useState<any[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState<string>('');

    const [loadingPlan, setLoadingPlan] = useState(false);
    // Edit slip state
    const [showEdit, setShowEdit] = useState(false);
    const [editSlip, setEditSlip] = useState<Slip | null>(null);
    const [editItems, setEditItems] = useState<{ head_name: string; amount: string; note: string }[]>([]);
    const [editDueDate, setEditDueDate] = useState('');
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState('');
    // Undo generation state
    const [showUndoModal, setShowUndoModal] = useState(false);
    const [undoLoading, setUndoLoading] = useState(false);

    // Tracks months that already have generated slips for this class+year
    const [generatedMonths, setGeneratedMonths] = useState<string[]>([]);
    const [generatedGroups, setGeneratedGroups] = useState<{ value: string, label: string, months: number[] }[]>([]);

    useEffect(() => { fetchClasses(); fetchHeads(); }, []);

    const fetchClasses = async () => {
        try { const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic`); setClasses(await r.json()); } catch { }
    };

    const fetchHeads = async () => {
        try { const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/fee-heads/active`); setAllHeads(await r.json()); } catch { }
    };

    const fetchPlanForClass = async (class_id: string) => {
        if (!class_id) { setMatchingPlans([]); setPlanInfo(null); setSelectedPlanId(''); return; }
        setLoadingPlan(true);
        try {
            const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/fee-plans`);
            const plans: any[] = await r.json();
            const activePlans = plans.filter(p => p.is_active && (p.applies_to_all || (p.classes && p.classes.some((c: any) => c.class_id.toString() === class_id))));
            setMatchingPlans(activePlans);
            if (activePlans.length > 0) {
                setSelectedPlanId(activePlans[0].plan_id.toString());
                setPlanInfo(activePlans[0]);
            } else {
                setSelectedPlanId('');
                setPlanInfo(null);
            }
        } catch { setMatchingPlans([]); setPlanInfo(null); setSelectedPlanId(''); }
        finally { setLoadingPlan(false); }
    };

    useEffect(() => {
        const plan = matchingPlans.find(p => p.plan_id.toString() === selectedPlanId);
        setPlanInfo(plan || null);
    }, [selectedPlanId, matchingPlans]);

    // viewMonth: first selected month always defined so we can show combined slips after generation
    const sortedSelectedMonths = [...selectedMonths].sort((a, b) => parseInt(a) - parseInt(b));
    const viewMonth = sortedSelectedMonths[0] ?? null;

    const toggleMonth = (m: string) => {
        setSelectedMonths(prev =>
            prev.includes(m) ? (prev.length > 1 ? prev.filter(x => x !== m) : prev) : [...prev, m]
        );
    };

    const fetchGeneratedMonths = async () => {
        if (!selectedClass || !selectedYear) { setGeneratedMonths([]); setGeneratedGroups([]); return; }
        try {
            const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/fee-slips/available-months?year=${selectedYear}&class_id=${selectedClass}`);
            const data = await r.json();
            if (data.months) {
                setGeneratedGroups(data.months);
                const flatMonths: string[] = [];
                data.months.forEach((g: any) => {
                    g.months.forEach((m: number) => flatMonths.push(m.toString()));
                });
                setGeneratedMonths(flatMonths);
            }
        } catch { }
    };

    const fetchSlips = async () => {
        if (!selectedClass || selectedMonths.length === 0 || !selectedYear) { setSlips([]); setStats(null); return; }

        // Find if the currently selected months EXACTLY match a generated group
        let fetchMonthValue = sortedSelectedMonths[0] ?? null;
        const matchingGroup = generatedGroups.find(g =>
            g.months.length === sortedSelectedMonths.length &&
            g.months.every((m: number) => sortedSelectedMonths.includes(m.toString()))
        );
        if (matchingGroup) {
            fetchMonthValue = matchingGroup.value;
        }

        setLoadingSlips(true);
        try {
            const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/fee-slips?class_id=${selectedClass}&month=${fetchMonthValue}&year=${selectedYear}`);
            const data = await r.json();
            setSlips(data.slips || []);
            setStats(data.stats || null);
        } catch { }
        finally { setLoadingSlips(false); }
    };

    useEffect(() => {
        if (selectedClass && selectedYear) {
            fetchSlips();
        }
    }, [selectedClass, selectedMonths, selectedYear]);

    useEffect(() => {
        if (selectedClass && selectedYear) {
            fetchGeneratedMonths();
        }
    }, [selectedClass, selectedYear]);

    useEffect(() => {
        fetchPlanForClass(selectedClass);
        setPlanInfo(null);
    }, [selectedClass]);

    const addExtraHead = () => {
        setExtraHeads(p => [...p, { head_id: null, head_name: '', amount: '', note: '' }]);
    };

    const removeExtraHead = (i: number) => {
        setExtraHeads(p => p.filter((_, idx) => idx !== i));
    };

    const updateExtra = (i: number, field: keyof ExtraHead, value: string | number | null) => {
        setExtraHeads(p => p.map((h, idx) => idx === i ? { ...h, [field]: value } : h));
    };

    const handleGenerate = async () => {
        if (!selectedClass || selectedMonths.length === 0 || !selectedYear) {
            notify.error('Please select class, at least one month and year.');
            return;
        }
        setGenerating(true);
        const sortedMonths = [...selectedMonths].sort((a, b) => parseInt(a) - parseInt(b));
        try {
            // Send ONE request with all selected months server creates a single combined slip
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/fee-slips/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    class_id: parseInt(selectedClass),
                    months: sortedMonths.map(m => parseInt(m)),
                    year: parseInt(selectedYear),
                    due_date: dueDate || null,
                    issue_date: issueDate || null,
                    plan_id: selectedPlanId ? parseInt(selectedPlanId) : undefined,
                    extra_heads: extraHeads.filter(h => h.head_name && parseFloat(h.amount) > 0)
                })
            });
            const data = await res.json();
            if (!res.ok) {
                notify.error(data.error || 'Generation failed');
            } else {
                const monthLabels = sortedMonths.map(m => MONTHS[parseInt(m) - 1]).join(' + ');
                const slipNote = sortedMonths.length > 1 ? ` (combined ${sortedMonths.length}-month slip per student)` : '';
                notify.success(`Generated slips for ${monthLabels}${slipNote} ${data.generated} created, ${data.skipped} skipped.`);
            }
            fetchSlips();
            fetchGeneratedMonths();
        } catch (err: any) {
            notify.error(err.message);
        } finally { setGenerating(false); }
    };

    const openEdit = (slip: Slip) => {
        setEditSlip(slip);
        setEditItems((slip.line_items || []).map(item => ({ head_name: item.head_name, amount: item.amount?.toString() || '0', note: item.note || '' })));
        setEditDueDate('');
        setEditError('');
        setShowEdit(true);
    };

    const saveEdit = async () => {
        if (!editSlip) return;
        setEditLoading(true); setEditError('');
        try {
            const res = await fetch(`${API}/fee-slips/${editSlip.slip_id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ line_items: editItems.map(i => ({ head_name: i.head_name, amount: parseFloat(i.amount) || 0, note: i.note })), due_date: editDueDate || null })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setShowEdit(false);
            fetchSlips();
            notify.success("Fee slip updated successfully");
        } catch (err: any) { setEditError(err.message); }
        finally { setEditLoading(false); }
    };

    const deleteSlip = async (slipId: number) => {
        if (!confirm('Delete this slip? This cannot be undone.')) return;

        let fetchMonthValue = sortedSelectedMonths[0] ?? null;
        const matchingGroup = generatedGroups.find(g =>
            g.months.length === sortedSelectedMonths.length &&
            g.months.every((m: number) => sortedSelectedMonths.includes(m.toString()))
        );
        if (matchingGroup) fetchMonthValue = matchingGroup.value;

        await fetch(`${API}/fee-slips/class/${selectedClass}/month/${fetchMonthValue}/year/${selectedYear}`, { method: 'DELETE' });
        fetchSlips();
        fetchGeneratedMonths();
    };

    const handleUndo = async () => {
        setUndoLoading(true);
        try {
            let fetchMonthValue = sortedSelectedMonths[0] ?? null;
            const matchingGroup = generatedGroups.find(g =>
                g.months.length === sortedSelectedMonths.length &&
                g.months.every((m: number) => sortedSelectedMonths.includes(m.toString()))
            );
            if (matchingGroup) fetchMonthValue = matchingGroup.value;

            const r = await fetch(
                `${API}/fee-slips/class/${selectedClass}/month/${fetchMonthValue}/year/${selectedYear}`,
                { method: 'DELETE' }
            );
            const data = await r.json();
            if (!r.ok) throw new Error(data.error);
            setShowUndoModal(false);
            if (data.blocked_paid > 0) {
                notify.warning(data.message);
            } else {
                notify.success(data.message);
            }
            fetchSlips();
            fetchGeneratedMonths();
        } catch (err: any) {
            notify.error(err.message);
            setShowUndoModal(false);
        } finally { setUndoLoading(false); }
    };

    const formatAmt = (n: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(n);

    const statusBadge = (s: string) => {
        if (s === 'paid') return <span className="badge bg-success rounded-pill">Paid</span>;
        if (s === 'partial') return <span className="badge bg-warning text-dark rounded-pill">Partial</span>;
        return <span className="badge bg-danger rounded-pill">Unpaid</span>;
    };

    const className = classes.find(c => c.class_id.toString() === selectedClass)?.class_name || '';

    const hasGeneratedSelected = selectedMonths.some(m => generatedMonths.includes(m));

    // Check if the current selection is a PARTIAL selection of a combined group
    let partialGroupLabel = '';
    const involvedGroup = generatedGroups.find(g =>
        g.months.some((m: number) => selectedMonths.includes(m.toString()))
    );
    if (involvedGroup) {
        const isExactMatch = involvedGroup.months.length === selectedMonths.length
            && involvedGroup.months.every((m: number) => selectedMonths.includes(m.toString()));
        if (!isExactMatch) {
            partialGroupLabel = involvedGroup.label;
        }
    }

    return (
        <div className="container-fluid p-3 p-md-4 animate__animated animate__fadeIn">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center align-items-start gap-3 mb-4">
                <div>
                    <h2 className="fw-bold mb-1" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-lightning-charge me-2"></i>Monthly Fee Generation
                    </h2>
                    <p className="text-muted small mb-0">Select a class and month regular heads auto-load from fee plan. Add extra charges if needed.</p>
                </div>
                <div className="d-grid d-md-block">
                    <button className="btn btn-secondary-custom d-inline-flex align-items-center justify-content-center gap-2" onClick={() => router.push('/fees/print')}>
                        <i className="bi bi-printer"></i> Print Slips
                    </button>
                </div>
            </div>

            <div className="row g-4">
                {/* LEFT: Controls */}
                <div className="col-lg-4">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-white border-bottom py-3" style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                            <h6 className="mb-0 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                                <i className="bi bi-gear me-2"></i>Generation Settings
                            </h6>
                        </div>
                        <div className="card-body p-4">
                            <div className="mb-3">
                                <label className="form-label fw-bold small text-muted">Class <span className="text-danger">*</span></label>
                                <select className="form-select" value={selectedClass}
                                    onChange={e => setSelectedClass(e.target.value)}>
                                    <option value="">Select Class</option>
                                    {classes.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                                </select>
                            </div>
                            <div className="mb-3">
                                <label className="form-label fw-bold small text-muted d-flex justify-content-between">
                                    <span>Month(s) <span className="text-danger">*</span></span>
                                    <span className="text-muted fw-normal">
                                        {selectedMonths.length === 1
                                            ? MONTHS[parseInt(selectedMonths[0]) - 1]
                                            : <span style={{ color: 'var(--accent-orange)' }}>{selectedMonths.length} months selected</span>}
                                    </span>
                                </label>
                                <div className="d-grid gap-1" style={{ gridTemplateColumns: 'repeat(4,1fr)', display: 'grid' }}>
                                    {MONTHS.map((m, i) => {
                                        const val = (i + 1).toString();
                                        const active = selectedMonths.includes(val);
                                        const isGenerated = generatedMonths.includes(val);

                                        // Find if this month is part of a combined group to show a link icon
                                        let isCombined = false;
                                        if (isGenerated) {
                                            const g = generatedGroups.find(gr => gr.months.includes(parseInt(val)));
                                            if (g && g.months.length > 1) {
                                                isCombined = true;
                                            }
                                        }

                                        return (
                                            <button key={val} type="button"
                                                onClick={() => toggleMonth(val)}
                                                className="btn btn-sm "
                                                style={{
                                                    fontSize: '0.72rem', padding: '5px 2px', borderRadius: 6,
                                                    background: active ? 'var(--primary-teal)' : '#f1f3f5',
                                                    color: active ? '#fff' : (isGenerated ? '#198754' : '#6c757d'),
                                                    border: active ? '1.5px solid var(--primary-teal)' : '1.5px solid #dee2e6',
                                                    fontWeight: isGenerated ? 'bold' : '600',
                                                    transition: 'all 0.15s'
                                                }}>
                                                {m.slice(0, 3)}
                                                {isGenerated && isCombined ? <i className="bi bi-link ms-1"></i> :
                                                    isGenerated ? <i className="bi bi-check-lg ms-1"></i> : ''}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="mb-3">
                                <label className="form-label fw-bold small text-muted">Year <span className="text-danger">*</span></label>
                                <input type="number" className="form-control" value={selectedYear}
                                    onKeyDown={e => ['e', 'E', '+', '-', '.'].includes(e.key) && e.preventDefault()}
                                    onChange={e => setSelectedYear(e.target.value)} />
                            </div>
                            <div className="row g-2 mb-3">
                                <div className="col-6">
                                    <label className="form-label fw-bold small text-muted">Issue Date</label>
                                    <input type="date" className="form-control" value={issueDate}
                                        onChange={e => setIssueDate(e.target.value)} />
                                </div>
                                <div className="col-6">
                                    <label className="form-label fw-bold small text-muted">Due Date</label>
                                    <input type="date" className="form-control" value={dueDate}
                                        onChange={e => setDueDate(e.target.value)} />
                                </div>
                            </div>

                            {/* Fee Plan Preview */}
                            {selectedClass && (
                                <div className="border rounded p-3 mb-4" style={{ backgroundColor: '#f0f9ff' }}>
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <h6 className="fw-bold mb-0 small" style={{ color: 'var(--primary-dark)' }}>
                                            <i className="bi bi-clipboard-check me-2"></i>Fee Plan Preview
                                        </h6>
                                    </div>
                                    {!loadingPlan && matchingPlans.length > 0 && (
                                        <div className="mb-3">
                                            <select
                                                className="form-select form-select-sm"
                                                value={selectedPlanId}
                                                onChange={e => setSelectedPlanId(e.target.value)}
                                            >
                                                {matchingPlans.map(p => (
                                                    <option key={p.plan_id} value={p.plan_id}>
                                                        {p.plan_name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {loadingPlan ? (
                                        <div className="text-center py-2"><div className="spinner-border spinner-border-sm text-primary"></div></div>
                                    ) : planInfo ? (
                                        <>
                                            <div className="d-flex align-items-center gap-2 mb-2 d-none">
                                                <span className="badge bg-success rounded-pill">Active</span>
                                                <small className="fw-bold text-dark">{planInfo.plan_name}</small>
                                            </div>
                                            {planInfo.heads.map((h: any, i: number) => (
                                                <div key={i} className="d-flex justify-content-between align-items-center py-1 border-bottom">
                                                    <small className="text-muted">{h.head_name}</small>
                                                    <small className="fw-bold">
                                                        {h.head_name.toLowerCase().includes('tuition') ? (
                                                            <span className="badge bg-success rounded-pill">Per Student</span>
                                                        ) : (
                                                            `PKR ${Number(h.amount).toLocaleString()}`
                                                        )}
                                                    </small>
                                                </div>
                                            ))}
                                            <div className="mt-2 text-muted" style={{ fontSize: '0.7rem' }}>
                                                <i className="bi bi-info-circle me-1"></i>Tuition head = personal fee per student.
                                                For students with siblings, <strong className="text-warning">1 family slip</strong> is generated using the family fee set on their family.
                                            </div>
                                        </>
                                    ) : (
                                        <div className="d-flex align-items-center gap-2 text-danger">
                                            <i className="bi bi-exclamation-triangle"></i>
                                            <small>No active fee plan found for this class. Create one in Fee Plans first.</small>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Extra Heads Section */}
                            <div className="border rounded p-3 mb-4" style={{ backgroundColor: '#fffbf5' }}>
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h6 className="mb-0 fw-bold" style={{ color: 'var(--accent-orange)' }}>
                                        <i className="bi bi-plus-circle me-2"></i>Extra Charges
                                    </h6>
                                    <button type="button" className="btn btn-sm btn-outline-warning" onClick={addExtraHead}>
                                        <i className="bi bi-plus"></i> Add
                                    </button>
                                </div>
                                <p className="text-muted small mb-3">These will be added on top of regular plan heads for ALL students in this class.</p>

                                {extraHeads.length === 0 ? (
                                    <p className="text-muted small text-center py-2">No extra charges added</p>
                                ) : (
                                    extraHeads.map((head, i) => (
                                        <div key={i} className="border rounded p-2 mb-2 bg-white">
                                            <div className="row g-2">
                                                <div className="col-12">
                                                    <select className="form-select form-select-sm" value={head.head_id?.toString() || ''}
                                                        onChange={e => {
                                                            const h = allHeads.find(x => x.head_id.toString() === e.target.value);
                                                            updateExtra(i, 'head_id', h ? h.head_id : null);
                                                            updateExtra(i, 'head_name', h ? h.head_name : '');
                                                        }}>
                                                        <option value="">Select Head</option>
                                                        {allHeads.map(h => <option key={h.head_id} value={h.head_id}>{h.head_name}</option>)}
                                                        <option value="__custom__">Custom (type below)</option>
                                                    </select>
                                                </div>
                                                {(!head.head_id || head.head_id === null) && (
                                                    <div className="col-12">
                                                        <input type="text" className="form-control form-control-sm" value={head.head_name}
                                                            onChange={e => updateExtra(i, 'head_name', e.target.value)} placeholder="Custom head name" />
                                                    </div>
                                                )}
                                                <div className="col-7">
                                                    <div className="input-group input-group-sm">
                                                        <span className="input-group-text bg-light">PKR</span>
                                                        <input type="number" className="form-control" value={head.amount}
                                                            onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                                            onChange={e => updateExtra(i, 'amount', e.target.value)} placeholder="0" />
                                                    </div>
                                                </div>
                                                <div className="col-5">
                                                    <button className="btn btn-sm btn-light text-danger w-100" onClick={() => removeExtraHead(i)}>
                                                        <i className="bi bi-trash"></i> Remove
                                                    </button>
                                                </div>
                                                <div className="col-12">
                                                    <input type="text" className="form-control form-control-sm" value={head.note}
                                                        onChange={e => updateExtra(i, 'note', e.target.value)} placeholder="Note (optional)" />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {hasPermission('fees', 'write') && (
                                <button
                                    className={`btn w-100 py-2 fw-bold shadow-sm ${hasGeneratedSelected ? 'btn-secondary' : 'btn-primary-custom'}`}
                                    onClick={handleGenerate}
                                    disabled={generating || hasGeneratedSelected || !!partialGroupLabel}
                                >
                                    {generating ? (
                                        <><span className="spinner-border spinner-border-sm me-2"></span>Generating...</>
                                    ) : partialGroupLabel ? (
                                        <><i className="bi bi-x-circle me-2"></i>Select Entire Combined ({partialGroupLabel}) first</>
                                    ) : hasGeneratedSelected ? (
                                        <><i className="bi bi-x-circle me-2"></i>Cannot Generate (Month Already Issued)</>
                                    ) : selectedMonths.length > 1 ? (
                                        <><i className="bi bi-lightning-charge me-2"></i>Generate for {selectedMonths.length} Months</>
                                    ) : (
                                        <><i className="bi bi-lightning-charge me-2"></i>Generate Fee Slips</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT: Slips Table */}
                <div className="col-lg-8">
                    {/* Stats Row */}
                    {stats && (
                        <div className="row g-3 mb-4">
                            {[
                                { label: 'Total Slips', value: stats.total_students, color: 'var(--primary-dark)', icon: 'bi-receipt' },
                                { label: 'Total Amount', value: formatAmt(stats.total_amount), color: 'var(--primary-teal)', icon: 'bi-cash-stack' },
                                { label: 'Paid', value: stats.paid_count, color: '#198754', icon: 'bi-check-circle' },
                                { label: 'Unpaid', value: stats.unpaid_count, color: '#dc3545', icon: 'bi-x-circle' },
                            ].map((s, i) => (
                                <div className="col-6 col-md-3" key={i}>
                                    <div className="card border-0 shadow-sm" style={{ borderLeft: `4px solid ${s.color}` }}>
                                        <div className="card-body py-2 px-3">
                                            <div className="text-muted small fw-bold text-uppercase">{s.label}</div>
                                            <div className="fw-bold" style={{ color: s.color, fontSize: '1.1rem' }}>{s.value}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="card border-0 shadow-sm">
                        <div className="card-header bg-white border-bottom py-3 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
                            <h6 className="mb-0 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                                {className
                                    ? sortedSelectedMonths.length === 1
                                        ? `${className} ${MONTHS[parseInt(sortedSelectedMonths[0]) - 1]} ${selectedYear}`
                                        : `${className} ${MONTHS[parseInt(sortedSelectedMonths[0]) - 1]} + ${MONTHS[parseInt(sortedSelectedMonths[sortedSelectedMonths.length - 1]) - 1]} ${selectedYear} (combined)`
                                    : 'Select a class to view slips'}
                            </h6>
                            {slips.length > 0 && (
                                <div className="d-flex flex-wrap align-items-center gap-2">
                                    <span className="badge rounded-pill bg-light text-dark border">{slips.length} slips</span>
                                    {slips.some(s => s.is_family_slip) && (
                                        <span className="badge rounded-pill bg-warning text-dark border">
                                            <i className="bi bi-people-fill me-1"></i>
                                            {slips.reduce((total, s) => total + (s.is_family_slip ? (s.family_members?.length || 1) : 1), 0)} students
                                        </span>
                                    )}
                                    {hasPermission('fees', 'delete') && (
                                        <button
                                            className="btn btn-sm btn-outline-danger fw-bold"
                                            onClick={() => setShowUndoModal(true)}
                                        >
                                            <i className="bi bi-arrow-counterclockwise me-1"></i>Undo Generation
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="card-body p-0">
                            {partialGroupLabel ? (
                                <div className="text-center py-5">
                                    <i className="bi bi-info-circle text-warning fs-1 d-block mb-3"></i>
                                    <h5 className="text-dark fw-bold">Combined Billing Detected!</h5>
                                    <p className="text-muted">This month's fee was generated combined with another month ({partialGroupLabel}).<br /> To view the data, please <strong>select the complete {partialGroupLabel} group together</strong>.</p>
                                </div>
                            ) : loadingSlips ? (
                                <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>
                            ) : slips.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                                    {selectedClass ? 'No slips generated yet. Click "Generate Fee Slips" to create.' : 'Select a class to view generated slips.'}
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle mb-0">
                                        <thead className="bg-light">
                                            <tr>
                                                <th className="ps-4 py-3 text-secondary">Student</th>
                                                <th className="py-3 text-secondary">Heads</th>
                                                <th className="py-3 text-secondary">Total</th>
                                                <th className="py-3 text-secondary">Paid</th>
                                                <th className="py-3 text-secondary">Status</th>
                                                <th className="pe-4 py-3 text-secondary">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {slips.map(slip => (
                                                <tr key={slip.slip_id}>
                                                    <td className="ps-4">
                                                        <div className="fw-bold text-dark">
                                                            {slip.first_name} {slip.last_name}
                                                            {slip.is_family_slip && (
                                                                <span className="badge bg-warning text-dark ms-2" style={{ fontSize: '0.65rem' }}>
                                                                    <i className="bi bi-people-fill me-1"></i>Family
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-muted small">{slip.admission_no}</div>
                                                        {slip.family_id && <div className="text-muted small"><i className="bi bi-people me-1"></i>{slip.family_id}</div>}
                                                        {/* Show all covered siblings for family slips */}
                                                        {slip.is_family_slip && slip.family_members && slip.family_members.length > 1 && (
                                                            <div className="mt-1">
                                                                {slip.family_members.map((m, mi) => (
                                                                    <div key={mi} className="d-flex align-items-center gap-1" style={{ fontSize: '0.72rem' }}>
                                                                        <i className="bi bi-person-fill text-muted"></i>
                                                                        <span className="text-muted">{m.first_name} {m.last_name}</span>
                                                                        <span className="badge bg-light text-secondary border" style={{ fontSize: '0.6rem' }}>{m.class_name}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {slip.line_items?.map((item, idx) => (
                                                            <div key={idx} className="text-muted small">
                                                                <span className="me-1">{item.head_name}:</span>
                                                                <strong>{formatAmt(parseFloat(item.amount?.toString() || '0'))}</strong>
                                                            </div>
                                                        ))}
                                                    </td>
                                                    <td className="fw-bold" style={{ color: 'var(--primary-dark)' }}>
                                                        {formatAmt(parseFloat(slip.total_amount?.toString() || '0'))}
                                                    </td>
                                                    <td className="text-success fw-bold">
                                                        {formatAmt(parseFloat(slip.paid_amount?.toString() || '0'))}
                                                    </td>
                                                    <td>{statusBadge(slip.status)}</td>
                                                    <td className="pe-4">
                                                        {slip.status !== 'paid' && hasPermission('fees', 'write') && (
                                                            <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => openEdit(slip)} title="Edit slip">
                                                                <i className="bi bi-pencil"></i>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Slip Modal */}
            {showEdit && editSlip && (
                <>
                    <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
                    <div className="modal fade show d-block" style={{ zIndex: 1050 }} tabIndex={-1}>
                        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
                            <div className="modal-content border-0 shadow-lg">
                                <div className="modal-header text-white" style={{ backgroundColor: 'var(--primary-dark)' }}>
                                    <h5 className="modal-title">
                                        <i className="bi bi-pencil-square me-2"></i>Edit Slip {editSlip.first_name} {editSlip.last_name}
                                    </h5>
                                    <button className="btn-close btn-close-white" onClick={() => setShowEdit(false)}></button>
                                </div>
                                <div className="modal-body p-4">
                                    {editError && <div className="alert alert-danger py-2 small">{editError}</div>}
                                    <p className="text-muted small mb-3">Edit fee heads and amounts for this student only. Other students are not affected.</p>
                                    {editItems.map((item, i) => (
                                        <div key={i} className="row g-2 mb-2 align-items-center">
                                            <div className="col-5">
                                                <input type="text" className="form-control form-control-sm" value={item.head_name}
                                                    onChange={e => setEditItems(p => p.map((x, j) => j === i ? { ...x, head_name: e.target.value } : x))}
                                                    placeholder="Fee Head Name" />
                                            </div>
                                            <div className="col-4">
                                                <div className="input-group input-group-sm">
                                                    <span className="input-group-text bg-light">PKR</span>
                                                    <input type="number" className="form-control" value={item.amount}
                                                        onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                                        onChange={e => setEditItems(p => p.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))}
                                                        min="0" />
                                                </div>
                                            </div>
                                            <div className="col-2">
                                                <button className="btn btn-sm btn-light text-danger w-100"
                                                    onClick={() => setEditItems(p => p.filter((_, j) => j !== i))}>
                                                    <i className="bi bi-trash"></i>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button className="btn btn-sm btn-outline-secondary mt-1 mb-3"
                                        onClick={() => setEditItems(p => [...p, { head_name: '', amount: '0', note: '' }])}>
                                        <i className="bi bi-plus me-1"></i>Add Row
                                    </button>
                                    <div className="mb-3">
                                        <label className="form-label fw-bold small text-muted">Due Date (optional override)</label>
                                        <input type="date" className="form-control form-control-sm" value={editDueDate}
                                            onChange={e => setEditDueDate(e.target.value)} />
                                    </div>
                                    <div className="alert border-0 py-2" style={{ backgroundColor: 'var(--primary-teal)', color: 'white' }}>
                                        <div className="d-flex justify-content-between fw-bold">
                                            <span><i className="bi bi-calculator me-2"></i>New Total</span>
                                            <span>{formatAmt(editItems.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0))}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-secondary-custom px-4" onClick={() => setShowEdit(false)}>Cancel</button>
                                    <button className="btn btn-primary-custom fw-bold px-4" onClick={saveEdit} disabled={editLoading}>
                                        {editLoading ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</> : <><i className="bi bi-check-circle me-2"></i>Save Changes</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Undo Generation Confirmation Modal */}
            {showUndoModal && (
                <>
                    <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
                    <div className="modal fade show d-block" style={{ zIndex: 1050 }} tabIndex={-1}>
                        <div className="modal-dialog modal-dialog-centered">
                            <div className="modal-content border-0 shadow-lg">
                                <div className="modal-header bg-danger text-white">
                                    <h5 className="modal-title">
                                        <i className="bi bi-exclamation-triangle-fill me-2"></i>Undo Fee Generation
                                    </h5>
                                    <button className="btn-close btn-close-white" onClick={() => setShowUndoModal(false)}></button>
                                </div>
                                <div className="modal-body p-4">
                                    <p className="mb-3">
                                        This will <strong>permanently delete</strong> all unpaid and partial fee slips for:
                                    </p>
                                    <div className="border rounded p-3 mb-3 bg-light">
                                        <div className="fw-bold text-dark">{className}</div>
                                        <div className="text-muted small">
                                            {sortedSelectedMonths.length === 1
                                                ? MONTHS[parseInt(sortedSelectedMonths[0]) - 1]
                                                : `${MONTHS[parseInt(sortedSelectedMonths[0]) - 1]} – ${MONTHS[parseInt(sortedSelectedMonths[sortedSelectedMonths.length - 1]) - 1]}`
                                            } {selectedYear}
                                        </div>
                                        <div className="mt-2 d-flex gap-3">
                                            <span className="text-danger small"><i className="bi bi-x-circle-fill me-1"></i>{stats?.unpaid_count || 0} unpaid</span>
                                            <span className="text-warning small"><i className="bi bi-exclamation-circle-fill me-1"></i>{stats?.partial_count || 0} partial</span>
                                            <span className="text-success small"><i className="bi bi-lock-fill me-1"></i>{stats?.paid_count || 0} paid (kept)</span>
                                        </div>
                                    </div>
                                    {(stats?.paid_count || 0) > 0 && (
                                        <div className="alert alert-warning py-2 small mb-3">
                                            <i className="bi bi-shield-lock-fill me-1"></i>
                                            <strong>{stats?.paid_count} paid slip(s)</strong> will NOT be deleted as payments have already been recorded.
                                        </div>
                                    )}
                                    <div className="alert alert-danger py-2 small mb-0">
                                        <i className="bi bi-info-circle me-1"></i>
                                        This action cannot be undone. You can re-generate slips anytime.
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-secondary-custom px-4" onClick={() => setShowUndoModal(false)}>Cancel</button>
                                    {hasPermission('fees', 'delete') && (
                                        <button className="btn btn-danger fw-bold px-4" onClick={handleUndo} disabled={undoLoading}>
                                            {undoLoading
                                                ? <><span className="spinner-border spinner-border-sm me-2"></span>Deleting...</>
                                                : <><i className="bi bi-trash3-fill me-2"></i>Yes, Delete Slips</>}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

