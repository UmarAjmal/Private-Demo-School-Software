'use client';
import React, { useState, useEffect } from 'react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const API = process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com";

interface SlipData {
    slip_id: number; student_id: number; family_id: string; class_id: number;
    total_amount: number; paid_amount: number; status: string; due_date: string; issue_date?: string;
    is_printed: boolean; printed_at: string;
    first_name: string; last_name: string; admission_no: string; monthly_fee: number; father_name: string;
    class_name: string; c_class_id: number;
    line_items: { item_id: number; head_name: string; amount: number; note?: string }[];
}
interface Voucher {
    voucher_type: 'individual' | 'family';
    primary: SlipData; siblings: SlipData[];
    family_id: string | null; total_family_amount: number; total_paid: number;
    is_printed: boolean; partial_printed?: boolean; slip_ids: number[];
    family_members?: { student_id: number; first_name: string; last_name: string; father_name: string; class_name: string; class_id: number; section_name?: string }[];
}
interface SchoolInfo {
    school_name: string; school_address: string; phone_number: string;
    school_phone2: string; school_phone3: string; school_logo_url: string;
}

function fmtAmt(n: number) { return `${Number(n || 0).toLocaleString('en-PK')}/-`; }
function fmtDate(d: string | Date | null) {
    if (!d) return '--';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function zeroPad(n: number, digits = 6) { return String(n).padStart(digits, '0'); }

/* ============================================================================
   PREVIOUS VOUCHER DESIGN (PRESERVED IN COMMENTS)
   ============================================================================
function OldVoucherSlip({ v, serial, month, year, school, filterClassId }: { v: Voucher; serial: number; month: string; year: string; school: SchoolInfo; filterClassId?: string }) {
    const mIdx = parseInt(month) - 1;
    const monthName = MONTHS[mIdx] || '';
    const voucherNo = `${MONTH_SHORT[mIdx] || 'FEE'}${zeroPad(serial)}`;
    const dueDate = v.primary.due_date ? fmtDate(v.primary.due_date) : '--';
    const allStudents: SlipData[] = [v.primary, ...v.siblings];

    const feeRows: { sr: number; desc: string; amount: number }[] = [];
    let sr = 1;
    for (const item of (v.primary.line_items || [])) {
        const displayName = item.head_name.replace('Family Monthly Fee', 'Monthly Fee');
        feeRows.push({ sr: sr++, desc: `${displayName} (${monthName})`, amount: parseFloat(item.amount as any) });
    }
    const totalPaid = parseFloat(v.total_paid as any) || 0;
    if (totalPaid > 0) feeRows.push({ sr: sr++, desc: 'Amount Already Paid', amount: -totalPaid });
    const grandTotal = parseFloat(v.total_family_amount as any) - totalPaid;

    type StudentRow = { first_name: string; last_name: string; father_name?: string; class_name?: string; section_name?: string } | null;
    let membersSource = v.family_members && v.family_members.length > 0
        ? [...v.family_members]
        : allStudents.map(s => ({ ...s, class_id: s.c_class_id }));
    if (filterClassId && v.voucher_type === 'family') {
        membersSource.sort((a, b) => {
            const aMatch = (a as any).class_id?.toString() === filterClassId ? 0 : 1;
            const bMatch = (b as any).class_id?.toString() === filterClassId ? 0 : 1;
            return aMatch - bMatch;
        });
    }
    const baseStudents: StudentRow[] = membersSource.map(m => ({
        first_name: m.first_name,
        last_name: m.last_name,
        father_name: (m as any).father_name,
        class_name: (m as any).class_name,
        section_name: (m as any).section_name
    }));
    const studentRows: StudentRow[] = [...baseStudents];
    while (studentRows.length < 9) studentRows.push(null);

    const td = (extra?: React.CSSProperties): React.CSSProperties => ({ border: '1px solid #000', padding: '0.5mm 1mm', lineHeight: 1, ...extra });
    const th = (extra?: React.CSSProperties): React.CSSProperties => ({ border: '1px solid #000', padding: '0.5mm 1mm', fontWeight: 'bold', backgroundColor: '#f0f0f0', ...extra });

    return (
        <div style={{ width: '91mm', height: '185mm', border: '1px solid #000', padding: '4mm 5mm', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', flexShrink: 0, fontFamily: 'Arial, sans-serif', overflow: 'hidden', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2mm' }}>
                {school.school_logo_url
                    ? <img src={school.school_logo_url} alt="logo" style={{ width: '20mm', height: '20mm', objectFit: 'contain', marginRight: '3mm', flexShrink: 0 }} />
                    : <div style={{ width: '20mm', height: '20mm', backgroundColor: '#007bff', marginRight: '3mm', flexShrink: 0 }} />}
                <div style={{ fontSize: '11pt', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2, color: '#000' }}>{school.school_name}</div>
            </div>
            <div style={{ fontSize: '9pt', textAlign: 'center', width: '100%' }}>{school.school_address}</div>
            <div style={{ fontSize: '9pt', textAlign: 'center', marginTop: '1mm', marginBottom: '2mm', whiteSpace: 'nowrap' }}>
                {[school.phone_number, school.school_phone2, school.school_phone3].filter(Boolean).join(' ; ')}
            </div>
            <div style={{ borderTop: '1px solid #000', margin: '1mm 0' }} />
            <div style={{ fontSize: '11pt', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center', margin: '1mm 0' }}>Monthly Fee Voucher</div>
            <div style={{ borderTop: '1px solid #000', margin: '1mm 0' }} />
            <div style={{ fontSize: '9pt', marginTop: '1mm', whiteSpace: 'nowrap' }}>
                Voucher No: <span style={{ fontSize: '10pt', fontWeight: 'bold', textDecoration: 'underline' }}>{voucherNo}</span>
                &nbsp;&nbsp;
                Family ID: <span style={{ fontSize: '10pt', fontWeight: 'bold', textDecoration: 'underline' }}>{v.family_id || '—'}</span>
            </div>
            <div style={{ fontSize: '8.5pt', marginTop: '1mm', marginBottom: '1.5mm', whiteSpace: 'nowrap' }}>
                Issue date: <span style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{v.primary.issue_date ? fmtDate(v.primary.issue_date) : fmtDate(new Date())}</span>
                &nbsp;&nbsp;
                Due date: <span style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{dueDate}</span>
            </div>
            <div style={{ fontSize: '9pt', fontWeight: 'bold', marginTop: '1mm', marginBottom: '0.5mm' }}>Students Details</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt' }}>
                <thead>
                    <tr>
                        <th style={th({ textAlign: 'center', width: '37%' })}>Student Name</th>
                        <th style={th({ textAlign: 'center', width: '37%' })}>Father Name</th>
                        <th style={th({ textAlign: 'center', width: '26%' })}>Class (Sec)</th>
                    </tr>
                </thead>
                <tbody>
                    {studentRows.map((s, i) => (
                        <tr key={i}>
                            <td style={td()}>{s ? `${s.first_name} ${s.last_name}` : '\u00A0'}</td>
                            <td style={td()}>{s?.father_name || '\u00A0'}</td>
                            <td style={td({ textAlign: 'center' })}>{s ? `${s.class_name}${s.section_name ? ` (${s.section_name})` : ''}` : '\u00A0'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div style={{ fontSize: '9pt', fontWeight: 'bold', marginTop: '1.5mm', marginBottom: '0.5mm' }}>Fee Details</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt' }}>
                <thead>
                    <tr>
                        <th style={th({ textAlign: 'center', width: '9%' })}>Sr.#</th>
                        <th style={th({ textAlign: 'left', width: '65%' })}>Fee Description</th>
                        <th style={th({ textAlign: 'center', width: '26%' })}>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {feeRows.map((row, i) => (
                        <tr key={i} style={row.amount < 0 ? { fontStyle: 'italic' } : {}}>
                            <td style={td({ textAlign: 'center' })}>{row.sr}</td>
                            <td style={td({ textAlign: 'left' })}>{row.desc}</td>
                            <td style={td({ textAlign: 'center' })}>{row.amount < 0 ? `-${fmtAmt(Math.abs(row.amount))}` : fmtAmt(row.amount)}</td>
                        </tr>
                    ))}
                    <tr style={{ fontWeight: 'bold' }}>
                        <td style={td({ textAlign: 'center' })}>{sr}</td>
                        <td style={td({ textAlign: 'center', fontWeight: 'bold' })}>Total Amount</td>
                        <td style={td({ textAlign: 'center', fontWeight: 'bold' })}>{fmtAmt(grandTotal)}</td>
                    </tr>
                </tbody>
            </table>
            <div style={{ marginTop: '2mm', fontSize: '7.5pt' }}>
                <ul style={{ paddingLeft: '10pt', margin: 0 }}>
                    <li style={{ marginBottom: '1mm' }}>Please bring this voucher when you pay your fee.</li>
                    <li style={{ marginBottom: '1mm' }}>All fees must be paid at the school office only.</li>
                    <li style={{ marginBottom: '1mm' }}>After payment, collect your receipt.</li>
                    <li>For any fee issues, contact the school office.</li>
                </ul>
            </div>
        </div>
    );
}
   ============================================================================ */

/* ============================================================================
   NEW MONTHLY FEE VOUCHER DESIGN (Strictly matching monthly fee voucher.html)
   ============================================================================ */

const MIN_STUDENTS = 4;   // always show at least 4 student rows
const MAX_STUDENTS = 9;   // extend beyond 4 up to 9 as students are added
const MIN_FEES = 2;       // always show Monthly Fee + Previous Dues
const MAX_FEES = 4;       // extend beyond base when extra fee-heads are added

function VoucherSlip({ v, serial, month, year, school, filterClassId }: { v: Voucher; serial: number; month: string; year: string; school: SchoolInfo; filterClassId?: string }) {
    const mIdx = parseInt(month) - 1;
    const monthName = MONTHS[mIdx] || '';
    const voucherNo = `${MONTH_SHORT[mIdx] || 'FEE'}${zeroPad(serial)}`;
    const dueDate = v.primary.due_date ? fmtDate(v.primary.due_date) : '--';
    const issueDate = v.primary.issue_date ? fmtDate(v.primary.issue_date) : fmtDate(new Date());

    const allStudents: SlipData[] = [v.primary, ...v.siblings];

    let membersSource = v.family_members && v.family_members.length > 0
        ? [...v.family_members]
        : allStudents.map(s => ({
            first_name: s.first_name,
            last_name: s.last_name,
            father_name: s.father_name,
            class_name: s.class_name,
            section_name: (s as any).section_name,
            class_id: s.c_class_id
        }));

    if (filterClassId && v.voucher_type === 'family') {
        membersSource.sort((a, b) => {
            const aMatch = (a as any).class_id?.toString() === filterClassId ? 0 : 1;
            const bMatch = (b as any).class_id?.toString() === filterClassId ? 0 : 1;
            return aMatch - bMatch;
        });
    }

    const rawStudentRows = membersSource.map(m => ({
        name: `${m.first_name || ''} ${m.last_name || ''}`.trim(),
        father: m.father_name || '',
        cls: `${m.class_name || ''}${(m as any).section_name ? ` (${(m as any).section_name})` : ''}`
    })).slice(0, MAX_STUDENTS);

    const studentRows = [...rawStudentRows];
    while (studentRows.length < MIN_STUDENTS) {
        studentRows.push({ name: '', father: '', cls: '' });
    }

    const rawFeeItems: { desc: string; amount: number }[] = [];
    for (const item of (v.primary.line_items || [])) {
        const displayName = item.head_name.replace('Family Monthly Fee', 'Monthly Fee');
        rawFeeItems.push({ desc: `${displayName} (${monthName})`, amount: parseFloat(item.amount as any) || 0 });
    }
    const totalPaid = parseFloat(v.total_paid as any) || 0;
    if (totalPaid > 0) {
        rawFeeItems.push({ desc: 'Amount Already Paid', amount: -totalPaid });
    }

    const feeRows = rawFeeItems.slice(0, MAX_FEES);
    while (feeRows.length < MIN_FEES) {
        feeRows.push({ desc: '', amount: 0 });
    }

    const totalAmount = feeRows.reduce((sum, f) => sum + (f.amount || 0), 0);

    const studentCount = Math.max(MIN_STUDENTS, Math.min(rawStudentRows.length, MAX_STUDENTS));
    const feeCount = Math.max(MIN_FEES, Math.min(feeRows.length, MAX_FEES));
    const extraRows = (studentCount - MIN_STUDENTS) + (feeCount - MIN_FEES);
    const compactClass = extraRows >= 3 ? ' table-compact' : '';

    const schoolName = school.school_name || 'Falcon School System';
    const schoolAddress = school.school_address || '83/M Madina Colony Vehari';
    const schoolPhones = [school.phone_number, school.school_phone2, school.school_phone3].filter(Boolean).join(' ; ') || '0300-7730141 ; 0308-7696430 ; 067-3366383';

    return (
        <div className={`voucher${compactClass}`}>
            <div className="voucher-header">
                {school.school_logo_url ? (
                    <img src={school.school_logo_url} alt="Logo" className="logo-placeholder" style={{ objectFit: 'contain' }} />
                ) : (
                    <div className="logo-placeholder"></div>
                )}
                <div className="school-name">{schoolName}</div>
            </div>
            <div className="school-address">{schoolAddress}</div>
            <div className="school-contact">{schoolPhones}</div>
            <div className="divider"></div>
            <div className="voucher-type">Monthly Fee Voucher</div>
            <div className="divider"></div>
            <div className="voucher-details">
                <span className="detail-group">Voucher No: <span className="number">{voucherNo}</span></span>
                <span className="detail-group">Family ID: <span className="family-id">{v.family_id || '—'}</span></span>
            </div>
            <div className="voucher-date-line">
                <span className="detail-group">Issue date: <span className="date-value">{issueDate}</span></span>
                <span className="detail-group">Due date: <span className="date-value">{dueDate}</span></span>
            </div>
            <div className="voucher-body">
                <div className="student-details">Students Details</div>
                <table className="students-table">
                    <thead>
                        <tr>
                            <th>Student Name</th>
                            <th>Father Name</th>
                            <th>Class (Sec)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {studentRows.map((s, i) => (
                            <tr key={i}>
                                <td>{s.name || '\u00A0'}</td>
                                <td>{s.father || '\u00A0'}</td>
                                <td>{s.cls || '\u00A0'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="fee-desc">Fee Details</div>
                <table className="fee-table">
                    <thead>
                        <tr>
                            <th>Sr.#</th>
                            <th>Fee Description</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {feeRows.map((f, i) => (
                            <tr key={i}>
                                <td>{i + 1}</td>
                                <td>{f.desc || '\u00A0'}</td>
                                <td>{f.desc ? fmtAmt(f.amount) : '0/-'}</td>
                            </tr>
                        ))}
                        <tr className="total-row">
                            <td>{feeRows.length + 1}</td>
                            <td>Total Amount</td>
                            <td>{fmtAmt(totalAmount)}</td>
                        </tr>
                    </tbody>
                </table>

                <div className="rules-box">
                    <span className="rule-line">1. Fee must be paid before the due date.</span>
                    <span className="rule-line">2. A fine/late fee will apply after the due date.</span>
                    <span className="rule-line">3. Fee must be deposited only at the school-designated bank/counter.</span>
                    <span className="rule-line">4. Fee once paid is non-refundable under any circumstances.</span>
                </div>
                <div className="filler"></div>
            </div>
        </div>
    );
}

function VoucherCard({ v, idx, selected, onToggle, filterClassId }: { v: Voucher; idx: number; selected: boolean; onToggle: () => void; filterClassId?: string }) {
    const remaining = parseFloat(v.total_family_amount as any) - parseFloat(v.total_paid as any);
    const isFam = v.voucher_type === 'family';

    const allMembers = (v.family_members && v.family_members.length > 0)
        ? v.family_members
        : [v.primary, ...v.siblings];

    const displayPrimary = (filterClassId && isFam && v.family_members && v.family_members.length > 0)
        ? (v.family_members.find(m => m.class_id?.toString() === filterClassId) || v.primary)
        : v.primary;

    return (
        <div className={`card border-0 shadow-sm mb-2${selected ? ' border border-primary' : ''}`}
            style={{ borderLeft: `4px solid ${v.is_printed ? '#198754' : isFam ? '#215E61' : '#FE7F2D'}`, cursor: 'pointer' }}
            onClick={onToggle}>
            <div className="card-body py-2 px-3">
                <div className="d-flex align-items-start gap-3">
                    <input type="checkbox" className="form-check-input mt-1" checked={selected} readOnly
                        onClick={e => e.stopPropagation()} onChange={onToggle} />
                    <div className="flex-grow-1">
                        <div className="d-flex justify-content-between align-items-start">
                            <div>
                                <span className="fw-bold text-dark me-2">{displayPrimary.first_name} {displayPrimary.last_name}</span>
                                <span className="badge rounded-pill bg-light text-dark border me-1">{(displayPrimary as any).class_name || v.primary.class_name}</span>
                                {isFam && <span className="badge rounded-pill me-1" style={{ backgroundColor: '#215E61', color: '#fff' }}>
                                    <i className="bi bi-people-fill me-1"></i>Family ({allMembers.length})
                                </span>}
                                {v.is_printed && <span className="badge bg-success rounded-pill"><i className="bi bi-printer-fill me-1"></i>Printed</span>}
                                {v.partial_printed && <span className="badge bg-warning text-dark rounded-pill">Partial</span>}
                            </div>
                            <div className="text-end">
                                <div className="fw-bold small" style={{ color: 'var(--primary-dark)' }}>PKR {Number(v.total_family_amount).toLocaleString()}</div>
                                {remaining > 0 && <div className="text-danger" style={{ fontSize: '0.72rem' }}>Due: {Number(remaining).toLocaleString()}</div>}
                            </div>
                        </div>
                        {isFam && allMembers.length > 0 && (
                            <div className="d-flex flex-wrap gap-1 mt-1">
                                {allMembers.map((m, i) => (
                                    <span key={i} className="badge bg-light text-dark border" style={{ fontSize: '0.7rem' }}>
                                        {m.first_name} {m.last_name} ({(m as any).class_name || (m as any).c_class_name})
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                            Adm: {v.primary.admission_no}
                            {v.primary.printed_at && <span className="ms-2">Printed: {new Date(v.primary.printed_at).toLocaleDateString('en-PK')}</span>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface AvailableMonth {
    value: string;
    label: string;
    months: number[];
}

export default function PrintSlipsPage() {
    const [month, setMonth] = useState('');
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [classId, setClassId] = useState('');
    const [classes, setClasses] = useState<{ class_id: number; class_name: string }[]>([]);
    const [availableMonths, setAvailableMonths] = useState<AvailableMonth[]>([]);
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [coveredStudents, setCoveredStudents] = useState<any[]>([]);
    const [stats, setStats] = useState<{ total_vouchers: number; printed: number; pending: number; family_vouchers: number } | null>(null);
    const [school, setSchool] = useState<SchoolInfo>({ school_name: '', school_address: '', phone_number: '', school_phone2: '', school_phone3: '', school_logo_url: '' });
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingSlipIds, setPendingSlipIds] = useState<number[]>([]);
    const [markingPrinted, setMarkingPrinted] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
    const [printing, setPrinting] = useState(false);

    useEffect(() => {
        fetch(`${API}/academic`).then(r => r.json()).then(setClasses).catch(() => { });
        fetch(`${API}/settings`).then(r => r.json()).then((data: any) => {
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                const getLogo = (raw?: string) => {
                    if (!raw || !raw.trim()) return `${API}/icon.png`;
                    const s = raw.trim();
                    if (s.startsWith('data:') || s.startsWith('http://') || s.startsWith('https://')) return s;
                    return `${API}/${s.replace(/^\/+/, '')}`;
                };
                setSchool({
                    school_name: data.school_name || '',
                    school_address: data.address || '',
                    phone_number: data.contact_number || '',
                    school_phone2: '',
                    school_phone3: '',
                    school_logo_url: getLogo(data.logo_url)
                });
            }
        }).catch(() => { });
    }, []);

    useEffect(() => {
        fetch(`${API}/fee-slips/available-months?year=${year}`)
            .then(r => r.json())
            .then(data => {
                if (data.months) {
                    setAvailableMonths(data.months);
                    if (data.months.length > 0) {
                        const currentM = (new Date().getMonth() + 1).toString();
                        const isCurrentValid = data.months.some((m: AvailableMonth) => m.months.includes(parseInt(currentM)));
                        if (!isCurrentValid) {
                            setMonth(data.months[data.months.length - 1].value);
                        } else {
                            const exact = data.months.find((m: AvailableMonth) => m.months.includes(parseInt(currentM)));
                            if (exact) setMonth(exact.value);
                        }
                    } else {
                        setMonth('');
                    }
                }
            })
            .catch(() => { });
    }, [year]);

    const loadQueue = async () => {
        if (!month || !year) {
            setMessage({ type: 'danger', text: 'Please select Month and Year.' });
            return;
        }
        setLoading(true); setMessage(null); setSelected(new Set()); setVouchers([]); setCoveredStudents([]); setStats(null);
        try {
            const url = `${API}/fee-slips/print-queue?month=${month}&year=${year}${classId ? `&class_id=${classId}` : ''}`;
            const r = await fetch(url);
            const data = await r.json();
            if (!r.ok) throw new Error(data.error);
            setVouchers(data.vouchers || []);
            setCoveredStudents(data.covered_students || []);
            setStats(data.stats || null);
        } catch (err: any) { setMessage({ type: 'danger', text: err.message }); }
        finally { setLoading(false); }
    };

    const toggleSelect = (idx: number) => { setSelected(prev => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; }); };
    const selectAllPending = () => setSelected(new Set(vouchers.map((v, i) => i).filter(i => !vouchers[i].is_printed)));
    const selectAll = () => setSelected(new Set(vouchers.map((_, i) => i)));
    const clearAll = () => setSelected(new Set());

    const selectedVouchers = Array.from(selected).sort((a, b) => a - b).map(i => vouchers[i]).filter(Boolean);
    const allSlipIds = selectedVouchers.flatMap(v => v.slip_ids);
    const pages: Voucher[][] = [];
    for (let i = 0; i < selectedVouchers.length; i += 3) pages.push(selectedVouchers.slice(i, i + 3));
    const voucherSerials = new Map<number, number>();
    vouchers.forEach((v, i) => { voucherSerials.set(v.slip_ids[0], i + 1); });
    const getSerial = (v: Voucher) => voucherSerials.get(v.slip_ids[0]) || 1;

    useEffect(() => {
        if (!printing) return;
        let cancelled = false;

        const t = setTimeout(() => {
            if (cancelled) return;

            const doAfterImagesLoad = () => {
                if (cancelled) return;
                window.print();
                setTimeout(() => { setShowConfirm(true); setPrinting(false); }, 600);
            };

            const imgs = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
            const pending = imgs.filter(img => !img.complete || img.naturalWidth === 0);

            if (pending.length === 0) {
                doAfterImagesLoad();
            } else {
                let done = 0;
                const onDone = () => { done++; if (done >= pending.length) doAfterImagesLoad(); };
                pending.forEach(img => {
                    img.addEventListener('load', onDone, { once: true });
                    img.addEventListener('error', onDone, { once: true });
                });
                setTimeout(() => { if (!cancelled) doAfterImagesLoad(); }, 3000);
            }
        }, 150);

        return () => { cancelled = true; clearTimeout(t); };
    }, [printing]);

    const handlePrint = () => {
        if (selected.size === 0) { setMessage({ type: 'danger', text: 'Select at least one voucher to print.' }); return; }
        setPendingSlipIds(allSlipIds);
        setPrinting(true);
    };

    const markAsPrinted = async () => {
        setMarkingPrinted(true);
        try {
            const r = await fetch(`${API}/fee-slips/mark-printed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slip_ids: pendingSlipIds }) });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error);
            setMessage({ type: 'success', text: `Marked ${pendingSlipIds.length} slip(s) as printed.` });
            setShowConfirm(false); setSelected(new Set()); loadQueue();
        } catch (err: any) { setMessage({ type: 'danger', text: err.message }); }
        finally { setMarkingPrinted(false); }
    };

    const printStyles = `
        @media print {
            @page { size: A4 landscape; margin: 0; }
            .sl-sidebar, .sl-topbar, .sl-overlay, .sl-toggle { display: none !important; }
            .sl-layout { display: block !important; overflow: visible !important; height: auto !important; }
            .sl-main { margin-left: 0 !important; padding: 0 !important; width: 297mm !important; max-width: 297mm !important; overflow: visible !important; max-height: unset !important; height: auto !important; min-height: 0 !important; }
            .fee-print-page { height: 210mm !important; overflow: hidden !important; }
            body, html { margin: 0 !important; padding: 0 !important; background: #fff !important; overflow: visible !important; font-family: 'Times New Roman', Times, serif; color: #000; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }

        .fee-print-page {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 0.5mm;
            width: 297mm;
            height: 210mm;
            padding: 8mm;
            box-sizing: border-box;
            background: #fff;
            color: #000;
            font-family: 'Times New Roman', Times, serif;
        }

        .cut-separator {
            position: relative;
            width: 0;
            align-self: stretch;
            border-left: 1.2pt dashed #555;
            margin: 0 1mm;
        }
        .cut-separator::before {
            content: "\\2702";
            position: absolute;
            top: -4.2mm;
            left: 50%;
            transform: translateX(-50%) rotate(90deg);
            font-size: 8pt;
            color: #555;
            background: #fff;
            padding: 0 0.5mm;
        }

        .voucher {
            width: 92mm;
            height: 190mm;
            border: 1.5pt solid #000;
            outline: 0.5pt solid #000;
            outline-offset: 1.5pt;
            padding: 4mm 4mm;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            page-break-inside: avoid;
            break-inside: avoid;
            overflow: hidden;
            background: #fff;
            color: #000;
            font-family: 'Times New Roman', Times, serif;
        }
        .voucher-header {
            display: flex;
            align-items: center;
            gap: 3mm;
            flex: 0 0 auto;
        }
        .logo-placeholder {
            width: 24mm;
            height: 20mm;
            flex: 0 0 auto;
            border: none;
            background: transparent;
        }
        .school-name {
            flex: 1 1 auto;
            font-size: 12.5pt;
            font-weight: bold;
            text-transform: uppercase;
            line-height: 1.15;
            text-align: left;
        }
        .school-address, .school-contact {
            font-size: 9.5pt;
            text-align: center;
            width: 100%;
            flex: 0 0 auto;
        }
        .school-address { margin-top: 1mm; }
        .school-contact { margin-top: 0.5mm; white-space: nowrap; }
        .divider { width: 100%; border-top: 1pt solid #000; margin: 1mm 0; flex: 0 0 auto; }
        .voucher-type {
            font-size: 12.5pt;
            font-weight: bold;
            text-transform: uppercase;
            text-align: center;
            margin: 0.3mm 0;
            flex: 0 0 auto;
        }
        .voucher-details {
            font-size: 10.5pt;
            margin-top: 1mm;
            white-space: nowrap;
            display: grid;
            grid-template-columns: 1fr 1fr;
            flex: 0 0 auto;
        }
        .voucher-details .detail-group:first-child { text-align: left; }
        .voucher-details .detail-group:last-child { text-align: right; }
        .voucher-details span.number,
        .voucher-details span.family-id {
            font-size: 10.5pt;
            font-weight: bold;
            text-decoration: underline;
        }
        .voucher-date-line {
            font-size: 9.5pt;
            margin-top: 0.5mm;
            white-space: nowrap;
            display: grid;
            grid-template-columns: 1fr 1fr;
            flex: 0 0 auto;
        }
        .voucher-date-line .detail-group:first-child { text-align: left; }
        .voucher-date-line .detail-group:last-child { text-align: right; }
        .voucher-date-line span.date-value {
            font-size: 9.5pt;
            font-weight: bold;
            text-decoration: underline;
        }

        .voucher-body {
            flex: 1 1 auto;
            display: flex;
            flex-direction: column;
            min-height: 0;
        }

        .student-details, .fee-desc {
            font-size: 11pt;
            font-weight: bold;
            margin-top: 1.5mm;
            border-bottom: 1pt solid #000;
            padding-bottom: 0.3mm;
            flex: 0 0 auto;
        }

        .students-table, .fee-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 0.5mm;
            font-size: 11pt;
            table-layout: fixed;
            flex: 0 0 auto;
        }
        .students-table th, .students-table td,
        .fee-table th, .fee-table td {
            border: 1px solid #000;
            padding: 0.5mm 1mm;
            line-height: 1.15;
            height: 5.2mm;
            word-wrap: break-word;
            box-sizing: border-box;
            overflow: hidden;
        }
        .students-table th, .fee-table th {
            font-weight: bold;
            background-color: #e9e9e9;
            height: 5.2mm;
        }

        .voucher.table-compact .students-table,
        .voucher.table-compact .fee-table {
            font-size: 9.8pt;
        }
        .voucher.table-compact .students-table th,
        .voucher.table-compact .students-table td,
        .voucher.table-compact .fee-table th,
        .voucher.table-compact .fee-table td {
            height: 4.5mm;
            padding: 0.35mm 1mm;
        }

        .students-table th:nth-child(1), .students-table td:nth-child(1) { width: 37%; text-align: center; }
        .students-table th:nth-child(2), .students-table td:nth-child(2) { width: 37%; text-align: center; }
        .students-table th:nth-child(3), .students-table td:nth-child(3) { width: 26%; text-align: center; }

        .fee-table th:nth-child(1), .fee-table td:nth-child(1) { width: 12%; text-align: center; }
        .fee-table th:nth-child(2), .fee-table td:nth-child(2) { width: 58%; text-align: left; }
        .fee-table th:nth-child(3), .fee-table td:nth-child(3) { width: 30%; text-align: center; }
        .fee-table .total-row td {
            font-weight: bold;
            background-color: #e9e9e9;
            border-top: 1.5pt solid #000;
        }

        .rules-box {
            flex: 0 0 auto;
            padding-top: 0.8mm;
            margin-top: 0.8mm;
            font-size: 8.8pt;
            line-height: 1.35;
            border-top: 1pt dashed #000;
        }
        .rules-box .rule-line { display: block; }
        .filler { flex: 1 1 auto; }
    `;

    // ── Print layout (replaces entire page content while printing) ──────────
    if (printing) {
        return (
            <>
                <style>{printStyles}</style>
                <div style={{ fontFamily: '"Times New Roman", Times, serif', margin: 0, padding: 0, background: '#fff', width: '297mm' }}>
                    {pages.map((page, pi) => (
                        <div key={pi} className="fee-print-page" style={{
                            pageBreakAfter: pi < pages.length - 1 ? 'always' : 'auto',
                            breakAfter: pi < pages.length - 1 ? 'page' : 'auto',
                        }}>
                            {page.map((v, vi) => (
                                <React.Fragment key={vi}>
                                    {vi > 0 && <div className="cut-separator" />}
                                    <VoucherSlip v={v} serial={getSerial(v)} month={month} year={year} school={school} filterClassId={classId || undefined} />
                                </React.Fragment>
                            ))}
                            {page.length < 3 && Array.from({ length: 3 - page.length }).map((_, ei) => (
                                <React.Fragment key={`e${ei}`}>
                                    <div className="cut-separator" />
                                    <div style={{ width: '92mm', height: '190mm', flexShrink: 0, visibility: 'hidden' }} />
                                </React.Fragment>
                            ))}
                        </div>
                    ))}
                </div>
            </>
        );
    }
    // ────────────────────────────────────────────────────────────────────────

    return (
        <>
            <style>{printStyles}</style>
            {school.school_logo_url && (
                <img src={school.school_logo_url} alt="" aria-hidden="true"
                    style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
            )}
            {/* Screen UI */}
            <div className="container-fluid p-4 animate__animated animate__fadeIn">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 className="fw-bold mb-1" style={{ color: 'var(--primary-dark)' }}><i className="bi bi-printer me-2"></i>Print Fee Slips</h2>
                        <p className="text-muted small mb-0">3 family vouchers per A4 landscape. Sibling fees combined into one voucher. Print tracking enabled.</p>
                    </div>
                </div>

                {message && (
                    <div className={`alert alert-${message.type} d-flex align-items-center animate__animated animate__fadeIn`}>
                        <i className={`bi ${message.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2`}></i>
                        <span>{message.text}</span>
                        <button className="btn-close ms-auto" onClick={() => setMessage(null)}></button>
                    </div>
                )}

                <div className="card border-0 shadow-sm mb-4">
                    <div className="card-body p-3">
                        <div className="row g-3 align-items-end">
                            <div className="col-md-2">
                                <label className="form-label fw-bold small text-muted">Month</label>
                                <select className="form-select" value={month} onChange={e => setMonth(e.target.value)}>
                                    {availableMonths.length === 0 ? (
                                        <option value="">No Fees Generated</option>
                                    ) : (
                                        availableMonths.map(m => <option key={m.value} value={m.value}>{m.label}</option>)
                                    )}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label fw-bold small text-muted">Year</label>
                                <input type="number" className="form-control" value={year} onKeyDown={e => ['e', 'E', '+', '-', '.'].includes(e.key) && e.preventDefault()} onChange={e => setYear(e.target.value)} />
                            </div>
                            <div className="col-md-3">
                                <label className="form-label fw-bold small text-muted">Class Filter (optional)</label>
                                <select className="form-select" value={classId} onChange={e => setClassId(e.target.value)}>
                                    <option value="">All Classes</option>
                                    {classes.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                                </select>
                            </div>
                            <div className="col-md-3">
                                <button className="btn btn-primary-custom w-100 py-2 fw-bold" onClick={loadQueue} disabled={loading}>
                                    {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Loading...</> : <><i className="bi bi-search me-2"></i>Load Queue</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {stats && (
                    <div className="row g-3 mb-4">
                        {[
                            { label: 'Total Vouchers', value: stats.total_vouchers, color: 'var(--primary-dark)' },
                            { label: 'Pending Print', value: stats.pending, color: '#dc3545' },
                            { label: 'Printed', value: stats.printed, color: '#198754' },
                            { label: 'Family Vouchers', value: stats.family_vouchers, color: '#215E61' },
                        ].map((s, i) => (
                            <div className="col-6 col-md-3" key={i}>
                                <div className="card border-0 shadow-sm" style={{ borderLeft: `4px solid ${s.color}` }}>
                                    <div className="card-body py-2 px-3">
                                        <div className="text-muted small fw-bold text-uppercase">{s.label}</div>
                                        <div className="fw-bold" style={{ color: s.color, fontSize: '1.3rem' }}>{s.value}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {vouchers.length > 0 && (
                    <div className="row g-4">
                        <div className="col-lg-8">
                            <div className="card border-0 shadow-sm mb-3">
                                <div className="card-body py-2 px-3 d-flex flex-wrap gap-2 align-items-center">
                                    <button className="btn btn-sm btn-outline-secondary" onClick={selectAllPending}>
                                        Select Pending ({vouchers.filter(v => !v.is_printed).length})
                                    </button>
                                    <button className="btn btn-sm btn-outline-secondary" onClick={selectAll}>All</button>
                                    <button className="btn btn-sm btn-outline-secondary" onClick={clearAll}>Clear</button>
                                    <span className="text-muted small ms-1">{selected.size} selected · {pages.length} page(s)</span>
                                    <button className="btn btn-primary-custom fw-bold px-4 ms-auto" onClick={handlePrint} disabled={selected.size === 0}>
                                        <i className="bi bi-printer me-2"></i>Print {selected.size} Voucher(s)
                                    </button>
                                </div>
                            </div>
                            {vouchers.map((v, i) => <VoucherCard key={i} v={v} idx={i} selected={selected.has(i)} onToggle={() => toggleSelect(i)} filterClassId={classId || undefined} />)}
                        </div>
                        <div className="col-lg-4">
                            <div className="card border-0 shadow-sm mb-3">
                                <div className="card-header bg-white border-bottom py-2" style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                                    <h6 className="mb-0 fw-bold small" style={{ color: 'var(--primary-dark)' }}><i className="bi bi-info-circle me-2"></i>Voucher Rules</h6>
                                </div>
                                <div className="card-body p-3 small text-muted">
                                    <ul className="list-unstyled mb-0">
                                        <li className="mb-2"><i className="bi bi-layout-three-columns text-primary me-2"></i>3 vouchers per A4 landscape page</li>
                                        <li className="mb-2"><i className="bi bi-people-fill me-2" style={{ color: '#215E61' }}></i>Siblings → ONE combined family voucher</li>
                                        <li className="mb-2"><i className="bi bi-sort-up me-2"></i>Priority = highest class sibling</li>
                                        <li className="mb-2"><i className="bi bi-printer-fill text-success me-2"></i>Print marks ALL siblings as printed</li>
                                        <li><code className="small">FEB000001</code> = Month + 6-digit serial</li>
                                    </ul>
                                </div>
                            </div>
                            {coveredStudents.length > 0 && (
                                <div className="card border-0 shadow-sm">
                                    <div className="card-header bg-warning bg-opacity-10 border-bottom py-2">
                                        <h6 className="mb-0 fw-bold small text-warning"><i className="bi bi-arrow-right-circle me-2"></i>In Sibling Voucher ({coveredStudents.length})</h6>
                                    </div>
                                    <div className="card-body p-3">
                                        {coveredStudents.map((s, i) => (
                                            <div key={i} className="border rounded p-2 mb-2 bg-light small">
                                                <div className="fw-bold">{s.first_name} {s.last_name}</div>
                                                <div className="text-muted" style={{ fontSize: '0.72rem' }}>{s.class_name} · {s.admission_no}</div>
                                                <div className="text-muted" style={{ fontSize: '0.72rem' }}>Included in: <b>{s.covered_by?.first_name} {s.covered_by?.last_name}</b></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {!loading && vouchers.length === 0 && stats !== null && (
                    <div className="card border-0 shadow-sm text-center py-5">
                        <i className="bi bi-inbox fs-1 text-muted d-block mb-3"></i>
                        <p className="text-muted">No slips found. Generate slips first from Generate Slips page.</p>
                    </div>
                )}
            </div>

            {showConfirm && (
                <>
                    <div className="modal-backdrop fade show no-print" style={{ zIndex: 1040 }}></div>
                    <div className="modal fade show d-block no-print" style={{ zIndex: 1050 }}>
                        <div className="modal-dialog modal-dialog-centered">
                            <div className="modal-content border-0 shadow-lg">
                                <div className="modal-header text-white" style={{ backgroundColor: 'var(--primary-dark)' }}>
                                    <h5 className="modal-title"><i className="bi bi-printer me-2"></i>Printing Complete?</h5>
                                    <button className="btn-close btn-close-white" onClick={() => setShowConfirm(false)}></button>
                                </div>
                                <div className="modal-body p-4">
                                    <p className="mb-2">Did <strong>{selectedVouchers.length} voucher(s)</strong> print successfully?</p>
                                    <p className="text-muted small">Marking as printed prevents duplicate vouchers from being issued.</p>
                                    <div className="alert alert-info py-2 small mb-0">
                                        <i className="bi bi-info-circle me-1"></i>
                                        {selectedVouchers.filter(v => v.voucher_type === 'family').length} family voucher(s) all siblings marked together.
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-secondary-custom" onClick={() => setShowConfirm(false)}>No Print Again</button>
                                    <button className="btn btn-primary-custom fw-bold px-4" onClick={markAsPrinted} disabled={markingPrinted}>
                                        {markingPrinted ? <><span className="spinner-border spinner-border-sm me-2"></span>Marking...</> : <><i className="bi bi-check-circle me-2"></i>Yes, Mark as Printed</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
