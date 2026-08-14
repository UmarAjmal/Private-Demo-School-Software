'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { notify } from '@/app/utils/notify';
import { useAuth } from '@/contexts/AuthContext';

type Student = {
    student_id: number;
    admission_no: string;
    roll_no: string;
    first_name: string;
    last_name: string;
    gender: string;
    dob: string;
    class_name: string;
    section_name: string;
    category: string;
    blood_group: string;
    religion: string;
    family_id: string;

    // Contact
    student_mobile: string;
    email: string;
    current_address: string;
    city: string;

    // Parent/Guardian
    father_name: string;
    father_phone: string;
    mother_name: string;
    mother_phone: string;
    is_orphan: boolean;
    guardian_name: string;
    guardian_relation: string;
    guardian_phone: string;

    // Fees
    monthly_fee: string;
    status: string;

    image_url: string;
    username?: string;
    system_pwd?: string;
};

// ── Column definitions ────────────────────────────────────────────────────
const COL_DEFS: { key: string; label: string; defaultOn: boolean }[] = [
    { key: 'sno', label: '#', defaultOn: true },
    { key: 'admission_no', label: 'Admission No', defaultOn: true },
    { key: 'roll_no', label: 'Roll No', defaultOn: true },
    { key: 'username', label: 'Username', defaultOn: true },
    { key: 'system_pwd', label: 'Password', defaultOn: true },
    { key: 'family_id', label: 'Family ID', defaultOn: false },
    { key: 'name', label: 'Name', defaultOn: true },
    { key: 'father_name', label: 'Father Name', defaultOn: true },
    { key: 'mother_name', label: 'Mother Name', defaultOn: false },
    { key: 'class', label: 'Class', defaultOn: true },
    { key: 'section', label: 'Section', defaultOn: true },
    { key: 'gender', label: 'Gender', defaultOn: false },
    { key: 'dob', label: 'Date of Birth', defaultOn: false },
    { key: 'blood_group', label: 'Blood Group', defaultOn: false },
    { key: 'religion', label: 'Religion', defaultOn: false },
    { key: 'category', label: 'Category', defaultOn: false },
    { key: 'mobile_no', label: 'Student Phone', defaultOn: true },
    { key: 'father_phone', label: 'Father Phone', defaultOn: false },
    { key: 'mother_phone', label: 'Mother Phone', defaultOn: false },
    { key: 'guardian', label: 'Guardian', defaultOn: false },
    { key: 'guardian_ph', label: 'Guardian Phone', defaultOn: false },
    { key: 'email', label: 'Email', defaultOn: false },
    { key: 'address', label: 'Address', defaultOn: false },
    { key: 'monthly_fee', label: 'Monthly Fee', defaultOn: false },
    { key: 'status', label: 'Status', defaultOn: true },
    { key: 'remarks', label: 'Remarks / Notes (Blank)', defaultOn: false },
];

