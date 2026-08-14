'use client';
import { useState, useEffect, useRef } from 'react';

type Class = { class_id: number; class_name: string };
type Section = { section_id: number; section_name: string; class_id: number };
type FeeHead = { head_id: number; head_name: string };
type LineItem = { slip_id: number; head_id: number; head_name: string; amount: number };
type FeeSlip = {
    slip_id: number; student_id: number; family_id: number;
    month: number; year: number;
    total_amount: number; paid_amount: number;
    status: string; due_date: string;
    student_name: string; admission_no: string;
    family_name: string; class_name: string; section_name: string;
    line_items: LineItem[];
};
type HeadSummary = { head_name: string; total: number };
type Collective = { total_billed: number; total_collected: number; total_pending: number };

interface AvailableMonth {
    value: string;
    label: string;
    months: number[];
}

export default function FamilyFeeReportPage() {
    const now = new Date();
    const [classes, setClasses] = useState<Class[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [filteredSections, setFilteredSections] = useState<Section[]>([]);
    const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);

    // Filters
    const [month, setMonth] = useState<string>('');
    const [year, setYear] = useState<string>(String(now.getFullYear()));
    const [availableMonths, setAvailableMonths] = useState<AvailableMonth[]>([]);
    const [loadingMonths, setLoadingMonths] = useState<boolean>(true);
    const [classId, setClassId] = useState('');
    const [sectionId, setSectionId] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [headId, setHeadId] = useState('');

    // Report data
    const [slips, setSlips] = useState<FeeSlip[]>([]);
    const [headSummary, setHeadSummary] = useState<HeadSummary[]>([]);
    const [collective, setCollective] = useState<Collective | null>(null);
    const [uniqueHeads, setUniqueHeads] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const printRef = useRef<HTMLDivElement>(null);

    // Load dropdowns on mount
    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/classes`).then(r => r.json()).then(setClasses).catch(console.error);
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/sections`).then(r => r.json()).then(setSections).catch(console.error);
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/reports/fee-heads`).then(r => r.json()).then(setFeeHeads).catch(console.error);
    }, []);

    useEffect(() => {
        setLoadingMonths(true);
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/fee-slips/available-months?year=${year}`)
            .then(r => r.json())
            .then(data => {
                if (data.months) {
                    setAvailableMonths(data.months);
                    if (data.months.length > 0) {
                        const currentM = (new Date().getMonth() + 1);
                        const exact = data.months.find((m: AvailableMonth) => m.months.includes(currentM));
                        if (exact) {
                            setMonth(exact.value);
                        } else {
                            setMonth(data.months[data.months.length - 1].value);
                        }
                    } else {
                        setMonth('');
                        setSlips([]);
                        setHeadSummary([]);
                        setCollective(null);
                    }
                }
            })
            .catch(() => {
                setAvailableMonths([]);
                setMonth('');
            })
            .finally(() => setLoadingMonths(false));
    }, [year]);

    useEffect(() => {
        setSectionId('');
        setFilteredSections(classId ? sections.filter(s => s.class_id === Number(classId)) : sections);
    }, [classId, sections]);

    const loadReport = async () => {
        if (!month || !year) {
            setSlips([]); setHeadSummary([]); setCollective(null); setError(''); setLoading(false);
            return;
        }
        setLoading(true); setError('');
        try {
            const params = new URLSearchParams({ month, year });
            if (classId) params.append('class_id', classId);
            if (sectionId) params.append('section_id', sectionId);
            if (statusFilter) params.append('status', statusFilter);
            if (headId) params.append('head_id', headId);

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/reports/family-fee?${params}`);
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to load report');
            const data = await res.json();

            const parsedSlips: FeeSlip[] = data.slips.map((s: FeeSlip) => ({
                ...s,
                total_amount: Number(s.total_amount),
                paid_amount: Number(s.paid_amount),
                line_items: (s.line_items || []).map((li: LineItem) => ({ ...li, amount: Number(li.amount) })),
            }));

            // Derive unique head names from actual line items in results
            const headSet = new Set<string>();
            parsedSlips.forEach(s => s.line_items.forEach(li => headSet.add(li.head_name)));
            setUniqueHeads(Array.from(headSet).sort());

            setSlips(parsedSlips);
            setHeadSummary(data.headSummary.map((h: HeadSummary) => ({ ...h, total: Number(h.total) })));
            setCollective({
                total_billed: Number(data.collective.total_billed),
                total_collected: Number(data.collective.total_collected),
                total_pending: Number(data.collective.total_pending),
            });
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    };

    const paidCount = slips.filter(s => s.status === 'paid').length;
    const partialCount = slips.filter(s => s.status === 'partial').length;
    const unpaidCount = slips.filter(s => s.status === 'unpaid').length;

    const currentSelMonth = availableMonths.find(m => m.value === month);
    const monthLabel = currentSelMonth
        ? currentSelMonth.label
        : (month ? month : 'No Fee Slips');
    const classLabel = classId ? classes.find(c => String(c.class_id) === classId)?.class_name || '' : '';
    const secLabel = sectionId ? filteredSections.find(s => String(s.section_id) === sectionId)?.section_name || '' : '';

    const statusBadge = (s: string) => {
        if (s === 'paid') return { bg: '#198754', label: 'Paid' };
        if (s === 'partial') return { bg: '#fd7e14', label: 'Partial' };
        return { bg: '#dc3545', label: 'Unpaid' };
    };

    // Per-head column totals for footer row
    const headTotals: Record<string, number> = {};
    uniqueHeads.forEach(h => {
        headTotals[h] = slips.reduce((sum, slip) => {
            const li = slip.line_items.find(l => l.head_name === h);
            return sum + (li ? li.amount : 0);
        }, 0);
    });

    const handlePrint = () => {
        if (!printRef.current) return;
        const win = window.open('', '_blank');
        if (!win) return;

        const headCols = uniqueHeads.map(h =>
            `<th style="background:#1a4a5e;color:#fff;padding:8px 7px;white-space:nowrap;text-align:right;font-size:10.5px">${h}</th>`
        ).join('');
        const headFooters = uniqueHeads.map(h =>
            `<td style="padding:8px 7px;text-align:right;font-weight:700">Rs.${(headTotals[h] || 0).toLocaleString()}</td>`
        ).join('');
        const rows = slips.map((s, i) => {
            const badge = statusBadge(s.status);
            const balance = s.total_amount - s.paid_amount;
            const headCells = uniqueHeads.map(h => {
                const li = s.line_items.find(l => l.head_name === h);
                return `<td style="padding:6px 7px;text-align:right;font-size:10.5px">${li ? `Rs.${li.amount.toLocaleString()}` : '—'}</td>`;
            }).join('');
            return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
                <td style="padding:6px 7px;color:#888;font-size:10px">${i + 1}</td>
                <td style="padding:6px 7px;font-size:10.5px">${s.admission_no}</td>
                <td style="padding:6px 7px;font-weight:600;font-size:10.5px">${s.student_name}</td>
                <td style="padding:6px 7px;font-size:10.5px">${s.class_name}</td>
                <td style="padding:6px 7px;font-size:10.5px">${s.section_name}</td>
                ${headCells}
                <td style="padding:6px 7px;text-align:right;font-weight:600;font-size:10.5px">Rs.${s.total_amount.toLocaleString()}</td>
                <td style="padding:6px 7px;text-align:right;color:#198754;font-weight:600;font-size:10.5px">Rs.${s.paid_amount.toLocaleString()}</td>
                <td style="padding:6px 7px;text-align:right;color:${balance > 0 ? '#dc3545' : '#198754'};font-weight:600;font-size:10.5px">Rs.${balance.toLocaleString()}</td>
                <td style="padding:6px 7px;text-align:center"><span style="background:${badge.bg};color:#fff;padding:2px 8px;border-radius:10px;font-size:9.5px">${badge.label}</span></td>
            </tr>`;
        }).join('');
        const headSummaryRows = headSummary.map(h =>
            `<tr><td style="padding:7px 10px">${h.head_name}</td><td style="padding:7px 10px;text-align:right;font-weight:600">Rs.${h.total.toLocaleString()}</td></tr>`
        ).join('');

        win.document.write(`<!DOCTYPE html><html><head><title>Family Fee Report ${monthLabel} ${year}</title>
        <style>
            * { box-sizing:border-box; margin:0; padding:0; }
            body { font-family:'Segoe UI',Arial,sans-serif; font-size:12px; color:#222; }
            .page { padding:24px 28px; }
            .header { border-bottom:3px solid #233D4D; padding-bottom:12px; margin-bottom:18px; display:flex; align-items:center; justify-content:space-between; }
            .school-name { font-size:22px; font-weight:800; color:#233D4D; }
            .report-title { font-size:13px; color:#555; margin-top:3px; }
            .meta { font-size:11px; color:#777; text-align:right; }
            .stats-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:8px; margin-bottom:18px; }
            .stat-box { border:1px solid #e0e4ea; border-radius:6px; padding:10px 6px; text-align:center; }
            .stat-val { font-size:16px; font-weight:800; }
            .stat-lbl { font-size:9px; color:#777; margin-top:2px; text-transform:uppercase; letter-spacing:0.4px; }
            .section-title { font-size:12px; font-weight:700; background:#f0f4f8; padding:7px 10px; border-left:4px solid #233D4D; margin-bottom:8px; margin-top:16px; }
            table { width:100%; border-collapse:collapse; margin-bottom:4px; }
            th { background:#233D4D; color:#fff; padding:8px 7px; font-size:10.5px; font-weight:600; }
            td { border-bottom:1px solid #eef0f3; }
            tfoot td { background:#eef2f7; font-weight:700; }
            @media print { @page { margin:12mm; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
        </style></head><body><div class="page">
        <div class="header">
            <div>
                <div class="school-name">School Management System</div>
                <div class="report-title">Family Fee Collection Report ${monthLabel} ${year}${classLabel ? ` &nbsp;|&nbsp; ${classLabel}${secLabel ? ' &rsaquo; ' + secLabel : ''}` : ''}</div>
            </div>
            <div class="meta">Generated: ${new Date().toLocaleDateString('en-PK', { dateStyle: 'medium' })}<br/>Time: ${new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div class="stats-grid">
            <div class="stat-box"><div class="stat-val" style="color:#233D4D">Rs.${(collective?.total_billed || 0).toLocaleString()}</div><div class="stat-lbl">Total Billed</div></div>
            <div class="stat-box"><div class="stat-val" style="color:#198754">Rs.${(collective?.total_collected || 0).toLocaleString()}</div><div class="stat-lbl">Collected</div></div>
            <div class="stat-box"><div class="stat-val" style="color:#dc3545">Rs.${(collective?.total_pending || 0).toLocaleString()}</div><div class="stat-lbl">Pending</div></div>
            <div class="stat-box"><div class="stat-val" style="color:#0d6efd">${slips.length}</div><div class="stat-lbl">Total Students</div></div>
            <div class="stat-box"><div class="stat-val" style="color:#198754">${paidCount}</div><div class="stat-lbl">Paid</div></div>
            <div class="stat-box"><div class="stat-val" style="color:#fd7e14">${partialCount}</div><div class="stat-lbl">Partial</div></div>
            <div class="stat-box"><div class="stat-val" style="color:#dc3545">${unpaidCount}</div><div class="stat-lbl">Unpaid</div></div>
        </div>
        <div class="section-title">Fee Head-wise Summary</div>
        <table style="width:340px">
            <thead><tr>
                <th style="background:#233D4D;color:#fff;padding:7px 10px">Fee Head</th>
                <th style="background:#233D4D;color:#fff;padding:7px 10px;text-align:right">Total Amount</th>
            </tr></thead>
            <tbody>${headSummaryRows}</tbody>
            <tfoot><tr>
                <td style="padding:8px 10px;font-weight:700">Grand Total</td>
                <td style="padding:8px 10px;text-align:right;font-weight:700">Rs.${(collective?.total_billed || 0).toLocaleString()}</td>
            </tr></tfoot>
        </table>
        <div class="section-title">Student-wise Fee Detail ${slips.length} Students</div>
        <table>
            <thead><tr>
                <th style="width:26px;padding:8px 6px">#</th>
                <th style="padding:8px 7px;white-space:nowrap">Adm#</th>
                <th style="padding:8px 7px">Student Name</th>
                <th style="padding:8px 7px">Class</th>
                <th style="padding:8px 7px">Section</th>
                ${headCols}
                <th style="padding:8px 7px;text-align:right">Total Bill</th>
                <th style="padding:8px 7px;text-align:right">Paid</th>
                <th style="padding:8px 7px;text-align:right">Balance</th>
                <th style="padding:8px 7px;text-align:center">Status</th>
            </tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr>
                <td colspan="5" style="padding:8px 7px;font-weight:800">TOTAL (${slips.length} students)</td>
                ${headFooters}
                <td style="padding:8px 7px;text-align:right;font-weight:800">Rs.${(collective?.total_billed || 0).toLocaleString()}</td>
                <td style="padding:8px 7px;text-align:right;font-weight:800;color:#198754">Rs.${(collective?.total_collected || 0).toLocaleString()}</td>
                <td style="padding:8px 7px;text-align:right;font-weight:800;color:#dc3545">Rs.${(collective?.total_pending || 0).toLocaleString()}</td>
                <td></td>
            </tr></tfoot>
        </table>
        </div></body></html>`);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 500);
    };

    const yearOptions = Array.from({ length: 8 }, (_, i) => now.getFullYear() - 2 + i);

    return (
        <div className="p-3 p-md-4" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>

            {/* ── Page Header ── */}
            <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-4">
                <div>
                    <h4 className="mb-1 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-wallet2 me-2" style={{ color: 'var(--accent-orange)' }} />
                        Family Fee Report
                    </h4>
                    <div className="text-muted small">Monthly fee collection head-wise per student &amp; collective summary</div>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-white border-bottom py-3" style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                    <h6 className="mb-0 fw-bold"><i className="bi bi-funnel me-2 text-muted" />Filters</h6>
                </div>
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-6 col-md-2">
                            <label className="form-label fw-semibold small mb-1">Month <span className="text-danger">*</span></label>
                            <select className="form-select form-select-sm"
                                value={month}
                                onChange={e => setMonth(e.target.value)}
                                disabled={availableMonths.length === 0 || loadingMonths}>
                                {availableMonths.length > 0 ? (
                                    availableMonths.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))
                                ) : (
                                    <option value="">{loadingMonths ? 'Loading...' : 'No Fee Slips Created'}</option>
                                )}
                            </select>
                        </div>
                        <div className="col-6 col-md-1">
                            <label className="form-label fw-semibold small mb-1">Year <span className="text-danger">*</span></label>
                            <select className="form-select form-select-sm" value={year} onChange={e => setYear(e.target.value)}>
                                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div className="col-6 col-md-2">
                            <label className="form-label fw-semibold small mb-1">Class</label>
                            <select className="form-select form-select-sm" value={classId} onChange={e => setClassId(e.target.value)}>
                                <option value="">All Classes</option>
                                {classes.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                            </select>
                        </div>
                        <div className="col-6 col-md-2">
                            <label className="form-label fw-semibold small mb-1">Section</label>
                            <select className="form-select form-select-sm" value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={!classId}>
                                <option value="">All Sections</option>
                                {filteredSections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
                            </select>
                        </div>
                        <div className="col-6 col-md-2">
                            <label className="form-label fw-semibold small mb-1">Fee Head</label>
                            <select className="form-select form-select-sm" value={headId} onChange={e => setHeadId(e.target.value)}>
                                <option value="">All Heads</option>
                                {feeHeads.map(h => <option key={h.head_id} value={h.head_id}>{h.head_name}</option>)}
                            </select>
                        </div>
                        <div className="col-6 col-md-1">
                            <label className="form-label fw-semibold small mb-1">Status</label>
                            <select className="form-select form-select-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                                <option value="">All</option>
                                <option value="paid">Paid</option>
                                <option value="partial">Partial</option>
                                <option value="unpaid">Unpaid</option>
                            </select>
                        </div>
                        <div className="col-12 col-md-2 d-flex gap-2 align-items-end">
                            <button
                                className="btn btn-sm fw-bold px-4 w-100"
                                style={{ background: 'var(--primary-teal)', color: '#fff', height: 34 }}
                                onClick={loadReport}
                                disabled={loading}
                            >
                                {loading
                                    ? <span className="spinner-border spinner-border-sm" />
                                    : <><i className="bi bi-search me-1" />Generate</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {error && <div className="alert alert-danger py-2"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}

            {/* ── Empty Prompt ── */}
            {!loading && !collective && (
                <div className="card border-0 shadow-sm">
                    <div className="card-body text-center py-5 text-muted">
                        <i className="bi bi-wallet2 fs-1 d-block mb-3 opacity-25" />
                        <div className="fw-semibold">Select filters and click <strong>Generate</strong></div>
                        <div className="small mt-1">Month and Year are required</div>
                    </div>
                </div>
            )}

            {/* ── No Data ── */}
            {!loading && collective && slips.length === 0 && (
                <div className="alert alert-info">
                    <i className="bi bi-info-circle me-2" />
                    No fee slips found for <strong>{monthLabel} {year}</strong> with selected filters.
                </div>
            )}

            {/* ── Report Content ── */}
            {collective && slips.length > 0 && (
                <div ref={printRef}>

                    {/* Report Title Bar */}
                    <div className="card border-0 shadow-sm mb-4" style={{ background: '#233D4D', borderRadius: 10 }}>
                        <div className="card-body d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 py-3 px-3 px-md-4">
                            <div>
                                <div className="fw-bold fs-5 text-white">
                                    Fee Collection Report {monthLabel} {year}
                                    {classLabel && <span className="ms-2 opacity-75 fs-6">| {classLabel}{secLabel && ` › ${secLabel}`}</span>}
                                </div>
                                <div className="text-white-50 small mt-1">
                                    Generated: {new Date().toLocaleDateString('en-PK', { dateStyle: 'long' })}
                                    {headId && feeHeads.find(h => String(h.head_id) === headId) &&
                                        <> &nbsp;|&nbsp; Head: <strong>{feeHeads.find(h => String(h.head_id) === headId)?.head_name}</strong></>}
                                    {statusFilter && <> &nbsp;|&nbsp; Status: <strong className="text-capitalize">{statusFilter}</strong></>}
                                </div>
                            </div>
                            <button className="btn btn-light btn-sm fw-bold px-3" onClick={handlePrint}>
                                <i className="bi bi-printer me-1" /> Print Report
                            </button>
                        </div>
                    </div>

                    {/* ── 7 Summary Cards ── */}
                    <div className="row g-2 g-md-3 mb-4">
                        {[
                            { label: 'Total Billed', val: `Rs. ${collective.total_billed.toLocaleString()}`, color: '#233D4D', bg: '#eaf0f6', icon: 'bi-receipt' },
                            { label: 'Collected', val: `Rs. ${collective.total_collected.toLocaleString()}`, color: '#198754', bg: '#e8f5ee', icon: 'bi-check-circle-fill' },
                            { label: 'Pending', val: `Rs. ${collective.total_pending.toLocaleString()}`, color: '#dc3545', bg: '#fdecea', icon: 'bi-exclamation-circle-fill' },
                            { label: 'Total Students', val: slips.length, color: '#0d6efd', bg: '#e8eefb', icon: 'bi-people-fill' },
                            { label: 'Paid', val: paidCount, color: '#198754', bg: '#e8f5ee', icon: 'bi-check2-all' },
                            { label: 'Partial', val: partialCount, color: '#fd7e14', bg: '#fff3e0', icon: 'bi-clock-history' },
                            { label: 'Unpaid', val: unpaidCount, color: '#dc3545', bg: '#fdecea', icon: 'bi-x-circle-fill' },
                        ].map(item => (
                            <div key={item.label} className="col-6 col-sm-4 col-md">
                                <div className="card border-0 shadow-sm text-center py-3 px-2 h-100"
                                    style={{ background: item.bg, borderTop: `3px solid ${item.color}` }}>
                                    <i className={`bi ${item.icon} mb-1`} style={{ color: item.color, fontSize: 22 }} />
                                    <div style={{ fontSize: typeof item.val === 'number' ? 26 : 17, fontWeight: 800, color: item.color, lineHeight: 1.2 }}>
                                        {item.val}
                                    </div>
                                    <div className="text-muted" style={{ fontSize: 11, marginTop: 3 }}>{item.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Head-wise Summary table ── */}
                    {headSummary.length > 0 && (
                        <div className="card border-0 shadow-sm mb-4">
                            <div className="card-header bg-white border-bottom py-3" style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                                <h6 className="mb-0 fw-bold">
                                    <i className="bi bi-bar-chart-steps me-2 text-muted" />
                                    Fee Head-wise Summary
                                </h6>
                            </div>
                            <div className="card-body p-0">
                                <table className="table mb-0" style={{ fontSize: 13 }}>
                                    <thead>
                                        <tr>
                                            <th style={{ background: '#233D4D', color: '#fff', padding: '10px 16px', width: 36 }}>#</th>
                                            <th style={{ background: '#233D4D', color: '#fff', padding: '10px 16px' }}>Fee Head</th>
                                            <th style={{ background: '#233D4D', color: '#fff', padding: '10px 16px', textAlign: 'right' }}>Total Billed</th>
                                            <th style={{ background: '#233D4D', color: '#fff', padding: '10px 16px', textAlign: 'right', width: 180 }}>% of Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {headSummary.map((h, i) => (
                                            <tr key={h.head_name} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                                <td style={{ padding: '9px 16px', color: '#aaa', fontSize: 12 }}>{i + 1}</td>
                                                <td style={{ padding: '9px 16px', fontWeight: 600 }}>{h.head_name}</td>
                                                <td style={{ padding: '9px 16px', textAlign: 'right' }}>Rs. {h.total.toLocaleString()}</td>
                                                <td style={{ padding: '9px 16px', textAlign: 'right' }}>
                                                    <div className="d-flex align-items-center justify-content-end gap-2">
                                                        <div style={{ background: '#e9ecef', borderRadius: 6, height: 8, width: 90, overflow: 'hidden' }}>
                                                            <div style={{ background: 'var(--primary-teal)', height: '100%', width: `${Math.round((h.total / collective.total_billed) * 100)}%`, transition: 'width 0.4s' }} />
                                                        </div>
                                                        <span className="fw-semibold" style={{ minWidth: 30 }}>
                                                            {Math.round((h.total / collective.total_billed) * 100)}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: '#eef2f7' }}>
                                            <td colSpan={2} style={{ padding: '10px 16px', fontWeight: 700 }}>Grand Total</td>
                                            <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 800, color: '#233D4D', fontSize: 14 }}>
                                                Rs. {collective.total_billed.toLocaleString()}
                                            </td>
                                            <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>100%</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ── Student-wise Detail Dynamic Head Columns ── */}
                    <div className="card border-0 shadow-sm mb-4">
                        <div className="card-header bg-white border-bottom py-3 d-flex align-items-center justify-content-between"
                            style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                            <h6 className="mb-0 fw-bold">
                                <i className="bi bi-table me-2 text-muted" />
                                Student-wise Fee Detail
                                <span className="badge ms-2" style={{ background: '#eaf0f6', color: '#233D4D', fontWeight: 600 }}>
                                    {slips.length} students
                                </span>
                            </h6>
                            <span className="text-muted small">
                                {uniqueHeads.length} fee head{uniqueHeads.length !== 1 ? 's' : ''} tracked
                            </span>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-hover mb-0" style={{ fontSize: 13, minWidth: 900 }}>
                                    <thead>
                                        <tr>
                                            {['#', 'Adm#', 'Student Name', 'Class', 'Section'].map(h => (
                                                <th key={h} style={{ background: '#233D4D', color: '#fff', padding: '10px 10px', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                            {/* Dynamic head columns one per unique head */}
                                            {uniqueHeads.map(h => (
                                                <th key={h} style={{ background: '#1a4a5e', color: '#fff', padding: '10px 10px', whiteSpace: 'nowrap', textAlign: 'right' }}>{h}</th>
                                            ))}
                                            {['Total Bill', 'Paid', 'Balance'].map(h => (
                                                <th key={h} style={{ background: '#233D4D', color: '#fff', padding: '10px 10px', whiteSpace: 'nowrap', textAlign: 'right' }}>{h}</th>
                                            ))}
                                            <th style={{ background: '#233D4D', color: '#fff', padding: '10px 10px', textAlign: 'center' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {slips.map((s, i) => {
                                            const balance = s.total_amount - s.paid_amount;
                                            const badge = statusBadge(s.status);
                                            return (
                                                <tr key={s.slip_id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                                    <td style={{ padding: '9px 10px', color: '#bbb', fontSize: 12 }}>{i + 1}</td>
                                                    <td style={{ padding: '9px 10px' }}>{s.admission_no}</td>
                                                    <td style={{ padding: '9px 10px', fontWeight: 600 }}>{s.student_name}</td>
                                                    <td style={{ padding: '9px 10px' }}>{s.class_name}</td>
                                                    <td style={{ padding: '9px 10px' }}>{s.section_name}</td>
                                                    {/* One cell per unique head */}
                                                    {uniqueHeads.map(h => {
                                                        const li = s.line_items.find(l => l.head_name === h);
                                                        return (
                                                            <td key={h} style={{ padding: '9px 10px', textAlign: 'right', color: li ? '#233D4D' : '#ccc' }}>
                                                                {li ? `Rs. ${li.amount.toLocaleString()}` : '—'}
                                                            </td>
                                                        );
                                                    })}
                                                    <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600 }}>Rs. {s.total_amount.toLocaleString()}</td>
                                                    <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600, color: '#198754' }}>Rs. {s.paid_amount.toLocaleString()}</td>
                                                    <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600, color: balance > 0 ? '#dc3545' : '#198754' }}>
                                                        Rs. {balance.toLocaleString()}
                                                    </td>
                                                    <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                                                        <span className="badge" style={{ background: badge.bg, color: '#fff', padding: '4px 10px', borderRadius: 12, fontSize: 11 }}>
                                                            {badge.label}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: '#eef2f7' }}>
                                            <td colSpan={5} style={{ padding: '11px 10px', fontWeight: 800, fontSize: 13 }}>
                                                TOTAL ({slips.length} students)
                                            </td>
                                            {uniqueHeads.map(h => (
                                                <td key={h} style={{ padding: '11px 10px', textAlign: 'right', fontWeight: 700, color: '#233D4D' }}>
                                                    Rs. {(headTotals[h] || 0).toLocaleString()}
                                                </td>
                                            ))}
                                            <td style={{ padding: '11px 10px', textAlign: 'right', fontWeight: 800, color: '#233D4D' }}>
                                                Rs. {collective.total_billed.toLocaleString()}
                                            </td>
                                            <td style={{ padding: '11px 10px', textAlign: 'right', fontWeight: 800, color: '#198754' }}>
                                                Rs. {collective.total_collected.toLocaleString()}
                                            </td>
                                            <td style={{ padding: '11px 10px', textAlign: 'right', fontWeight: 800, color: '#dc3545' }}>
                                                Rs. {collective.total_pending.toLocaleString()}
                                            </td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
