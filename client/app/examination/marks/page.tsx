'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastHelper';

type Term = { id: number; term_name: string; start_date?: string | null; end_date?: string | null };
type ClassItem = { class_id: number; class_name: string };
type SectionItem = { section_id: number; section_name: string; class_id: number };
type SubjectItem = {
    subject_id: number;
    subject_name: string;
    subject_code?: string | null;
    section_id: number;
    section_name: string;
    class_id: number;
    class_name: string;
};
type StudentMarkRow = {
    student_id: number;
    first_name: string;
    last_name: string;
    admission_no?: string | null;
    roll_no?: string | null;
    mark_id?: number | null;
    total_marks?: number | null;
    obtained_marks?: number | null;
};

type SheetResponse = {
    readonly: boolean;
    has_any_marks: boolean;
    total_marks: number | null;
    students: StudentMarkRow[];
};

const API = process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com";

async function fetchJson(url: string, options?: RequestInit) {
    const r = await fetch(url, options);
    const contentType = r.headers.get('content-type') || '';
    let data: any = {};
    if (contentType.includes('application/json')) {
        try {
            data = await r.json();
        } catch {
            data = {};
        }
    } else {
        throw new Error(r.status === 404 ? 'API endpoint not found (404)' : `Server response error (${r.status})`);
    }

    if (!r.ok) {
        throw new Error(data.error || data.message || `Request failed with status ${r.status}`);
    }
    return data;
}

