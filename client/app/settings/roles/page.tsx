'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastHelper';

type Permission = {
    module_name: string;
    can_read: boolean;
    can_write: boolean;
    can_delete: boolean;
};

type Role = {
    id: number;
    role_name: string;
    description: string;
    role_level?: number;
    dashboard_access?: string;
    is_system_default: boolean;
    is_custom?: boolean;
    permissions: Permission[];
    assigned_count?: number;
};

/* Role Level Hierarchy */
const ROLE_LEVELS = [
    { value: 100, label: '100 - Administrator', desc: 'Full system access' },
    { value: 95, label: '95 - Principal', desc: 'All features (except system settings)' },
    { value: 90, label: '90 - Vice Principal', desc: 'Teaching + basic admin features' },
    { value: 75, label: '75 - Coordinator', desc: 'Teaching + limited admin features' },
    { value: 65, label: '65 - Head Teacher', desc: 'Teaching features only' },
    { value: 50, label: '50 - Teacher', desc: 'Own classes only' },
    { value: 30, label: '30 - Accountant', desc: 'Finance features only' },
    { value: 20, label: '20 - Assistant', desc: 'Support staff (limited)' },
    { value: 10, label: '10 - Student', desc: 'Own data only' },
];

/* Assigned Dashboard Options */
const DASHBOARD_OPTIONS = [
    { value: 'admin', label: 'Admin Executive Dashboard', desc: 'Full school overview, financial KPIs, collection charts & admin stats', icon: 'bi-speedometer2', color: '#6366f1' },
    { value: 'teacher', label: 'Teacher Academic Dashboard', desc: 'Assigned classes, student attendance & exam marks entry', icon: 'bi-journal-check', color: '#10b981' },
    { value: 'accountant', label: 'Accountant Finance Dashboard', desc: 'Fee collection, receipt printing, fee slips & expense tracking', icon: 'bi-cash-coin', color: '#f59e0b' },
    { value: 'student', label: 'Student Portal Dashboard', desc: 'Student fee slips, attendance history & result cards', icon: 'bi-mortarboard', color: '#0ea5e9' },
    { value: 'generic', label: 'Generic Staff Dashboard', desc: 'Standard overview & quick action shortcuts for support staff', icon: 'bi-person-workspace', color: '#64748b' },
];

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE TREE   every module maps to its sub-pages with page-level keys
   These page-level keys are stored in role_permissions.module_name column
───────────────────────────────────────────────────────────────────────────── */
type PageDef = { key: string; label: string; icon: string; desc: string };
type ModuleDef = { label: string; icon: string; color: string; pages: PageDef[] };

