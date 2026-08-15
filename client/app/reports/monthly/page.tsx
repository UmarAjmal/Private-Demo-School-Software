'use client';
import { useState, useEffect } from 'react';
import { notify } from '@/app/utils/notify';
import { useAuth } from '@/contexts/AuthContext';

const API = process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com";

const MONTHS = [
    { num: 1, name: 'January' }, { num: 2, name: 'February' }, { num: 3, name: 'March' },
    { num: 4, name: 'April' }, { num: 5, name: 'May' }, { num: 6, name: 'June' },
    { num: 7, name: 'July' }, { num: 8, name: 'August' }, { num: 9, name: 'September' },
    { num: 10, name: 'October' }, { num: 11, name: 'November' }, { num: 12, name: 'December' }
];

function fmtPKR(val: number) {
    return `PKR ${Number(val || 0).toLocaleString('en-PK')}`;
}

interface AvailableMonth {
    value: string;
    label: string;
    months: number[];
}

export default function MonthlyReportPage() {
    const { hasPermission } = useAuth();

    // Filters
    const now = new Date();
    const [month, setMonth] = useState<string>('');
    const [year, setYear] = useState<string>(now.getFullYear().toString());
    const [classId, setClassId] = useState<string>('');
    const [sectionId, setSectionId] = useState<string>('');
    const [statusTab, setStatusTab] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
    const [searchKeyword, setSearchKeyword] = useState<string>('');

    // Data
    const [classes, setClasses] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [availableMonths, setAvailableMonths] = useState<AvailableMonth[]>([]);
    const [loadingMonths, setLoadingMonths] = useState<boolean>(true);
    const [reportData, setReportData] = useState<{ summary: any; families: any[] } | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [schoolInfo, setSchoolInfo] = useState<{ name: string; address: string; phone: string; logo: string }>({
        name: 'Falcon School System', address: '', phone: '', logo: ''
    });

    useEffect(() => {
        // Fetch classes
        fetch(`${API}/academic`).then(r => r.json()).then(setClasses).catch(() => { });
        // Fetch school info
        fetch(`${API}/settings`).then(r => r.json()).then((data: any) => {
            if (data && typeof data === 'object') {
                setSchoolInfo({
                    name: data.school_name || 'Falcon School System',
                    address: data.address || '',
                    phone: data.contact_number || '',
                    logo: data.logo_url ? `${API}${data.logo_url}` : ''
                });
            }
        }).catch(() => { });
    }, []);

    useEffect(() => {
        setLoadingMonths(true);
        fetch(`${API}/fee-slips/available-months?year=${year}`)
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
                        setReportData(null);
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
        if (classId) {
            fetch(`${API}/academic/sections`).then(r => r.json()).then((allSecs: any[]) => {
                setSections(allSecs.filter((s: any) => s.class_id === Number(classId)));
            }).catch(() => setSections([]));
        } else {
            setSections([]);
            setSectionId('');
        }
    }, [classId]);

    const fetchReport = async () => {
        if (!month || !year) {
            setReportData(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const params = new URLSearchParams({
                month: month,
                year: year
            });
            if (classId) params.append('class_id', classId);
            if (sectionId) params.append('section_id', sectionId);

            const res = await fetch(`${API}/reports/monthly-tuition?${params.toString()}`);
            const data = await res.json();

            if (res.ok) {
                setReportData(data);
            } else {
                notify.error(data.error || 'Failed to load report data');
            }
        } catch (e: any) {
            console.error(e);
            notify.error('Network error loading monthly report');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [month, year, classId, sectionId]);

    // Filter families based on tab and keyword
    const filteredFamilies = (reportData?.families || []).filter(f => {
        if (statusTab !== 'all' && f.payment_status !== statusTab) return false;
        if (searchKeyword.trim()) {
            const q = searchKeyword.toLowerCase().trim();
            const name = (f.student_name || '').toLowerCase();
            const father = (f.father_name || '').toLowerCase();
            const fam = (f.family_id || '').toLowerCase();
            const adm = (f.admission_no || '').toLowerCase();
            return name.includes(q) || father.includes(q) || fam.includes(q) || adm.includes(q);
        }
        return true;
    });

    const currentSelMonth = availableMonths.find(m => m.value === month);
    const monthName = currentSelMonth
        ? currentSelMonth.label
        : (month ? month : 'No Fee Slips');

    const summary = reportData?.summary || {
        total_billed: 0, total_collected: 0, total_remaining: 0, total_expenses: 0,
        expected_surplus: 0, net_cash_balance: 0, collection_rate: 0,
        total_families_count: 0, paid_count: 0, partial_count: 0, unpaid_count: 0
    };

    // Export PDF
    const doExportPDF = () => {
        const win = window.open('', '_blank');
        if (!win) { notify.error('Popup blocked please allow popups to print.'); return; }

        const rowsHtml = filteredFamilies.map((f, idx) => `
            <tr>
                <td style="text-align:center;padding:7px;border-bottom:1px solid #e2e8f0;">${idx + 1}</td>
                <td style="padding:7px;font-weight:700;color:#0f766e;border-bottom:1px solid #e2e8f0;">${f.family_id || '—'}</td>
                <td style="padding:7px;border-bottom:1px solid #e2e8f0;">
                    <div style="font-weight:700;color:#1e293b;">${f.student_name}</div>
                    <div style="font-size:9px;color:#64748b;">Father: ${f.father_name || '—'} ${f.father_phone ? '(' + f.father_phone + ')' : ''}</div>
                </td>
                <td style="padding:7px;border-bottom:1px solid #e2e8f0;font-weight:600;">${f.class_name || '—'} - ${f.section_name || '—'}</td>
                <td style="text-align:right;padding:7px;font-weight:700;color:#1e293b;border-bottom:1px solid #e2e8f0;">${fmtPKR(f.tuition_billed)}</td>
                <td style="text-align:right;padding:7px;color:#16a34a;font-weight:700;border-bottom:1px solid #e2e8f0;">${fmtPKR(f.tuition_paid)}</td>
                <td style="text-align:right;padding:7px;color:${f.tuition_remaining > 0 ? '#dc2626' : '#16a34a'};font-weight:800;border-bottom:1px solid #e2e8f0;">${fmtPKR(f.tuition_remaining)}</td>
                <td style="text-align:center;padding:7px;border-bottom:1px solid #e2e8f0;">
                    <span style="padding:3px 10px;border-radius:20px;font-size:9px;font-weight:800;letter-spacing:0.04em;background:${f.payment_status === 'paid' ? '#dcfce7;color:#15803d;border:1px solid #bbf7d0' :
                f.payment_status === 'partial' ? '#ffedd5;color:#c2410c;border:1px solid #fed7aa' : '#fee2e2;color:#b91c1c;border:1px solid #fca5a5'
            };">
                        ${f.payment_status.toUpperCase()}
                    </span>
                </td>
            </tr>
        `).join('');

        win.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8"/>
                <title>Monthly Fee & Financial Report - ${monthName} ${year}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; margin: 15px; color: #1e293b; line-height: 1.4; }
                    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #0f766e; padding-bottom: 12px; margin-bottom: 15px; }
                    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
                    .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
                    .stat-label { font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 3px; letter-spacing: 0.05em; }
                    .stat-val { font-size: 15px; font-weight: 800; color: #0f172a; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th { background: #1e293b; color: #fff; padding: 8px 7px; font-size: 10px; text-transform: uppercase; text-align: left; letter-spacing: 0.05em; }
                    @media print { @page { margin: 8mm; size: A4 portrait; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        ${schoolInfo.logo ? `<img src="${schoolInfo.logo}" height="48" style="margin-bottom:6px;display:block;" />` : ''}
                        <div style="font-size:18px;font-weight:900;color:#0f766e;letter-spacing:-0.5px;">${schoolInfo.name}</div>
                        <div style="font-size:10px;color:#64748b;margin-top:2px;">${schoolInfo.address} ${schoolInfo.phone ? ' | Ph: ' + schoolInfo.phone : ''}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:16px;font-weight:900;color:#1e293b;letter-spacing:-0.3px;">MONTHLY TUITION &amp; FINANCIAL REPORT</div>
                        <div style="font-size:13px;font-weight:800;color:#0f766e;margin-top:2px;">Period: ${monthName} ${year}</div>
                        <div style="font-size:9px;color:#94a3b8;margin-top:4px;">Generated: ${new Date().toLocaleString()}</div>
                    </div>
                </div>

                <div class="stats-grid">
                    <div class="stat-card" style="border-left:4px solid #0f766e;">
                        <div class="stat-label">Total Tuition Billed</div>
                        <div class="stat-val">${fmtPKR(summary.total_billed)}</div>
                    </div>
                    <div class="stat-card" style="border-left:4px solid #16a34a;">
                        <div class="stat-label">Tuition Collected</div>
                        <div class="stat-val" style="color:#16a34a;">${fmtPKR(summary.total_collected)}</div>
                        <div style="font-size:9px;color:#15803d;font-weight:700;">Rate: ${summary.collection_rate}%</div>
                    </div>
                    <div class="stat-card" style="border-left:4px solid #dc2626;">
                        <div class="stat-label">Remaining Dues</div>
                        <div class="stat-val" style="color:#dc2626;">${fmtPKR(summary.total_remaining)}</div>
                    </div>
                    <div class="stat-card" style="border-left:4px solid #ea580c;">
                        <div class="stat-label">Monthly Expenses</div>
                        <div class="stat-val" style="color:#ea580c;">${fmtPKR(summary.total_expenses)}</div>
                    </div>
                </div>

                <div style="display:flex;gap:12px;margin-bottom:15px;background:#f1f5f9;padding:12px;border-radius:10px;border:1px solid #cbd5e1;">
                    <div style="flex:1;">
                        <span style="font-size:9px;font-weight:700;color:#475569;text-transform:uppercase;">Expected Operating Surplus (Billed - Expenses):</span>
                        <span style="font-size:14px;font-weight:900;color:${summary.expected_surplus >= 0 ? '#0f766e' : '#dc2626'};margin-left:8px;">
                            ${fmtPKR(summary.expected_surplus)}
                        </span>
                    </div>
                    <div style="flex:1;">
                        <span style="font-size:9px;font-weight:700;color:#475569;text-transform:uppercase;">Net Realized Cash Balance (Collected - Expenses):</span>
                        <span style="font-size:14px;font-weight:900;color:${summary.net_cash_balance >= 0 ? '#16a34a' : '#dc2626'};margin-left:8px;">
                            ${fmtPKR(summary.net_cash_balance)}
                        </span>
                    </div>
                </div>

                <h3 style="font-size:11px;font-weight:800;color:#1e293b;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;">
                    Family Tuition Fee Status Breakdown (${filteredFamilies.length} Records)
                </h3>
                <table>
                    <thead>
                        <tr>
                            <th style="width:30px;text-align:center;">#</th>
                            <th>Family ID</th>
                            <th>Student &amp; Father Details</th>
                            <th>Class &amp; Sec</th>
                            <th style="text-align:right;">Tuition Billed</th>
                            <th style="text-align:right;">Tuition Paid</th>
                            <th style="text-align:right;">Remaining Dues</th>
                            <th style="text-align:center;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml || '<tr><td colspan="8" style="text-align:center;padding:20px;color:#94a3b8;">No records found for selected filters</td></tr>'}
                    </tbody>
                </table>
            </body>
            </html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); }, 500);
    };

    // Export Excel
    const doExportExcel = () => {
        const ths = ['#', 'Family ID', 'Student Name', 'Father Name', 'Father Phone', 'Class', 'Section', 'Tuition Billed', 'Tuition Paid', 'Remaining Dues', 'Status']
            .map(h => `<th style="background:#0f766e;color:#fff;padding:8px;font-size:11px">${h}</th>`).join('');

        const trs = filteredFamilies.map((f, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${f.family_id || ''}</td>
                <td>${f.student_name || ''}</td>
                <td>${f.father_name || ''}</td>
                <td>${f.father_phone || ''}</td>
                <td>${f.class_name || ''}</td>
                <td>${f.section_name || ''}</td>
                <td>${f.tuition_billed}</td>
                <td>${f.tuition_paid}</td>
                <td>${f.tuition_remaining}</td>
                <td>${f.payment_status.toUpperCase()}</td>
            </tr>
        `).join('');

        const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/></head><body><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></body></html>`;
        const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: `Monthly-Tuition-Report-${monthName}-${year}.xls` });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Export CSV
    const doExportCSV = () => {
        const headers = ['#', 'Family ID', 'Student Name', 'Father Name', 'Father Phone', 'Class', 'Section', 'Tuition Billed', 'Tuition Paid', 'Remaining Dues', 'Status'];
        const rows = filteredFamilies.map((f, i) => [
            i + 1, f.family_id || '', f.student_name || '', f.father_name || '', f.father_phone || '',
            f.class_name || '', f.section_name || '', f.tuition_billed, f.tuition_paid, f.tuition_remaining, f.payment_status.toUpperCase()
        ]);
        const esc = (v: any) => `"${String(v).replace(/"/g, '""')}"`;
        const lines = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))];
        const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: `Monthly-Tuition-Report-${monthName}-${year}.csv` });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="container-fluid p-2 p-md-4 bg-light min-vh-100">
            {/* Header Banner - Executive Gradient & Fully Responsive */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-stretch align-items-md-center gap-3 mb-4 p-3 p-md-4 rounded-4 shadow-lg position-relative overflow-hidden"
                style={{
                    background: 'linear-gradient(135deg, #1b2e3b 0%, #0f766e 60%, #047857 100%)',
                    color: 'white',
                    borderLeft: '5px solid #14b8a6'
                }}>
                <div style={{ position: 'relative', zIndex: 2 }}>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="badge px-2.5 py-1 rounded-pill" style={{ background: 'rgba(255,255,255,0.15)', color: '#5eead4', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em' }}>
                            <i className="bi bi-shield-check me-1"></i>EXECUTIVE FINANCIAL AUDIT
                        </span>
                    </div>
                    <h2 className="mb-1 fw-black text-white" style={{ letterSpacing: '-0.8px', fontSize: 'clamp(1.2rem, 2.5vw, 1.75rem)' }}>
                        Monthly Tuition &amp; Expense Financial Report
                    </h2>
                    <p className="text-white-50 mb-0 small" style={{ fontSize: 'clamp(11px, 1.8vw, 13px)' }}>
                        Comprehensive Cash Flow, Operating Surplus &amp; Family Fee Analysis for <strong>{monthName} {year}</strong>
                    </p>
                </div>

                <div className="d-flex flex-wrap gap-2 justify-content-start justify-content-md-end" style={{ position: 'relative', zIndex: 2 }}>
                    <button className="btn btn-sm text-white border-0 d-flex align-items-center gap-1 shadow-sm px-3 py-2 flex-grow-1 flex-md-grow-0 justify-content-center"
                        onClick={doExportPDF} title="Export PDF Report"
                        style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', borderRadius: 10, transition: 'all 0.2s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.25)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'; }}>
                        <i className="bi bi-file-earmark-pdf-fill text-danger fs-6"></i>
                        <span className="fw-semibold">PDF Report</span>
                    </button>
                    <button className="btn btn-sm text-white border-0 d-flex align-items-center gap-1 shadow-sm px-3 py-2 flex-grow-1 flex-md-grow-0 justify-content-center"
                        onClick={doExportExcel} title="Export Excel"
                        style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', borderRadius: 10, transition: 'all 0.2s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.25)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'; }}>
                        <i className="bi bi-file-earmark-spreadsheet-fill text-success fs-6"></i>
                        <span className="fw-semibold">Excel</span>
                    </button>
                    <button className="btn btn-sm text-white border-0 d-flex align-items-center gap-1 shadow-sm px-3 py-2 flex-grow-1 flex-md-grow-0 justify-content-center"
                        onClick={doExportCSV} title="Export CSV"
                        style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', borderRadius: 10, transition: 'all 0.2s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.25)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'; }}>
                        <i className="bi bi-filetype-csv text-info fs-6"></i>
                        <span className="fw-semibold">CSV</span>
                    </button>
                </div>
            </div>

            {/* Smart Filter Bar - Mobile Grid Optimized */}
            <div className="card shadow-sm border-0 rounded-4 mb-4" style={{ background: '#ffffff', border: '1px solid #f1f5f9' }}>
                <div className="card-body p-3">
                    <div className="row g-2 g-md-3 align-items-center">
                        <div className="col-6 col-sm-4 col-md-2">
                            <label className="form-label small text-muted text-uppercase fw-bold mb-1" style={{ fontSize: 10, letterSpacing: '0.05em' }}>
                                <i className="bi bi-calendar3 me-1 text-primary"></i>Month
                            </label>
                            <select className="form-select form-select-sm fw-bold border-0 bg-light rounded-3"
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
                        <div className="col-6 col-sm-4 col-md-2">
                            <label className="form-label small text-muted text-uppercase fw-bold mb-1" style={{ fontSize: 10, letterSpacing: '0.05em' }}>
                                <i className="bi bi-calendar-event me-1 text-primary"></i>Year
                            </label>
                            <select className="form-select form-select-sm fw-bold border-0 bg-light rounded-3" value={year} onChange={e => setYear(e.target.value)}>
                                {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-4 col-md-3">
                            <label className="form-label small text-muted text-uppercase fw-bold mb-1" style={{ fontSize: 10, letterSpacing: '0.05em' }}>
                                <i className="bi bi-building me-1 text-primary"></i>Class Filter
                            </label>
                            <select className="form-select form-select-sm border-0 bg-light rounded-3" value={classId} onChange={e => setClassId(e.target.value)}>
                                <option value="">All Classes</option>
                                {classes.map((c: any) => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-md-2">
                            <label className="form-label small text-muted text-uppercase fw-bold mb-1" style={{ fontSize: 10, letterSpacing: '0.05em' }}>
                                <i className="bi bi-diagram-3 me-1 text-primary"></i>Section
                            </label>
                            <select className="form-select form-select-sm border-0 bg-light rounded-3" value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={!classId}>
                                <option value="">All Sections</option>
                                {sections.map((s: any) => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-md-3 ms-auto">
                            <label className="form-label small text-muted text-uppercase fw-bold mb-1 d-block" style={{ fontSize: 10, letterSpacing: '0.05em' }}>
                                Instant Search
                            </label>
                            <div className="input-group input-group-sm">
                                <span className="input-group-text bg-light border-0"><i className="bi bi-search text-muted"></i></span>
                                <input type="text" className="form-control border-0 bg-light" placeholder="Search student / father / ID..."
                                    value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} />
                                {searchKeyword && (
                                    <button className="btn btn-light border-0" onClick={() => setSearchKeyword('')}><i className="bi bi-x text-danger"></i></button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Financial Summary Cards - 2 Grid per row on Mobile */}
            <div className="row g-2 g-md-3 mb-4">
                {/* 1. Billed Tuition */}
                <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 rounded-4 h-100 p-2.5 p-md-3 bg-white" style={{ borderLeft: '4px solid #0f766e' }}>
                        <div className="d-flex justify-content-between align-items-center mb-1 mb-md-2">
                            <span className="text-muted small text-uppercase fw-bold text-truncate" style={{ fontSize: 9, letterSpacing: '0.05em' }}>Tuition Billed</span>
                            <div className="rounded-3 p-1.5 p-md-2" style={{ backgroundColor: 'rgba(15,118,110,0.1)', color: '#0f766e' }}>
                                <i className="bi bi-piggy-bank-fill fs-6 fs-md-5"></i>
                            </div>
                        </div>
                        <h3 className="fw-black mb-1 text-dark" style={{ letterSpacing: '-0.5px', fontSize: 'clamp(1rem, 2.2vw, 1.5rem)' }}>{fmtPKR(summary.total_billed)}</h3>
                        <span className="text-muted small d-none d-sm-inline" style={{ fontSize: 11 }}>Expected Tuition Revenue</span>
                    </div>
                </div>

                {/* 2. Collected Tuition */}
                <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 rounded-4 h-100 p-2.5 p-md-3 bg-white" style={{ borderLeft: '4px solid #16a34a' }}>
                        <div className="d-flex justify-content-between align-items-center mb-1 mb-md-2">
                            <span className="text-muted small text-uppercase fw-bold text-truncate" style={{ fontSize: 9, letterSpacing: '0.05em' }}>Tuition Collected</span>
                            <div className="rounded-3 p-1.5 p-md-2" style={{ backgroundColor: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                                <i className="bi bi-cash-coin fs-6 fs-md-5"></i>
                            </div>
                        </div>
                        <h3 className="fw-black mb-1 text-success" style={{ letterSpacing: '-0.5px', fontSize: 'clamp(1rem, 2.2vw, 1.5rem)' }}>{fmtPKR(summary.total_collected)}</h3>
                        <div className="d-flex align-items-center gap-1.5 mt-1">
                            <div className="progress flex-grow-1" style={{ height: 5, borderRadius: 10, background: '#e2e8f0' }}>
                                <div className="progress-bar bg-success rounded-pill" role="progressbar" style={{ width: `${Math.min(100, summary.collection_rate)}%` }}></div>
                            </div>
                            <span className="badge bg-success bg-opacity-10 text-success fw-bold" style={{ fontSize: 9 }}>
                                {summary.collection_rate}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3. Remaining Dues */}
                <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 rounded-4 h-100 p-2.5 p-md-3 bg-white" style={{ borderLeft: '4px solid #dc2626' }}>
                        <div className="d-flex justify-content-between align-items-center mb-1 mb-md-2">
                            <span className="text-muted small text-uppercase fw-bold text-truncate" style={{ fontSize: 9, letterSpacing: '0.05em' }}>Remaining Dues</span>
                            <div className="rounded-3 p-1.5 p-md-2" style={{ backgroundColor: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
                                <i className="bi bi-exclamation-octagon-fill fs-6 fs-md-5"></i>
                            </div>
                        </div>
                        <h3 className="fw-black mb-1 text-danger" style={{ letterSpacing: '-0.5px', fontSize: 'clamp(1rem, 2.2vw, 1.5rem)' }}>{fmtPKR(summary.total_remaining)}</h3>
                        <span className="text-muted small d-none d-sm-inline" style={{ fontSize: 11 }}>Uncollected Tuition Balance</span>
                    </div>
                </div>

                {/* 4. Monthly Expenses */}
                <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 rounded-4 h-100 p-2.5 p-md-3 bg-white" style={{ borderLeft: '4px solid #ea580c' }}>
                        <div className="d-flex justify-content-between align-items-center mb-1 mb-md-2">
                            <span className="text-muted small text-uppercase fw-bold text-truncate" style={{ fontSize: 9, letterSpacing: '0.05em' }}>Monthly Expenses</span>
                            <div className="rounded-3 p-1.5 p-md-2" style={{ backgroundColor: 'rgba(234,88,12,0.1)', color: '#ea580c' }}>
                                <i className="bi bi-receipt-cutoff fs-6 fs-md-5"></i>
                            </div>
                        </div>
                        <h3 className="fw-black mb-1" style={{ color: '#ea580c', letterSpacing: '-0.5px', fontSize: 'clamp(1rem, 2.2vw, 1.5rem)' }}>{fmtPKR(summary.total_expenses)}</h3>
                        <span className="text-muted small d-none d-sm-inline" style={{ fontSize: 11 }}>Total Month Expenses</span>
                    </div>
                </div>
            </div>

            {/* Net Surplus & Realized Cash Row */}
            <div className="row g-2 g-md-3 mb-4">
                <div className="col-12 col-md-6">
                    <div className="card shadow-sm border-0 rounded-4 p-3 bg-white h-100" style={{ borderLeft: '5px solid #0284c7', background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)' }}>
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <span className="text-uppercase fw-bold small text-muted d-block" style={{ fontSize: 9, letterSpacing: '0.06em' }}>
                                    Expected Operating Surplus (Billed Tuition - Expenses)
                                </span>
                                <h3 className="fw-black mb-0 mt-1" style={{ color: summary.expected_surplus >= 0 ? '#0284c7' : '#dc2626', letterSpacing: '-0.5px', fontSize: 'clamp(1.1rem, 2.2vw, 1.6rem)' }}>
                                    {fmtPKR(summary.expected_surplus)}
                                </h3>
                            </div>
                            <div className="rounded-circle p-2.5 p-md-3 flex-shrink-0" style={{ background: 'rgba(2,132,199,0.1)', color: '#0284c7' }}>
                                <i className="bi bi-graph-up-arrow fs-5 fs-md-4"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-md-6">
                    <div className="card shadow-sm border-0 rounded-4 p-3 bg-white h-100"
                        style={{
                            borderLeft: `5px solid ${summary.net_cash_balance >= 0 ? '#16a34a' : '#dc2626'}`,
                            background: summary.net_cash_balance >= 0 ? 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)' : 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)'
                        }}>
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                    <span className="text-uppercase fw-bold small text-muted" style={{ fontSize: 9, letterSpacing: '0.06em' }}>
                                        Net Realized Cash Balance (Collected Tuition - Expenses)
                                    </span>
                                    <span className={`badge rounded-pill ${summary.net_cash_balance >= 0 ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: 8 }}>
                                        {summary.net_cash_balance >= 0 ? 'SURPLUS' : 'DEFICIT'}
                                    </span>
                                </div>
                                <h3 className="fw-black mb-0 mt-1" style={{ color: summary.net_cash_balance >= 0 ? '#16a34a' : '#dc2626', letterSpacing: '-0.5px', fontSize: 'clamp(1.1rem, 2.2vw, 1.6rem)' }}>
                                    {fmtPKR(summary.net_cash_balance)}
                                </h3>
                            </div>
                            <div className="rounded-circle p-2.5 p-md-3 flex-shrink-0" style={{
                                background: summary.net_cash_balance >= 0 ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                                color: summary.net_cash_balance >= 0 ? '#16a34a' : '#dc2626'
                            }}>
                                <i className="bi bi-wallet2 fs-5 fs-md-4"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Family Table Card */}
            <div className="card shadow-lg border-0 rounded-4 overflow-hidden bg-white">
                <div className="card-header bg-white p-2.5 p-md-3 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2">
                    {/* Status Tabs - Wrapping flex grid for mobile */}
                    <div className="d-flex flex-wrap gap-1 p-1 bg-light rounded-3" role="group" style={{ border: '1px solid #e2e8f0', width: 'fit-content' }}>
                        <button type="button" className={`btn btn-sm rounded-2 fw-semibold px-2.5 py-1 ${statusTab === 'all' ? 'btn-primary text-white shadow-sm' : 'btn-light text-muted'}`}
                            style={{ fontSize: 11 }}
                            onClick={() => setStatusTab('all')}>
                            All ({summary.total_families_count})
                        </button>
                        <button type="button" className={`btn btn-sm rounded-2 fw-semibold px-2.5 py-1 ${statusTab === 'paid' ? 'btn-success text-white shadow-sm' : 'btn-light text-muted'}`}
                            style={{ fontSize: 11 }}
                            onClick={() => setStatusTab('paid')}>
                            Fully Paid ({summary.paid_count})
                        </button>
                        <button type="button" className={`btn btn-sm rounded-2 fw-semibold px-2.5 py-1 ${statusTab === 'partial' ? 'btn-warning text-dark shadow-sm' : 'btn-light text-muted'}`}
                            style={{ fontSize: 11 }}
                            onClick={() => setStatusTab('partial')}>
                            Partial ({summary.partial_count})
                        </button>
                        <button type="button" className={`btn btn-sm rounded-2 fw-semibold px-2.5 py-1 ${statusTab === 'unpaid' ? 'btn-danger text-white shadow-sm' : 'btn-light text-muted'}`}
                            style={{ fontSize: 11 }}
                            onClick={() => setStatusTab('unpaid')}>
                            Unpaid Dues ({summary.unpaid_count})
                        </button>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-light text-dark border px-2.5 py-1.5 rounded-pill fw-semibold" style={{ fontSize: 11 }}>
                            Showing {filteredFamilies.length} Records
                        </span>
                    </div>
                </div>

                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center p-5">
                            <div className="spinner-border text-teal" role="status" style={{ color: '#0f766e' }}></div>
                            <p className="text-muted mt-2 small fw-semibold">Computing financial calculations...</p>
                        </div>
                    ) : filteredFamilies.length === 0 ? (
                        <div className="text-center p-5 text-muted">
                            <i className="bi bi-inbox fs-1 d-block mb-2 opacity-50"></i>
                            No tuition fee records found for {monthName} {year} with the selected filters.
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0" style={{ fontSize: 12.5, minWidth: 680 }}>
                                <thead className="text-uppercase small" style={{ backgroundColor: '#1b2e3b', color: '#ffffff' }}>
                                    <tr>
                                        <th className="ps-3" style={{ width: 35, padding: '10px 12px' }}>#</th>
                                        <th style={{ padding: '10px 12px' }}>Family ID</th>
                                        <th style={{ padding: '10px 12px' }}>Student &amp; Father Details</th>
                                        <th style={{ padding: '10px 12px' }}>Class &amp; Section</th>
                                        <th className="text-end" style={{ padding: '10px 12px' }}>Tuition Billed</th>
                                        <th className="text-end" style={{ padding: '10px 12px' }}>Tuition Paid</th>
                                        <th className="text-end" style={{ padding: '10px 12px' }}>Remaining Dues</th>
                                        <th className="text-center pe-3" style={{ padding: '10px 12px' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredFamilies.map((f, i) => (
                                        <tr key={f.slip_id || i} style={{ transition: 'background 0.15s' }}>
                                            <td className="ps-3 text-muted small fw-semibold">{i + 1}</td>
                                            <td>
                                                <span className="badge bg-light text-primary border fw-semibold" style={{ fontSize: 10.5 }}>
                                                    {f.family_id || '—'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="rounded-circle bg-teal text-white d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                                                        style={{ width: 30, height: 30, fontSize: 11, background: 'linear-gradient(135deg, #0f766e, #047857)' }}>
                                                        {(f.student_name || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="fw-bold text-dark" style={{ fontSize: 13 }}>{f.student_name}</div>
                                                        <div className="text-muted" style={{ fontSize: 10.5 }}>
                                                            Father: {f.father_name || '—'} {f.father_phone ? `(${f.father_phone})` : ''}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="fw-bold text-dark">{f.class_name || '—'}</span>
                                                <span className="text-muted ms-1">({f.section_name || '—'})</span>
                                            </td>
                                            <td className="text-end fw-semibold text-dark">
                                                {fmtPKR(f.tuition_billed)}
                                            </td>
                                            <td className="text-end fw-bold text-success">
                                                {fmtPKR(f.tuition_paid)}
                                            </td>
                                            <td className={`text-end fw-black ${f.tuition_remaining > 0 ? 'text-danger' : 'text-success'}`}>
                                                {fmtPKR(f.tuition_remaining)}
                                            </td>
                                            <td className="text-center pe-3">
                                                <span className={`badge rounded-pill px-2.5 py-1 ${f.payment_status === 'paid' ? 'bg-success bg-opacity-15 text-success border border-success' :
                                                    f.payment_status === 'partial' ? 'bg-warning bg-opacity-15 text-warning-emphasis border border-warning' : 'bg-danger bg-opacity-15 text-danger border border-danger'
                                                    }`} style={{ fontSize: 9.5, fontWeight: 700 }}>
                                                    {f.payment_status === 'paid' ? 'FULLY PAID' :
                                                        f.payment_status === 'partial' ? 'PARTIAL' : 'UNPAID DUES'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="card-footer bg-light p-3 text-center border-top">
                    <span className="text-muted small fw-semibold">
                        Falcon School System • Monthly Financial Audit Report • {monthName} {year}
                    </span>
                </div>
            </div>
        </div>
    );
}
