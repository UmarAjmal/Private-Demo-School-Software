'use client';
import { useState, useEffect, useRef } from 'react';

type Class = { class_id: number; class_name: string };
type Section = { section_id: number; section_name: string; class_id: number };
type Student = {
    student_id: number; admission_no: string; roll_no: string;
    student_name: string; gender: string; father_name: string;
    father_phone: string; status: string; class_name: string;
    section_name: string; admission_date: string; monthly_fee: number;
};
type Summary = { total: number; active: number; inactive: number };

export default function StudentReportPage() {
    const [classes, setClasses] = useState<Class[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [filteredSections, setFilteredSections] = useState<Section[]>([]);
    const [classId, setClassId] = useState('');
    const [sectionId, setSectionId] = useState('');
    const [students, setStudents] = useState<Student[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/classes`).then(r => r.json()).then(setClasses).catch(console.error);
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/sections`).then(r => r.json()).then(setSections).catch(console.error);
    }, []);

    useEffect(() => {
        setSectionId('');
        if (classId) setFilteredSections(sections.filter(s => s.class_id === Number(classId)));
        else setFilteredSections(sections);
    }, [classId, sections]);

    const loadReport = async () => {
        setLoading(true); setError('');
        try {
            const params = new URLSearchParams();
            if (classId) params.append('class_id', classId);
            if (sectionId) params.append('section_id', sectionId);
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/reports/students?${params}`);
            if (!res.ok) throw new Error((await res.json()).error || 'Failed');
            const data = await res.json();
            setStudents(data.students);
            setSummary(data.summary);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    };

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`
            <html><head><title>Student Report</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
                h2 { text-align: center; margin-bottom: 4px; }
                .subtitle { text-align: center; color: #666; margin-bottom: 16px; font-size: 11px; }
                table { width: 100%; border-collapse: collapse; }
                th { background: #233D4D; color: white; padding: 7px 8px; text-align: left; font-size: 11px; }
                td { padding: 6px 8px; border-bottom: 1px solid #e0e0e0; font-size: 11px; }
                tr:nth-child(even) { background: #f9f9f9; }
                .summary-box { display: flex; gap: 20px; margin-bottom: 14px; }
                .summary-item { background: #f0f4f8; padding: 8px 16px; border-radius: 6px; }
                .summary-item strong { display: block; font-size: 18px; color: #233D4D; }
                .badge-active { background: #d4edda; color: #155724; padding: 2px 8px; border-radius: 10px; }
                .badge-inactive { background: #f8d7da; color: #721c24; padding: 2px 8px; border-radius: 10px; }
                @media print { body { margin: 10px; } }
            </style></head><body>${content.innerHTML}</body></html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 400);
    };

    return (
        <div className="p-3 p-md-4" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>
            {/* Header */}
            <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-4">
                <div>
                    <h4 className="mb-1 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-people-fill me-2" style={{ color: 'var(--accent-orange)' }} />
                        Student Report
                    </h4>
                    <div className="text-muted small">Class & Section wise student list</div>
                </div>
            </div>

            {/* Filters */}
            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-white border-bottom py-3" style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                    <h6 className="mb-0 fw-bold"><i className="bi bi-funnel me-2 text-muted" />Filters</h6>
                </div>
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-12 col-md-3">
                            <label className="form-label fw-semibold small mb-1">Class</label>
                            <select className="form-select form-select-sm" value={classId} onChange={e => setClassId(e.target.value)}>
                                <option value="">All Classes</option>
                                {classes.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-md-3">
                            <label className="form-label fw-semibold small mb-1">Section</label>
                            <select className="form-select form-select-sm" value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={!classId}>
                                <option value="">All Sections</option>
                                {filteredSections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-md-4 d-flex gap-2">
                            <button className="btn btn-sm fw-bold px-4 flex-grow-1" style={{ background: 'var(--primary-teal)', color: '#fff', height: 34 }} onClick={loadReport} disabled={loading}>
                                {loading ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-search me-2" />}
                                Generate
                            </button>
                            {students.length > 0 && (
                                <button className="btn btn-outline-secondary btn-sm fw-bold px-3" onClick={handlePrint}>
                                    <i className="bi bi-printer" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {/* Report Content */}
            {students.length > 0 && (
                <div className="card border-0 shadow-sm">
                    <div className="card-body p-0">
                        <div ref={printRef}>
                            <h2 style={{ textAlign: 'center', padding: '16px 0 4px', color: '#233D4D' }}>Student Report</h2>
                            <div className="text-center text-muted small mb-3">
                                {classId ? classes.find(c => String(c.class_id) === classId)?.class_name : 'All Classes'}
                                {sectionId ? ` ${filteredSections.find(s => String(s.section_id) === sectionId)?.section_name}` : ''}
                                {' | '} Generated: {new Date().toLocaleDateString('en-PK')}
                            </div>

                            {/* Summary */}
                            {summary && (
                                <div className="row g-2 g-md-3 px-3 px-md-4 mb-3">
                                    {[
                                        { label: 'Total Students', val: summary.total, color: '#233D4D', bg: '#eaf0f6' },
                                        { label: 'Active', val: summary.active, color: '#198754', bg: '#e8f5ee' },
                                        { label: 'Inactive', val: summary.inactive, color: '#dc3545', bg: '#fdecea' },
                                    ].map(s => (
                                        <div key={s.label} className="col-4">
                                            <div style={{ background: s.bg, padding: '10px 14px', borderRadius: 8, borderTop: `3px solid ${s.color}` }}>
                                                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
                                                <div style={{ fontSize: 11, color: '#666' }}>{s.label}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="table-responsive">
                                <table className="table table-hover mb-0" style={{ fontSize: 13 }}>
                                    <thead style={{ background: '#233D4D' }}>
                                        <tr>
                                            {['#', 'Admission#', 'Roll#', 'Student Name', 'Gender', 'Class', 'Section', 'Father Name', 'Contact', 'Monthly Fee', 'Status'].map(h => (
                                                <th key={h} style={{ background: '#233D4D', color: 'white', padding: '10px 12px', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map((s, i) => (
                                            <tr key={s.student_id}>
                                                <td className="text-center text-muted small">{i + 1}</td>
                                                <td>{s.admission_no}</td>
                                                <td>{s.roll_no || '-'}</td>
                                                <td className="fw-semibold">{s.student_name}</td>
                                                <td>{s.gender || '-'}</td>
                                                <td>{s.class_name}</td>
                                                <td>{s.section_name}</td>
                                                <td>{s.father_name}</td>
                                                <td>{s.father_phone || '-'}</td>
                                                <td>Rs. {Number(s.monthly_fee || 0).toLocaleString()}</td>
                                                <td>
                                                    <span className={`badge ${s.status === 'active' ? 'bg-success' : 'bg-danger'}`}>
                                                        {s.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!loading && students.length === 0 && summary === null && (
                <div className="card border-0 shadow-sm">
                    <div className="card-body text-center py-5 text-muted">
                        <i className="bi bi-people fs-1 d-block mb-2" />
                        Select filters and click "Generate Report"
                    </div>
                </div>
            )}
        </div>
    );
}
