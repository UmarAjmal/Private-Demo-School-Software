'use client';
import { useState, useEffect } from 'react';
import { notify, toast } from '@/app/utils/notify';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function EditStudent({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [classes, setClasses] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const { hasPermission } = useAuth();

    // Initial State
    const [guardianType, setGuardianType] = useState('Father');
    const [existingImage, setExistingImage] = useState<string | null>(null);
    const [existingDocs, setExistingDocs] = useState<string[]>([]);

    const [form, setForm] = useState({
        // Academic
        roll_no: '',
        class_id: '',
        section_id: '',
        admission_date: '',
        category: 'Normal',

        // Personal
        first_name: '',
        last_name: '',
        gender: 'Male',
        dob: '',
        cnic_bform: '',
        religion: '',
        blood_group: '',
        has_disability: false,
        disability_details: '',

        // Contact
        mobile_no: '',
        email: '',
        current_address: '',
        permanent_address: '',
        city: '',

        // Parents
        father_name: '',
        father_phone: '',
        father_cnic: '',
        father_occupation: '',
        mother_name: '',
        mother_phone: '',
        mother_cnic: '',
        mother_occupation: '',

        // Guardian
        is_orphan: false,
        guardian_name: '',
        guardian_relation: '',
        guardian_phone: '',
        guardian_cnic: '',
        guardian_address: '',

        // Fees
        monthly_fee: '',
        family_fee: '',
        admission_fee: '',
        other_charges: '',
        opening_balance: ''
    });

    // Family info state
    const [familyInfo, setFamilyInfo] = useState<{ family_id: string; family_fee: number; family_size: number } | null>(null);
    const [opbPaid, setOpbPaid] = useState<number>(0);

    const [imageFile, setImageFile] = useState<File | null>(null);
    const [documentFiles, setDocumentFiles] = useState<FileList | null>(null);

    useEffect(() => {
        require('bootstrap/dist/js/bootstrap.bundle.min.js');
        const loadData = async () => {
            await fetchClasses();
            await fetchStudentData();
        };
        loadData();
    }, [params.id]);

    const fetchStudentData = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/students/${params.id}`);
            if (res.ok) {
                const data = await res.json();

                const opbVal = data.opening_balance ? parseFloat(data.opening_balance) : 0;
                const opbPaidVal = data.opening_balance_paid ? parseFloat(data.opening_balance_paid) : 0;
                setOpbPaid(opbPaidVal);

                // Populate Form
                setForm({
                    ...data,
                    // Fix Column Mapping
                    mobile_no: data.student_mobile || data.mobile_no || '',

                    admission_date: data.admission_date ? new Date(data.admission_date).toISOString().split('T')[0] : '',
                    dob: data.dob ? new Date(data.dob).toISOString().split('T')[0] : '',
                    has_disability: data.has_disability === true,
                    is_orphan: data.is_orphan === true,
                    // If class/section IDs are present
                    class_id: data.class_id || '',
                    section_id: data.section_id || '',
                    opening_balance: opbVal > 0 ? opbVal.toString() : '',
                });

                if (data.class_id) fetchSections(data.class_id);
                if (data.image_url) setExistingImage(data.image_url);

                // Fetch family info if student has a family
                if (data.family_id) {
                    try {
                        const fRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/students/families/${data.family_id}`);
                        if (fRes.ok) {
                            const fData = await fRes.json();
                            const memberCount = fData.members ? fData.members.length : 1;
                            if (memberCount > 1) {
                                setFamilyInfo({
                                    family_id: data.family_id,
                                    family_fee: parseFloat(fData.family_fee) || 0,
                                    family_size: memberCount
                                });
                                setForm(f => ({ ...f, family_fee: String(parseFloat(fData.family_fee) || 0) }));
                            }
                        }
                    } catch (fe) { console.error('Family info fetch error:', fe); }
                }

                if (data.documents) {
                    try { setExistingDocs(JSON.parse(data.documents)); } catch (e) { }
                }

                // Determine Guardian Type Logic
                if (data.guardian_name === data.father_name && data.father_name) setGuardianType('Father');
                else if (data.guardian_name === data.mother_name && data.mother_name) setGuardianType('Mother');
                else setGuardianType('Other');

            } else {
                notify.error("Failed to load student data");
                router.push('/students');
            }
        } catch (e) {
            console.error(e);
            notify.error("Error loading student");
        } finally {
            setLoading(false);
        }
    };

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

    const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setForm({ ...form, class_id: val, section_id: '' });
        if (val) fetchSections(val);
        else setSections([]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const toastId = toast.loading("Updating Student...");

        const enteredOpb = parseFloat(form.opening_balance || '0') || 0;
        if (opbPaid > 0 && enteredOpb < opbPaid) {
            toast.update(toastId, {
                render: `Opening Balance cannot be less than already paid amount (Rs. ${opbPaid.toLocaleString()})`,
                type: "error",
                isLoading: false,
                autoClose: 5000
            });
            setSubmitting(false);
            return;
        }

        try {
            const formData = new FormData();

            // Append Text Fields - Handle optional fields properly
            Object.keys(form).forEach(key => {
                let value = (form as any)[key];

                // Skip empty date fields (dob, admission_date) if empty string to avoid date syntax errors
                if ((key === 'dob' || key === 'admission_date') && (!value || String(value).trim() === '')) {
                    return;
                }

                // Skip empty integer fields (class_id, section_id) if empty string
                if ((key === 'class_id' || key === 'section_id') && (!value || String(value).trim() === '')) {
                    return;
                }

                if (value !== null && value !== undefined) {
                    formData.append(key, value);
                }
            });

            // Handle Existing Files
            if (existingImage) formData.append('existing_image_url', existingImage);
            if (existingDocs.length > 0) formData.append('existing_documents', JSON.stringify(existingDocs));

            // Append New Files
            if (imageFile) {
                formData.append('image', imageFile);
            }
            if (documentFiles) {
                for (let i = 0; i < documentFiles.length; i++) {
                    formData.append('documents', documentFiles[i]);
                }
            }

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/students/${params.id}`, {
                method: 'PUT',
                body: formData
            });

            const data = await res.json();

            if (res.ok) {
                toast.update(toastId, { render: "Updated Successfully!", type: "success", isLoading: false, autoClose: 2000 });
                router.push(`/students/profile/${params.id}`);
            } else {
                toast.update(toastId, { render: data.error || "Update Failed", type: "error", isLoading: false, autoClose: 5000 });
            }
        } catch (err) {
            console.error(err);
            toast.update(toastId, { render: "Server Error", type: "error", isLoading: false, autoClose: 5000 });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-5 text-center">Loading Student Data...</div>;

    return (
        <div className="container-fluid p-4">
            <div className="d-flex align-items-center mb-4">
                <button className="btn btn-outline-secondary me-3 rounded-circle" onClick={() => router.back()}>
                    <i className="bi bi-arrow-left"></i>
                </button>
                <h2 className="mb-0 fw-bold animate__animated animate__fadeInDown" style={{ color: 'var(--primary-dark)' }}>
                    <i className="bi bi-pencil-square me-2"></i>Edit Student Profile
                </h2>
            </div>

            <form onSubmit={handleSubmit} className="animate__animated animate__fadeInUp">
                <div className="row g-4">

                    {/* 1. Academic & Uploads */}
                    <div className="col-12">
                        <div className="card shadow-sm border-0 rounded-4">
                            <div className="card-header text-white p-3 rounded-top-4" style={{ backgroundColor: 'var(--primary-dark)' }}>
                                <h5 className="mb-0 bi bi-mortarboard-fill"> Academic & Uploads</h5>
                            </div>
                            <div className="card-body p-4">
                                <div className="row g-3">
                                    {/* Photo Upload Section */}
                                    <div className="col-md-2 text-center">
                                        <div className="border border-2 border-dashed rounded-3 d-flex align-items-center justify-content-center bg-light position-relative"
                                            style={{ height: '140px', width: '130px', margin: '0 auto', overflow: 'hidden' }}>
                                            {imageFile ? (
                                                <img src={URL.createObjectURL(imageFile)} alt="Preview"
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : existingImage ? (
                                                <img src={`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/${existingImage}`} alt="Current"
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <div className="text-secondary small">
                                                    <i className="bi bi-camera-fill fs-3 d-block mb-1"></i>
                                                    Student Photo
                                                </div>
                                            )}
                                        </div>
                                        <input type="file" className="form-control form-control-sm mt-2" accept="image/*"
                                            onChange={(e) => e.target.files && setImageFile(e.target.files[0])} />
                                    </div>

                                    {/* Academic Fieds */}
                                    <div className="col-md-10">
                                        <div className="row g-3">
                                            {/* Admission NO Readonly */}
                                            <div className="col-md-3">
                                                <label className="form-label fw-bold">Admission No</label>
                                                <input type="text" className="form-control bg-light" disabled value={(form as any).admission_no || ''} />
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label fw-bold">Admission Date</label>
                                                <input type="date" className="form-control"
                                                    value={form.admission_date} onChange={e => setForm({ ...form, admission_date: e.target.value })} />
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label fw-bold">Class</label>
                                                <select className="form-select" value={form.class_id} onChange={handleClassChange}>
                                                    <option value="">Select Class</option>
                                                    {classes.map((c: any) => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label fw-bold">Section</label>
                                                <select className="form-select" value={form.section_id} onChange={e => setForm({ ...form, section_id: e.target.value })}>
                                                    <option value="">Select Section</option>
                                                    {sections.map((s: any) => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label fw-bold">Roll No</label>
                                                <input type="text" className="form-control"
                                                    value={form.roll_no} onChange={e => setForm({ ...form, roll_no: e.target.value })} />
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label fw-bold">Category</label>
                                                <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                                                    <option value="Normal">Normal</option>
                                                    <option value="Trusted">Trusted</option>
                                                </select>
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold">Add New Documents</label>
                                                <input type="file" className="form-control" multiple accept=".pdf,.doc,.docx,.jpg,.png"
                                                    onChange={(e) => setDocumentFiles(e.target.files)} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Personal Details */}
                    <div className="col-12">
                        <div className="card shadow-sm border-0 rounded-4">
                            <div className="card-header text-white p-3 rounded-top-4" style={{ backgroundColor: 'var(--primary-teal)' }}>
                                <h5 className="mb-0 bi bi-person-lines-fill"> Personal Details</h5>
                            </div>
                            <div className="card-body p-4">
                                <div className="row g-3">
                                    <div className="col-md-4">
                                        <label className="form-label fw-bold">First Name</label>
                                        <input type="text" className="form-control" required
                                            value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label fw-bold">Last Name</label>
                                        <input type="text" className="form-control"
                                            value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label fw-bold">Date of Birth</label>
                                        <input type="date" className="form-control"
                                            value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label fw-bold">Gender</label>
                                        <select className="form-select" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                                            <option>Male</option>
                                            <option>Female</option>
                                            <option>Other</option>
                                        </select>
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label fw-bold">CNIC / B-Form</label>
                                        <input type="text" className="form-control" placeholder="xxxxx-xxxxxxx-x"
                                            value={form.cnic_bform} onChange={e => setForm({ ...form, cnic_bform: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label fw-bold">Blood Group</label>
                                        <select className="form-select" value={form.blood_group} onChange={e => setForm({ ...form, blood_group: e.target.value })}>
                                            <option value="">Unknown</option>
                                            <option>A+</option><option>A-</option>
                                            <option>B+</option><option>B-</option>
                                            <option>O+</option><option>O-</option>
                                            <option>AB+</option><option>AB-</option>
                                        </select>
                                    </div>
                                    <div className="col-12 mt-3">
                                        <div className="form-check">
                                            <input className="form-check-input" type="checkbox" id="disabilityCheck"
                                                checked={form.has_disability} onChange={e => setForm({ ...form, has_disability: e.target.checked })} />
                                            <label className="form-check-label fw-bold text-danger" htmlFor="disabilityCheck">
                                                Student has Disability?
                                            </label>
                                        </div>
                                    </div>
                                    {form.has_disability && (
                                        <div className="col-12 animate__animated animate__fadeIn">
                                            <label className="form-label fw-bold">Disability Details</label>
                                            <input type="text" className="form-control" placeholder="Please specify nature of disability..."
                                                value={form.disability_details} onChange={e => setForm({ ...form, disability_details: e.target.value })} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Parents & Guardian Info */}
                    <div className="col-12">
                        <div className="card shadow-sm border-0 rounded-4">
                            <div className="card-header text-white p-3 rounded-top-4" style={{ backgroundColor: 'var(--accent-orange)' }}>
                                <div className="d-flex justify-content-between align-items-center">
                                    <h5 className="mb-0 bi bi-people-fill"> Parents & Guardian Info</h5>
                                    <div>
                                        <div className="form-check form-switch d-inline-block me-3">
                                            <input className="form-check-input" type="checkbox" id="orphanSwitch"
                                                checked={form.is_orphan} onChange={e => {
                                                    const isOrphan = e.target.checked;
                                                    setForm({ ...form, is_orphan: isOrphan });
                                                    if (isOrphan) setGuardianType('Other');
                                                    else setGuardianType('Father');
                                                }} />
                                            <label className="form-check-label text-white fw-bold" htmlFor="orphanSwitch">Student is Orphan?</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="card-body p-4">
                                <div className={`row g-3 ${form.is_orphan ? 'opacity-50' : ''}`}>
                                    <h6 className="fw-bold text-muted border-bottom pb-2">Parents Information</h6>
                                    {/* FATHER */}
                                    <div className="col-md-3">
                                        <label className="form-label fw-bold">Father Name</label>
                                        <input type="text" className="form-control" required={!form.is_orphan}
                                            value={form.father_name} onChange={e => setForm({ ...form, father_name: e.target.value })} />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label fw-bold">Father Phone</label>
                                        <input type="text" className="form-control"
                                            value={form.father_phone} onChange={e => setForm({ ...form, father_phone: e.target.value })} />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label fw-bold">Father CNIC</label>
                                        <input type="text" className="form-control"
                                            value={form.father_cnic} onChange={e => setForm({ ...form, father_cnic: e.target.value })} />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label fw-bold">Occupation</label>
                                        <input type="text" className="form-control"
                                            value={form.father_occupation} onChange={e => setForm({ ...form, father_occupation: e.target.value })} />
                                    </div>

                                    {/* MOTHER */}
                                    <div className="col-md-3">
                                        <label className="form-label fw-bold">Mother Name</label>
                                        <input type="text" className="form-control"
                                            value={form.mother_name} onChange={e => setForm({ ...form, mother_name: e.target.value })} />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label fw-bold">Mother Phone</label>
                                        <input type="text" className="form-control"
                                            value={form.mother_phone} onChange={e => setForm({ ...form, mother_phone: e.target.value })} />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label fw-bold">Mother CNIC</label>
                                        <input type="text" className="form-control"
                                            value={form.mother_cnic} onChange={e => setForm({ ...form, mother_cnic: e.target.value })} />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label fw-bold">Occupation</label>
                                        <input type="text" className="form-control"
                                            value={form.mother_occupation} onChange={e => setForm({ ...form, mother_occupation: e.target.value })} />
                                    </div>
                                </div>

                                {/* Guardian Section */}
                                <div className={`row g-3 mt-4 p-3 rounded-3 ${form.is_orphan ? 'bg-danger-subtle border border-danger' : 'bg-light border'}`}>
                                    <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2">
                                        <h6 className="fw-bold text-muted mb-0">Guardian Information <span className="badge bg-danger ms-2">REQUIRED</span></h6>
                                        <div className="d-flex align-items-center gap-3">
                                            <span className="fw-bold small text-secondary">Is Guardian:</span>
                                            <div className="btn-group btn-group-sm" role="group">
                                                <button type="button" className={`btn ${guardianType === 'Father' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                    onClick={() => { setGuardianType('Father'); setForm(f => ({ ...f, guardian_name: f.father_name, guardian_phone: f.father_phone, guardian_cnic: f.father_cnic, guardian_relation: 'Father', guardian_address: f.current_address })) }} disabled={form.is_orphan}>Father</button>
                                                <button type="button" className={`btn ${guardianType === 'Mother' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                    onClick={() => { setGuardianType('Mother'); setForm(f => ({ ...f, guardian_name: f.mother_name, guardian_phone: f.mother_phone, guardian_cnic: f.mother_cnic, guardian_relation: 'Mother', guardian_address: f.current_address })) }} disabled={form.is_orphan}>Mother</button>
                                                <button type="button" className={`btn ${guardianType === 'Other' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                    onClick={() => { setGuardianType('Other'); }}>Other</button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-md-4">
                                        <label className="form-label fw-bold">Guardian Name</label>
                                        <input type="text" className="form-control" required
                                            readOnly={guardianType !== 'Other'}
                                            value={form.guardian_name} onChange={e => setForm({ ...form, guardian_name: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label fw-bold">Relation</label>
                                        <input type="text" className="form-control" placeholder="e.g. Uncle" required
                                            readOnly={guardianType !== 'Other'}
                                            value={form.guardian_relation} onChange={e => setForm({ ...form, guardian_relation: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label fw-bold">Guardian Phone</label>
                                        <input type="text" className="form-control"
                                            readOnly={guardianType !== 'Other'}
                                            value={form.guardian_phone} onChange={e => setForm({ ...form, guardian_phone: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label fw-bold">Guardian CNIC</label>
                                        <input type="text" className="form-control"
                                            readOnly={guardianType !== 'Other'}
                                            value={form.guardian_cnic} onChange={e => setForm({ ...form, guardian_cnic: e.target.value })} />
                                    </div>
                                    <div className="col-md-8">
                                        <label className="form-label fw-bold">Guardian Address</label>
                                        <input type="text" className="form-control"
                                            readOnly={guardianType !== 'Other'}
                                            value={form.guardian_address} onChange={e => setForm({ ...form, guardian_address: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. Contact Details */}
                    <div className="col-md-6">
                        <div className="card shadow-sm border-0 rounded-4 h-100">
                            <div className="card-header text-white p-3 rounded-top-4" style={{ backgroundColor: 'var(--secondary-purple)' }}>
                                <h5 className="mb-0 bi bi-geo-alt-fill"> Contact Details</h5>
                            </div>
                            <div className="card-body p-4">
                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <label className="form-label fw-bold">Student Mobile</label>
                                        <input type="text" className="form-control"
                                            value={form.mobile_no} onChange={e => setForm({ ...form, mobile_no: e.target.value })} />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label fw-bold">Email</label>
                                        <input type="email" className="form-control"
                                            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label fw-bold">City</label>
                                        <input type="text" className="form-control"
                                            value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label fw-bold">Current Address</label>
                                        <textarea className="form-control" rows={2}
                                            value={form.current_address} onChange={e => setForm({ ...form, current_address: e.target.value })}></textarea>
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label fw-bold">Permanent Address</label>
                                        <textarea className="form-control" rows={2}
                                            value={form.permanent_address} onChange={e => setForm({ ...form, permanent_address: e.target.value })}></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 5. Fee Structure */}
                    <div className="col-md-6">
                        <div className="card shadow-sm border-0 rounded-4 h-100">
                            <div className="card-header text-white p-3 rounded-top-4" style={{ backgroundColor: '#2c3e50' }}>
                                <h5 className="mb-0 bi bi-cash-coin"> Fee Structure</h5>
                            </div>
                            <div className="card-body p-4">

                                {familyInfo ? (
                                    /* FAMILY FEE MODE */
                                    <>
                                        <div className="alert alert-warning d-flex align-items-start gap-2 mb-3">
                                            <i className="bi bi-people-fill fs-5 mt-1"></i>
                                            <div>
                                                <strong>Family Fee Mode</strong>
                                                <div className="small mt-1">
                                                    This student belongs to a family unit ({familyInfo.family_size} members).
                                                    Updating this fee will apply to all siblings' monthly slips.
                                                </div>
                                            </div>
                                        </div>
                                        <div className="row g-3">
                                            <div className="col-12">
                                                <label className="form-label fw-bold fs-5">
                                                    <i className="bi bi-house-heart-fill me-2 text-warning"></i>Family Monthly Fee
                                                </label>
                                                <div className="text-muted small mb-1">
                                                    Current: <strong className="text-success">Rs. {familyInfo.family_fee.toLocaleString()}</strong>
                                                </div>
                                                <div className="input-group">
                                                    <span className="input-group-text">Rs.</span>
                                                    <input type="number" className="form-control form-control-lg" placeholder="0.00"
                                                        onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                                        value={form.family_fee}
                                                        onChange={e => setForm({ ...form, family_fee: e.target.value })} />
                                                </div>
                                                <small className="text-muted">
                                                    <i className="bi bi-info-circle me-1"></i>
                                                    This amount applies to the whole family every month.
                                                </small>
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold">Admission Fee (Paid)</label>
                                                <div className="input-group">
                                                    <span className="input-group-text">Rs.</span>
                                                    <input type="number" className="form-control" placeholder="0.00"
                                                        onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                                        value={form.admission_fee} onChange={e => setForm({ ...form, admission_fee: e.target.value })} />
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold">Other Charges</label>
                                                <div className="input-group">
                                                    <span className="input-group-text">Rs.</span>
                                                    <input type="number" className="form-control" placeholder="0.00"
                                                        onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                                        value={form.other_charges} onChange={e => setForm({ ...form, other_charges: e.target.value })} />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    /* INDIVIDUAL FEE MODE */
                                    <div className="row g-3">
                                        <div className="col-12">
                                            <label className="form-label fw-bold display-6 fs-5">Monthly Tuition Fee</label>
                                            <div className="input-group">
                                                <span className="input-group-text">Rs.</span>
                                                <input type="number" className="form-control form-control-lg" placeholder="0.00"
                                                    onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                                    value={form.monthly_fee} onChange={e => setForm({ ...form, monthly_fee: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label fw-bold">Admission Fee (Paid)</label>
                                            <div className="input-group">
                                                <span className="input-group-text">Rs.</span>
                                                <input type="number" className="form-control" placeholder="0.00"
                                                    onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                                    value={form.admission_fee} onChange={e => setForm({ ...form, admission_fee: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label fw-bold">Other Charges</label>
                                            <div className="input-group">
                                                <span className="input-group-text">Rs.</span>
                                                <input type="number" className="form-control" placeholder="0.00"
                                                    onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                                    value={form.other_charges} onChange={e => setForm({ ...form, other_charges: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ── OPENING BALANCE (Purana Baqi) ── */}
                                {(() => {
                                    const totalOpb = parseFloat(form.opening_balance || '0') || 0;
                                    const paidOpb = opbPaid || 0;
                                    const isFullyPaid = paidOpb > 0 && totalOpb > 0 && paidOpb >= totalOpb;
                                    const isPartiallyPaid = paidOpb > 0 && paidOpb < totalOpb;

                                    return (
                                        <div className="mt-3 p-3 rounded-3" style={{ background: 'rgba(254,127,45,0.07)', border: '1.5px solid rgba(254,127,45,0.25)' }}>
                                            <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-1">
                                                <div className="d-flex align-items-center gap-2">
                                                    <i className="bi bi-clock-history" style={{ color: 'var(--accent-orange)', fontSize: '1.1rem' }} />
                                                    <strong style={{ color: 'var(--primary-dark)', fontSize: '0.95rem' }}>Opening Balance (Purana Baqi)</strong>
                                                    <span className="badge rounded-pill ms-1" style={{ background: 'rgba(254,127,45,0.15)', color: 'var(--accent-orange)', fontSize: '0.72rem' }}>Optional</span>
                                                </div>
                                                {isFullyPaid && (
                                                    <span className="badge bg-success text-white px-2.5 py-1 rounded-pill" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                                        <i className="bi bi-check-circle-fill me-1"></i>Fully Paid (Rs. {paidOpb.toLocaleString()})
                                                    </span>
                                                )}
                                                {isPartiallyPaid && (
                                                    <span className="badge bg-warning text-dark px-2.5 py-1 rounded-pill" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                                        <i className="bi bi-pie-chart-fill me-1"></i>Partially Paid: Rs. {paidOpb.toLocaleString()}
                                                    </span>
                                                )}
                                            </div>

                                            <small className="text-muted d-block mb-2">
                                                Agar is family ka koi purana baqi ho (software install se pehle ka) tou yahan enter karo. Yeh family account mein track hoga aur gradually collect kiya jay ga.
                                            </small>

                                            <div className="input-group">
                                                <span className="input-group-text bg-white"><i className="bi bi-wallet2" style={{ color: 'var(--accent-orange)' }} /></span>
                                                <span className="input-group-text bg-white fw-semibold">Rs.</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    className="form-control"
                                                    placeholder="0.00 (agar koi purana baqi ho)"
                                                    disabled={isFullyPaid}
                                                    value={form.opening_balance}
                                                    onChange={e => setForm({ ...form, opening_balance: e.target.value })}
                                                />
                                            </div>

                                            {isFullyPaid && (
                                                <small className="text-success d-block mt-1.5 fw-semibold" style={{ fontSize: '0.78rem' }}>
                                                    <i className="bi bi-lock-fill me-1"></i>Yeh Opening Balance mukammal pay ho chuka hai (Paid: Rs. {paidOpb.toLocaleString()}), is wajah se yeh edit nahi ho sakta.
                                                </small>
                                            )}
                                            {isPartiallyPaid && (
                                                <small className="text-warning-emphasis d-block mt-1.5 fw-semibold" style={{ fontSize: '0.78rem' }}>
                                                    <i className="bi bi-exclamation-triangle-fill me-1"></i>Is Opening Balance se Rs. {paidOpb.toLocaleString()} Already Paid hai. Naya Balance kam se kam Rs. {paidOpb.toLocaleString()} hona chahiye.
                                                </small>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="col-12 text-end mb-5">
                        {hasPermission('students', 'write') && (
                            <button type="submit" className="btn btn-lg text-white px-5 py-3 shadow-lg rounded-pill" disabled={submitting}
                                style={{ backgroundColor: 'var(--primary-teal)', fontSize: '1.2rem' }}>
                                {submitting ? <i className="bi bi-hourglass-split me-2"></i> : <i className="bi bi-chheck-lg me-2"></i>}
                                Save Changes
                            </button>
                        )}
                    </div>
                </div>
            </form>
        </div>
    );
}