export default function ExaminationMarksPage() {
    const { user, hasPermission } = useAuth();

    const [loadingContext, setLoadingContext] = useState(true);
    const [loadingSheet, setLoadingSheet] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [isAdmin, setIsAdmin] = useState(false);
    const [activeYearName, setActiveYearName] = useState('');
    const [terms, setTerms] = useState<Term[]>([]);
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [sections, setSections] = useState<SectionItem[]>([]);
    const [subjects, setSubjects] = useState<SubjectItem[]>([]);

    const [selectedTerm, setSelectedTerm] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [searchKeyword, setSearchKeyword] = useState('');

    const [sheetReadonly, setSheetReadonly] = useState(false);
    const [sheetHasAnyMarks, setSheetHasAnyMarks] = useState(false);
    const [totalMarks, setTotalMarks] = useState('100');
    const [students, setStudents] = useState<StudentMarkRow[]>([]);
    const [obtainedMap, setObtainedMap] = useState<Record<number, string>>({});

    const [msg, setMsg] = useState<{ type: 'success' | 'danger' | 'warning'; text: string } | null>(null);

    const canUsePage = !!user;

    const filteredSections = useMemo(() => {
        if (!selectedClass) return [];
        return sections.filter(s => s.class_id === Number(selectedClass));
    }, [sections, selectedClass]);

    const filteredSubjects = useMemo(() => {
        if (!selectedClass || !selectedSection) return [];
        return subjects.filter(s => s.class_id === Number(selectedClass) && s.section_id === Number(selectedSection));
    }, [subjects, selectedClass, selectedSection]);

    const readyToLoadSheet = !!(selectedTerm && selectedClass && selectedSection && selectedSubject && user?.id);

    const loadContext = async () => {
        if (!user?.id) {
            setLoadingContext(false);
            return;
        }
        setLoadingContext(true);
        setMsg(null);
        try {
            const d = await fetchJson(`${API}/exams/context?user_id=${user.id}`);

            setIsAdmin(!!d.is_admin);
            setActiveYearName(d.active_year?.year_name || '');
            setTerms(d.terms || []);
            setClasses(d.classes || []);
            setSections(d.sections || []);
            setSubjects(d.subjects || []);

            const termList = d.terms || [];
            const classList = d.classes || [];

            setSelectedTerm(prev => {
                if (prev && termList.some((t: Term) => String(t.id) === prev)) return prev;
                return termList.length > 0 ? String(termList[0].id) : '';
            });

            setSelectedClass(prev => {
                if (prev && classList.some((c: ClassItem) => String(c.class_id) === prev)) return prev;
                return classList.length > 0 ? String(classList[0].class_id) : '';
            });
        } catch (e: any) {
            const errText = e.message || 'Failed to load context';
            setMsg({ type: 'danger', text: errText });
            showToast.error(errText);
        } finally {
            setLoadingContext(false);
        }
    };

    const loadSheet = async () => {
        if (!readyToLoadSheet || !user?.id) return;
        setLoadingSheet(true);
        setMsg(null);
        try {
            const params = new URLSearchParams({
                user_id: String(user.id),
                term_id: selectedTerm,
                class_id: selectedClass,
                section_id: selectedSection,
                subject_id: selectedSubject
            });
            const d: SheetResponse | any = await fetchJson(`${API}/exams/marking-sheet?${params.toString()}`);

            setSheetReadonly(!!d.readonly);
            setSheetHasAnyMarks(!!d.has_any_marks);
            setTotalMarks(d.total_marks !== null && d.total_marks !== undefined ? String(d.total_marks) : '100');
            setStudents(d.students || []);

            const nextMap: Record<number, string> = {};
            (d.students || []).forEach((s: StudentMarkRow) => {
                nextMap[s.student_id] = s.obtained_marks !== null && s.obtained_marks !== undefined ? String(s.obtained_marks) : '';
            });
            setObtainedMap(nextMap);
        } catch (e: any) {
            setStudents([]);
            setObtainedMap({});
            setSheetHasAnyMarks(false);
            setSheetReadonly(false);
            const errText = e.message || 'Failed to load sheet';
            setMsg({ type: 'danger', text: errText });
            showToast.error(errText);
        } finally {
            setLoadingSheet(false);
        }
    };

    useEffect(() => {
        loadContext();
    }, [user?.id]);

    useEffect(() => {
        setSelectedSection('');
        setSelectedSubject('');
        setStudents([]);
        setObtainedMap({});
        setSheetHasAnyMarks(false);
        setSheetReadonly(false);
    }, [selectedClass]);

    useEffect(() => {
        setSelectedSubject('');
        setStudents([]);
        setObtainedMap({});
        setSheetHasAnyMarks(false);
        setSheetReadonly(false);
    }, [selectedSection]);

    useEffect(() => {
        setStudents([]);
        setObtainedMap({});
        setSheetHasAnyMarks(false);
        setSheetReadonly(false);
    }, [selectedTerm, selectedSubject]);

    useEffect(() => {
        if (filteredSections.length === 1 && !selectedSection) {
            setSelectedSection(String(filteredSections[0].section_id));
        }
    }, [filteredSections, selectedSection]);

    useEffect(() => {
        if (filteredSubjects.length === 1 && !selectedSubject) {
            setSelectedSubject(String(filteredSubjects[0].subject_id));
        }
    }, [filteredSubjects, selectedSubject]);

    // Seamless Auto Load on selection
    useEffect(() => {
        if (readyToLoadSheet) {
            loadSheet();
        }
    }, [readyToLoadSheet, selectedTerm, selectedClass, selectedSection, selectedSubject]);

    const handleObtainedChange = (studentId: number, value: string) => {
        setObtainedMap(prev => ({ ...prev, [studentId]: value }));
    };

    const handleSave = async () => {
        if (!user?.id || !readyToLoadSheet) return;
        if (!Number.isFinite(Number(totalMarks)) || Number(totalMarks) <= 0) {
            const txt = 'Total marks must be greater than 0.';
            setMsg({ type: 'danger', text: txt });
            showToast.warning(txt);
            return;
        }

        const tm = Number(totalMarks);
        const payloadMarks = students.map(s => {
            const val = obtainedMap[s.student_id];
            if (val === '' || val === undefined || val === null) {
                return { student_id: s.student_id, obtained_marks: NaN };
            }
            const n = Number(val);
            return { student_id: s.student_id, obtained_marks: n };
        });

        for (const row of payloadMarks) {
            if (!Number.isFinite(row.obtained_marks) || row.obtained_marks < 0 || row.obtained_marks > tm) {
                const txt = `Invalid marks for one or more students. Must be between 0 and ${tm}.`;
                setMsg({ type: 'danger', text: txt });
                showToast.error(txt);
                return;
            }
        }

        setSaving(true);
        setMsg(null);
        try {
            const d = await fetchJson(`${API}/exams/marks/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    term_id: Number(selectedTerm),
                    class_id: Number(selectedClass),
                    section_id: Number(selectedSection),
                    subject_id: Number(selectedSubject),
                    total_marks: tm,
                    marks: payloadMarks
                })
            });
            const succMsg = d.message || 'Marks saved successfully.';
            setMsg({ type: 'success', text: succMsg });
            showToast.success(succMsg);
            await loadSheet();
        } catch (e: any) {
            const errText = e.message || 'Save failed';
            setMsg({ type: 'danger', text: errText });
            showToast.error(errText);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSheet = async () => {
        if (!user?.id || !readyToLoadSheet) return;
        if (!window.confirm('Delete this complete marks sheet? This will remove all student marks for selected term/class/section/subject.')) return;

        setDeleting(true);
        setMsg(null);
        try {
            const params = new URLSearchParams({
                user_id: String(user.id),
                term_id: selectedTerm,
                class_id: selectedClass,
                section_id: selectedSection,
                subject_id: selectedSubject
            });
            const d = await fetchJson(`${API}/exams/marks/sheet?${params.toString()}`, { method: 'DELETE' });
            const succMsg = d.message || 'Marks deleted successfully.';
            setMsg({ type: 'success', text: succMsg });
            showToast.success(succMsg);
            await loadSheet();
        } catch (e: any) {
            const errText = e.message || 'Delete failed';
            setMsg({ type: 'danger', text: errText });
            showToast.error(errText);
        } finally {
            setDeleting(false);
        }
    };

    const filteredStudents = useMemo(() => {
        if (!searchKeyword.trim()) return students;
        const q = searchKeyword.toLowerCase().trim();
        return students.filter(s =>
            `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
            (s.roll_no || '').toLowerCase().includes(q) ||
            (s.admission_no || '').toLowerCase().includes(q)
        );
    }, [students, searchKeyword]);

    if (!canUsePage) {
        return (
            <div className="container py-4">
                <div className="alert alert-danger mb-0">You do not have permission to access Examination Marks.</div>
            </div>
        );
    }

    const presentCount = students.length
        ? students.filter(s => {
            const raw = obtainedMap[s.student_id];
            const n = Number(raw);
            return Number.isFinite(n) && n > 0;
        }).length
        : 0;

    const avgMarks = students.length
        ? (() => {
            const nums = students
                .map(s => Number(obtainedMap[s.student_id]))
                .filter(n => Number.isFinite(n));
            if (!nums.length) return 0;
            return +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
        })()
        : 0;

    return (
        <div className="page-wrap" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh', padding: '1.5rem' }}>
            {/* Standard Theme Page Header */}
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-1 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-journal-check me-2" style={{ color: 'var(--accent-orange)' }} />
                        Examination Marks
                    </h4>
                    <div className="text-muted small">Enter and manage term-wise subject marks</div>
                </div>
                <span className="badge rounded-pill bg-light text-dark border">
                    Academic Year: {activeYearName || '—'}
                </span>
            </div>

            {msg && (
                <div className={`alert alert-${msg.type} alert-dismissible`} role="alert">
                    {msg.text}
                    <button type="button" className="btn-close" onClick={() => setMsg(null)} />
                </div>
            )}

            {/* Filters (Original Theme Structure) */}
            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-white border-bottom py-3" style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                    <h6 className="mb-0 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-funnel-fill me-2" style={{ color: 'var(--primary-teal)' }} />
                        Filter Marking Sheet
                    </h6>
                </div>
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-12 col-sm-6 col-md-3">
                            <label className="form-label fw-semibold small text-muted text-uppercase">Term</label>
                            <select className="form-select rounded-3" value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} disabled={loadingContext}>
                                <option value="">Select Term</option>
                                {terms.map(t => <option key={t.id} value={t.id}>{t.term_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-md-3">
                            <label className="form-label fw-semibold small text-muted text-uppercase">Class</label>
                            <select className="form-select rounded-3" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} disabled={loadingContext}>
                                <option value="">Select Class</option>
                                {classes.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-md-3">
                            <label className="form-label fw-semibold small text-muted text-uppercase">Section</label>
                            <select className="form-select rounded-3" value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} disabled={!selectedClass || loadingContext}>
                                <option value="">Select Section</option>
                                {filteredSections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-md-3">
                            <label className="form-label fw-semibold small text-muted text-uppercase">Subject</label>
                            <select className="form-select rounded-3" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} disabled={!selectedSection || loadingContext}>
                                <option value="">Select Subject</option>
                                {filteredSubjects.map(s => <option key={s.subject_id} value={s.subject_id}>{s.subject_name}{s.subject_code ? ` (${s.subject_code})` : ''}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Marking Sheet View */}
            {readyToLoadSheet && (
                <div className="card border-0 shadow-sm mb-4">
                    <div className="card-header bg-white d-flex justify-content-between align-items-center border-bottom flex-wrap gap-2 py-3" style={{ borderLeft: '4px solid var(--accent-orange)' }}>
                        <div className="fw-semibold" style={{ color: 'var(--primary-dark)' }}>
                            Marking Sheet ({students.length} students)
                        </div>

                        <div className="d-flex align-items-center gap-2 flex-wrap">
                            <div className="input-group input-group-sm" style={{ width: 170 }}>
                                <span className="input-group-text bg-light text-muted">Out of</span>
                                <input
                                    type="number"
                                    className="form-control text-center fw-bold"
                                    onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                    value={totalMarks}
                                    min={1}
                                    onChange={(e) => setTotalMarks(e.target.value)}
                                    disabled={sheetReadonly || saving || loadingSheet}
                                />
                            </div>

                            <div className="input-group input-group-sm" style={{ width: 180 }}>
                                <span className="input-group-text bg-light border-0"><i className="bi bi-search text-muted"></i></span>
                                <input
                                    type="text"
                                    className="form-control border-0 bg-light"
                                    placeholder="Search..."
                                    value={searchKeyword}
                                    onChange={(e) => setSearchKeyword(e.target.value)}
                                />
                            </div>

                            {!sheetReadonly && hasPermission('academic', 'write') && (
                                <button className="btn btn-primary-custom btn-sm fw-bold px-3" onClick={handleSave} disabled={saving || loadingSheet || students.length === 0}>
                                    {saving ? (<><span className="spinner-border spinner-border-sm me-2" />Saving...</>) : <><i className="bi bi-floppy me-1"></i>Save Marks</>}
                                </button>
                            )}

                            {isAdmin && sheetHasAnyMarks && hasPermission('academic', 'delete') && (
                                <button className="btn btn-outline-danger btn-sm px-3" onClick={handleDeleteSheet} disabled={deleting || loadingSheet}>
                                    {deleting ? 'Deleting...' : 'Delete Sheet'}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="card-body p-0">
                        {sheetReadonly && (
                            <div className="alert alert-warning m-3 mb-0">
                                This sheet is locked for your account. You can only view marks now.
                            </div>
                        )}

                        {students.length > 0 && (
                            <div className="px-3 px-md-4 py-3 border-bottom bg-light">
                                <div className="row g-2 text-center text-md-start">
                                    <div className="col-6 col-md-3">
                                        <div className="small text-muted">Students</div>
                                        <div className="fw-bold" style={{ color: 'var(--primary-dark)' }}>{students.length}</div>
                                    </div>
                                    <div className="col-6 col-md-3">
                                        <div className="small text-muted">Entered Marks</div>
                                        <div className="fw-bold" style={{ color: 'var(--primary-teal)' }}>
                                            {students.filter(s => obtainedMap[s.student_id] !== '' && obtainedMap[s.student_id] !== undefined).length}
                                        </div>
                                    </div>
                                    <div className="col-6 col-md-3">
                                        <div className="small text-muted">Average</div>
                                        <div className="fw-bold" style={{ color: 'var(--accent-orange)' }}>{avgMarks}</div>
                                    </div>
                                    <div className="col-6 col-md-3">
                                        <div className="small text-muted">Above Zero</div>
                                        <div className="fw-bold" style={{ color: 'var(--primary-dark)' }}>{presentCount}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {loadingSheet ? (
                            <div className="text-center p-5">
                                <div className="spinner-border text-teal" role="status" style={{ color: 'var(--primary-teal)' }}></div>
                                <p className="text-muted mt-2 small fw-semibold">Loading marking sheet...</p>
                            </div>
                        ) : filteredStudents.length === 0 ? (
                            <div className="text-center py-5 text-muted">
                                {students.length === 0 ? 'Load a valid term/class/section/subject to view students.' : 'No student matching search query.'}
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead style={{ background: 'var(--primary-dark)', color: '#fff' }}>
                                        <tr>
                                            <th className="ps-4">Roll No</th>
                                            <th>Admission No</th>
                                            <th>Student Name</th>
                                            <th className="text-end pe-4" style={{ width: 180 }}>Obtained Marks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStudents.map((s) => (
                                            <tr key={s.student_id}>
                                                <td className="ps-4 fw-semibold">{s.roll_no || '—'}</td>
                                                <td>{s.admission_no || '—'}</td>
                                                <td className="fw-semibold">{s.first_name} {s.last_name}</td>
                                                <td className="text-end pe-4">
                                                    <div className="input-group input-group-sm ms-auto" style={{ width: 140 }}>
                                                        <input
                                                            type="number"
                                                            className="form-control form-control-sm text-end fw-bold"
                                                            onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                                            min={0}
                                                            max={Number(totalMarks) || undefined}
                                                            step="0.01"
                                                            placeholder="0"
                                                            value={obtainedMap[s.student_id] ?? ''}
                                                            disabled={sheetReadonly || saving || loadingSheet}
                                                            onChange={(e) => handleObtainedChange(s.student_id, e.target.value)}
                                                        />
                                                        <span className="input-group-text text-muted" style={{ fontSize: 10 }}>/ {totalMarks}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
