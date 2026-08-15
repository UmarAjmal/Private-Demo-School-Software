'use client';
import { useState, useEffect, useRef } from 'react';

type Class = { class_id: number; class_name: string };
type Section = { section_id: number; section_name: string; class_id: number };
type AcademicYear = { id: number; year_name: string; status: string };
type Term = { id: number; term_name: string; academic_year_id: number };
type ResultRow = {
    student_id: number; admission_no: string; roll_no: string;
    student_name: string; class_name: string; section_name: string;
    obtained_marks: number; total_marks: number; percentage: number; grade: string;
};

export default function ResultsReportPage() {
    const [classes, setClasses] = useState<Class[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [filteredSections, setFilteredSections] = useState<Section[]>([]);
    const [years, setYears] = useState<AcademicYear[]>([]);
    const [filteredTerms, setFilteredTerms] = useState<Term[]>([]);
    const [yearId, setYearId] = useState('');
    const [termId, setTermId] = useState('');
    const [classId, setClassId] = useState('');
    const [sectionId, setSectionId] = useState('');
    const [results, setResults] = useState<ResultRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/classes`).then(r => r.json()).then(setClasses).catch(console.error);
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/sections`).then(r => r.json()).then(setSections).catch(console.error);
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/years`).then(r => r.json()).then(data => {
            setYears(data);
            const active = data.find((y: AcademicYear) => y.status === 'active');
            if (active) setYearId(String(active.id));
        }).catch(console.error);
    }, []);

    useEffect(() => {
        setSectionId('');
        setFilteredSections(classId ? sections.filter(s => s.class_id === Number(classId)) : sections);
    }, [classId, sections]);

    useEffect(() => {
        setTermId('');
        setFilteredTerms([]);
        if (yearId) {
            fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/terms/${yearId}`)
                .then(r => r.json())
                .then(data => { setFilteredTerms(data); })
                .catch(console.error);
        }
    }, [yearId]);

    const loadReport = async () => {
        if (!yearId) { setError('Please select an academic year'); return; }
        setLoading(true); setError('');
        try {
            const params = new URLSearchParams({ academic_year_id: yearId });
            if (termId) params.append('term_id', termId);
            if (classId) params.append('class_id', classId);
            if (sectionId) params.append('section_id', sectionId);
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/reports/results?${params}`);
            if (!res.ok) throw new Error((await res.json()).error || 'Failed');
            const data = await res.json();
            setResults(data.results.map((r: ResultRow) => ({
                ...r,
                obtained_marks: Number(r.obtained_marks),
                total_marks: Number(r.total_marks),
                percentage: Number(r.percentage),
            })));
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    };

    const gradeColor = (g: string) => {
        if (g === 'A+' || g === 'A') return 'bg-success';
        if (g === 'B') return 'bg-info';
        if (g === 'C' || g === 'D') return 'bg-warning';
        if (g === 'F') return 'bg-danger';
        return 'bg-secondary';
    };

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`<html><head><title>Results Report</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
                h2 { text-align: center; margin-bottom: 4px; }
                .subtitle { text-align: center; color: #666; margin-bottom: 16px; }
                table { width: 100%; border-collapse: collapse; }
                th { background: #233D4D; color: white; padding: 7px 8px; text-align: left; font-size: 11px; }
                td { padding: 6px 8px; border-bottom: 1px solid #e0e0e0; font-size: 11px; }
                tr:nth-child(even) { background: #f9f9f9; }
                @media print { body { margin: 10px; } }
            </style></head><body>${content.innerHTML}</body></html>`);
        win.document.close(); win.focus();
        setTimeout(() => { win.print(); win.close(); }, 400);
    };

    return (
        <div className="p-3 p-md-4" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>
            <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-4">
                <div>
                    <h4 className="mb-1 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-bar-chart-fill me-2" style={{ color: 'var(--accent-orange)' }} />
                        Results Report
                    </h4>
                    <div className="text-muted small">Class & Section wise exam results</div>
                </div>
            </div>

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-white border-bottom py-3" style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                    <h6 className="mb-0 fw-bold"><i className="bi bi-funnel me-2 text-muted" />Filters</h6>
                </div>
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-12 col-sm-6 col-md-2">
                            <label className="form-label fw-semibold small mb-1">Academic Year <span className="text-danger">*</span></label>
                            <select className="form-select form-select-sm" value={yearId} onChange={e => setYearId(e.target.value)}>
                                <option value="">Select Year</option>
                                {years.map(y => <option key={y.id} value={y.id}>{y.year_name}{y.status === 'active' ? ' (Active)' : ''}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-md-2">
                            <label className="form-label fw-semibold small mb-1">Term</label>
                            <select className="form-select form-select-sm" value={termId} onChange={e => setTermId(e.target.value)} disabled={!yearId}>
                                <option value="">All Terms</option>
                                {filteredTerms.map(t => <option key={t.id} value={t.id}>{t.term_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-md-2">
                            <label className="form-label fw-semibold small mb-1">Class</label>
                            <select className="form-select form-select-sm" value={classId} onChange={e => setClassId(e.target.value)}>
                                <option value="">All Classes</option>
                                {classes.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-md-2">
                            <label className="form-label fw-semibold small mb-1">Section</label>
                            <select className="form-select form-select-sm" value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={!classId}>
                                <option value="">All Sections</option>
                                {filteredSections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-md-4 d-flex gap-2">
                            <button className="btn btn-sm fw-bold px-4 flex-grow-1" style={{ background: 'var(--primary-teal)', color: '#fff', height: 34 }} onClick={loadReport} disabled={loading || !yearId}>
                                {loading ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-search me-2" />}
                                Generate
                            </button>
                            {results.length > 0 && (
                                <button className="btn btn-outline-secondary btn-sm fw-bold px-3" onClick={handlePrint}>
                                    <i className="bi bi-printer" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {results.length > 0 && (
                <div className="card border-0 shadow-sm">
                    <div className="card-body p-0">
                        <div ref={printRef}>
                            <h2 style={{ textAlign: 'center', padding: '16px 0 4px', color: '#233D4D' }}>Results Report</h2>
                            <div className="text-center text-muted small mb-3">
                                {years.find(y => String(y.id) === yearId)?.year_name}
                                {termId ? ` ${filteredTerms.find(t => String(t.id) === termId)?.term_name}` : ' All Terms'}
                                {' | '} Generated: {new Date().toLocaleDateString('en-PK')}
                            </div>

                            {/* Quick Stats */}
                            <div className="row g-2 g-md-3 px-3 px-md-4 mb-3">
                                {[
                                    { label: 'Total Students', val: results.length, color: '#233D4D', bg: '#eaf0f6' },
                                    { label: 'Passed', val: results.filter(r => r.grade !== 'F' && r.grade !== 'N/A').length, color: '#198754', bg: '#e8f5ee' },
                                    { label: 'Failed', val: results.filter(r => r.grade === 'F').length, color: '#dc3545', bg: '#fdecea' },
                                    { label: 'No Exam Data', val: results.filter(r => r.grade === 'N/A').length, color: '#6c757d', bg: '#f0f0f0' },
                                ].map(s => (
                                    <div key={s.label} className="col-6 col-sm-3">
                                        <div style={{ background: s.bg, padding: '10px 14px', borderRadius: 8, borderTop: `3px solid ${s.color}` }}>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
                                            <div style={{ fontSize: 11, color: '#666' }}>{s.label}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="table-responsive">
                                <table className="table table-hover mb-0" style={{ fontSize: 13 }}>
                                    <thead>
                                        <tr>
                                            {['#', 'Admission#', 'Roll#', 'Student Name', 'Class', 'Section', 'Obtained', 'Total', 'Percentage', 'Grade'].map(h => (
                                                <th key={h} style={{ background: '#233D4D', color: 'white', padding: '10px 12px', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.map((r, i) => (
                                            <tr key={r.student_id}>
                                                <td className="text-center text-muted small">{i + 1}</td>
                                                <td>{r.admission_no}</td>
                                                <td>{r.roll_no || '-'}</td>
                                                <td className="fw-semibold">{r.student_name}</td>
                                                <td>{r.class_name}</td>
                                                <td>{r.section_name}</td>
                                                <td>{r.total_marks > 0 ? r.obtained_marks : '-'}</td>
                                                <td>{r.total_marks > 0 ? r.total_marks : '-'}</td>
                                                <td>{r.total_marks > 0 ? `${r.percentage.toFixed(1)}%` : '-'}</td>
                                                <td><span className={`badge ${gradeColor(r.grade)}`}>{r.grade}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!loading && results.length === 0 && (
                <div className="card border-0 shadow-sm">
                    <div className="card-body text-center py-5 text-muted">
                        <i className="bi bi-bar-chart fs-1 d-block mb-2" />
                        Select year and click "Generate Report"
                    </div>
                </div>
            )}
        </div>
    );
}