const PAGE_TREE: Record<string, ModuleDef> = {
    dashboard: {
        label: 'Dashboard', icon: 'bi-speedometer2', color: '#6366f1',
        pages: [
            { key: 'dashboard', label: 'Dashboard', icon: 'bi-speedometer2', desc: 'Main stats, charts & overview' },
        ],
    },
    dashboard_settings: {
        label: 'Dashboard Settings', icon: 'bi-sliders', color: '#8b5cf6',
        pages: [
            { key: 'dash.admin_kpi', label: 'Admin - KPIs', icon: 'bi-bar-chart', desc: 'Top stat cards' },
            { key: 'dash.admin_charts', label: 'Admin - Charts', icon: 'bi-graph-up', desc: 'Revenue and attendance charts' },
            { key: 'dash.admin_recent', label: 'Admin - Recent Payments', icon: 'bi-table', desc: 'Recent transactions table' },
            { key: 'dash.teacher_kpi', label: 'Teacher - KPIs', icon: 'bi-clipboard-data', desc: 'Teacher top stat cards' },
            { key: 'dash.teacher_att', label: 'Teacher - Attendance', icon: 'bi-calendar-check', desc: 'Today and recent attendance' },
            { key: 'dash.teacher_classes', label: 'Teacher - Classes', icon: 'bi-book', desc: 'Assigned classes and subjects' },
            { key: 'dash.acc_kpi', label: 'Accountant - KPIs', icon: 'bi-wallet', desc: 'Financial summary cards' },
            { key: 'dash.acc_charts', label: 'Accountant - Charts', icon: 'bi-graph-up-arrow', desc: 'Collection charts' },
            { key: 'dash.student_kpi', label: 'Student - KPIs', icon: 'bi-mortarboard', desc: 'Student overview' },
            { key: 'dash.student_att', label: 'Student - Attendance', icon: 'bi-calendar3', desc: 'Student attendance view' },
            { key: 'dash.student_fees', label: 'Student - Fees', icon: 'bi-cash', desc: 'Student fee history view' },
        ],
    },
    students: {
        label: 'Students', icon: 'bi-person-graduation', color: '#0ea5e9',
        pages: [
            { key: 'students.details', label: 'Student List', icon: 'bi-list-ul', desc: 'Browse, search and filter all students' },
            { key: 'students.families', label: 'Family Directory', icon: 'bi-people', desc: 'Family-wise student directory & balance management' },
            { key: 'students.admission', label: 'New Admission', icon: 'bi-person-plus', desc: 'Register a new student' },
            { key: 'students.import', label: 'Import Students', icon: 'bi-file-earmark-arrow-up', desc: 'Bulk import via Excel file' },
            { key: 'students.profile', label: 'Student Profile', icon: 'bi-person-badge', desc: 'View individual student profile page' },
            { key: 'students.edit', label: 'Edit Student', icon: 'bi-pencil-square', desc: 'Edit / update student information' },
        ],
    },
    academic: {
        label: 'Academic', icon: 'bi-book-half', color: '#10b981',
        pages: [
            { key: 'academic.classes', label: 'Classes', icon: 'bi-building', desc: 'Manage class list' },
            { key: 'academic.sections', label: 'Sections', icon: 'bi-diagram-2', desc: 'Manage class sections' },
            { key: 'academic.subjects', label: 'Subjects', icon: 'bi-journal-text', desc: 'Manage subject records' },
            { key: 'academic.teachers', label: 'Teacher Assignments', icon: 'bi-person-workspace', desc: 'Assign teachers to classes/subjects' },
            { key: 'academic.promotion', label: 'Promotion', icon: 'bi-arrow-up-circle', desc: 'Promote students to next class' },
        ],
    },
    examination: {
        label: 'Examination', icon: 'bi-clipboard-check-fill', color: '#7c3aed',
        pages: [
            { key: 'academic.examination', label: 'Marks Entry', icon: 'bi-pencil-square', desc: 'Enter exam marks per subject' },
            { key: 'academic.examination.test-marking', label: 'Test Marking', icon: 'bi-journal-check', desc: 'Enter class test marks' },
            { key: 'academic.marks-sheet', label: 'Marks Sheet', icon: 'bi-table', desc: 'View class-wide marks sheet (Incharge only)' },
            { key: 'academic.result-card', label: 'Result Cards', icon: 'bi-file-earmark-text', desc: 'Print individual result cards (Incharge only)' },
            { key: 'academic.examination.approvals', label: 'Marks Approval & Publishing', icon: 'bi-shield-check', desc: 'Approve & publish marks to Student Portal' },
        ],
    },
    hrm: {
        label: 'HR Management', icon: 'bi-people-fill', color: '#f59e0b',
        pages: [
            { key: 'hrm.departments', label: 'Departments', icon: 'bi-building-gear', desc: 'Manage departments' },
            { key: 'hrm.employees', label: 'Employees List', icon: 'bi-people', desc: 'Employee records and profiles' },
        ],
    },
    fees: {
        label: 'Fee Management', icon: 'bi-currency-dollar', color: '#8b5cf6',
        pages: [
            { key: 'fees.heads', label: 'Fee Heads', icon: 'bi-tags', desc: 'Define fee categories / heads' },
            { key: 'fees.plans', label: 'Fee Plans', icon: 'bi-card-list', desc: 'Create and manage fee plans' },
            { key: 'fees.generate', label: 'Generate Slips', icon: 'bi-receipt', desc: 'Generate monthly fee slips' },
            { key: 'fees.print', label: 'Print Slips', icon: 'bi-printer', desc: 'Batch print monthly fee slips' },
            { key: 'fees.collect', label: 'Collect Fees', icon: 'bi-cash-stack', desc: 'Receive and record fee payments' },
            { key: 'fees.admission', label: 'Admission Fees', icon: 'bi-cash-coin', desc: 'Collect one-time admission fees' },
            { key: 'fees.opening-balance', label: 'Opening Balance', icon: 'bi-clock-history', desc: 'Set prior dues / opening balance' },
            { key: 'fees.exam-collection', label: 'Exam Fees', icon: 'bi-cash-coin', desc: 'Collect exam fees' },
        ],
    },
    expenses: {
        label: 'Expenses', icon: 'bi-receipt-cutoff', color: '#ef4444',
        pages: [
            { key: 'expenses.categories', label: 'Categories', icon: 'bi-folder', desc: 'Manage expense categories' },
            { key: 'expenses.list', label: 'All Expenses', icon: 'bi-list-check', desc: 'Browse all expense records' },
            { key: 'expenses.add', label: 'Add Expense', icon: 'bi-plus-square', desc: 'Record a new expense entry' },
            { key: 'expenses.edit', label: 'Edit Expense', icon: 'bi-pencil-square', desc: 'Edit expense entries' },
        ],
    },
    attendance: {
        label: 'Attendance', icon: 'bi-calendar-check', color: '#14b8a6',
        pages: [
            { key: 'attendance.students', label: 'Student Attendance', icon: 'bi-person-check', desc: 'Mark daily student attendance' },
            { key: 'attendance.staff', label: 'Staff Attendance', icon: 'bi-person-badge-fill', desc: 'Mark daily staff attendance' },
            { key: 'attendance.students.history', label: 'Student History', icon: 'bi-calendar-range', desc: 'View past student attendance records' },
            { key: 'attendance.staff.history', label: 'Staff History', icon: 'bi-calendar2-range', desc: 'View past staff attendance records' },
        ],
    },
    reports: {
        label: 'Reports', icon: 'bi-bar-chart-fill', color: '#64748b',
        pages: [
            { key: 'reports.monthly', label: 'Monthly Report', icon: 'bi-calendar-month', desc: 'Monthly summary & collection report' },
            { key: 'reports.students', label: 'Student Reports', icon: 'bi-person-lines-fill', desc: 'Student-related report views' },
            { key: 'reports.results', label: 'Result Reports', icon: 'bi-bar-chart-steps', desc: 'Exam result reports' },
            { key: 'reports.expenses', label: 'Expense Reports', icon: 'bi-graph-down', desc: 'Financial expense summaries' },
            { key: 'reports.family-fee', label: 'Family Fee Reports', icon: 'bi-people-fill', desc: 'Family fee summary reports' },
            { key: 'reports.admission', label: 'Admission Reports', icon: 'bi-person-badge-fill', desc: 'New admissions & fee collection reports' },
        ],
    },
    settings: {
        label: 'Settings', icon: 'bi-gear-fill', color: '#d97706',
        pages: [
            { key: 'settings.general', label: 'General Settings', icon: 'bi-sliders', desc: 'School name, address, logo' },
            { key: 'settings.academic', label: 'Academic Year', icon: 'bi-calendar-event', desc: 'Academic year and term management' },
            { key: 'settings.system', label: 'System & Backup', icon: 'bi-database-gear', desc: 'System config, backup & restore' },
            { key: 'settings.users', label: 'Users', icon: 'bi-person-fill-gear', desc: 'Manage application user accounts' },
            { key: 'settings.roles', label: 'Roles', icon: 'bi-shield-fill-check', desc: 'Manage roles and page permissions' },
        ],
    },
};

/* Flat list of all page keys for initializing form permissions */
const ALL_PAGES: PageDef[] = Object.values(PAGE_TREE).flatMap(m => m.pages);

