'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type AcademicYear = {
    id: number;
    year_name: string;
    status: string;
    is_configured: boolean;
};

type Class = {
    class_id: number;
    class_name: string;
    description?: string;
};

type Section = {
    section_id: number;
    section_name: string;
    class_id: number;
};

type Student = {
    id: number;
    admission_number: string;
    student_name: string;
    father_name: string;
    class_id: number;
    class_name: string;
    section_id: number;
    section_name: string;
    total_marks: number;
    max_marks: number;
    percentage: number;
    has_record: boolean;
};

type PromotionData = {
    student_id: number;
    target_class_id: number;
    target_section_id: number;
    status: 'promoted' | 'detained' | 'left' | 'transferred';
};

export default function StudentPromotion() {
    const [years, setYears] = useState<AcademicYear[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [students, setStudents] = useState<Student[]>([]);

    const [fromYearId, setFromYearId] = useState<number | null>(null);
    const [toYearId, setToYearId] = useState<number | null>(null);
    const [filterClassId, setFilterClassId] = useState<number | null>(null);
    const [filterSectionId, setFilterSectionId] = useState<number | null>(null);

    const [loading, setLoading] = useState(false);
    const [promoting, setPromoting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
    const [promotionMap, setPromotionMap] = useState<Map<number, PromotionData>>(new Map());
    const { hasPermission } = useAuth();

    // Filter sections based on selected class
    const filteredSections = useMemo(() => {
        if (!filterClassId) return sections;
        return sections.filter(s => s.class_id === Number(filterClassId));
    }, [sections, filterClassId]);

    // Fetch initial data
    useEffect(() => {
        fetchPromotionReadyYears();
        fetchClasses();
        fetchSections();
    }, []);

    // Auto-select active year as "from" year
    useEffect(() => {
        if (years.length > 0 && !fromYearId) {
            const activeYear = years.find(y => y.status === 'active');
            if (activeYear) setFromYearId(activeYear.id);
        }
    }, [years]);

    // Reset section when class changes
    useEffect(() => {
        setFilterSectionId(null);
    }, [filterClassId]);

    const fetchPromotionReadyYears = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/years/promotion-ready`);
            if (res.ok) {
                const data = await res.json();
                setYears(data);
            }
        } catch (err) {
            console.error('Error fetching years:', err);
        }
    };

    const fetchClasses = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/classes`);
            if (res.ok) {
                const data = await res.json();
                console.log('Fetched classes:', data);
                setClasses(data);
            } else {
                console.error('Failed to fetch classes:', res.status, res.statusText);
            }
        } catch (err) {
            console.error('Error fetching classes:', err);
        }
    };

    const fetchSections = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/sections`);
            if (res.ok) {
                const data = await res.json();
                console.log('Fetched sections:', data);
                setSections(data);
            } else {
                console.error('Failed to fetch sections:', res.status, res.statusText);
            }
        } catch (err) {
            console.error('Error fetching sections:', err);
        }
    };

    const loadStudents = async () => {
        if (!fromYearId) {
            setError('Please select from year');
            return;
        }

        setLoading(true);
        setError(null);
        setStudents([]);

        try {
            const params = new URLSearchParams({ year_id: fromYearId.toString() });
            if (filterClassId) params.append('class_id', filterClassId.toString());
            if (filterSectionId) params.append('section_id', filterSectionId.toString());

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/promotion/load-students?${params}`);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                setError(errData.error || 'Failed to load students');
                return;
            }

            const data = await res.json();
            // PostgreSQL returns numeric/decimal columns as strings - parse them
            const parsedData = data.map((s: Student) => ({
                ...s,
                total_marks: Number(s.total_marks),
                max_marks: Number(s.max_marks),
                percentage: Number(s.percentage),
            }));
            setStudents(parsedData);

            // Initialize promotion map with default next class
            const newMap = new Map<number, PromotionData>();
            parsedData.forEach((student: Student) => {
                const nextClass = getNextClass(student.class_id);
                newMap.set(student.id, {
                    student_id: student.id,
                    target_class_id: nextClass?.class_id || student.class_id,
                    target_section_id: student.section_id,
                    status: 'promoted'
                });
            });
            setPromotionMap(newMap);

        } catch (err) {
            console.error('Error loading students:', err);
            setError('Network error. Could not load students.');
        } finally {
            setLoading(false);
        }
    };

    const getNextClass = (currentClassId: number) => {
        const currentClass = classes.find(c => c.class_id === currentClassId);
        if (!currentClass) return null;

        // Simple logic: extract class number and increment
        const match = currentClass.class_name.match(/\d+/);
        if (!match) return null;

        const currentNum = parseInt(match[0]);
        const nextClassName = currentClass.class_name.replace(/\d+/, String(currentNum + 1));

        return classes.find(c => c.class_name === nextClassName) || null;
    };

    const updatePromotionData = (studentId: number, field: keyof PromotionData, value: any) => {
        const newMap = new Map(promotionMap);
        const existing = newMap.get(studentId) || {
            student_id: studentId,
            target_class_id: 0,
            target_section_id: 0,
            status: 'promoted' as const
        };
        newMap.set(studentId, { ...existing, [field]: value });
        setPromotionMap(newMap);
    };

    const toggleStudent = (studentId: number) => {
        const newSelected = new Set(selectedStudents);
        if (newSelected.has(studentId)) {
            newSelected.delete(studentId);
        } else {
            newSelected.add(studentId);
        }
        setSelectedStudents(newSelected);
    };

    const selectAll = () => {
        if (selectedStudents.size === students.length) {
            setSelectedStudents(new Set());
        } else {
            setSelectedStudents(new Set(students.map(s => s.id)));
        }
    };

    const executePromotion = async () => {
        if (!fromYearId || !toYearId) {
            setError('Please select both from year and to year');
            return;
        }

        if (selectedStudents.size === 0) {
            setError('Please select at least one student');
            return;
        }

        if (!confirm(`Promote ${selectedStudents.size} student(s) from ${years.find(y => y.id === fromYearId)?.year_name} to ${years.find(y => y.id === toYearId)?.year_name}?`)) {
            return;
        }

        setPromoting(true);
        setError(null);

        try {
            const studentsToPromote = Array.from(selectedStudents).map(id => promotionMap.get(id)!);

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/promotion/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    students: studentsToPromote,
                    from_year_id: fromYearId,
                    to_year_id: toYearId,
                    promoted_by: 1 // TODO: Get from auth context
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                setError(errData.error || 'Promotion failed');
                return;
            }

            const result = await res.json();
            alert(`Success! ${result.successCount} students promoted.${result.failedCount > 0 ? ` ${result.failedCount} failed.` : ''}`);

            // Reload students
            setSelectedStudents(new Set());
            loadStudents();

        } catch (err) {
            console.error('Promotion error:', err);
            setError('Network error. Promotion failed.');
        } finally {
            setPromoting(false);
        }
    };

    const getStatusBadge = (percentage: number) => {
        if (percentage >= 80) return { grade: 'A+', class: 'bg-success' };
        if (percentage >= 70) return { grade: 'A', class: 'bg-success' };
        if (percentage >= 60) return { grade: 'B', class: 'bg-info' };
        if (percentage >= 50) return { grade: 'C', class: 'bg-warning' };
        if (percentage >= 40) return { grade: 'D', class: 'bg-warning' };
        return { grade: 'F', class: 'bg-danger' };
    };

    return (
        <div className="page-wrap" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>
            {/* Page Header */}
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-1 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-arrow-up-circle me-2" style={{ color: 'var(--accent-orange)' }} />
                        Student Promotion
                    </h4>
                    <div className="text-muted small">Promote students to next academic year</div>
                </div>
            </div>

            {/* Filters */}
            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-white border-bottom py-3" style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                    <h6 className="mb-0 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-funnel-fill me-2" style={{ color: 'var(--primary-teal)' }} />
                        Promotion Filters
                    </h6>
                </div>
                <div className="card-body">

                    <div className="row g-3 align-items-end">
                        <div className="col-md-3">
                            <label className="form-label fw-semibold">From Year</label>
                            <select
                                className="form-select"
                                value={fromYearId || ''}
                                onChange={e => setFromYearId(parseInt(e.target.value))}
                            >
                                <option value="">Select Year</option>
                                {years.map(year => (
                                    <option key={year.id} value={year.id}>
                                        {year.year_name} {year.status === 'active' ? '(Active)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-3">
                            <label className="form-label fw-semibold">To Year</label>
                            <select
                                className="form-select"
                                value={toYearId || ''}
                                onChange={e => setToYearId(parseInt(e.target.value))}
                            >
                                <option value="">Select Year</option>
                                {years.filter(y => y.id !== fromYearId).map(year => (
                                    <option key={year.id} value={year.id}>
                                        {year.year_name} {year.is_configured ? '✓ Configured' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-2">
                            <label className="form-label fw-semibold">Class </label>
                            <select
                                className="form-select"
                                value={filterClassId || ''}
                                onChange={e => setFilterClassId(e.target.value ? parseInt(e.target.value) : null)}
                            >
                                <option value="">All Classes</option>
                                {classes.length === 0 && <option disabled>No classes available</option>}
                                {classes.map(cls => (
                                    <option key={cls.class_id} value={cls.class_id}>{cls.class_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-2">
                            <label className="form-label fw-semibold">Section </label>
                            <select
                                className="form-select"
                                value={filterSectionId || ''}
                                onChange={e => setFilterSectionId(e.target.value ? parseInt(e.target.value) : null)}
                                disabled={!filterClassId}
                            >
                                <option value="">All Sections</option>
                                {filteredSections.length === 0 && filterClassId && <option disabled>No sections available</option>}
                                {filteredSections.map(sec => (
                                    <option key={sec.section_id} value={sec.section_id}>{sec.section_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-2 d-flex align-items-end">
                            <button
                                className="btn btn-primary-custom w-100 fw-bold"
                                onClick={loadStudents}
                                disabled={loading || !fromYearId}
                            >
                                {loading ? (
                                    <><span className="spinner-border spinner-border-sm me-2" />Loading...</>
                                ) : 'Load Students'}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="alert alert-danger mt-3 mb-0 d-flex align-items-center">
                            <i className="bi bi-exclamation-triangle-fill me-2"></i>
                            {error}
                        </div>
                    )}
                </div>
            </div>

            {/* Students List */}
            {students.length > 0 && (
                <div className="card border-0 shadow-sm">
                    <div className="card-header bg-white border-bottom d-flex justify-content-between align-items-center"
                        style={{ borderLeft: '4px solid var(--accent-orange)' }}>
                        <div className="fw-semibold" style={{ color: 'var(--primary-dark)' }}>
                            <i className="bi bi-people-fill me-2" style={{ color: 'var(--accent-orange)' }} />
                            Students ({students.length})
                            {selectedStudents.size > 0 && (
                                <span className="badge bg-primary ms-2">{selectedStudents.size} selected</span>
                            )}
                        </div>
                        <div className="d-flex gap-2">
                            <button
                                className="btn btn-outline-secondary btn-sm"
                                onClick={selectAll}
                            >
                                <i className="bi bi-check-square me-1"></i>
                                {selectedStudents.size === students.length ? 'Deselect All' : 'Select All'}
                            </button>
                            {hasPermission('academic', 'write') && (
                                <button
                                    className="btn btn-success fw-bold"
                                    onClick={executePromotion}
                                    disabled={promoting || selectedStudents.size === 0 || !toYearId}
                                >
                                    {promoting ? (
                                        <><span className="spinner-border spinner-border-sm me-2" />Promoting...</>
                                    ) : (
                                        <><i className="bi bi-arrow-up-circle me-1"></i>Promote Selected ({selectedStudents.size})</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="card-body p-0">

                        <div className="table-responsive">
                            <table className="table table-bordered table-sm align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ background: 'var(--primary-dark)', color: '#fff' }}>
                                        <th style={{ width: '50px', textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                className="form-check-input"
                                                checked={selectedStudents.size === students.length && students.length > 0}
                                                onChange={selectAll}
                                            />
                                        </th>
                                        <th style={{ width: '100px', textAlign: 'center' }}>Admission#</th>
                                        <th style={{ minWidth: '180px' }}>Student Name</th>
                                        <th style={{ minWidth: '120px' }}>Current Class</th>
                                        {/* <th style={{minWidth: '150px'}}>Performance</th> */}
                                        <th style={{ minWidth: '140px' }}>Promote To</th>
                                        <th style={{ minWidth: '120px' }}>Section</th>
                                        <th style={{ minWidth: '120px' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map(student => {
                                        const promotion = promotionMap.get(student.id);
                                        // const badge = getStatusBadge(student.percentage);

                                        return (
                                            <tr key={student.id} style={student.has_record ? { backgroundColor: '#fff3cd' } : {}}>
                                                <td className="text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="form-check-input"
                                                        checked={selectedStudents.has(student.id)}
                                                        onChange={() => toggleStudent(student.id)}
                                                    />
                                                </td>
                                                <td className="text-center">{student.admission_number}</td>
                                                <td className="fw-semibold">
                                                    {student.student_name}
                                                    <div className="small text-muted">S/O: {student.father_name}</div>
                                                </td>
                                                <td>{student.class_name} - {student.section_name}</td>
                                                {/* Performance column - hidden until exam marks are entered
                                                <td>
                                                    {student.max_marks > 0 ? (
                                                        <div className="d-flex align-items-center gap-2">
                                                            <span className={`badge ${badge.class}`}>{badge.grade}</span>
                                                            <small>{student.percentage.toFixed(1)}% ({student.total_marks}/{student.max_marks})</small>
                                                        </div>
                                                    ) : (
                                                        <span className="badge bg-secondary">No Exam Data</span>
                                                    )}
                                                </td>
                                                */}
                                                <td>
                                                    <select
                                                        className="form-select form-select-sm"
                                                        value={promotion?.target_class_id || ''}
                                                        onChange={e => updatePromotionData(student.id, 'target_class_id', parseInt(e.target.value))}
                                                        disabled={!selectedStudents.has(student.id)}
                                                    >
                                                        {classes.map(cls => (
                                                            <option key={cls.class_id} value={cls.class_id}>{cls.class_name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <select
                                                        className="form-select form-select-sm"
                                                        value={promotion?.target_section_id || ''}
                                                        onChange={e => updatePromotionData(student.id, 'target_section_id', parseInt(e.target.value))}
                                                        disabled={!selectedStudents.has(student.id)}
                                                    >
                                                        {sections.filter(s => s.class_id === (promotion?.target_class_id || 0)).map(sec => (
                                                            <option key={sec.section_id} value={sec.section_id}>{sec.section_name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <select
                                                        className="form-select form-select-sm"
                                                        value={promotion?.status || 'promoted'}
                                                        onChange={e => updatePromotionData(student.id, 'status', e.target.value)}
                                                        disabled={!selectedStudents.has(student.id)}
                                                    >
                                                        <option value="promoted">Promoted</option>
                                                        <option value="detained">Detained</option>
                                                        <option value="left">Left</option>
                                                        <option value="transferred">Transferred</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {students.some(s => s.has_record) && (
                        <div className="card-footer bg-warning-subtle border-top">
                            <i className="bi bi-info-circle-fill me-2"></i>
                            <small>Yellow highlighted students already have a record for this year. Promotion will update their existing record.</small>
                        </div>
                    )}
                </div>
            )}

            {students.length === 0 && !loading && (
                <div className="card border-0 shadow-sm">
                    <div className="card-body p-5 text-center">
                        <i className="bi bi-inbox fs-1 text-muted mb-3"></i>
                        <p className="text-muted">Select filters and click "Load Students" to begin promotion</p>
                    </div>
                </div>
            )}
        </div>
    );
}
