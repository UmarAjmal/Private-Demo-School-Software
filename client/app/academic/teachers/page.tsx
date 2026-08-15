'use client';
import { useState, useEffect, useMemo } from 'react';
import { notify, toast } from '@/app/utils/notify';
import { useAuth } from '@/contexts/AuthContext';

// --- Types ---
type Teacher = {
    employee_id: number;
    first_name: string;
    last_name: string;
    designation: string;
    department_name: string;
    assigned_subjects: { subject_id: number; subject_name: string; assignment_id: number }[];
    assigned_classes: { class_id: number; class_name: string; section_id: number; section_name: string; is_class_teacher: boolean; assignment_id: number }[];
    status: string;
    phone: string;
    email: string;
};

type Subject = {
    subject_id: number;
    subject_name: string;
    section_id: number;
    class_id: number;
    section_name: string;
    class_name: string;
    subject_code: string;
};

type Class = { class_id: number; class_name: string; };
type Section = { section_id: number; section_name: string; class_id: number; };

// --- Styling Constants ---
// Using CSS variables defined in global.css
// --primary-dark (#233D4D), --primary-teal (#215E61), --accent-orange (#FE7F2D)

export default function TeacherAssign() {
    // --- Data State ---
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- Modal / Selection State ---
    const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
    const [showAssignModal, setShowAssignModal] = useState(false);

    // Navigation State (Which Class/Section is currently being viewed)
    const [activeClassId, setActiveClassId] = useState<number | null>(null);
    const [activeSectionId, setActiveSectionId] = useState<number | null>(null);

    // --- Edit State (The "Buffer") ---
    // These store the CURRENT configuration by the user in the modal
    const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<number>>(new Set());
    const [classTeacherSections, setClassTeacherSections] = useState<Set<number>>(new Set());

    // --- Initial State Mappers (For Diffing on Save) ---
    // specific maps to look up assignment_ids for deletion
    const [initialSubjectMap, setInitialSubjectMap] = useState<Record<number, number>>({}); // subject_id -> assignment_id
    const [initialClassMap, setInitialClassMap] = useState<Record<string, number>>({}); // "class_id-section_id" -> assignment_id
    const { hasPermission } = useAuth();

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        setError(null);
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com";


        try {
            console.log("Fetching from:", API_URL);

            // Create a timeout promise to prevent infinite loading
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timed out after 10 seconds. Server might be down.')), 10000)
            );

            // Use 'cache: no-store' to ensure we get fresh data
            const fetchConfig = { cache: 'no-store' } as RequestInit;

            const fetchPromise = Promise.all([
                fetch(`${API_URL}/academic/teachers`, fetchConfig).then(res => { if (!res.ok) throw new Error(`Teachers: ${res.status}`); return res.json(); }),
                fetch(`${API_URL}/academic/subjects`, fetchConfig).then(res => { if (!res.ok) throw new Error(`Subjects: ${res.status}`); return res.json(); }),
                fetch(`${API_URL}/academic`, fetchConfig).then(res => { if (!res.ok) throw new Error(`Classes: ${res.status}`); return res.json(); }),
                fetch(`${API_URL}/academic/sections`, fetchConfig).then(res => { if (!res.ok) throw new Error(`Sections: ${res.status}`); return res.json(); })
            ]);

            // Race against timeout
            const results = await Promise.race([fetchPromise, timeoutPromise]) as any[];
            const [teachersData, subjectsData, classesData, sectionsData] = results;

            if (Array.isArray(teachersData)) setTeachers(teachersData);
            else { console.error("Teachers data invalid:", teachersData); setTeachers([]); }

            if (Array.isArray(subjectsData)) setAllSubjects(subjectsData);
            if (Array.isArray(classesData)) setClasses(classesData);
            if (Array.isArray(sectionsData)) setSections(sectionsData);

        } catch (err: any) {
            console.error("Fetch Error:", err);
            setError(`${err.message} (API: ${API_URL})`);
            notify.error(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // --- Logic: Open Modal & Initialize State ---
    const handleOpenAssign = (teacher: Teacher) => {
        setSelectedTeacher(teacher);

        // 1. Load existing subjects into Set
        const tSubjects = new Set<number>();
        const tSubMap: Record<number, number> = {};

        teacher.assigned_subjects?.forEach(s => {
            tSubjects.add(s.subject_id);
            tSubMap[s.subject_id] = s.assignment_id;
        });
        setSelectedSubjectIds(tSubjects);
        setInitialSubjectMap(tSubMap);

        // 2. Load Class Teacher roles
        const tCTSections = new Set<number>();
        const tClassMap: Record<string, number> = {}; // key: "class_id-section_id"

        teacher.assigned_classes?.forEach(c => {
            if (c.is_class_teacher) {
                tCTSections.add(c.section_id);
            }
            // Store assignment ID for ALL class links to handle deletions if needed
            // (Though currently we mainly auto-manage class links via subjects)
            tClassMap[`${c.class_id}-${c.section_id}`] = c.assignment_id;
        });
        setClassTeacherSections(tCTSections);
        setInitialClassMap(tClassMap);

        // 3. Reset View Navigation
        setActiveClassId(null);
        setActiveSectionId(null);
        setShowAssignModal(true);
    };

    // --- Logic: Toggle Selection ---
    const toggleSubject = (subId: number) => {
        const newSet = new Set(selectedSubjectIds);
        if (newSet.has(subId)) newSet.delete(subId);
        else newSet.add(subId);
        setSelectedSubjectIds(newSet);
    };

    const toggleClassTeacher = (secId: number) => {
        const newSet = new Set(classTeacherSections);
        if (newSet.has(secId)) newSet.delete(secId);
        else newSet.add(secId);
        setClassTeacherSections(newSet);
    };

    // --- Logic: Save (Diffing) ---
    const handleSaveChanges = async () => {
        if (!selectedTeacher) return;
        const employeeId = selectedTeacher.employee_id;
        const toastId = toast.loading("Saving changes...");

        try {
            const apiCalls: Promise<Response>[] = [];

            // 1. Handle Subjects (Add/Remove)
            // Iterate over Union of (Initial U Selected)
            const allInvolvedSubjects = new Set([...Array.from(selectedSubjectIds), ...Object.keys(initialSubjectMap).map(Number)]);

            for (const subId of Array.from(allInvolvedSubjects)) {
                const wasSelected = initialSubjectMap.hasOwnProperty(subId);
                const isSelected = selectedSubjectIds.has(subId);

                if (isSelected && !wasSelected) {
                    // ADD
                    apiCalls.push(
                        fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/teachers/${employeeId}/subjects`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ subject_id: subId })
                        })
                    );
                } else if (!isSelected && wasSelected) {
                    // REMOVE
                    const assignId = initialSubjectMap[subId];
                    if (assignId) {
                        apiCalls.push(
                            fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/teachers/${employeeId}/subjects/${assignId}`, {
                                method: 'DELETE'
                            })
                        );
                    }
                }
            }

            // 2. Handle Class Teacher Status & Implicit Class Assignments
            const activeSectionsMap = new Map<number, boolean>(); // section_id -> is_active

            // Mark active from subjects
            selectedSubjectIds.forEach(subId => {
                const sub = allSubjects.find(s => s.subject_id === subId);
                if (sub) activeSectionsMap.set(sub.section_id, true);
            });
            // Mark active from Class Teacher
            classTeacherSections.forEach(secId => activeSectionsMap.set(secId, true));

            // -- Process Upserts (Active Sections) --
            for (const [secId, _] of Array.from(activeSectionsMap.entries())) {
                const sec = sections.find(s => s.section_id === secId);
                if (!sec) continue;

                // POST (Upsert)
                apiCalls.push(
                    fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/teachers/${employeeId}/classes`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            class_id: sec.class_id,
                            section_id: sec.section_id,
                            is_class_teacher: classTeacherSections.has(secId)
                        })
                    })
                );
            }

            // -- Process Deletes (Inactive Sections that were present) --
            // Loop through initial assignments
            if (selectedTeacher.assigned_classes) {
                for (const cls of selectedTeacher.assigned_classes) {
                    const secId = cls.section_id;
                    if (!activeSectionsMap.has(secId)) {
                        // Section is no longer active (no subjects, not CT) -> Remove it
                        apiCalls.push(
                            fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/teachers/${employeeId}/classes/${cls.assignment_id}`, {
                                method: 'DELETE'
                            })
                        );
                    }
                }
            }

            const responses = await Promise.all(apiCalls);
            const errors = responses.filter(r => !r.ok);

            if (errors.length > 0) {
                console.error("Some requests failed", errors);
                toast.update(toastId, { render: "Some changes failed to save.", type: "warning", isLoading: false, autoClose: 3000 });
            } else {
                toast.update(toastId, { render: "Assignments Updated!", type: "success", isLoading: false, autoClose: 2000 });
            }

            fetchAllData();
            setShowAssignModal(false);

        } catch (e) {
            console.error(e);
            toast.update(toastId, { render: "Error saving changes", type: "error", isLoading: false, autoClose: 3000 });
        }
    };

    // --- Derived UI Helpers ---

    // Subjects for current view
    const visibleSubjects = useMemo(() => {
        if (!activeSectionId) return [];
        return allSubjects.filter(s => s.section_id === activeSectionId);
    }, [activeSectionId, allSubjects]);

    // Derived: Counts for Badges
    const getSubjectCountForClass = (clsId: number) => {
        // Count selected subjects that belong to this class
        const subIdsInClass = allSubjects.filter(s => s.class_id === clsId).map(s => s.subject_id);
        const count = subIdsInClass.filter(id => selectedSubjectIds.has(id)).length;
        return count > 0 ? count : null;
    };

    const getSubjectCountForSection = (secId: number) => {
        const subIdsInSec = allSubjects.filter(s => s.section_id === secId).map(s => s.subject_id);
        const count = subIdsInSec.filter(id => selectedSubjectIds.has(id)).length;
        return count > 0 ? count : null;
    };

    const isClassTeacher = (secId: number) => classTeacherSections.has(secId);


    return (
        <>
            <div className="container-fluid p-4 animate__animated animate__fadeIn" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h2 className="mb-0 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-person-video3 me-2"></i>Teacher Assignments
                    </h2>
                    <div className="text-muted small">Manage subjects and class responsibilities</div>
                </div>

                {/* List Grid */}
                <div className="row g-4">
                    {loading ? (
                        <div className="col-12 text-center py-5">
                            <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }} role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <div className="mt-3 text-muted">Connecting to Server (Falcon School Systemschool.onrender.com)...</div>
                        </div>
                    ) : error ? (
                        <div className="col-12 text-center py-5">
                            <div className="alert alert-danger d-inline-block">
                                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                {error}
                            </div>
                            <div className="mt-3">
                                <button className="btn btn-outline-primary" onClick={fetchAllData}>
                                    <i className="bi bi-arrow-clockwise me-2"></i>Retry
                                </button>
                            </div>
                        </div>
                    ) : teachers.length === 0 ? (
                        <div className="col-12 text-center py-5">
                            <i className="bi bi-person-x fs-1 text-muted opacity-50"></i>
                            <h5 className="mt-3 text-muted">No Teachers Found</h5>
                            <p className="text-muted">Add employees with "Teacher" designation in the HRM module.</p>
                        </div>
                    ) : (
                        teachers.map(teacher => (
                            <div className="col-lg-6 col-xl-4" key={teacher.employee_id}>
                                <div className="card h-100 border-0 shadow-sm" style={{ transition: 'transform 0.2s' }}>
                                    <div className="card-body">
                                        <div className="d-flex align-items-start justify-content-between mb-3">
                                            <div className="d-flex align-items-center">
                                                <div className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold me-3"
                                                    style={{ width: '45px', height: '45px', backgroundColor: 'var(--primary-teal)', fontSize: '1.2rem' }}>
                                                    {teacher.first_name[0]}{teacher.last_name[0]}
                                                </div>
                                                <div>
                                                    <h5 className="card-title fw-bold mb-0 text-dark">{teacher.first_name} {teacher.last_name}</h5>
                                                    <small className="text-muted">{teacher.department_name}</small>
                                                </div>
                                            </div>
                                            <span className={`badge ${teacher.status === 'Active' ? 'bg-success' : 'bg-secondary'}`}>{teacher.status}</span>
                                        </div>

                                        <div className="mb-3">
                                            <small className="text-uppercase fw-bold text-muted" style={{ fontSize: '0.75rem' }}>Assigned Subjects</small>
                                            <div className="d-flex flex-wrap gap-2 mt-1">
                                                {teacher.assigned_subjects?.length > 0 ? (
                                                    teacher.assigned_subjects.map((s, i) => (
                                                        <span key={i} className="badge bg-light text-dark border">
                                                            {s.subject_name}
                                                        </span>
                                                    ))
                                                ) : <span className="text-muted small fst-italic">No subjects assigned</span>}
                                            </div>
                                        </div>

                                        {hasPermission('academic', 'write') && (
                                            <button
                                                className="btn btn-sm w-100 fw-bold text-white custom-btn-hover"
                                                style={{ backgroundColor: 'var(--primary-dark)' }}
                                                onClick={() => handleOpenAssign(teacher)}
                                            >
                                                <i className="bi bi-pencil-square me-2"></i>Manage Assignments
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* --- ASSIGN MODAL --- */}
            {showAssignModal && selectedTeacher && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(35, 61, 77, 0.7)', zIndex: 10000 }}>
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
                            {/* Header */}
                            <div className="modal-header text-white px-4 py-3" style={{ backgroundColor: 'var(--primary-dark)' }}>
                                <div>
                                    <h5 className="modal-title fw-bold">
                                        Assignments: {selectedTeacher.first_name} {selectedTeacher.last_name}
                                    </h5>
                                    <div className="small opacity-75">Select classes and subjects below. Changes are saved when you click Confirm.</div>
                                </div>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAssignModal(false)}></button>
                            </div>

                            {/* Body (3 Columns) */}
                            <div className="modal-body p-0" style={{ backgroundColor: '#f8f9fa' }}>
                                <div className="row g-0 h-100" style={{ minHeight: '500px' }}>

                                    {/* COL 1: CLASSES */}
                                    <div className="col-md-3 border-end bg-white">
                                        <div className="p-3 bg-light border-bottom fw-bold text-muted text-uppercase small">
                                            <i className="bi bi-building me-2"></i>1. Select Class
                                        </div>
                                        <div className="list-group list-group-flush">
                                            {classes.map(cls => {
                                                const count = getSubjectCountForClass(cls.class_id);
                                                return (
                                                    <button
                                                        key={cls.class_id}
                                                        className={`list-group-item list-group-item-action py-3 px-3 border-bottom-0 d-flex justify-content-between align-items-center ${activeClassId === cls.class_id ? 'active-class-item' : ''}`}
                                                        style={activeClassId === cls.class_id ? { backgroundColor: 'var(--primary-teal)', color: 'white' } : {}}
                                                        onClick={() => { setActiveClassId(cls.class_id); setActiveSectionId(null); }}
                                                    >
                                                        <span className="fw-semibold">{cls.class_name}</span>
                                                        {count && <span className="badge bg-warning text-dark rounded-pill">{count}</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* COL 2: SECTIONS */}
                                    <div className="col-md-3 border-end bg-light">
                                        <div className="p-3 bg-light border-bottom fw-bold text-muted text-uppercase small">
                                            <i className="bi bi-grid-3x3-gap me-2"></i>2. Select Section
                                        </div>
                                        <div className="list-group list-group-flush">
                                            {!activeClassId ? (
                                                <div className="p-4 text-center text-muted small fst-italic">Select a class first</div>
                                            ) : (
                                                sections.filter(s => s.class_id === activeClassId).map(sec => {
                                                    const count = getSubjectCountForSection(sec.section_id);
                                                    const isCT = isClassTeacher(sec.section_id);
                                                    return (
                                                        <button
                                                            key={sec.section_id}
                                                            className={`list-group-item list-group-item-action py-3 px-3 d-flex justify-content-between align-items-center ${activeSectionId === sec.section_id ? 'bg-white border-start border-4' : 'bg-transparent text-muted'}`}
                                                            style={activeSectionId === sec.section_id ? { borderLeftColor: 'var(--primary-teal)', color: 'var(--primary-dark)' } : {}}
                                                            onClick={() => setActiveSectionId(sec.section_id)}
                                                        >
                                                            <div className="d-flex align-items-center">
                                                                <span className="fw-bold">{sec.section_name}</span>
                                                                {isCT && <i className="bi bi-star-fill text-warning ms-2" title="Class Teacher"></i>}
                                                            </div>
                                                            {count && <span className="badge bg-secondary opacity-75 rounded-pill small">{count}</span>}
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* COL 3: SUBJECTS */}
                                    <div className="col-md-6 bg-white">
                                        <div className="p-3 border-bottom d-flex justify-content-between align-items-center bg-white sticky-top">
                                            <div className="fw-bold text-muted text-uppercase small">
                                                <i className="bi bi-book me-2"></i>3. Assign Subjects
                                            </div>
                                            {activeSectionId && (
                                                <div className="form-check form-switch cursor-pointer user-select-none">
                                                    <input
                                                        className="form-check-input"
                                                        type="checkbox"
                                                        id="ctSwitch"
                                                        checked={isClassTeacher(activeSectionId)}
                                                        onChange={() => toggleClassTeacher(activeSectionId)}
                                                    />
                                                    <label className="form-check-label fw-bold small text-dark" htmlFor="ctSwitch">
                                                        Make Class Teacher
                                                    </label>
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-4">
                                            {!activeSectionId ? (
                                                <div className="text-center py-5 text-muted">
                                                    <i className="bi bi-arrow-left fs-3 d-block mb-2 opacity-50"></i>
                                                    Select a section to view subjects
                                                </div>
                                            ) : visibleSubjects.length === 0 ? (
                                                <div className="text-center py-5 text-muted">No subjects found in this section</div>
                                            ) : (
                                                <div className="row g-3">
                                                    {visibleSubjects.map(sub => {
                                                        const isSelected = selectedSubjectIds.has(sub.subject_id);
                                                        return (
                                                            <div className="col-12" key={sub.subject_id}>
                                                                <div
                                                                    className={`p-3 rounded-3 border d-flex align-items-center cursor-pointer transition-all ${isSelected ? 'border-primary bg-primary bg-opacity-10' : 'border-light bg-light'}`}
                                                                    onClick={() => toggleSubject(sub.subject_id)}
                                                                >
                                                                    <div className={`form-check me-3 ${isSelected ? 'scale-110' : ''}`}>
                                                                        <input
                                                                            type="checkbox"
                                                                            className="form-check-input"
                                                                            checked={isSelected}
                                                                            onChange={() => { }} // Handled by div click
                                                                            style={{ cursor: 'pointer' }}
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <div className={`fw-bold ${isSelected ? 'text-primary' : 'text-dark'}`}>{sub.subject_name}</div>
                                                                        <small className="text-muted">Code: {sub.subject_code || 'N/A'}</small>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="modal-footer bg-light px-4 py-3">
                                <div className="me-auto">
                                    <span className="badge bg-primary rounded-pill me-2">{selectedSubjectIds.size}</span>
                                    <span className="text-muted small">Subjects selected in total</span>
                                </div>
                                <button className="btn btn-outline-secondary px-4 me-2" onClick={() => setShowAssignModal(false)}>Cancel</button>
                                {hasPermission('academic', 'write') && (
                                    <button
                                        className="btn px-5 text-white fw-bold"
                                        style={{ backgroundColor: 'var(--primary-teal)' }}
                                        onClick={handleSaveChanges}
                                    >
                                        <i className="bi bi-check-lg me-2"></i>Confirm & Save
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}


