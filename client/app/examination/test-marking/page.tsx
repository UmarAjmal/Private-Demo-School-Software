'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastHelper';

type ClassItem = { class_id: number; class_name: string };
type SectionItem = { section_id: number; section_name: string; class_id: number };
type SubjectItem = {
    subject_id: number; subject_name: string; subject_code?: string | null;
    section_id: number; class_id: number;
};

type TestPaper = {
    test_id: number; test_name: string; description?: string | null;
    total_marks: number; created_at: string; created_by_name: string;
    marks_entered: number;
};

type StudentMarkRow = {
    student_id: number; first_name: string; last_name: string;
    admission_no?: string | null; roll_no?: string | null;
    test_mark_id?: number | null; obtained_marks?: number | null; remarks?: string | null;
};

type SheetData = {
    test: TestPaper & { class_name: string; section_name: string; subject_name: string };
    readonly: boolean;
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

export default function TestMarkingPage() {
    const { user, hasPermission } = useAuth();

    // ── context state ────────────────────────────────────────────────────────
    const [loadingCtx, setLoadingCtx] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [sections, setSections] = useState<SectionItem[]>([]);
    const [subjects, setSubjects] = useState<SubjectItem[]>([]);

    // ── filter selectors ─────────────────────────────────────────────────────
    const [selClass, setSelClass] = useState('');
    const [selSection, setSelSection] = useState('');
    const [selSubject, setSelSubject] = useState('');
    const [searchKeyword, setSearchKeyword] = useState('');

    // ── tests list ───────────────────────────────────────────────────────────
    const [loadingTests, setLoadingTests] = useState(false);
    const [tests, setTests] = useState<TestPaper[]>([]);

    // ── create-test form ─────────────────────────────────────────────────────
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [formName, setFormName] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formTotal, setFormTotal] = useState('');
    const [creating, setCreating] = useState(false);

    // ── marking sheet ────────────────────────────────────────────────────────
    const [selectedTest, setSelectedTest] = useState<number | null>(null);
    const [loadingSheet, setLoadingSheet] = useState(false);
    const [sheet, setSheet] = useState<SheetData | null>(null);
    const [obtainedMap, setObtainedMap] = useState<Record<number, string>>({});
    const [remarksMap, setRemarksMap] = useState<Record<number, string>>({});
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // ── messages ─────────────────────────────────────────────────────────────
    const [msg, setMsg] = useState<{ type: 'success' | 'danger' | 'warning'; text: string } | null>(null);

    // ── derived lists ─────────────────────────────────────────────────────────
    const filteredSections = useMemo(() =>
        selClass ? sections.filter(s => s.class_id === Number(selClass)) : [],
        [sections, selClass]
    );

    const filteredSubjects = useMemo(() =>
        (selClass && selSection)
            ? subjects.filter(s => s.class_id === Number(selClass) && s.section_id === Number(selSection))
            : [],
        [subjects, selClass, selSection]
    );

    const readyToList = !!(selClass && selSection && selSubject && user?.id);

    // ── load context ──────────────────────────────────────────────────────────
    const loadContext = async () => {
        if (!user?.id) { setLoadingCtx(false); return; }
        setLoadingCtx(true);
        setMsg(null);
        try {
            const d = await fetchJson(`${API}/exams/tests/context?user_id=${user.id}`);
            setIsAdmin(!!d.is_admin);
            setClasses(d.classes || []);
            setSections(d.sections || []);
            setSubjects(d.subjects || []);
        } catch (e: any) {
            const errText = e.message || 'Failed to load context';
            setMsg({ type: 'danger', text: errText });
            showToast.error(errText);
        } finally {
            setLoadingCtx(false);
        }
    };

    useEffect(() => { loadContext(); }, [user?.id]);

    // cascade resets
    useEffect(() => { setSelSection(''); setSelSubject(''); setTests([]); setSelectedTest(null); setSheet(null); }, [selClass]);
    useEffect(() => { setSelSubject(''); setTests([]); setSelectedTest(null); setSheet(null); }, [selSection]);
    useEffect(() => { setTests([]); setSelectedTest(null); setSheet(null); }, [selSubject]);

    useEffect(() => {
        if (filteredSections.length === 1 && !selSection)
            setSelSection(String(filteredSections[0].section_id));
    }, [filteredSections]);

    useEffect(() => {
        if (filteredSubjects.length === 1 && !selSubject)
            setSelSubject(String(filteredSubjects[0].subject_id));
    }, [filteredSubjects]);

    // Seamless auto loading on filter selection
    const loadTests = async () => {
        if (!readyToList || !user?.id) return;
        setLoadingTests(true);
        setMsg(null);
        try {
            const p = new URLSearchParams({ user_id: String(user.id), class_id: selClass, section_id: selSection, subject_id: selSubject });
            const d = await fetchJson(`${API}/exams/tests?${p}`);
            setTests(d.tests || []);
        } catch (e: any) {
            const errText = e.message || 'Failed to load tests';
            setMsg({ type: 'danger', text: errText });
            showToast.error(errText);
        } finally {
            setLoadingTests(false);
        }
    };

    useEffect(() => {
        if (readyToList) loadTests();
    }, [selClass, selSection, selSubject, user?.id]);

    // ── create test ───────────────────────────────────────────────────────────
    const handleCreate = async () => {
        if (!user?.id || !readyToList) return;
        if (!formName.trim()) {
            const txt = 'Test name is required.';
            setMsg({ type: 'warning', text: txt });
            showToast.warning(txt);
            return;
        }
        const tm = Number(formTotal);
        if (!Number.isFinite(tm) || tm <= 0) {
            const txt = 'Total marks must be > 0.';
            setMsg({ type: 'warning', text: txt });
            showToast.warning(txt);
            return;
        }

        setCreating(true);
        setMsg(null);
        try {
            const d = await fetchJson(`${API}/exams/tests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    class_id: Number(selClass),
                    section_id: Number(selSection),
                    subject_id: Number(selSubject),
                    test_name: formName.trim(),
                    description: formDesc.trim() || null,
                    total_marks: tm,
                })
            });
            const succMsg = d.message || 'Test created successfully.';
            setMsg({ type: 'success', text: succMsg });
            showToast.success(succMsg);
            setFormName(''); setFormDesc(''); setFormTotal('');
            setShowCreateForm(false);
            await loadTests();
        } catch (e: any) {
            const errText = e.message || 'Create failed';
            setMsg({ type: 'danger', text: errText });
            showToast.error(errText);
        } finally {
            setCreating(false);
        }
    };

    // ── load sheet for selected test ──────────────────────────────────────────
    const openSheet = async (testId: number) => {
        if (!user?.id) return;
        setSelectedTest(testId);
        setLoadingSheet(true);
        setMsg(null);
        try {
            const p = new URLSearchParams({ user_id: String(user.id) });
            const d: SheetData = await fetchJson(`${API}/exams/tests/${testId}/sheet?${p}`);
            setSheet(d);

            const oMap: Record<number, string> = {};
            const rMap: Record<number, string> = {};
            (d.students || []).forEach(s => {
                oMap[s.student_id] = s.obtained_marks !== null && s.obtained_marks !== undefined ? String(s.obtained_marks) : '';
                rMap[s.student_id] = s.remarks || '';
            });
            setObtainedMap(oMap);
            setRemarksMap(rMap);
        } catch (e: any) {
            setSheet(null);
            const errText = e.message || 'Failed to open sheet';
            setMsg({ type: 'danger', text: errText });
            showToast.error(errText);
        } finally {
            setLoadingSheet(false);
        }
    };

    // ── save marks for selected test ──────────────────────────────────────────
    const handleSaveMarks = async () => {
        if (!user?.id || !sheet) return;
        const tm = sheet.test.total_marks;

        const payload = sheet.students.map(s => {
            const val = obtainedMap[s.student_id];
            const obt = (val === '' || val === undefined || val === null) ? NaN : Number(val);
            return {
                student_id: s.student_id,
                obtained_marks: obt,
                remarks: remarksMap[s.student_id] || null,
            };
        });

        for (const row of payload) {
            if (!Number.isFinite(row.obtained_marks) || row.obtained_marks < 0 || row.obtained_marks > tm) {
                const errText = `Marks for each student must be between 0 and ${tm}.`;
                setMsg({ type: 'danger', text: errText });
                showToast.error(errText);
                return;
            }
        }

        setSaving(true);
        setMsg(null);
        try {
            const d = await fetchJson(`${API}/exams/tests/${sheet.test.test_id}/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    marks: payload,
                })
            });
            const succMsg = d.message || 'Test marks saved successfully.';
            setMsg({ type: 'success', text: succMsg });
            showToast.success(succMsg);
            await loadTests();
            await openSheet(sheet.test.test_id);
        } catch (e: any) {
            const errText = e.message || 'Save failed';
            setMsg({ type: 'danger', text: errText });
            showToast.error(errText);
        } finally {
            setSaving(false);
        }
    };

    // ── delete test ───────────────────────────────────────────────────────────
    const handleDeleteTest = async (testId: number, testName: string) => {
        if (!user?.id) return;
        if (!window.confirm(`Delete test "${testName}"? All entered marks for this test will be removed.`)) return;

        setDeleting(true);
        setMsg(null);
        try {
            const p = new URLSearchParams({ user_id: String(user.id) });
            const d = await fetchJson(`${API}/exams/tests/${testId}?${p}`, { method: 'DELETE' });
            const succMsg = d.message || 'Test deleted successfully.';
            setMsg({ type: 'success', text: succMsg });
            showToast.success(succMsg);
            if (selectedTest === testId) { setSelectedTest(null); setSheet(null); }
            await loadTests();
        } catch (e: any) {
            const errText = e.message || 'Delete failed';
            setMsg({ type: 'danger', text: errText });
            showToast.error(errText);
        } finally {
            setDeleting(false);
        }
    };

    const filteredSheetStudents = useMemo(() => {
        if (!sheet?.students) return [];
        if (!searchKeyword.trim()) return sheet.students;
        const q = searchKeyword.toLowerCase().trim();
        return sheet.students.filter(s =>
            `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
            (s.roll_no || '').toLowerCase().includes(q) ||
            (s.admission_no || '').toLowerCase().includes(q)
        );
    }, [sheet, searchKeyword]);

    return (
        <div className="page-wrap" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh', padding: '1.5rem' }}>
            {/* Standard Theme Page Header */}
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-1 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-journal-check me-2" style={{ color: 'var(--accent-orange)' }} />
                        Test Marking
                    </h4>
                    <div className="text-muted small">Create and mark class tests for selected subject</div>
                </div>

                {readyToList && hasPermission('academic', 'write') && (
                    <button className="btn btn-primary-custom btn-sm fw-bold px-3" onClick={() => setShowCreateForm(p => !p)}>
                        <i className={`bi ${showCreateForm ? 'bi-x-lg' : 'bi-plus-lg'} me-1`}></i>
                        {showCreateForm ? 'Cancel' : 'New Test'}
                    </button>
                )}
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
                        Filter Test Marking
                    </h6>
                </div>
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-12 col-sm-4 col-md-4">
                            <label className="form-label fw-semibold small text-muted text-uppercase">Class</label>
                            <select className="form-select rounded-3" value={selClass} onChange={e => setSelClass(e.target.value)} disabled={loadingCtx}>
                                <option value="">Select Class</option>
                                {classes.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-4 col-md-4">
                            <label className="form-label fw-semibold small text-muted text-uppercase">Section</label>
                            <select className="form-select rounded-3" value={selSection} onChange={e => setSelSection(e.target.value)} disabled={!selClass || loadingCtx}>
                                <option value="">Select Section</option>
                                {filteredSections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-4 col-md-4">
                            <label className="form-label fw-semibold small text-muted text-uppercase">Subject</label>
                            <select className="form-select rounded-3" value={selSubject} onChange={e => setSelSubject(e.target.value)} disabled={!selSection || loadingCtx}>
                                <option value="">Select Subject</option>
                                {filteredSubjects.map(s => <option key={s.subject_id} value={s.subject_id}>{s.subject_name}{s.subject_code ? ` (${s.subject_code})` : ''}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create New Test Form */}
            {showCreateForm && readyToList && (
                <div className="card border-0 shadow-sm mb-4" style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                    <div className="card-body">
                        <h6 className="fw-bold mb-3" style={{ color: 'var(--primary-dark)' }}>Create New Class Test</h6>
                        <div className="row g-3">
                            <div className="col-12 col-md-6">
                                <label className="form-label small fw-semibold text-muted text-uppercase">Test Name *</label>
                                <input type="text" className="form-control rounded-3" placeholder="e.g. Test #1 - Chapter 1" value={formName} onChange={e => setFormName(e.target.value)} />
                            </div>
                            <div className="col-12 col-md-3">
                                <label className="form-label small fw-semibold text-muted text-uppercase">Total Marks *</label>
                                <input type="number" className="form-control rounded-3 text-center fw-bold" placeholder="25" min={1} value={formTotal} onChange={e => setFormTotal(e.target.value)} />
                            </div>
                            <div className="col-12 col-md-3 d-flex align-items-end">
                                <button className="btn btn-primary-custom fw-bold w-100 py-2 rounded-3" onClick={handleCreate} disabled={creating}>
                                    {creating ? 'Creating...' : 'Create Test'}
                                </button>
                            </div>
                            <div className="col-12">
                                <input type="text" className="form-control rounded-3" placeholder="Description / topics (optional)..." value={formDesc} onChange={e => setFormDesc(e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tests List & Marking Sheet */}
            {readyToList && (
                <div className="row g-3">
                    {/* Left Column: Test Papers List */}
                    <div className={sheet ? "col-12 col-lg-4" : "col-12"}>
                        <div className="card border-0 shadow-sm">
                            <div className="card-header bg-white border-bottom py-3" style={{ borderLeft: '4px solid var(--accent-orange)' }}>
                                <div className="fw-semibold" style={{ color: 'var(--primary-dark)' }}>
                                    Class Tests ({tests.length})
                                </div>
                            </div>
                            <div className="card-body p-0">
                                {loadingTests ? (
                                    <div className="text-center p-4 text-muted">Loading class tests...</div>
                                ) : tests.length === 0 ? (
                                    <div className="text-center p-4 text-muted">No tests created for this subject yet.</div>
                                ) : (
                                    <div className="list-group list-group-flush">
                                        {tests.map(t => {
                                            const isActive = selectedTest === t.test_id;
                                            return (
                                                <button key={t.test_id}
                                                    className={`list-group-item list-group-item-action p-3 text-start border-bottom ${isActive ? 'bg-light border-start border-4 border-teal' : ''}`}
                                                    style={{ borderLeftColor: isActive ? 'var(--primary-teal)' : 'transparent' }}
                                                    onClick={() => openSheet(t.test_id)}>
                                                    <div className="d-flex justify-content-between align-items-start mb-1">
                                                        <span className="fw-bold text-dark">{t.test_name}</span>
                                                        <span className="badge bg-light text-dark border fw-bold">{t.total_marks} Marks</span>
                                                    </div>
                                                    <div className="d-flex justify-content-between align-items-center mt-2 small">
                                                        <span className="text-muted"><i className="bi bi-person me-1"></i>{t.created_by_name || 'Teacher'}</span>
                                                        <span className={`badge ${t.marks_entered > 0 ? 'bg-success-subtle text-success-emphasis border' : 'bg-warning-subtle text-warning-emphasis border'}`}>
                                                            {t.marks_entered > 0 ? `${t.marks_entered} Entered` : 'Pending'}
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Marking Sheet */}
                    {sheet && (
                        <div className="col-12 col-lg-8">
                            <div className="card border-0 shadow-sm">
                                <div className="card-header bg-white border-bottom d-flex flex-column flex-md-row justify-content-between align-items-stretch align-items-md-center gap-2 py-3" style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                                    <div>
                                        <h5 className="fw-bold mb-0" style={{ color: 'var(--primary-dark)' }}>{sheet.test.test_name}</h5>
                                        <span className="text-muted small">Max Marks: {sheet.test.total_marks}</span>
                                    </div>

                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                        <div className="input-group input-group-sm" style={{ width: 170 }}>
                                            <span className="input-group-text bg-light border-0"><i className="bi bi-search text-muted"></i></span>
                                            <input type="text" className="form-control border-0 bg-light" placeholder="Search..."
                                                value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} />
                                        </div>

                                        {!sheet.readonly && hasPermission('academic', 'write') && (
                                            <button className="btn btn-primary-custom btn-sm fw-bold px-3" onClick={handleSaveMarks} disabled={saving || loadingSheet}>
                                                {saving ? 'Saving...' : <><i className="bi bi-floppy me-1"></i>Save Marks</>}
                                            </button>
                                        )}

                                        {(isAdmin || hasPermission('academic', 'delete')) && (
                                            <button className="btn btn-outline-danger btn-sm px-2.5"
                                                onClick={() => handleDeleteTest(sheet.test.test_id, sheet.test.test_name)} disabled={deleting}>
                                                <i className="bi bi-trash3"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="card-body p-0">
                                    {loadingSheet ? (
                                        <div className="text-center p-5">
                                            <div className="spinner-border text-teal" role="status" style={{ color: 'var(--primary-teal)' }}></div>
                                            <p className="text-muted mt-2 small fw-semibold">Loading student test marks...</p>
                                        </div>
                                    ) : (
                                        <div className="table-responsive">
                                            <table className="table table-hover align-middle mb-0">
                                                <thead style={{ background: 'var(--primary-dark)', color: '#fff' }}>
                                                    <tr>
                                                        <th className="ps-3" style={{ width: 40 }}>#</th>
                                                        <th>Student Name</th>
                                                        <th style={{ width: 90 }}>Roll No</th>
                                                        <th className="text-end pe-3" style={{ width: 140 }}>Obtained</th>
                                                        <th style={{ width: 180 }}>Remarks</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredSheetStudents.map((s, idx) => (
                                                        <tr key={s.student_id}>
                                                            <td className="ps-3 text-muted small fw-semibold">{idx + 1}</td>
                                                            <td className="fw-bold text-dark">{s.first_name} {s.last_name}</td>
                                                            <td>
                                                                <span className="badge bg-light text-dark border fw-semibold" style={{ fontSize: 10.5 }}>
                                                                    {s.roll_no || '—'}
                                                                </span>
                                                            </td>
                                                            <td className="text-end pe-3">
                                                                <div className="input-group input-group-sm ms-auto" style={{ width: 130 }}>
                                                                    <input
                                                                        type="number"
                                                                        className="form-control form-control-sm text-end fw-bold"
                                                                        onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                                                        min={0}
                                                                        max={sheet.test.total_marks}
                                                                        step="0.01"
                                                                        placeholder="0"
                                                                        value={obtainedMap[s.student_id] ?? ''}
                                                                        disabled={sheet.readonly || saving}
                                                                        onChange={(e) => setObtainedMap(p => ({ ...p, [s.student_id]: e.target.value }))}
                                                                    />
                                                                    <span className="input-group-text text-muted" style={{ fontSize: 10 }}>/ {sheet.test.total_marks}</span>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="text"
                                                                    className="form-control form-control-sm"
                                                                    placeholder="Remarks..."
                                                                    value={remarksMap[s.student_id] ?? ''}
                                                                    disabled={sheet.readonly || saving}
                                                                    onChange={(e) => setRemarksMap(p => ({ ...p, [s.student_id]: e.target.value }))}
                                                                />
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
                    )}
                </div>
            )}
        </div>
    );
}