export default function RolesPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'form'>('list');
    const [saving, setSaving] = useState(false);
    const [expanded, setExpanded] = useState<Record<string, boolean>>(
        Object.fromEntries(Object.keys(PAGE_TREE).map(k => [k, true]))
    );
    const [formData, setFormData] = useState<Role>({
        id: 0, role_name: '', description: '', role_level: 50, is_system_default: false, is_custom: true, permissions: [],
    });
    const [confirmModal, setConfirmModal] = useState<{ show: boolean; assignedCount: number; roleId: number; originalLevel?: number } | null>(null);
    const { hasPermission } = useAuth();

    // Replaced local showToast with global one.
    const showToastMsg = (type: 'success' | 'danger', msg: string) => {
        if (type === 'success') {
            showToast.success(msg);
        } else {
            showToast.error(msg);
        }
    };

    useEffect(() => { fetchRoles(); }, []);

    const fetchRoles = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/roles`);
            const data = await res.json();
            setRoles(data);
        } catch { showToastMsg('danger', 'Failed to load roles'); }
        finally { setLoading(false); }
    };

    /* ── Build initial permissions array from a role's existing DB permissions ── */
    const buildFormPerms = (existingPerms: Permission[]): Permission[] => {
        return ALL_PAGES.map(page => {
            // 1. Try exact page-level match
            const exact = existingPerms.find(p => p.module_name === page.key);
            if (exact) return exact;

            // 2. Fallback: inherit from parent module key (legacy row like 'students')
            const parentKey = page.key.includes('.') ? page.key.split('.')[0] : null;
            if (parentKey) {
                const parent = existingPerms.find(p => p.module_name === parentKey);
                if (parent) return { module_name: page.key, can_read: parent.can_read, can_write: parent.can_write, can_delete: parent.can_delete };
            }

            // 3. Default no access
            return { module_name: page.key, can_read: false, can_write: false, can_delete: false };
        });
    };

    const handleEdit = (role: Role) => {
        setFormData({
            ...role,
            role_level: role.role_level || 50,
            dashboard_access: role.dashboard_access || (
                (role.role_level || 50) >= 90 ? 'admin' :
                    (role.role_level || 50) >= 50 ? 'teacher' :
                        (role.role_level || 50) >= 20 ? 'accountant' : 'student'
            ),
            permissions: buildFormPerms(role.permissions || [])
        });
        setExpanded(Object.fromEntries(Object.keys(PAGE_TREE).map(k => [k, true])));
        setView('form');
    };

    const handleClone = async (roleId: number) => {
        try {
            setSaving(true);
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/roles/${roleId}/clone`, { method: 'POST' });
            if (res.ok) {
                fetchRoles();
                showToastMsg('success', 'Role cloned successfully! Edit the new role to customize it.');
            } else showToastMsg('danger', 'Failed to clone role');
        } catch { showToastMsg('danger', 'Server error'); }
        finally { setSaving(false); }
    };

    const handleCreate = () => {
        setFormData({
            id: 0, role_name: '', description: '', role_level: 50, dashboard_access: 'admin', is_system_default: false, is_custom: true,
            permissions: ALL_PAGES.map(p => ({ module_name: p.key, can_read: false, can_write: false, can_delete: false })),
        });
        setExpanded(Object.fromEntries(Object.keys(PAGE_TREE).map(k => [k, true])));
        setView('form');
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure? This role will be permanently deleted.')) return;
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/roles/${id}`, { method: 'DELETE' });
            if (res.ok) { fetchRoles(); showToastMsg('success', 'Role deleted'); }
            else showToastMsg('danger', 'Failed to delete role');
        } catch { showToastMsg('danger', 'Server error'); }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        // If editing existing role with assigned users, show confirmation modal
        if (formData.id !== 0 && (formData.assigned_count ?? 0) > 0) {
            setConfirmModal({ show: true, assignedCount: formData.assigned_count ?? 0, roleId: formData.id, originalLevel: formData.role_level });
            return;
        }

        await performSave(true);
    };

    const performSave = async (applyToAssigned: boolean = true) => {
        setSaving(true);
        const url = formData.id === 0 ? `${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/roles` : `${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/roles/${formData.id}?apply_to_assigned=${applyToAssigned}`;
        const method = formData.id === 0 ? 'POST' : 'PUT';
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, role_level: formData.role_level || 50 }),
            });
            if (res.ok) {
                setView('list');
                fetchRoles();
                setConfirmModal(null);
                showToastMsg('success', formData.id === 0 ? 'Role created successfully' : 'Role updated successfully');
            } else {
                let errorMsg = 'Failed to save role';
                try {
                    const error = await res.json();
                    errorMsg = error.message || error.error || errorMsg;
                } catch (e) {
                    const txt = await res.text().catch(() => '');
                    if (txt) errorMsg = txt;
                }
                showToastMsg('danger', errorMsg);
            }
        } catch (err: any) { showToastMsg('danger', err?.message || 'Server error'); }
        finally { setSaving(false); }
    };

    /* ── Permission helpers ── */
    const getPerm = (key: string) =>
        formData.permissions.find(p => p.module_name === key) ||
        { module_name: key, can_read: false, can_write: false, can_delete: false };

    const togglePerm = (key: string, field: 'can_read' | 'can_write' | 'can_delete') => {
        const perms = formData.permissions.map(p => p.module_name === key ? { ...p } : p);
        const idx = perms.findIndex(p => p.module_name === key);
        if (idx < 0) return;
        const updated = { ...perms[idx], [field]: !perms[idx][field] };
        if (field === 'can_write' && updated.can_write) updated.can_read = true;
        if (field === 'can_delete' && updated.can_delete) { updated.can_read = true; updated.can_write = true; }
        if (field === 'can_read' && !updated.can_read) { updated.can_write = false; updated.can_delete = false; }
        if (field === 'can_write' && !updated.can_write) updated.can_delete = false;
        perms[idx] = updated;
        setFormData({ ...formData, permissions: perms });
    };

    const setModulePerms = (moduleKey: string, grant: boolean) => {
        const pageKeys = PAGE_TREE[moduleKey]?.pages.map(p => p.key) || [];
        const perms = formData.permissions.map(p =>
            pageKeys.includes(p.module_name) ? { ...p, can_read: grant, can_write: grant, can_delete: grant } : p
        );
        setFormData({ ...formData, permissions: perms });
    };

    const grantAll = () => setFormData({ ...formData, permissions: formData.permissions.map(p => ({ ...p, can_read: true, can_write: true, can_delete: true })) });
    const revokeAll = () => setFormData({ ...formData, permissions: formData.permissions.map(p => ({ ...p, can_read: false, can_write: false, can_delete: false })) });

    /* ── Stat helpers ── */
    const modulePageCount = (moduleKey: string) => {
        const pages = PAGE_TREE[moduleKey]?.pages || [];
        const enabled = pages.filter(p => getPerm(p.key).can_read).length;
        return { enabled, total: pages.length };
    };

    const totalPages = ALL_PAGES.length;
    const enabledCount = formData.permissions.filter(p => p.can_read).length;

    const getCardSummary = (role: Role) => {
        const perms = role.permissions || [];
        const enabledPages = ALL_PAGES.filter(p => {
            const ex = perms.find(r => r.module_name === p.key);
            if (ex) return ex.can_read;
            const parent = p.key.includes('.') ? perms.find(r => r.module_name === p.key.split('.')[0]) : null;
            return parent?.can_read ?? false;
        });
        return { enabled: enabledPages.length, total: ALL_PAGES.length };
    };

    /* ── Badge color for a page perm ── */
    const permBadge = (p: Permission, moduleColor: string) => {
        if (p.can_read && p.can_write && p.can_delete) return { bg: `${moduleColor}22`, border: `${moduleColor}44`, color: moduleColor };
        if (p.can_read && p.can_write) return { bg: '#d1fae522', border: '#10b98144', color: '#10b981' };
        if (p.can_read) return { bg: '#e0f2fe22', border: '#0ea5e944', color: '#0ea5e9' };
        return { bg: '#f1f5f9', border: '#e2e8f0', color: '#94a3b8' };
    };

    if (loading) return (
        <div className="d-flex align-items-center justify-content-center" style={{ minHeight: 300 }}>
            <div className="text-center">
                <div className="spinner-border mb-3" style={{ color: 'var(--primary-teal)', width: 48, height: 48 }} />
                <p className="text-muted fw-semibold">Loading roles...</p>
            </div>
        </div>
    );

    return (
        <div className="container-fluid px-3 px-md-4 py-3 animate__animated animate__fadeIn">

            {/* ──────────────────────────── LIST VIEW ──────────────────────────── */}
            {view === 'list' && (
                <>
                    <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-3">
                        <div>
                            <h2 className="h3 fw-bold mb-1" style={{ color: 'var(--primary-dark)' }}>
                                <i className="bi bi-shield-lock-fill me-2" style={{ color: 'var(--primary-teal)' }} />
                                Role Management
                            </h2>
                            <p className="text-muted mb-0 small">
                                Define roles and control per-page access with Read / Write / Delete permissions
                            </p>
                        </div>
                        {hasPermission('settings', 'write') && (
                            <button className="btn btn-primary-custom d-flex align-items-center gap-2 px-4" onClick={handleCreate}>
                                <i className="bi bi-plus-circle-fill" /> Create New Role
                            </button>
                        )}
                    </div>

                    {/* Legend */}
                    <div className="d-flex flex-wrap gap-4 mb-4">
                        {[
                            { icon: 'bi-eye-fill', color: '#0ea5e9', label: 'Read View only access' },
                            { icon: 'bi-pencil-fill', color: '#10b981', label: 'Write Create & edit access' },
                            { icon: 'bi-trash3-fill', color: '#ef4444', label: 'Delete Remove records access' },
                        ].map(l => (
                            <span key={l.label} className="d-flex align-items-center gap-2 small fw-semibold" style={{ color: '#64748b' }}>
                                <i className={`bi ${l.icon}`} style={{ color: l.color }} /> {l.label}
                            </span>
                        ))}
                    </div>

                    {/* Role Cards */}
                    <div className="row g-4">
                        {roles.map(role => {
                            const { enabled, total } = getCardSummary(role);
                            const allPerms = ALL_PAGES.map(p => {
                                const ex = role.permissions?.find(r => r.module_name === p.key);
                                if (ex) return ex;
                                const parent = p.key.includes('.') ? role.permissions?.find(r => r.module_name === p.key.split('.')[0]) : null;
                                return parent || { module_name: p.key, can_read: false, can_write: false, can_delete: false };
                            });
                            const fullAccess = allPerms.filter(p => p.can_read && p.can_write && p.can_delete).length;
                            const writeAccess = allPerms.filter(p => p.can_write && !p.can_delete).length;
                            const readOnly = allPerms.filter(p => p.can_read && !p.can_write).length;

                            return (
                                <div key={role.id} className="col-12 col-sm-6 col-xl-4">
                                    <div className="card h-100 border-0 shadow-sm rounded-4 overflow-hidden"
                                        style={{ transition: 'transform 0.15s' }}
                                        onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
                                        onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
                                        {/* Accent bar */}
                                        <div style={{ height: 4, background: role.is_system_default ? 'linear-gradient(90deg,#6366f1,#8b5cf6)' : 'linear-gradient(90deg,var(--primary-teal),var(--primary-dark))' }} />
                                        <div className="card-body p-4">
                                            <div className="d-flex justify-content-between align-items-start mb-3">
                                                <div>
                                                    <h5 className="fw-bold mb-1" style={{ color: 'var(--primary-dark)' }}>{role.role_name}</h5>
                                                    <p className="text-muted small mb-1" style={{ minHeight: 28 }}>{role.description || 'No description'}</p>
                                                    {(() => {
                                                        const dashInfo = DASHBOARD_OPTIONS.find(d => d.value === (role.dashboard_access || 'admin')) || DASHBOARD_OPTIONS[0];
                                                        return (
                                                            <span className="badge rounded-pill px-2.5 py-1 border text-dark shadow-sm mb-2" style={{ background: '#f8fafc', fontSize: '0.68rem', fontWeight: 700 }}>
                                                                <i className={`bi ${dashInfo.icon} me-1`} style={{ color: dashInfo.color }} />
                                                                {dashInfo.label}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                                <div className="d-flex flex-column gap-1 ms-2 flex-shrink-0">
                                                    {role.is_system_default && (
                                                        <span className="badge rounded-pill px-2 py-1"
                                                            style={{ background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: '0.7rem' }}>
                                                            <i className="bi bi-lock-fill me-1" />System
                                                        </span>
                                                    )}
                                                    {(role.assigned_count ?? 0) > 0 && (
                                                        <span className="badge rounded-pill px-2 py-1" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.7rem' }}>
                                                            <i className="bi bi-people-fill me-1" />{role.assigned_count} user{role.assigned_count !== 1 ? 's' : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Pages counter */}
                                            <div className="d-flex align-items-center gap-2 mb-3">
                                                <div className="progress flex-grow-1 rounded-pill" style={{ height: 6 }}>
                                                    <div className="progress-bar rounded-pill" role="progressbar"
                                                        style={{ width: `${total > 0 ? (enabled / total) * 100 : 0}%`, background: 'var(--primary-teal)' }} />
                                                </div>
                                                <span className="small fw-bold" style={{ color: 'var(--primary-teal)', whiteSpace: 'nowrap' }}>
                                                    {enabled}/{total} pages
                                                </span>
                                            </div>

                                            {/* Module dots one dot per module showing how many pages enabled */}
                                            <div className="d-flex flex-wrap gap-2 mb-3">
                                                {Object.entries(PAGE_TREE).map(([mk, mod]) => {
                                                    const modPages = mod.pages;
                                                    const activeCnt = modPages.filter(p => {
                                                        const ex = role.permissions?.find(r => r.module_name === p.key);
                                                        if (ex) return ex.can_read;
                                                        const par = role.permissions?.find(r => r.module_name === mk);
                                                        return par?.can_read ?? false;
                                                    }).length;
                                                    if (activeCnt === 0) return null;
                                                    return (
                                                        <span key={mk} title={`${mod.label}: ${activeCnt}/${modPages.length} pages`}
                                                            className="d-flex align-items-center gap-1 rounded-pill px-2 py-1"
                                                            style={{ background: `${mod.color}18`, border: `1px solid ${mod.color}44`, fontSize: '0.68rem', fontWeight: 600, color: mod.color }}>
                                                            <i className={`bi ${mod.icon}`} style={{ fontSize: '0.72rem' }} />
                                                            {activeCnt}/{modPages.length}
                                                        </span>
                                                    );
                                                })}
                                                {enabled === 0 && <span className="text-muted small fst-italic">No pages enabled</span>}
                                            </div>

                                            {/* Stats row */}
                                            <div className="d-flex gap-3 mb-4 pt-2 border-top">
                                                {[
                                                    { val: fullAccess, label: 'Full', color: '#ef4444' },
                                                    { val: writeAccess, label: 'R+W', color: '#10b981' },
                                                    { val: readOnly, label: 'Read', color: '#0ea5e9' },
                                                    { val: total - enabled, label: 'None', color: '#94a3b8' },
                                                ].map(s => (
                                                    <div key={s.label} className="text-center">
                                                        <div className="fw-bold" style={{ color: s.color, fontSize: '1.1rem' }}>{s.val}</div>
                                                        <div style={{ fontSize: '0.62rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Buttons */}
                                            <div className="d-flex gap-2">
                                                {hasPermission('settings', 'write') && (
                                                    <button className="btn btn-sm flex-grow-1 fw-semibold rounded-3"
                                                        onClick={() => handleEdit(role)}
                                                        style={{ background: 'var(--primary-dark)', color: '#fff', border: 'none' }}>
                                                        <i className="bi bi-sliders me-2" />Configure Permissions
                                                    </button>
                                                )}
                                                {hasPermission('settings', 'write') && (
                                                    <button className="btn btn-sm btn-outline-primary rounded-3" onClick={() => handleClone(role.id)} title="Clone Role">
                                                        <i className="bi bi-files me-1" />Clone
                                                    </button>
                                                )}
                                                {!role.is_system_default && hasPermission('settings', 'delete') && (
                                                    <button className="btn btn-sm btn-outline-danger rounded-3" onClick={() => handleDelete(role.id)} title="Delete Role">
                                                        <i className="bi bi-trash3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {roles.length === 0 && (
                            <div className="col-12 text-center py-5">
                                <i className="bi bi-shield-x display-4 d-block mb-3 text-muted" />
                                <h5 className="text-muted">No roles created yet</h5>
                                <p className="text-muted">Create your first role to manage user access</p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ──────────────────────────── FORM VIEW ──────────────────────────── */}
            {view === 'form' && (
                <div className="animate__animated animate__fadeInUp">
                    {/* Header */}
                    <div className="d-flex align-items-center gap-3 mb-4">
                        <button className="btn btn-sm btn-light rounded-3 d-flex align-items-center gap-2 px-3" onClick={() => setView('list')}>
                            <i className="bi bi-arrow-left" /> Back
                        </button>
                        <div>
                            <h3 className="h4 fw-bold mb-0" style={{ color: 'var(--primary-dark)' }}>
                                {formData.id === 0 ? 'Create New Role' : `Edit ${formData.role_name}`}
                            </h3>
                            <p className="text-muted small mb-0">
                                Set per-page permissions control exactly which pages this role can read, edit or delete
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSave}>
                        {/* Role details card */}
                        <div className="card border-0 shadow-sm rounded-4 mb-4">
                            <div className="card-body p-4">
                                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--primary-dark)' }}>
                                    <i className="bi bi-info-circle-fill" style={{ color: 'var(--primary-teal)' }} /> Role Details
                                </h6>
                                <div className="row g-3">
                                    <div className="col-12 col-md-5">
                                        <label className="form-label fw-semibold small text-uppercase" style={{ letterSpacing: '0.05em', color: 'var(--primary-dark)' }}>
                                            Role Name <span className="text-danger">*</span>
                                        </label>
                                        <input className="form-control rounded-3" required
                                            value={formData.role_name}
                                            onChange={e => setFormData({ ...formData, role_name: e.target.value })}
                                            disabled={formData.is_system_default}
                                            placeholder="e.g. Accountant, Librarian, Receptionist"
                                            style={{ border: '1.5px solid #dee2e6', height: 42 }} />
                                        {formData.is_system_default && (
                                            <small className="text-muted d-block mt-1"><i className="bi bi-lock-fill me-1" />System roles cannot be renamed</small>
                                        )}
                                    </div>
                                    <div className="col-12 col-md-7">
                                        <label className="form-label fw-semibold small text-uppercase" style={{ letterSpacing: '0.05em', color: 'var(--primary-dark)' }}>Description</label>
                                        <input className="form-control rounded-3"
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Short description of this role's responsibilities"
                                            style={{ border: '1.5px solid #dee2e6', height: 42 }} />
                                    </div>
                                    <div className="col-12 col-md-6">
                                        <label className="form-label fw-semibold small text-uppercase" style={{ letterSpacing: '0.05em', color: 'var(--primary-dark)' }}>
                                            Role Level
                                        </label>
                                        <select className="form-control rounded-3"
                                            value={formData.role_level || 50}
                                            onChange={e => setFormData({ ...formData, role_level: parseInt(e.target.value) })}
                                            style={{ border: '1.5px solid #dee2e6', height: 42 }}>
                                            {ROLE_LEVELS.map(level => (
                                                <option key={level.value} value={level.value}>
                                                    {level.label} - {level.desc}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-12 col-md-6">
                                        <label className="form-label fw-semibold small text-uppercase d-flex align-items-center gap-1" style={{ letterSpacing: '0.05em', color: 'var(--primary-dark)' }}>
                                            <i className="bi bi-display" style={{ color: '#0f766e' }}></i> Assigned Dashboard Access <span className="text-danger">*</span>
                                        </label>
                                        <select className="form-select rounded-3 fw-bold"
                                            value={formData.dashboard_access || 'admin'}
                                            onChange={e => setFormData({ ...formData, dashboard_access: e.target.value })}
                                            style={{ border: '1.5px solid #0f766e', height: 42, color: '#0f766e' }}>
                                            {DASHBOARD_OPTIONS.map(dash => (
                                                <option key={dash.value} value={dash.value}>
                                                    {dash.label} — ({dash.desc})
                                                </option>
                                            ))}
                                        </select>
                                        <small className="text-muted d-block mt-1">
                                            <i className="bi bi-info-circle me-1"></i>
                                            Users assigned to this role will see this specific dashboard interface upon logging in.
                                        </small>
                                    </div>
                                    {formData.id !== 0 && (formData.assigned_count ?? 0) > 0 && (
                                        <div className="col-12 col-md-6">
                                            <div className="p-3 rounded-3" style={{ background: '#e0f2fe', border: '1px solid #0ea5e9' }}>
                                                <p className="fw-semibold small mb-1" style={{ color: '#0369a1' }}>
                                                    <i className="bi bi-people-fill me-2" />Assigned Users
                                                </p>
                                                <p className="mb-0 text-muted small">
                                                    This role is assigned to <strong>{formData.assigned_count}</strong> user{formData.assigned_count !== 1 ? 's' : ''}. Changes will affect all of them.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Permissions card */}
                        <div className="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden">
                            {/* Card global header */}
                            <div className="px-4 py-3 d-flex justify-content-between align-items-center flex-wrap gap-2"
                                style={{ background: 'var(--primary-dark)' }}>
                                <div>
                                    <h6 className="fw-bold mb-0 text-white d-flex align-items-center gap-2">
                                        <i className="bi bi-toggles" /> Page-Level Permissions
                                    </h6>
                                    <small style={{ color: 'rgba(255,255,255,0.6)' }}>
                                        {enabledCount} of {totalPages} pages enabled
                                    </small>
                                </div>
                                <div className="d-flex gap-2">
                                    <button type="button" className="btn btn-sm rounded-3 fw-semibold" onClick={grantAll}
                                        style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>
                                        <i className="bi bi-check-all me-1" />Grant All
                                    </button>
                                    <button type="button" className="btn btn-sm rounded-3 fw-semibold" onClick={revokeAll}
                                        style={{ background: 'rgba(239,68,68,0.25)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)' }}>
                                        <i className="bi bi-x-circle me-1" />Revoke All
                                    </button>
                                </div>
                            </div>

                            {/* Legend */}
                            <div className="px-4 py-2 d-flex flex-wrap gap-4 border-bottom" style={{ background: '#f8fafc' }}>
                                {[
                                    { icon: 'bi-eye-fill', color: '#0ea5e9', bg: '#e0f2fe', label: 'Read', desc: 'Can view/see the page & its data' },
                                    { icon: 'bi-pencil-fill', color: '#10b981', bg: '#d1fae5', label: 'Write', desc: 'Can create and edit records' },
                                    { icon: 'bi-trash3-fill', color: '#ef4444', bg: '#fee2e2', label: 'Delete', desc: 'Can permanently remove records' },
                                ].map(l => (
                                    <div key={l.label} className="d-flex align-items-center gap-2 py-1">
                                        <div className="rounded-2 d-flex align-items-center justify-content-center" style={{ width: 28, height: 28, background: l.bg }}>
                                            <i className={`bi ${l.icon}`} style={{ color: l.color, fontSize: '0.8rem' }} />
                                        </div>
                                        <div>
                                            <div className="fw-bold" style={{ fontSize: '0.78rem', color: '#1e293b' }}>{l.label}</div>
                                            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{l.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Module sections */}
                            <div className="card-body p-0">
                                {Object.entries(PAGE_TREE).map(([moduleKey, mod], modIdx) => {
                                    const { enabled: modEnabled, total: modTotal } = modulePageCount(moduleKey);
                                    const isExpanded = expanded[moduleKey] ?? true;
                                    const allGranted = modEnabled === modTotal && modTotal > 0;
                                    const noneGranted = modEnabled === 0;
                                    return (
                                        <div key={moduleKey} className="border-bottom">
                                            {/* Module header row */}
                                            <div className="d-flex align-items-center gap-3 px-4 py-3 flex-wrap"
                                                style={{ background: '#f8fafc', borderLeft: `4px solid ${mod.color}`, cursor: 'pointer' }}
                                                onClick={() => setExpanded(prev => ({ ...prev, [moduleKey]: !isExpanded }))}>

                                                {/* Icon + label */}
                                                <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ minWidth: 180 }}>
                                                    <div className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                                                        style={{ width: 36, height: 36, background: `${mod.color}18`, border: `1.5px solid ${mod.color}33` }}>
                                                        <i className={`bi ${mod.icon}`} style={{ color: mod.color, fontSize: '0.95rem' }} />
                                                    </div>
                                                    <div>
                                                        <div className="fw-bold" style={{ fontSize: '0.9rem', color: 'var(--primary-dark)' }}>{mod.label}</div>
                                                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{modEnabled}/{modTotal} pages enabled</div>
                                                    </div>
                                                </div>

                                                {/* Mini progress bar */}
                                                <div className="d-flex align-items-center gap-2 me-2" style={{ minWidth: 120 }}>
                                                    <div className="progress rounded-pill" style={{ height: 5, width: 80 }}>
                                                        <div className="progress-bar rounded-pill" style={{ width: `${modTotal > 0 ? (modEnabled / modTotal) * 100 : 0}%`, background: mod.color }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: mod.color }}>
                                                        {modTotal > 0 ? Math.round((modEnabled / modTotal) * 100) : 0}%
                                                    </span>
                                                </div>

                                                {/* Module Grant/Revoke buttons */}
                                                <div className="d-flex gap-1 me-2" onClick={e => e.stopPropagation()}>
                                                    <button type="button" title={`Grant all ${mod.label} pages`}
                                                        className="btn btn-sm rounded-2 fw-semibold"
                                                        onClick={() => setModulePerms(moduleKey, true)}
                                                        style={{ fontSize: '0.7rem', padding: '3px 10px', background: allGranted ? '#d1fae5' : '#f1f5f9', color: allGranted ? '#047857' : '#64748b', border: `1px solid ${allGranted ? '#10b981' : '#e2e8f0'}` }}>
                                                        <i className="bi bi-check-all me-1" />All
                                                    </button>
                                                    <button type="button" title={`Revoke all ${mod.label} pages`}
                                                        className="btn btn-sm rounded-2 fw-semibold"
                                                        onClick={() => setModulePerms(moduleKey, false)}
                                                        style={{ fontSize: '0.7rem', padding: '3px 10px', background: noneGranted ? '#fee2e2' : '#f1f5f9', color: noneGranted ? '#b91c1c' : '#64748b', border: `1px solid ${noneGranted ? '#ef4444' : '#e2e8f0'}` }}>
                                                        <i className="bi bi-x-lg me-1" />None
                                                    </button>
                                                </div>

                                                {/* Expand toggle */}
                                                <i className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'} ms-auto`}
                                                    style={{ color: '#94a3b8', fontSize: '0.85rem' }} />
                                            </div>

                                            {/* Page rows */}
                                            {isExpanded && (
                                                <div>
                                                    {mod.pages.map((page, pageIdx) => {
                                                        const perm = getPerm(page.key);
                                                        const badge = permBadge(perm, mod.color);
                                                        return (
                                                            <div key={page.key}
                                                                className={`d-flex align-items-center gap-3 flex-wrap px-4 py-3 border-top ${perm.can_read ? '' : 'opacity-75'}`}
                                                                style={{ background: perm.can_read ? '#fff' : '#fafafa', paddingLeft: '3.5rem !important', marginLeft: 4 }}>
                                                                {/* Page icon + info */}
                                                                <div className="d-flex align-items-center gap-3 me-auto" style={{ minWidth: 220, paddingLeft: 28 }}>
                                                                    <div className="rounded-2 d-flex align-items-center justify-content-center flex-shrink-0"
                                                                        style={{ width: 32, height: 32, background: badge.bg, border: `1px solid ${badge.border}` }}>
                                                                        <i className={`bi ${page.icon}`} style={{ color: badge.color, fontSize: '0.85rem' }} />
                                                                    </div>
                                                                    <div>
                                                                        <div className="fw-semibold" style={{ fontSize: '0.85rem', color: 'var(--primary-dark)' }}>{page.label}</div>
                                                                        <div className="text-muted" style={{ fontSize: '0.7rem' }}>{page.desc}</div>
                                                                    </div>
                                                                </div>

                                                                {/* R/W/D toggles */}
                                                                <div className="d-flex gap-2 flex-wrap align-items-center ms-auto">
                                                                    {/* Read */}
                                                                    <label className="d-flex align-items-center gap-2 rounded-3 px-3 py-2 user-select-none"
                                                                        style={{ cursor: 'pointer', background: perm.can_read ? '#e0f2fe' : '#f1f5f9', border: `1.5px solid ${perm.can_read ? '#0ea5e9' : '#e2e8f0'}`, transition: 'all 0.15s' }}>
                                                                        <input type="checkbox" className="d-none" checked={perm.can_read} onChange={() => togglePerm(page.key, 'can_read')} />
                                                                        <div className="rounded-2 d-flex align-items-center justify-content-center"
                                                                            style={{ width: 18, height: 18, background: perm.can_read ? '#0ea5e9' : '#e2e8f0', transition: 'all 0.15s', flexShrink: 0 }}>
                                                                            {perm.can_read && <i className="bi bi-check text-white" style={{ fontSize: '0.7rem', lineHeight: 1 }} />}
                                                                        </div>
                                                                        <div>
                                                                            <div className="fw-bold" style={{ fontSize: '0.75rem', color: perm.can_read ? '#0369a1' : '#94a3b8', lineHeight: 1.2 }}>Read</div>
                                                                        </div>
                                                                    </label>

                                                                    {/* Write */}
                                                                    <label className="d-flex align-items-center gap-2 rounded-3 px-3 py-2 user-select-none"
                                                                        style={{ cursor: 'pointer', background: perm.can_write ? '#d1fae5' : '#f1f5f9', border: `1.5px solid ${perm.can_write ? '#10b981' : '#e2e8f0'}`, transition: 'all 0.15s' }}>
                                                                        <input type="checkbox" className="d-none" checked={perm.can_write} onChange={() => togglePerm(page.key, 'can_write')} />
                                                                        <div className="rounded-2 d-flex align-items-center justify-content-center"
                                                                            style={{ width: 18, height: 18, background: perm.can_write ? '#10b981' : '#e2e8f0', transition: 'all 0.15s', flexShrink: 0 }}>
                                                                            {perm.can_write && <i className="bi bi-check text-white" style={{ fontSize: '0.7rem', lineHeight: 1 }} />}
                                                                        </div>
                                                                        <div>
                                                                            <div className="fw-bold" style={{ fontSize: '0.75rem', color: perm.can_write ? '#047857' : '#94a3b8', lineHeight: 1.2 }}>Write</div>
                                                                        </div>
                                                                    </label>

                                                                    {/* Delete */}
                                                                    <label className="d-flex align-items-center gap-2 rounded-3 px-3 py-2 user-select-none"
                                                                        style={{ cursor: 'pointer', background: perm.can_delete ? '#fee2e2' : '#f1f5f9', border: `1.5px solid ${perm.can_delete ? '#ef4444' : '#e2e8f0'}`, transition: 'all 0.15s' }}>
                                                                        <input type="checkbox" className="d-none" checked={perm.can_delete} onChange={() => togglePerm(page.key, 'can_delete')} />
                                                                        <div className="rounded-2 d-flex align-items-center justify-content-center"
                                                                            style={{ width: 18, height: 18, background: perm.can_delete ? '#ef4444' : '#e2e8f0', transition: 'all 0.15s', flexShrink: 0 }}>
                                                                            {perm.can_delete && <i className="bi bi-check text-white" style={{ fontSize: '0.7rem', lineHeight: 1 }} />}
                                                                        </div>
                                                                        <div>
                                                                            <div className="fw-bold" style={{ fontSize: '0.75rem', color: perm.can_delete ? '#b91c1c' : '#94a3b8', lineHeight: 1.2 }}>Delete</div>
                                                                        </div>
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Save bar */}
                        <div className="card border-0 shadow-sm rounded-4 p-3 d-flex flex-row align-items-center justify-content-between gap-3 flex-wrap">
                            <div className="d-flex flex-wrap gap-3 small">
                                <span className="fw-semibold" style={{ color: 'var(--primary-dark)' }}>
                                    <i className="bi bi-check-circle-fill me-1 text-success" />
                                    {enabledCount}/{totalPages} pages enabled
                                </span>
                                <span className="fw-semibold" style={{ color: '#64748b' }}>
                                    <i className="bi bi-pencil-fill me-1" style={{ color: '#10b981' }} />
                                    {formData.permissions.filter(p => p.can_write).length} with write
                                </span>
                                <span className="fw-semibold" style={{ color: '#64748b' }}>
                                    <i className="bi bi-trash3-fill me-1" style={{ color: '#ef4444' }} />
                                    {formData.permissions.filter(p => p.can_delete).length} with delete
                                </span>
                            </div>
                            <div className="d-flex gap-2">
                                <button type="button" className="btn btn-light rounded-3 px-4" onClick={() => setView('list')}>Cancel</button>
                                {hasPermission('settings', 'write') && (
                                    <button type="submit" className="btn rounded-3 px-4 fw-bold d-flex align-items-center gap-2"
                                        disabled={saving}
                                        style={{ background: 'var(--primary-dark)', color: '#fff', border: 'none', minWidth: 140 }}>
                                        {saving ? (
                                            <><span className="spinner-border spinner-border-sm" /> Saving...</>
                                        ) : (
                                            <><i className="bi bi-floppy-fill" /> Save Changes</>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmModal?.show && (
                <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                    style={{ background: 'rgba(0,0,0,0.5)', zIndex: 9999 }}>
                    <div className="card border-0 rounded-4 shadow-lg" style={{ maxWidth: 450, width: '90%' }}>
                        <div className="card-body p-4">
                            <div className="mb-3 p-3 rounded-3" style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}>
                                <h5 className="fw-bold mb-1 d-flex align-items-center gap-2" style={{ color: '#b45309' }}>
                                    <i className="bi bi-exclamation-triangle-fill" /> Updating Shared Role
                                </h5>
                                <p className="mb-0 small" style={{ color: '#92400e' }}>
                                    This role is assigned to <strong>{confirmModal.assignedCount}</strong> user{confirmModal.assignedCount !== 1 ? 's' : ''}. Your changes will affect all of them.
                                </p>
                            </div>

                            <p className="text-muted mb-3">
                                <i className="bi bi-info-circle me-2" />Choose one of the following options:
                            </p>

                            <div className="d-flex flex-column gap-2 mb-4">
                                <button type="button" className="btn btn-sm p-2 text-start rounded-3"
                                    onClick={() => performSave(true)}
                                    disabled={saving}
                                    style={{ background: '#d1fae5', color: '#047857', border: '1.5px solid #10b981', fontWeight: 600 }}>
                                    <i className="bi bi-check-circle-fill me-2" />
                                    <div>
                                        <div style={{ fontSize: '0.9rem' }}>Apply to all {confirmModal.assignedCount} user{confirmModal.assignedCount !== 1 ? 's' : ''}</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Update the shared role for everyone</div>
                                    </div>
                                </button>

                                <button type="button" className="btn btn-sm p-2 text-start rounded-3"
                                    onClick={async () => {
                                        setConfirmModal(null);
                                        await handleClone(confirmModal.roleId);
                                    }}
                                    disabled={saving}
                                    style={{ background: '#e0f2fe', color: '#0369a1', border: '1.5px solid #0ea5e9', fontWeight: 600 }}>
                                    <i className="bi bi-files me-2" />
                                    <div>
                                        <div style={{ fontSize: '0.9rem' }}>Clone & edit</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Create a copy for different permissions</div>
                                    </div>
                                </button>
                            </div>

                            <button type="button" className="btn btn-light w-100 rounded-3 fw-semibold"
                                onClick={() => setConfirmModal(null)}
                                disabled={saving}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
