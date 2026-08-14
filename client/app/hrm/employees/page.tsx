'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';

// Types
type Employee = {
    employee_id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    designation: string;
    department_name: string;
    department_id: string; // Needed for edit
    status: string;
    system_username?: string;
    cnic?: string;
    joining_date?: string;
    salary?: string;
    address?: string;
    gender?: string;
    dob?: string;
    marital_status?: string;
    father_name?: string;
    emergency_contact?: string;
    qualification?: string;
    experience?: string;
    blood_group?: string;
    app_user_id?: number;
};

type Department = { department_id: number; department_name: string; };
type Role = { id: number; role_name: string; };

export default function EmployeesPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'details'>('create');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [mounted, setMounted] = useState(false);

    // Form State
    const [isSysUser, setIsSysUser] = useState(false);
    const { hasPermission } = useAuth();
    const [formData, setFormData] = useState({
        first_name: '', last_name: '', email: '', phone: '', cnic: '', designation: '',
        department_id: '', joining_date: '', salary: '', address: '',
        gender: '', dob: '', marital_status: '', father_name: '',
        emergency_contact: '', qualification: '', experience: '', blood_group: '',
        username: '', password: '', role_id: ''
    });

    useEffect(() => {
        setMounted(true);
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [empRes, deptRes, roleRes] = await Promise.all([
                fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/hrm/employees`),
                fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/hrm/departments`),
                fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/roles`) // Assuming this exists from previous modules
            ]);

            if (empRes.ok) setEmployees(await empRes.json());
            if (deptRes.ok) setDepartments(await deptRes.json());
            if (roleRes.ok) setRoles(await roleRes.json());
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const resetForm = () => {
        setFormData({
            first_name: '', last_name: '', email: '', phone: '', cnic: '', designation: '',
            department_id: '', joining_date: '', salary: '', address: '',
            gender: '', dob: '', marital_status: '', father_name: '',
            emergency_contact: '', qualification: '', experience: '', blood_group: '',
            username: '', password: '', role_id: ''
        });
        setIsSysUser(false);
        setModalMode('create');
        setSelectedId(null);
    };

    const handleOpenCreate = () => {
        resetForm();
        setModalMode('create');
        setShowModal(true);
    };

    const handleOpenEdit = (emp: Employee) => {
        resetForm();
        setModalMode('edit');
        setSelectedId(emp.employee_id);
        // setIsSysUser stays false show toggle only if employee has no user
        setFormData({
            first_name: emp.first_name || '',
            last_name: emp.last_name || '',
            email: emp.email || '',
            phone: emp.phone || '',
            cnic: emp.cnic || '',
            designation: emp.designation || '',
            department_id: emp.department_id || '',
            joining_date: emp.joining_date ? emp.joining_date.substring(0, 10) : '',
            salary: emp.salary || '',
            address: emp.address || '',
            gender: emp.gender || '',
            dob: emp.dob ? emp.dob.substring(0, 10) : '',
            marital_status: emp.marital_status || '',
            father_name: emp.father_name || '',
            emergency_contact: emp.emergency_contact || '',
            qualification: emp.qualification || '',
            experience: emp.experience || '',
            blood_group: emp.blood_group || '',
            // Store whether employee already has a user via a hidden marker
            username: '', password: '', role_id: '',
            // Pass existing user status so UI knows whether to show "create" or "already linked"
            _has_user: emp.app_user_id ? 'yes' : ''
        } as any);
        setShowModal(true);
    };

    const handleOpenDetails = (emp: Employee) => {
        handleOpenEdit(emp); // Reuse population logic
        setModalMode('details'); // Override mode
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload = { ...formData, create_system_user: isSysUser };
        const url = modalMode === 'create'
            ? `${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/hrm/employees`
            : `${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/hrm/employees/${selectedId}`;

        const method = modalMode === 'create' ? 'POST' : 'PUT';

        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                fetchData();
                setShowModal(false);
                resetForm();
                alert(modalMode === 'create' ? "Employee created successfully!" : "Employee updated successfully!");
            } else {
                const err = await res.json();
                alert("Error: " + err.error);
            }
        } catch (err) { alert('Failed to save employee'); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this employee?')) return;
        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/hrm/employees/${id}`, { method: 'DELETE' });
            fetchData();
        } catch (err) { alert('Failed to delete'); }
    };

    return (
        <div className="container-fluid animate__animated animate__fadeIn">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="h3 mb-0 text-primary-dark">Employees</h2>
                {hasPermission('hrm', 'write') && (
                    <button className="btn btn-primary-custom" onClick={handleOpenCreate}>
                        + New Employee
                    </button>
                )}
            </div>

            <div className="card border-0 shadow-sm">
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover mb-0 align-middle">
                            <thead className="bg-light">
                                <tr>
                                    <th className="ps-4">Name</th>
                                    <th>Designation</th>
                                    <th>Department</th>
                                    <th>Contact</th>
                                    <th>User Account</th>
                                    <th>Status</th>
                                    <th className="text-end pe-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={7} className="text-center py-4">Loading...</td></tr>
                                ) : employees.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-4">No employees found.</td></tr>
                                ) : (
                                    employees.map(emp => (
                                        <tr key={emp.employee_id}>
                                            <td className="ps-4">
                                                <div className="fw-bold">{emp.first_name} {emp.last_name}</div>
                                                <small className="text-muted">{emp.email}</small>
                                            </td>
                                            <td>{emp.designation}</td>
                                            <td><span className="badge bg-light text-dark border">{emp.department_name || 'Unassigned'}</span></td>
                                            <td>{emp.phone}</td>
                                            <td>
                                                {emp.system_username ? (
                                                    <span className="badge bg-success-subtle text-success">
                                                        <i className="bi bi-check-circle me-1"></i> {emp.system_username}
                                                    </span>
                                                ) : <span className="text-muted small">-</span>}
                                            </td>
                                            <td>
                                                <span className={`badge ${emp.status === 'Active' ? 'bg-success' : 'bg-secondary'}`}>
                                                    {emp.status}
                                                </span>
                                            </td>
                                            <td className="text-end pe-4">
                                                <Link href={`/hrm/employees/${emp.employee_id}`}>
                                                    <button title="View Details" className="btn btn-sm btn-outline-primary me-1">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                            <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z" />
                                                            <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" />
                                                        </svg>
                                                    </button>
                                                </Link>
                                                {hasPermission('hrm', 'write') && (
                                                    <button title="Edit" className="btn btn-sm btn-outline-secondary me-1" onClick={() => handleOpenEdit(emp)}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                            <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z" />
                                                        </svg>
                                                    </button>
                                                )}
                                                {hasPermission('hrm', 'delete') && (
                                                    <button title="Delete" className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(emp.employee_id)}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                                                            <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Large Modal */}
            {showModal && mounted && createPortal(
                <div className="modal-backdrop-custom">
                    <div className="modal-content-custom animate__animated animate__zoomIn">
                        <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
                            <h4 className="mb-0">
                                {modalMode === 'create' && 'Add New Employee'}
                                {modalMode === 'edit' && 'Edit Employee'}
                                {modalMode === 'details' && 'Employee Details'}
                            </h4>
                            <button onClick={() => setShowModal(false)} className="btn-close"></button>
                        </div>

                        <div className="p-3" style={{ overflowY: 'auto', flex: 1 }}>
                            <form id="createEmpForm" onSubmit={handleSubmit}>
                                <fieldset disabled={modalMode === 'details'}>
                                    <div className="row g-0">
                                        {/* Left Col: Personal */}
                                        <div className="col-12 col-lg-6 pe-lg-4">
                                            <h6 className="text-primary mb-3 bg-light p-2 rounded"><i className="bi bi-person me-2"></i>Personal Information</h6>

                                            <div className="row g-3 mb-3">
                                                <div className="col-6">
                                                    <label className="form-label small fw-bold">First Name</label>
                                                    <input required type="text" className="form-control" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} />
                                                </div>
                                                <div className="col-6">
                                                    <label className="form-label small fw-bold">Last Name</label>
                                                    <input required type="text" className="form-control" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} />
                                                </div>
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label small fw-bold">Father/Husband Name</label>
                                                <input type="text" className="form-control" value={formData.father_name} onChange={e => setFormData({ ...formData, father_name: e.target.value })} />
                                            </div>

                                            <div className="row g-3 mb-3">
                                                <div className="col-6">
                                                    <label className="form-label small fw-bold">Gender</label>
                                                    <select className="form-select" value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                                                        <option value="">Select...</option>
                                                        <option value="Male">Male</option>
                                                        <option value="Female">Female</option>
                                                    </select>
                                                </div>
                                                <div className="col-6">
                                                    <label className="form-label small fw-bold">Date of Birth</label>
                                                    <input type="date" className="form-control" value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} />
                                                </div>
                                            </div>

                                            <div className="row g-3 mb-3">
                                                <div className="col-6">
                                                    <label className="form-label small fw-bold">Marital Status</label>
                                                    <select className="form-select" value={formData.marital_status} onChange={e => setFormData({ ...formData, marital_status: e.target.value })}>
                                                        <option value="">Select...</option>
                                                        <option value="Single">Single</option>
                                                        <option value="Married">Married</option>
                                                    </select>
                                                </div>
                                                <div className="col-6">
                                                    <label className="form-label small fw-bold">CNIC</label>
                                                    <input type="text" className="form-control" value={formData.cnic} onChange={e => setFormData({ ...formData, cnic: e.target.value })} />
                                                </div>
                                            </div>

                                            <h6 className="text-primary mb-3 bg-light p-2 rounded mt-4"><i className="bi bi-geo-alt me-2"></i>Contact Details</h6>

                                            <div className="row g-3 mb-3">
                                                <div className="col-6">
                                                    <label className="form-label small fw-bold">Email</label>
                                                    <input type="email" className="form-control" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                                </div>
                                                <div className="col-6">
                                                    <label className="form-label small fw-bold">Phone</label>
                                                    <input type="text" className="form-control" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                                </div>
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label small fw-bold">Emergency Contact (Name & No)</label>
                                                <input type="text" className="form-control" value={formData.emergency_contact} onChange={e => setFormData({ ...formData, emergency_contact: e.target.value })} />
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label small fw-bold">Direct Address</label>
                                                <textarea className="form-control" rows={2} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })}></textarea>
                                            </div>
                                        </div>

                                        {/* Right Col: Job & System */}
                                        <div className="col-12 col-lg-6 ps-lg-4 border-start-lg">
                                            <h6 className="text-primary mb-3 bg-light p-2 rounded"><i className="bi bi-briefcase me-2"></i>Job Details</h6>

                                            <div className="row g-3 mb-3">
                                                <div className="col-6">
                                                    <label className="form-label small fw-bold">Designation</label>
                                                    <input required type="text" className="form-control" placeholder="e.g. Teacher" value={formData.designation} onChange={e => setFormData({ ...formData, designation: e.target.value })} />
                                                </div>
                                                <div className="col-6">
                                                    <label className="form-label small fw-bold">Department</label>
                                                    <select className="form-select" value={formData.department_id} onChange={e => setFormData({ ...formData, department_id: e.target.value })}>
                                                        <option value="">Select Dept</option>
                                                        {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="row g-3 mb-3">
                                                <div className="col-6">
                                                    <label className="form-label small fw-bold">Qualification</label>
                                                    <input type="text" className="form-control" placeholder="e.g. Master in CS" value={formData.qualification} onChange={e => setFormData({ ...formData, qualification: e.target.value })} />
                                                </div>
                                                <div className="col-6">
                                                    <label className="form-label small fw-bold">Total Experience</label>
                                                    <input type="text" className="form-control" placeholder="e.g. 5 Years" value={formData.experience} onChange={e => setFormData({ ...formData, experience: e.target.value })} />
                                                </div>
                                            </div>

                                            <div className="row g-3 mb-3">
                                                <div className="col-6">
                                                    <label className="form-label small fw-bold">Joining Date</label>
                                                    <input type="date" className="form-control" value={formData.joining_date} onChange={e => setFormData({ ...formData, joining_date: e.target.value })} />
                                                </div>
                                                <div className="col-6">
                                                    <label className="form-label small fw-bold">Blood Group</label>
                                                    <input type="text" className="form-control" placeholder="e.g. O+" value={formData.blood_group} onChange={e => setFormData({ ...formData, blood_group: e.target.value })} />
                                                </div>
                                            </div>

                                            <div className="mb-4">
                                                <label className="form-label small fw-bold">Salary (PKR)</label>
                                                <div className="input-group">
                                                    <span className="input-group-text">$</span>
                                                    <input type="number" className="form-control" value={formData.salary} onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()} onChange={e => setFormData({ ...formData, salary: e.target.value })} />
                                                </div>
                                            </div>

                                            <h6 className="text-primary mb-3 bg-light p-2 rounded"><i className="bi bi-shield-lock me-2"></i>System Access</h6>
                                            <div className="bg-light p-3 rounded border">
                                                {/* If editing and employee already has a user account → show info only */}
                                                {modalMode === 'edit' && (formData as any)._has_user ? (
                                                    <div className="d-flex align-items-center gap-2 text-success">
                                                        <i className="bi bi-shield-check fs-5"></i>
                                                        <div>
                                                            <div className="fw-bold small">System account already linked</div>
                                                            <div className="text-muted" style={{ fontSize: '0.78rem' }}>To reset password, open the employee's profile page.</div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="form-check form-switch mb-2">
                                                            <input className="form-check-input" type="checkbox" checked={isSysUser} onChange={e => setIsSysUser(e.target.checked)} />
                                                            <label className="form-check-label fw-bold">Create System User Login</label>
                                                        </div>

                                                        {isSysUser && (
                                                            <div className="animate__animated animate__fadeIn">
                                                                <div className="mb-2">
                                                                    <label className="form-label small fw-bold">Username</label>
                                                                    <input required={isSysUser} type="text" className="form-control form-control-sm" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                                                                </div>
                                                                <div className="mb-2">
                                                                    <label className="form-label small fw-bold">Password</label>
                                                                    <input required={isSysUser} type="password" className="form-control form-control-sm" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                                                                </div>
                                                                <div>
                                                                    <label className="form-label small fw-bold">Role</label>
                                                                    <select required={isSysUser} className="form-select form-select-sm" value={formData.role_id} onChange={e => setFormData({ ...formData, role_id: e.target.value })}>
                                                                        <option value="">Select Role</option>
                                                                        {roles.map(r => <option key={r.id} value={r.id}>{r.role_name}</option>)}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </fieldset>
                            </form>
                        </div>

                        <div className="d-flex justify-content-end p-3 border-top bg-light rounded-bottom">
                            <button type="button" onClick={() => setShowModal(false)} className="btn btn-light me-2">Cancel</button>
                            {modalMode !== 'details' && hasPermission('hrm', 'write') && (
                                <button type="submit" form="createEmpForm" className="btn btn-primary-custom px-4">
                                    {modalMode === 'create' ? 'Create Employee' : 'Update Employee'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                , document.body)}

            <style jsx>{`
                .modal-backdrop-custom {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1050;
                }
                .modal-content-custom {
                    background: white; border-radius: 12px;
                    width: 90%; max-width: 900px;
                    display: flex; flex-direction: column;
                    max-height: 90vh;
                    overflow: hidden;
                }
            `}</style>
        </div>
    );
}
