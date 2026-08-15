'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type ClassItem = {
    class_id: number;
    class_name: string;
};

type SectionItem = {
    section_id: number;
    section_name: string;
};

type StudentItem = {
    student_id: number;
    first_name: string;
    last_name: string;
    roll_no: string | null;
    is_paid: boolean;
    paid_amount: string | null;
    paid_remarks: string | null;
    collection_date: string | null;
    remarks?: string;
    selected?: boolean;
};

const API = process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com";



export default function ExamCollectionPage() {
    const { user } = useAuth();

    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [sections, setSections] = useState<SectionItem[]>([]);
    const [students, setStudents] = useState<StudentItem[]>([]);
    const [collectionNames, setCollectionNames] = useState<string[]>([]);

    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [collectionName, setCollectionName] = useState('');
    const [selectedCollectionOption, setSelectedCollectionOption] = useState('');
    const [isNewCollectionMode, setIsNewCollectionMode] = useState(false);
    const [collectionAmount, setCollectionAmount] = useState('');

    const [loadingContext, setLoadingContext] = useState(false);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'danger' | 'warning'; text: string } | null>(null);

    const totalStudents = students.length;
    const totalPaid = students.filter(s => s.is_paid).length;
    const pendingCount = totalStudents - totalPaid;
    const selectedCount = students.filter(s => s.selected && !s.is_paid).length;

    const resetStudentGrid = () => {
        setStudents([]);
    };

    const loadClasses = async () => {
        if (!user?.id) return;
        setLoadingContext(true);
        setMsg(null);
        try {
            const res = await fetch(`${API}/exam-fees/classes?user_id=${user.id}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load classes');
            setClasses(Array.isArray(data) ? data : []);
        } catch (error: any) {
            setMsg({ type: 'danger', text: error.message || 'Failed to load classes' });
        } finally {
            setLoadingContext(false);
        }
    };

    const loadSections = async (classId: string) => {
        if (!user?.id || !classId) {
            setSections([]);
            return;
        }
        try {
            const res = await fetch(`${API}/exam-fees/sections?class_id=${classId}&user_id=${user.id}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load sections');
            setSections(Array.isArray(data) ? data : []);
        } catch (error: any) {
            setSections([]);
            setMsg({ type: 'danger', text: error.message || 'Failed to load sections' });
        }
    };

    const loadCollectionNames = useCallback(async (classId: string, sectionId: string) => {
        if (!classId || !sectionId) {
            setCollectionNames([]);
            return;
        }

        try {
            const params = new URLSearchParams({ class_id: classId, section_id: sectionId });
            const res = await fetch(`${API}/exam-fees/collection-names?${params}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load collection names');
            setCollectionNames(Array.isArray(data) ? data : []);
        } catch {
            setCollectionNames([]);
        }
    }, []);

    const fetchStudents = useCallback(async (collectionNameOverride?: string) => {
        if (!selectedClass || !selectedSection) return;
        setLoadingStudents(true);
        setMsg(null);
        try {
            const activeCollectionName = collectionNameOverride ?? collectionName;
            const params = new URLSearchParams({
                class_id: selectedClass,
                section_id: selectedSection,
                collection_name: activeCollectionName
            });
            const res = await fetch(`${API}/exam-fees/students?${params}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load students');

            const rows: StudentItem[] = Array.isArray(data)
                ? data.map((student: StudentItem) => ({
                    ...student,
                    remarks: student.paid_remarks || '',
                    selected: false,
                }))
                : [];

            setStudents(rows);
        } catch (error: any) {
            setStudents([]);
            setMsg({ type: 'danger', text: error.message || 'Failed to load students' });
        } finally {
            setLoadingStudents(false);
        }
    }, [selectedClass, selectedSection, collectionName]);

    useEffect(() => {
        loadClasses();
    }, [user?.id]);

    useEffect(() => {
        if (!selectedClass) {
            setSections([]);
            setCollectionNames([]);
            return;
        }
        loadSections(selectedClass);
    }, [selectedClass]);

    useEffect(() => {
        if (!selectedClass || !selectedSection) {
            setCollectionNames([]);
            return;
        }
        loadCollectionNames(selectedClass, selectedSection);
    }, [selectedClass, selectedSection, loadCollectionNames]);

    useEffect(() => {
        if (selectedClass && selectedSection) {
            fetchStudents();
        } else {
            resetStudentGrid();
        }
    }, [selectedClass, selectedSection, fetchStudents]);

    const handleClassChange = (classId: string) => {
        setSelectedClass(classId);
        setSelectedSection('');
        setCollectionName('');
        setSelectedCollectionOption('');
        setIsNewCollectionMode(false);
        resetStudentGrid();
    };

    const handleCollectionOptionChange = (value: string) => {
        setSelectedCollectionOption(value);

        if (value === '__new__') {
            setIsNewCollectionMode(true);
            setCollectionName('');
            return;
        }

        setIsNewCollectionMode(false);
        setCollectionName(value);
        if (selectedClass && selectedSection) {
            fetchStudents(value);
        }
    };

    const handleSelectAll = (checked: boolean) => {
        setStudents(prev => prev.map(student => (student.is_paid ? student : { ...student, selected: checked })));
    };

    const handleStudentCheck = (studentId: number, checked: boolean) => {
        setStudents(prev => prev.map(student => (student.student_id === studentId ? { ...student, selected: checked } : student)));
    };

    const handleRemarkChange = (studentId: number, value: string) => {
        setStudents(prev => prev.map(student => (student.student_id === studentId ? { ...student, remarks: value } : student)));
    };

    const handleSave = async () => {
        if (!collectionName.trim()) {
            setMsg({ type: 'warning', text: 'Exam/Collection name is required.' });
            return;
        }
        if (!collectionAmount.trim()) {
            setMsg({ type: 'warning', text: 'Amount is required.' });
            return;
        }

        const selectedRows = students
            .filter(student => student.selected && !student.is_paid)
            .map(student => ({
                student_id: student.student_id,
                amount: collectionAmount,
                remarks: student.remarks || null,
            }));

        if (selectedRows.length === 0) {
            setMsg({ type: 'warning', text: 'Select at least one unpaid student.' });
            return;
        }

        if (!window.confirm(`Save exam collection for ${selectedRows.length} students?`)) return;

        setSaving(true);
        setMsg(null);
        try {
            const res = await fetch(`${API}/exam-fees/collect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user?.id,
                    class_id: selectedClass,
                    section_id: selectedSection,
                    collection_name: collectionName.trim(),
                    students: selectedRows,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save collection');

            setMsg({ type: 'success', text: data.message || 'Collection saved successfully.' });
            await loadCollectionNames(selectedClass, selectedSection);
            setSelectedCollectionOption(collectionName.trim());
            setIsNewCollectionMode(false);
            await fetchStudents();
        } catch (error: any) {
            setMsg({ type: 'danger', text: error.message || 'Error while saving collection' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="page-wrap" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-1 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-cash-coin me-2" style={{ color: 'var(--accent-orange)' }} />
                        Exam Collection
                    </h4>
                    <div className="text-muted small">Create and submit exam fee collection for selected students</div>
                </div>
                <span className="badge rounded-pill bg-light text-dark border">
                    <i className="bi bi-people-fill me-1" /> Selected: {selectedCount}
                </span>
            </div>

            {msg && (
                <div className={`alert alert-${msg.type} alert-dismissible`} role="alert">
                    {msg.text}
                    <button type="button" className="btn-close" onClick={() => setMsg(null)} />
                </div>
            )}

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-white border-bottom py-3" style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                    <h6 className="mb-0 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-funnel-fill me-2" style={{ color: 'var(--primary-teal)' }} />
                        Collection Filters
                    </h6>
                </div>
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-md-2">
                            <label className="form-label fw-semibold">Class</label>
                            <select
                                className="form-select"
                                value={selectedClass}
                                onChange={e => handleClassChange(e.target.value)}
                                disabled={loadingContext}
                            >
                                <option value="">Select Class</option>
                                {classes.map(c => (
                                    <option key={c.class_id} value={c.class_id}>
                                        {c.class_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-2">
                            <label className="form-label fw-semibold">Section</label>
                            <select
                                className="form-select"
                                value={selectedSection}
                                onChange={e => {
                                    setSelectedSection(e.target.value);
                                    setCollectionName('');
                                    setSelectedCollectionOption('');
                                    setIsNewCollectionMode(false);
                                }}
                                disabled={!selectedClass || loadingContext}
                            >
                                <option value="">Select Section</option>
                                {sections.map(s => (
                                    <option key={s.section_id} value={s.section_id}>
                                        {s.section_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-4">
                            <label className="form-label fw-semibold">Collection Name</label>
                            <div className="border rounded-3 p-2 bg-light-subtle">
                                {!isNewCollectionMode ? (
                                    <div className="input-group input-group-sm">
                                        <select
                                            className="form-select"
                                            value={selectedCollectionOption}
                                            onChange={e => handleCollectionOptionChange(e.target.value)}
                                            disabled={!selectedClass || !selectedSection}
                                        >
                                            <option value="">Select Existing Collection</option>
                                            {collectionNames.map(name => (
                                                <option key={name} value={name}>
                                                    {name}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className="btn btn-outline-primary"
                                            title="Create new collection"
                                            onClick={() => {
                                                setIsNewCollectionMode(true);
                                                setSelectedCollectionOption('__new__');
                                                setCollectionName('');
                                            }}
                                            disabled={!selectedClass || !selectedSection}
                                        >
                                            <i className="bi bi-plus-lg" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="input-group input-group-sm">
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={collectionName}
                                            onChange={e => setCollectionName(e.target.value)}
                                            onBlur={() => {
                                                if (selectedClass && selectedSection) fetchStudents();
                                            }}
                                            placeholder="Enter new collection name"
                                            maxLength={200}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary"
                                            title="Back to existing list"
                                            onClick={() => {
                                                setIsNewCollectionMode(false);
                                                setSelectedCollectionOption('');
                                                setCollectionName('');
                                                resetStudentGrid();
                                            }}
                                        >
                                            <i className="bi bi-x-lg" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* <div className="form-text">Old names dropdown se select karein, naya banane ke liye `+` icon use karein.</div> */}
                        </div>

                        <div className="col-md-2">
                            <label className="form-label fw-semibold">Amount (Rs.)</label>
                            <input
                                type="number"
                                className="form-control"
                                value={collectionAmount}
                                onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                onChange={e => setCollectionAmount(e.target.value)}
                                min={0}
                                step="0.01"
                            />
                        </div>

                        <div className="col-md-2">
                            <label className="form-label fw-semibold">Refresh</label>
                            <button
                                className="btn btn-outline-secondary w-100"
                                onClick={() => fetchStudents()}
                                disabled={!selectedClass || !selectedSection || loadingStudents}
                                title="Reload students"
                            >
                                {loadingStudents ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-arrow-repeat" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card border-0 shadow-sm">
                <div
                    className="card-header bg-white d-flex flex-wrap gap-2 justify-content-between align-items-center border-bottom"
                    style={{ borderLeft: '4px solid var(--accent-orange)' }}
                >
                    <h6 className="mb-0 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-table me-2" style={{ color: 'var(--accent-orange)' }} />
                        Student Collection Sheet
                        <span className="ms-2 badge bg-secondary rounded-pill">{totalStudents}</span>
                    </h6>

                    <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-success-subtle text-success-emphasis border">Paid: {totalPaid}</span>
                        <span className="badge bg-danger-subtle text-danger-emphasis border">Pending: {pendingCount}</span>
                        <button
                            className="btn btn-sm btn-primary-custom fw-semibold"
                            onClick={handleSave}
                            disabled={saving || selectedCount === 0}
                        >
                            {saving ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-1" /> Saving...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-check2-circle me-1" /> Save Collection
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="card-body p-0">
                    {loadingStudents ? (
                        <div className="text-center py-5 text-muted">
                            <span className="spinner-border spinner-border-sm me-2" /> Loading students...
                        </div>
                    ) : !selectedClass || !selectedSection ? (
                        <div className="text-center py-5 text-muted">
                            <i className="bi bi-funnel fs-2 d-block mb-2" />
                            Select class and section to load students.
                        </div>
                    ) : students.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            <i className="bi bi-inbox fs-2 d-block mb-2" />
                            No students found for selected class/section.
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0 align-middle">
                                <thead className="table-light">
                                    <tr>
                                        <th style={{ width: 48 }} className="text-center">
                                            <input
                                                type="checkbox"
                                                className="form-check-input"
                                                checked={pendingCount > 0 && selectedCount === pendingCount}
                                                onChange={e => handleSelectAll(e.target.checked)}
                                                disabled={pendingCount === 0}
                                            />
                                        </th>
                                        <th>#</th>
                                        <th>Student</th>
                                        <th>Roll No</th>
                                        <th className="text-end">Amount</th>
                                        <th>Remarks</th>
                                        <th className="text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map((student, index) => (
                                        <tr
                                            key={student.student_id}
                                            style={{
                                                background: student.selected ? 'var(--primary-teal-soft, #e8f5f5)' : undefined,
                                            }}
                                        >
                                            <td className="text-center" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    className="form-check-input"
                                                    checked={student.is_paid || !!student.selected}
                                                    disabled={student.is_paid}
                                                    onChange={e => handleStudentCheck(student.student_id, e.target.checked)}
                                                />
                                            </td>
                                            <td className="text-muted">{index + 1}</td>
                                            <td className="fw-semibold">
                                                {student.first_name} {student.last_name}
                                            </td>
                                            <td className="small text-muted">{student.roll_no || '—'}</td>
                                            <td className="text-end">
                                                <span className="badge bg-primary rounded-pill">
                                                    Rs. {student.is_paid ? student.paid_amount || '0' : collectionAmount || '0'}
                                                </span>
                                            </td>
                                            <td>
                                                {student.is_paid ? (
                                                    <span className="small text-muted">{student.paid_remarks || '—'}</span>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        value={student.remarks || ''}
                                                        onChange={e => handleRemarkChange(student.student_id, e.target.value)}
                                                        placeholder="Optional remarks"
                                                    />
                                                )}
                                            </td>
                                            <td className="text-center">
                                                {student.is_paid ? (
                                                    <span className="badge rounded-pill bg-success">Paid</span>
                                                ) : (
                                                    <span className="badge rounded-pill bg-secondary">Unpaid</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {students.length > 0 && (
                    <div className="card-footer bg-light d-flex justify-content-between small text-muted">
                        <span>Showing {students.length} records</span>
                        <span>
                            {totalPaid} paid · {pendingCount} unpaid · {selectedCount} selected
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