// ── Plain-text value for exports ──────────────────────────────────────────
function exportText(key: string, s: Student, idx: number): string {
    switch (key) {
        case 'sno': return String(idx + 1);
        case 'admission_no': return s.admission_no ?? '';
        case 'roll_no': return s.roll_no ?? '';
        case 'username': return s.username ?? '';
        case 'system_pwd': return s.system_pwd ?? '';
        case 'family_id': return s.family_id ?? '';
        case 'name': return `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim();
        case 'father_name': return s.father_name ?? '';
        case 'mother_name': return s.mother_name ?? '';
        case 'class': return s.class_name ?? '';
        case 'section': return s.section_name ?? '';
        case 'gender': return s.gender ?? '';
        case 'dob': return s.dob ? s.dob.split('T')[0] : '';
        case 'blood_group': return s.blood_group ?? '';
        case 'religion': return s.religion ?? '';
        case 'category': return s.category ?? '';
        case 'mobile_no': return s.student_mobile ?? '';
        case 'father_phone': return s.father_phone ?? '';
        case 'mother_phone': return s.mother_phone ?? '';
        case 'guardian': return s.guardian_name ?? '';
        case 'guardian_ph': return s.guardian_phone ?? '';
        case 'email': return s.email ?? '';
        case 'address': return [s.current_address, s.city].filter(Boolean).join(', ');
        case 'monthly_fee': return s.monthly_fee ?? '';
        case 'status': return s.status ?? '';
        case 'remarks': return '';
        default: return '';
    }
}

// ── JSX cell renderer ─────────────────────────────────────────────────────
function renderCell(key: string, s: Student, idx: number) {
    switch (key) {
        case 'sno':
            return <span className="text-muted small">{idx + 1}</span>;
        case 'admission_no':
            return <span className="badge bg-light text-dark border fw-normal">{s.admission_no || '—'}</span>;
        case 'roll_no':
            return <span className="fw-semibold">{s.roll_no || '—'}</span>;
        case 'username':
            return <span className="font-monospace text-primary bg-light border px-1 rounded" style={{ fontSize: '0.8rem' }}>{s.username || '—'}</span>;
        case 'system_pwd':
            return <span className="font-monospace text-muted" style={{ fontSize: '0.8rem' }}>{s.system_pwd || '—'}</span>;
        case 'family_id':
            return s.family_id
                ? <span className="badge bg-info-subtle text-info-emphasis fw-normal" style={{ fontSize: 11 }}>{s.family_id}</span>
                : <span className="text-muted">—</span>;
        case 'name':
            return (
                <div className="d-flex align-items-center gap-2">
                    <div className="rounded-circle bg-light border d-flex align-items-center justify-content-center text-primary fw-bold flex-shrink-0"
                        style={{ width: 32, height: 32, fontSize: 13 }}>
                        {s.image_url
                            ? <img src={`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/${s.image_url}`} alt="" className="rounded-circle w-100 h-100 object-fit-cover" />
                            : (s.first_name?.charAt(0) ?? '?')}
                    </div>
                    <span className="fw-semibold text-dark">{s.first_name} {s.last_name}</span>
                </div>
            );
        case 'father_name': return s.father_name || '—';
        case 'mother_name': return s.mother_name || '—';
        case 'class': return <span className="fw-bold">{s.class_name || '—'}</span>;
        case 'section': return s.section_name || '—';
        case 'gender':
            return (
                <span className={`badge rounded-pill ${s.gender === 'Male' ? 'bg-info bg-opacity-25 text-info-emphasis' : 'bg-danger bg-opacity-10 text-danger'}`}>
                    {s.gender}
                </span>
            );
        case 'dob':
            return s.dob ? s.dob.split('T')[0] : '—';
        case 'blood_group':
            return s.blood_group
                ? <span className="badge bg-danger bg-opacity-10 text-danger fw-normal">{s.blood_group}</span>
                : '—';
        case 'religion': return s.religion || '—';
        case 'category': return s.category || '—';
        case 'mobile_no':
            return s.student_mobile
                ? <span><i className="bi bi-telephone-fill text-muted me-1" style={{ fontSize: 11 }}></i>{s.student_mobile}</span>
                : '—';
        case 'father_phone': return s.father_phone || '—';
        case 'mother_phone': return s.mother_phone || '—';
        case 'guardian':
            return s.guardian_name
                ? `${s.guardian_name}${s.guardian_relation ? ` (${s.guardian_relation})` : ''}`
                : '—';
        case 'guardian_ph': return s.guardian_phone || '—';
        case 'email': return s.email || '—';
        case 'address': return [s.current_address, s.city].filter(Boolean).join(', ') || '—';
        case 'monthly_fee':
            return Number(s.monthly_fee) > 0
                ? `Rs. ${s.monthly_fee}`
                : <span className="text-success small">Free</span>;
        case 'status':
            return (
                <span className={`badge rounded-pill ${s.status === 'Active' ? 'bg-success' :
                    s.status === 'Left' ? 'bg-danger' :
                        'bg-secondary'
                    }`}>{s.status || 'Active'}</span>
            );
        case 'remarks':
            return (
                <div className="border-bottom border-secondary border-opacity-25" style={{ minWidth: 120, minHeight: 24, margin: '2px 0' }}>
                    &nbsp;
                </div>
            );
        default: return '—';
    }
}

export default function StudentDetails() {
    const router = useRouter();
    const { hasPermission, user } = useAuth();

    const isClassTeacher = user?.role_name?.toLowerCase() === 'teacher' && user?.incharge_class;

    // ── Data state ────────────────────────────────────────────────────────
    const [students, setStudents] = useState<Student[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    // ── Column visibility state ───────────────────────────────────────────
    const [visibleCols, setVisibleCols] = useState<Set<string>>(
        () => new Set(COL_DEFS.filter(c => c.defaultOn).map(c => c.key))
    );
    const [showColPicker, setShowColPicker] = useState(false);
    const colPickerRef = useRef<HTMLDivElement>(null);

    // ── Filters ───────────────────────────────────────────────────────────
    const [filters, setFilters] = useState({
        class_id: '', section_id: '', gender: '', status: '',
        category: '', blood_group: '', religion: '', age: '', keyword: '',
        family_id: ''
    });

    useEffect(() => {
        if (isClassTeacher && user?.incharge_class) {
            const classId = String(user.incharge_class.class_id);
            const sectionId = String(user.incharge_class.section_id);
            setFilters(prev => ({
                ...prev,
                class_id: classId,
                section_id: sectionId
            }));
            fetchSections(classId);
        }
    }, [isClassTeacher, user]);

    useEffect(() => {
        const init = async () => {
            await fetchClasses();
            fetchStudents();
        };
        init();
    }, []);

    useEffect(() => {
        const t = setTimeout(() => { fetchStudents(); }, 300);
        return () => clearTimeout(t);
    }, [filters]);

    // Automatically fetch sections whenever class_id filter changes
    useEffect(() => {
        if (filters.class_id) {
            fetchSections(filters.class_id);
        } else {
            setSections([]);
        }
    }, [filters.class_id]);

    // Reset filters helper respecting class teacher permissions
    const resetFilters = () => {
        if (isClassTeacher && user?.incharge_class) {
            setFilters({
                class_id: String(user.incharge_class.class_id),
                section_id: String(user.incharge_class.section_id),
                gender: '', status: '', category: '', blood_group: '', religion: '', age: '', keyword: '', family_id: ''
            });
        } else {
            setFilters({
                class_id: '', section_id: '', gender: '', status: '', category: '', blood_group: '', religion: '', age: '', keyword: '', family_id: ''
            });
        }
    };

    // Close column picker when clicking outside
    useEffect(() => {
        if (!showColPicker) return;
        const handler = (e: MouseEvent) => {
            if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
                setShowColPicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showColPicker]);

    const fetchClasses = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic`);
            if (res.ok) setClasses(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchSections = async (classId: string) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/sections`);
            if (res.ok) {
                const allSections = await res.json();
                setSections(allSections.filter((s: any) => s.class_id === Number(classId)));
            }
        } catch (e) { console.error(e); }
    };

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value) queryParams.append(key, value.trim());
            });
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/students?${queryParams.toString()}`);
            if (res.ok) {
                setStudents(await res.json());
            }
        } catch (e) {
            console.error(e);
            notify.error("Failed to fetch students");
        } finally {
            setLoading(false);
        }
    };

    const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setFilters({ ...filters, class_id: val, section_id: '' });
        if (val) fetchSections(val);
        else setSections([]);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this student permanently?")) return;
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/students/${id}`, { method: 'DELETE' });
            if (res.ok) {
                notify.success("Student deleted successfully");
                fetchStudents();
            } else {
                notify.error("Failed to delete student");
            }
        } catch (e) { notify.error("Error deleting student"); }
    };

    // ── Column toggle ─────────────────────────────────────────────────────
    const toggleCol = (key: string) => {
        setVisibleCols(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // ── Export helpers ────────────────────────────────────────────────────────
    const buildExportData = () => {
        const cols = COL_DEFS.filter(c => visibleCols.has(c.key));
        return {
            headers: cols.map(c => c.label),
            rows: students.map((s, idx) => cols.map(c => exportText(c.key, s, idx))),
        };
    };

    const doExportCSV = () => {
        const { headers, rows } = buildExportData();
        const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
        const lines = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))];
        const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: `students-${new Date().toISOString().split('T')[0]}.csv` });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const doExportExcel = () => {
        const { headers, rows } = buildExportData();
        const ths = headers.map(h => `<th style="background:#1a3a5c;color:#fff;padding:6px 8px;font-size:11px">${h}</th>`).join('');
        const trs = rows.map(r => '<tr>' + r.map(v => `<td style="padding:5px 8px;border-bottom:1px solid #e0e0e0;font-size:11px">${v}</td>`).join('') + '</tr>').join('');
        const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Students</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></body></html>`;
        const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: `students-${new Date().toISOString().split('T')[0]}.xls` });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const [school, setSchool] = useState<any>(null);

    useEffect(() => {
        const API = (process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com").replace(/\/+$/, '');
        fetch(`${API}/settings`)
            .then(r => r.json())
            .then(data => {
                if (data && typeof data === 'object' && !Array.isArray(data)) {
                    const getLogo = (raw?: string) => {
                        if (!raw || !raw.trim()) return `${API}/icon.png`;
                        const s = raw.trim();
                        if (s.startsWith('data:') || s.startsWith('http://') || s.startsWith('https://')) return s;
                        return `${API}/${s.replace(/^\/+/, '')}`;
                    };
                    setSchool({
                        school_name: data.school_name || 'Falcon School System',
                        address: data.address || '',
                        contact_number: data.contact_number || '',
                        logo_url: getLogo(data.logo_url)
                    });
                }
            })
            .catch(() => { });
    }, []);

    const doExportPDF = () => {
        const { headers, rows } = buildExportData();
        const win = window.open('', '_blank');
        if (!win) { notify.error('Popup blocked allow popups to export PDF.'); return; }
        const ths = headers.map(h => `<th>${h}</th>`).join('');
        const trs = rows.map(r => '<tr>' + r.map((v, i) => {
            const isRemarks = headers[i]?.toLowerCase().includes('remarks') || headers[i]?.toLowerCase().includes('notes');
            return isRemarks ? `<td style="border-bottom:1px dashed #777;min-width:120px">&nbsp;</td>` : `<td>${v}</td>`;
        }).join('') + '</tr>').join('');

        const logoUrl = school?.logo_url || `${(process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com").replace(/\/+$/, '')}/icon.png`;
        const schoolName = school?.school_name || 'Falcon School System';
        const address = school?.address || '';
        const contact = school?.contact_number || '';

        win.document.write(
            `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Student Directory</title>` +
            `<style>body{font-family:Arial,sans-serif;font-size:11px;margin:20px}` +
            `.header-container{display:flex;align-items:center;justify-content:center;gap:15px;margin-bottom:15px;border-bottom:2px solid #1a3a5c;padding-bottom:10px}` +
            `.header-logo{height:65px;width:65px;object-fit:contain}` +
            `.header-text{text-align:center}` +
            `h2{text-align:center;font-size:18px;margin:0;color:#1a3a5c;font-weight:bold}` +
            `p.sub{text-align:center;color:#555;font-size:11px;margin:2px 0}` +
            `h3.title{text-align:center;font-size:14px;margin:4px 0 0 0;color:#333;text-transform:uppercase;letter-spacing:0.5px}` +
            `table{width:100%;border-collapse:collapse;margin-top:10px}` +
            `th{background:#1a3a5c;color:#fff;padding:6px 8px;font-size:10px;text-align:left}` +
            `td{padding:5px 8px;border-bottom:1px solid #e0e0e0;font-size:11px}` +
            `tr:nth-child(even) td{background:#f7f9fc}` +
            `@media print{@page{margin:10mm}}</style></head><body>` +
            `<div class="header-container">` +
            `<img src="${logoUrl}" class="header-logo" alt="Logo" />` +
            `<div class="header-text">` +
            `<h2>${schoolName}</h2>` +
            `${address ? `<p class="sub">${address}</p>` : ''}` +
            `${contact ? `<p class="sub">Contact: ${contact}</p>` : ''}` +
            `<h3 class="title">Student Directory (${students.length} Students)</h3>` +
            `</div>` +
            `</div>` +
            `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></body></html>`
        );
        win.document.close(); win.focus();
        setTimeout(() => { win.print(); }, 400);
    };

    // ── Derived values for rendering ───────────────────────────────────────────
    const activeCols = COL_DEFS.filter(c => visibleCols.has(c.key));
    const totalColSpan = activeCols.length; // actions col commented out

    return (
        <div className="container-fluid p-4 bg-light min-vh-100">
            {/* ── Page header ──────────────────────────────────────────────── */}
            <div className="d-flex justify-content-between align-items-center mb-4 p-4 rounded-4 shadow-sm" style={{ background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-teal) 100%)', color: 'white' }}>
                <div>
                    <h2 className="mb-1 fw-bold text-white" style={{ letterSpacing: '-0.5px' }}>Student Directory</h2>
                    <p className="text-white-50 mb-0">Manage and view student records</p>
                </div>
            </div>

            {/* ── Filters Card ──────────────────────────────────────────────── */}
            <div className="card shadow-lg border-0 rounded-4 mb-4 overflow-hidden">
                <div className="card-header bg-white p-3 border-bottom-0">
                    <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-2" style={{ color: 'var(--primary-dark)' }}>
                            <i className="bi bi-funnel-fill"></i>
                            <span className="fw-bold text-uppercase small" style={{ letterSpacing: '1px' }}>Smart Filters</span>
                        </div>
                        <button className="btn btn-sm" style={{
                            backgroundColor: showAdvancedFilters ? 'var(--primary-teal)' : 'transparent',
                            color: showAdvancedFilters ? 'white' : 'var(--primary-teal)',
                            border: '1px solid var(--primary-teal)'
                        }}
                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
                            <i className="bi bi-sliders me-1"></i> Advanced
                        </button>
                    </div>
                </div>
                <div className="card-body p-4 bg-light">
                    <form onSubmit={(e) => e.preventDefault()}>
                        {/* Row 1 primary search */}
                        <div className="row g-3 mb-3">
                            <div className="col-md-3">
                                <div className="input-group">
                                    <span className="input-group-text bg-white border-end-0"><i className="bi bi-search text-muted"></i></span>
                                    <input type="text" className="form-control border-start-0 ps-0" placeholder="Name / Roll / Adm No..."
                                        value={filters.keyword} onChange={e => setFilters({ ...filters, keyword: e.target.value })} />
                                    {filters.keyword && (
                                        <button className="btn btn-outline-secondary border border-start-0" type="button" onClick={() => setFilters({ ...filters, keyword: '' })}>
                                            <i className="bi bi-x"></i>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="col-md-3">
                                <select className="form-select" value={filters.class_id} onChange={handleClassChange} disabled={!!isClassTeacher}>
                                    <option value="">All Classes</option>
                                    {classes.map((c: any) => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                                </select>
                            </div>
                            <div className="col-md-3">
                                <select className="form-select" value={filters.section_id}
                                    onChange={e => setFilters({ ...filters, section_id: e.target.value })}
                                    disabled={!filters.class_id || !!isClassTeacher}>
                                    <option value="">All Sections</option>
                                    {sections.map((s: any) => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
                                </select>
                            </div>
                            <div className="col-md-3">
                                <div className="input-group">
                                    <span className="input-group-text bg-white border-end-0"><i className="bi bi-people-fill text-muted"></i></span>
                                    <input type="text" className="form-control border-start-0 ps-0" placeholder="Family ID..."
                                        value={filters.family_id} onChange={e => setFilters({ ...filters, family_id: e.target.value })} />
                                    {filters.family_id && (
                                        <button className="btn btn-outline-secondary border border-start-0" type="button" onClick={() => setFilters({ ...filters, family_id: '' })}>
                                            <i className="bi bi-x"></i>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Row 2 advanced filters */}
                        {showAdvancedFilters && (
                            <div className="row g-3 animate__animated animate__fadeIn">
                                <div className="col-md-2">
                                    <label className="form-label small text-muted text-uppercase fw-bold">Gender</label>
                                    <select className="form-select form-select-sm" value={filters.gender} onChange={e => setFilters({ ...filters, gender: e.target.value })}>
                                        <option value="">Any</option>
                                        <option>Male</option>
                                        <option>Female</option>
                                    </select>
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label small text-muted text-uppercase fw-bold">Status</label>
                                    <select className="form-select form-select-sm" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                                        <option value="">Any</option>
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                        <option value="Left">Left</option>
                                        <option value="Suspended">Suspended</option>
                                    </select>
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label small text-muted text-uppercase fw-bold">Category</label>
                                    <select className="form-select form-select-sm" value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })}>
                                        <option value="">Any</option>
                                        <option>Normal</option>
                                        <option>Trusted</option>
                                    </select>
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label small text-muted text-uppercase fw-bold">Blood Group</label>
                                    <select className="form-select form-select-sm" value={filters.blood_group} onChange={e => setFilters({ ...filters, blood_group: e.target.value })}>
                                        <option value="">Any</option>
                                        <option>A+</option><option>A-</option>
                                        <option>B+</option><option>B-</option>
                                        <option>O+</option><option>O-</option>
                                        <option>AB+</option><option>AB-</option>
                                    </select>
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label small text-muted text-uppercase fw-bold">Religion</label>
                                    <select className="form-select form-select-sm" value={filters.religion} onChange={e => setFilters({ ...filters, religion: e.target.value })}>
                                        <option value="">Any</option>
                                        <option>Islam</option>
                                        <option>Christianity</option>
                                        <option>Hinduism</option>
                                        <option>Other</option>
                                    </select>
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label small text-muted text-uppercase fw-bold">Age (Years)</label>
                                    <input type="number" className="form-control form-control-sm" placeholder="e.g. 15"
                                        onKeyDown={e => ['e', 'E', '+', '-', '.'].includes(e.key) && e.preventDefault()}
                                        value={filters.age} onChange={e => setFilters({ ...filters, age: e.target.value })} />
                                </div>
                                <div className="col-12 text-end">
                                    <button type="button" className="btn btn-link text-muted text-decoration-none btn-sm"
                                        onClick={resetFilters}>
                                        <i className="bi bi-x-circle me-1"></i> Clear All Filters
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            </div>

            {/* ── Results Table ─────────────────────────────────────────────── */}
            <div className="row animate__animated animate__fadeInUp">
                <div className="col-12">
                    <div className="card shadow-lg border-0 rounded-4 h-100">

                        {/* Card header: result count + exports + column picker */}
                        <div className="card-header bg-white p-3 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <h5 className="mb-0 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                                Results <span className="badge ms-2" style={{ backgroundColor: 'var(--primary-teal)', color: 'white' }}>{students.length}</span>
                            </h5>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                {/* Export icons */}
                                <button className="btn btn-sm btn-outline-danger" onClick={doExportPDF} title="Export PDF">
                                    <i className="bi bi-file-earmark-pdf"></i>
                                </button>
                                <button className="btn btn-sm btn-outline-success" onClick={doExportExcel} title="Export Excel">
                                    <i className="bi bi-file-earmark-spreadsheet"></i>
                                </button>
                                <button className="btn btn-sm btn-outline-secondary" onClick={doExportCSV} title="Export CSV">
                                    <i className="bi bi-filetype-csv"></i>
                                </button>
                                {/* Quick Blank Column Toggle */}
                                <button
                                    className={`btn btn-sm d-flex align-items-center gap-1 ${visibleCols.has('remarks') ? 'btn-primary' : 'btn-outline-primary'}`}
                                    onClick={() => toggleCol('remarks')}
                                    title="Toggle Blank Remarks Column for Hand Writing when Printing"
                                    style={{ borderRadius: 6, fontWeight: 500, fontSize: 12 }}
                                >
                                    <i className={`bi ${visibleCols.has('remarks') ? 'bi-pencil-square' : 'bi-journal-plus'}`}></i>
                                    <span>{visibleCols.has('remarks') ? 'Blank Column ON' : '+ Blank Column'}</span>
                                </button>
                                <div className="vr" style={{ height: 24 }}></div>
                                {/* Column picker */}
                                <div className="position-relative" ref={colPickerRef}>
                                    <button
                                        className="btn btn-sm"
                                        style={{ backgroundColor: showColPicker ? 'var(--primary-teal)' : 'white', color: showColPicker ? 'white' : 'var(--primary-teal)', border: '1px solid var(--primary-teal)' }}
                                        onClick={() => setShowColPicker(v => !v)}
                                        title="Select visible columns"
                                    >
                                        <i className="bi bi-eye me-1"></i>Columns
                                        <span className="badge ms-1" style={{
                                            background: showColPicker ? 'rgba(255,255,255,0.3)' : 'var(--bs-primary)',
                                            color: '#fff', fontSize: 10
                                        }}>{visibleCols.size}</span>
                                    </button>

                                    {showColPicker && (
                                        <div
                                            className="position-absolute end-0 bg-white border rounded-3 shadow-lg mt-1"
                                            style={{ zIndex: 1050, minWidth: 270, maxHeight: 430, overflowY: 'auto', top: '100%' }}
                                        >
                                            <div className="p-3 pb-0">
                                                <div className="d-flex justify-content-between align-items-center mb-2">
                                                    <span className="fw-bold small text-uppercase text-muted" style={{ letterSpacing: '0.6px' }}>
                                                        Toggle Columns
                                                    </span>
                                                    <div className="d-flex gap-2">
                                                        <button className="btn btn-link btn-sm p-0 text-primary text-decoration-none small"
                                                            onClick={() => setVisibleCols(new Set(COL_DEFS.map(c => c.key)))}>
                                                            All
                                                        </button>
                                                        <span className="text-muted">|</span>
                                                        <button className="btn btn-link btn-sm p-0 text-danger text-decoration-none small"
                                                            onClick={() => setVisibleCols(new Set())}>
                                                            None
                                                        </button>
                                                    </div>
                                                </div>
                                                <hr className="my-2" />
                                            </div>
                                            <div className="px-3 pb-3">
                                                {COL_DEFS.map(col => (
                                                    <div key={col.key} className="form-check form-switch mb-1 py-1">
                                                        <input
                                                            className="form-check-input"
                                                            type="checkbox"
                                                            role="switch"
                                                            id={`col-${col.key}`}
                                                            checked={visibleCols.has(col.key)}
                                                            onChange={() => toggleCol(col.key)}
                                                        />
                                                        <label className="form-check-label small" htmlFor={`col-${col.key}`}>
                                                            {col.label}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="card-body p-0">
                            <div className="table-responsive" style={{ borderTop: '1px solid #f0f0f0' }}>
                                <table className="table table-hover table-borderless align-middle mb-0">
                                    <thead className="text-uppercase small text-muted" style={{ backgroundColor: 'var(--primary-dark)', color: 'white' }}>
                                        <tr>
                                            {activeCols.map(col => (
                                                <th key={col.key} className={col.key === 'sno' ? 'ps-3' : ''}
                                                    style={{ whiteSpace: 'nowrap' }}>
                                                    {col.label}
                                                </th>
                                            ))}
                                            {/* <th className="text-end pe-4">Actions</th> */}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr>
                                                <td colSpan={totalColSpan} className="text-center p-5">
                                                    <div className="spinner-border text-primary" role="status"></div>
                                                </td>
                                            </tr>
                                        ) : students.length === 0 ? (
                                            <tr>
                                                <td colSpan={totalColSpan} className="text-center p-5 text-muted">
                                                    <i className="bi bi-emoji-frown fs-1 d-block mb-3"></i>
                                                    No students found matching your criteria
                                                </td>
                                            </tr>
                                        ) : (
                                            students.map((s, idx) => (
                                                <tr key={s.student_id} style={{ cursor: 'pointer' }}
                                                    onClick={() => router.push(`/students/profile/${s.student_id}`)}>
                                                    {activeCols.map(col => (
                                                        <td key={col.key} className={col.key === 'sno' ? 'ps-3' : ''}>
                                                            {renderCell(col.key, s, idx)}
                                                        </td>
                                                    ))}
                                                    {/* ACTION BUTTONS temporarily hidden */}
                                                    {false && (
                                                        <td className="text-end pe-4" onClick={e => e.stopPropagation()}>
                                                            <button
                                                                className="btn btn-sm btn-outline-primary me-2 rounded-circle"
                                                                onClick={() => router.push(`/students/profile/${s.student_id}`)}
                                                                title="View Details"
                                                                style={{ width: '32px', height: '32px' }}
                                                            >
                                                                <i className="bi bi-eye"></i>
                                                            </button>
                                                            {hasPermission('students', 'delete') && (
                                                                <button
                                                                    className="btn btn-sm btn-outline-danger rounded-circle"
                                                                    onClick={() => handleDelete(s.student_id)}
                                                                    title="Delete"
                                                                    style={{ width: '32px', height: '32px' }}
                                                                >
                                                                    <i className="bi bi-trash"></i>
                                                                </button>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="card-footer bg-white p-3 text-muted small text-center border-top-0">
                            Showing {students.length} Records
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
