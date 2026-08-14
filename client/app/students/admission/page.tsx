'use client';
import { useState, useEffect } from 'react';
import { notify, toast } from '@/app/utils/notify';
import { useAuth } from '@/contexts/AuthContext';

export default function NewAdmission() {
    const [classes, setClasses] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const { hasPermission } = useAuth();

    // Sibling Selection States
    const [hasSibling, setHasSibling] = useState(false);
    const [siblingSearch, setSiblingSearch] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedSiblings, setSelectedSiblings] = useState<any[]>([]);
    const [searchingSiblings, setSearchingSiblings] = useState(false);
    const [familyFeeInfo, setFamilyFeeInfo] = useState<{ family_fee: number; family_size: number } | null>(null);

    // Father Auto-Fetch & Suggestion States
    const [fatherSuggestions, setFatherSuggestions] = useState<any[]>([]);
    const [showFatherSuggestions, setShowFatherSuggestions] = useState(false);
    const [searchingFathers, setSearchingFathers] = useState(false);

    // Initial State
    const [guardianType, setGuardianType] = useState('Father'); // Father, Mother, Other
    const [form, setForm] = useState({
        // Academic
        roll_no: '',
        class_id: '',
        section_id: '',
        admission_date: new Date().toISOString().split('T')[0],
        category: 'Normal', // Normal, Trusted

        // Personal
        first_name: '',
        last_name: '',
        gender: '',
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

    // File States
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [documentFiles, setDocumentFiles] = useState<FileList | null>(null);

    const handleTextChange = (field: string, value: string) => {
        if (/^[a-zA-Z\s]*$/.test(value)) {
            setForm(f => ({ ...f, [field]: value }));
        }
    };

    const handleNumberChange = (field: string, value: string) => {
        if (/^\d*$/.test(value)) {
            setForm(f => ({ ...f, [field]: value }));
        }
    };

    const handlePhoneChange = (field: string, value: string) => {
        let val = value;
        if (val.startsWith("92")) {
            const digits = val.substring(2).replace(/\D/g, "");
            if (digits.length <= 10) setForm(f => ({ ...f, [field]: "92" + digits }));
        } else {
            const digits = val.replace(/\D/g, "");
            if (digits.length <= 12) setForm(f => ({ ...f, [field]: digits }));
        }
    };

    const handleCNICChange = (field: string, value: string) => {
        let digits = value.replace(/\D/g, "");
        if (digits.length > 13) digits = digits.slice(0, 13);
        let formatted = digits;
        if (digits.length > 5) formatted = digits.slice(0, 5) + "-" + digits.slice(5);
        if (digits.length > 12) formatted = formatted.slice(0, 13) + "-" + digits.slice(12);
        setForm(f => ({ ...f, [field]: formatted }));
    };

    useEffect(() => {
        require('bootstrap/dist/js/bootstrap.bundle.min.js');
        fetchClasses();
    }, []);

    // Effect to sync Guardian Info based on selection
    useEffect(() => {
        if (guardianType === 'Father') {
            setForm(f => ({
                ...f,
                guardian_name: f.father_name,
                guardian_phone: f.father_phone,
                guardian_cnic: f.father_cnic,
                guardian_relation: 'Father',
                guardian_address: f.current_address // Assuming same address
            }));
        } else if (guardianType === 'Mother') {
            setForm(f => ({
                ...f,
                guardian_name: f.mother_name,
                guardian_phone: f.mother_phone,
                guardian_cnic: f.mother_cnic,
                guardian_relation: 'Mother',
                guardian_address: f.current_address
            }));
        } else {
            // If switched to Other, clear ONLY if it was previously synced? 
            // Better to leave it for user to edit to avoid accidental data loss.
            setForm(f => ({ ...f, guardian_relation: 'Other' }));
        }
    }, [guardianType, form.father_name, form.father_phone, form.father_cnic, form.mother_name, form.mother_phone, form.mother_cnic, form.current_address]);


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

    // Search for siblings
    const searchSiblings = async (query: string) => {
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        setSearchingSiblings(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/students/search-siblings?query=${encodeURIComponent(query)}`);
            if (res.ok) {
                const results = await res.json();
                setSearchResults(results);
            }
        } catch (error) {
            console.error('Error searching siblings:', error);
            notify.error('Failed to search students');
        } finally {
            setSearchingSiblings(false);
        }
    };

    // Handle sibling selection
    const selectSibling = (sibling: any) => {
        // Check if already selected
        if (selectedSiblings.some(s => s.student_id === sibling.student_id)) {
            notify.warning('This sibling is already added!');
            return;
        }

        // Add to selected siblings array
        const newSibling = {
            ...sibling,
            isExpanded: true // New sibling is expanded by default
        };

        const updated = [...selectedSiblings, newSibling];
        setSelectedSiblings(updated);
        setSearchResults([]);
        setSiblingSearch('');

        // Auto-fill parent & contact details into admission form
        setForm(f => ({
            ...f,
            father_name: f.father_name || sibling.father_name || '',
            father_phone: f.father_phone || sibling.father_phone || '',
            father_cnic: f.father_cnic || sibling.father_cnic || '',
            father_occupation: f.father_occupation || sibling.father_occupation || '',
            mother_name: f.mother_name || sibling.mother_name || '',
            mother_phone: f.mother_phone || sibling.mother_phone || '',
            mother_cnic: f.mother_cnic || sibling.mother_cnic || '',
            mother_occupation: f.mother_occupation || sibling.mother_occupation || '',
            current_address: f.current_address || sibling.current_address || '',
            permanent_address: f.permanent_address || sibling.permanent_address || '',
            city: f.city || sibling.city || ''
        }));

        // If this is the first sibling, set family fee info
        if (selectedSiblings.length === 0 && sibling.family_id) {
            const existingFee = parseFloat(sibling.family_fee) || parseFloat(sibling.monthly_fee) || 0;
            setFamilyFeeInfo({ family_fee: existingFee, family_size: sibling.family_size || 1 });
            setForm(f => ({ ...f, family_fee: existingFee > 0 ? String(existingFee) : f.family_fee }));
        }

        notify.success(`Sibling added: ${sibling.first_name} ${sibling.last_name}`);
    };

    const searchFatherSuggestions = async (query: string) => {
        if (!query || query.trim().length < 2) {
            setFatherSuggestions([]);
            setShowFatherSuggestions(false);
            return;
        }

        const qLower = query.trim().toLowerCase();
        setSearchingFathers(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/students/search-siblings?query=${encodeURIComponent(query)}`);
            if (res.ok) {
                const results = await res.json();
                const fatherMap = new Map();

                // Check matched selected siblings first
                selectedSiblings.forEach(s => {
                    if (s.father_name) {
                        const key = (s.father_name + '_' + (s.father_phone || '')).toLowerCase();
                        fatherMap.set(key, s);
                    }
                });

                results.forEach((r: any) => {
                    if (r.father_name) {
                        const key = (r.father_name + '_' + (r.father_phone || '')).toLowerCase();
                        if (!fatherMap.has(key)) {
                            fatherMap.set(key, r);
                        }
                    }
                });

                const list = Array.from(fatherMap.values());
                setFatherSuggestions(list);
                setShowFatherSuggestions(list.length > 0);

                // Auto-fill phone & details if exact father name match found and form phone is empty
                const exactMatch = list.find(item => item.father_name && item.father_name.trim().toLowerCase() === qLower);
                if (exactMatch && exactMatch.father_phone) {
                    setForm(f => ({
                        ...f,
                        father_phone: f.father_phone || exactMatch.father_phone || '',
                        father_cnic: f.father_cnic || exactMatch.father_cnic || '',
                        father_occupation: f.father_occupation || exactMatch.father_occupation || '',
                        mother_name: f.mother_name || exactMatch.mother_name || '',
                        mother_phone: f.mother_phone || exactMatch.mother_phone || '',
                        mother_cnic: f.mother_cnic || exactMatch.mother_cnic || '',
                        mother_occupation: f.mother_occupation || exactMatch.mother_occupation || '',
                        current_address: f.current_address || exactMatch.current_address || '',
                        city: f.city || exactMatch.city || ''
                    }));
                }
            }
        } catch (err) {
            console.error('Error searching father suggestions:', err);
        } finally {
            setSearchingFathers(false);
        }
    };

    const applyFatherDetails = (parent: any) => {
        setForm(f => ({
            ...f,
            father_name: parent.father_name || f.father_name,
            father_phone: parent.father_phone || f.father_phone || '',
            father_cnic: parent.father_cnic || f.father_cnic || '',
            father_occupation: parent.father_occupation || f.father_occupation || '',
            mother_name: parent.mother_name || f.mother_name || '',
            mother_phone: parent.mother_phone || f.mother_phone || '',
            mother_cnic: parent.mother_cnic || f.mother_cnic || '',
            mother_occupation: parent.mother_occupation || f.mother_occupation || '',
            current_address: parent.current_address || f.current_address || '',
            city: parent.city || f.city || ''
        }));
        setShowFatherSuggestions(false);
        toast.success(`Auto-filled parent details for ${parent.father_name}`);
    };

    const removeSibling = (index: number) => {
        const updatedSiblings = selectedSiblings.filter((_, i) => i !== index);
        setSelectedSiblings(updatedSiblings);
        if (updatedSiblings.length === 0) {
            setFamilyFeeInfo(null);
            setForm(f => ({ ...f, family_fee: '' }));
        }
        toast.info('Sibling removed');
    };

    const toggleSiblingExpand = (index: number) => {
        const updated = [...selectedSiblings];
        updated[index].isExpanded = !updated[index].isExpanded;
        setSelectedSiblings(updated);
    };



    const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setForm({ ...form, class_id: val, section_id: '' });
        if (val) fetchSections(val);
        else setSections([]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const toastId = toast.loading("Processing Admission...");

        try {
            const formData = new FormData();

            // Append Text Fields - Handle optional date fields properly
            Object.keys(form).forEach(key => {
                let value = (form as any)[key];

                // For date fields (dob), only append if not empty
                // This prevents "invalid input syntax for type date" error
                if (key === 'dob' && (!value || value.trim() === '')) {
                    return; // Skip empty date fields
                }

                formData.append(key, value);
            });

            // Append Sibling Information
            if (selectedSiblings && selectedSiblings.length > 0) {
                const currentFatherName = (form.father_name || '').trim().toLowerCase();
                // Send as JSON array
                formData.append('siblings', JSON.stringify(
                    selectedSiblings.map(s => {
                        const siblingFatherName = (s.father_name || '').trim().toLowerCase();
                        const dynamicRelation = (currentFatherName !== '' && siblingFatherName !== '' && currentFatherName === siblingFatherName) ? 'blood' : 'cousin';

                        return {
                            sibling_id: s.student_id,
                            relation_type: dynamicRelation
                        };
                    })
                ));
            }

            // Append Files
            if (imageFile) {
                formData.append('image', imageFile);
            }
            if (documentFiles) {
                for (let i = 0; i < documentFiles.length; i++) {
                    formData.append('documents', documentFiles[i]);
                }
            }

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/students`, {
                method: 'POST',
                // HEADERS MUST NOT BE SET MANUALLY FOR MULTIPART
                body: formData
            });

            const data = await res.json();

            if (res.ok) {
                toast.update(toastId, { render: `Admission Successful! ID: ${data.admission_no}`, type: "success", isLoading: false, autoClose: 5000 });
                // Reset ALL form fields
                setForm({
                    roll_no: '',
                    class_id: '',
                    section_id: '',
                    admission_date: new Date().toISOString().split('T')[0],
                    category: 'Normal',
                    first_name: '',
                    last_name: '',
                    gender: '',
                    dob: '',
                    cnic_bform: '',
                    religion: '',
                    blood_group: '',
                    has_disability: false,
                    disability_details: '',
                    mobile_no: '',
                    email: '',
                    current_address: '',
                    permanent_address: '',
                    city: '',
                    father_name: '',
                    father_phone: '',
                    father_cnic: '',
                    father_occupation: '',
                    mother_name: '',
                    mother_phone: '',
                    mother_cnic: '',
                    mother_occupation: '',
                    is_orphan: false,
                    guardian_name: '',
                    guardian_relation: '',
                    guardian_phone: '',
                    guardian_cnic: '',
                    guardian_address: '',
                    monthly_fee: '',
                    family_fee: '',
                    admission_fee: '',
                    other_charges: '',
                    opening_balance: ''
                });
                // Reset sibling selection
                setHasSibling(false);
                setSelectedSiblings([]);
                setSiblingSearch('');
                setSearchResults([]);
                setFamilyFeeInfo(null);
                setGuardianType('Father');
                // Reset files
                setImageFile(null);
                setDocumentFiles(null);
            } else {
                toast.update(toastId, { render: data.error || "Submission Failed", type: "error", isLoading: false, autoClose: 5000 });
            }
        } catch (err) {
            toast.update(toastId, { render: "Server Error", type: "error", isLoading: false, autoClose: 5000 });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container-fluid p-4">
            <h2 className="mb-4 fw-bold animate__animated animate__fadeInDown" style={{ color: 'var(--primary-dark)' }}>
                <i className="bi bi-person-badge-fill me-2"></i>New Student Admission
            </h2>

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
                                            <div className="col-md-3">
                                                <label className="form-label fw-bold">Admission No</label>
                                                <input type="text" className="form-control bg-light" disabled placeholder="Auto Generated" />
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label fw-bold">Admission Date <span className="text-danger">*</span></label>
                                                <input type="date" className="form-control" required
                                                    value={form.admission_date} onChange={e => setForm({ ...form, admission_date: e.target.value })} />
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label fw-bold">Class <span className="text-danger">*</span></label>
                                                <select className="form-select" required value={form.class_id} onChange={handleClassChange}>
                                                    <option value="">Select Class</option>
                                                    {classes.map((c: any) => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label fw-bold">Section <span className="text-danger">*</span></label>
                                                <select className="form-select" required value={form.section_id} onChange={e => setForm({ ...form, section_id: e.target.value })}>
                                                    <option value="">Select Section</option>
                                                    {sections.map((s: any) => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label fw-bold">Roll No</label>
                                                <input type="text" className="form-control"
                                                    value={form.roll_no} onChange={e => handleNumberChange("roll_no", e.target.value)} />
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label fw-bold">Category</label>
                                                <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                                                    <option value="Normal">Normal</option>
                                                    <option value="Trusted">Trusted</option>
                                                </select>
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold">Upload Documents</label>
                                                <input type="file" className="form-control" multiple accept=".pdf,.doc,.docx,.jpg,.png"
                                                    onChange={(e) => setDocumentFiles(e.target.files)} />
                                                <small className="text-muted d-block mt-1"><i className="bi bi-info-circle me-1"></i>Certificates, B-Form, etc. (Max 5MB)</small>
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
                                        <label className="form-label fw-bold">First Name <span className="text-danger">*</span></label>
                                        <input type="text" className="form-control" required
                                            value={form.first_name} onChange={e => handleTextChange("first_name", e.target.value)} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label fw-bold">Last Name</label>
                                        <input type="text" className="form-control"
                                            value={form.last_name} onChange={e => handleTextChange("last_name", e.target.value)} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label fw-bold">Date of Birth</label>
                                        <input type="date" className="form-control"
                                            value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label fw-bold">Gender <span className="text-danger">*</span></label>
                                        <select className="form-select" required value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                                            <option value="">-- Select Gender --</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label fw-bold">CNIC / B-Form</label>
                                        <input type="text" className="form-control" placeholder="xxxxx-xxxxxxx-x"
                                            value={form.cnic_bform} onChange={e => handleCNICChange("cnic_bform", e.target.value)} />
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

                    {/* 2.5 Family & Sibling Information */}
                    <div className="col-12">
                        <div className="card shadow-sm border-0 rounded-4">
                            <div className="card-header text-white p-3 rounded-top-4" style={{ backgroundColor: 'var(--primary-teal)' }}>
                                <div className="d-flex justify-content-between align-items-center">
                                    <h5 className="mb-0">
                                        <i className="bi bi-people-fill me-2"></i>Family & Sibling Information
                                    </h5>
                                    <div className="form-check form-switch">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="siblingCheck"
                                            checked={hasSibling}
                                            onChange={e => {
                                                setHasSibling(e.target.checked);
                                                if (!e.target.checked) {
                                                    setSelectedSiblings([]);
                                                    setSearchResults([]);
                                                    setSiblingSearch('');
                                                }
                                            }}
                                        />
                                        <label className="form-check-label text-white fw-bold" htmlFor="siblingCheck">
                                            Has Sibling in School?
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {hasSibling && (
                                <div className="card-body p-4 animate__animated animate__fadeIn">
                                    <div className="alert alert-info">
                                        <i className="bi bi-info-circle-fill me-2"></i>
                                        <strong>Note:</strong> Search for the sibling already enrolled in the system.
                                        <strong className="text-primary"> Blood siblings</strong> will share the same family and parent details,
                                        while <strong className="text-warning">cousins</strong> may have different parent/guardian information.
                                    </div>

                                    {/* Search Box - Always visible */}
                                    <div className="row g-3 mb-3">
                                        <div className="col-12">
                                            <label className="form-label fw-bold">
                                                <i className="bi bi-search me-2"></i>
                                                Search for Sibling {selectedSiblings.length > 0 && `(${selectedSiblings.length} added)`}
                                            </label>
                                            <div className="position-relative">
                                                <input
                                                    type="text"
                                                    className="form-control form-control-lg"
                                                    placeholder="Search by name, father name, class, section (e.g. Ali, Class 2, Red)..."
                                                    value={siblingSearch}
                                                    onChange={e => {
                                                        setSiblingSearch(e.target.value);
                                                        searchSiblings(e.target.value);
                                                    }}
                                                />
                                                {searchingSiblings && (
                                                    <div className="position-absolute top-50 end-0 translate-middle-y me-3">
                                                        <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Search Results */}
                                        {searchResults.length > 0 && (
                                            <div className="col-12">
                                                <div className="list-group" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                                    {searchResults.map((student: any) => (
                                                        <button
                                                            key={student.student_id}
                                                            type="button"
                                                            className="list-group-item list-group-item-action d-flex align-items-center"
                                                            onClick={() => selectSibling(student)}
                                                        >
                                                            <div className="flex-shrink-0 me-3">
                                                                {student.image_url ? (
                                                                    <img
                                                                        src={`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/${student.image_url}`}
                                                                        alt={student.first_name}
                                                                        className="rounded-circle"
                                                                        style={{ width: '45px', height: '45px', objectFit: 'cover' }}
                                                                    />
                                                                ) : (
                                                                    <div
                                                                        className="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white"
                                                                        style={{ width: '45px', height: '45px' }}
                                                                    >
                                                                        <i className="bi bi-person-fill fs-5"></i>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-grow-1">
                                                                <h6 className="mb-0 fw-bold">
                                                                    {student.first_name} {student.last_name}
                                                                    <span className="badge bg-primary ms-2 small">{student.admission_no}</span>
                                                                </h6>
                                                                <small className="text-muted">
                                                                    Father: {student.father_name || 'N/A'}
                                                                    {student.class_name && ` | ${student.class_name}`}
                                                                </small>
                                                            </div>
                                                            <i className="bi bi-plus-circle text-success fs-4"></i>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {siblingSearch.length >= 2 && searchResults.length === 0 && !searchingSiblings && (
                                            <div className="col-12">
                                                <div className="alert alert-warning mb-0">
                                                    <i className="bi bi-exclamation-triangle me-2"></i>
                                                    No students found matching your search.
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Selected Siblings List - Collapsible Cards */}
                                    {selectedSiblings.length > 0 && (
                                        <div className="mt-3">
                                            <h6 className="fw-bold text-success mb-3">
                                                <i className="bi bi-check-circle-fill me-2"></i>
                                                Selected Siblings ({selectedSiblings.length})
                                            </h6>

                                            {selectedSiblings.map((sibling: any, index: number) => (
                                                <div key={index} className="card mb-2 border-2" style={{
                                                    borderColor: sibling.relation_type === 'blood' ? '#0d6efd' : '#ffc107'
                                                }}>
                                                    {/* Collapsed Header */}
                                                    <div className="card-header p-2 d-flex align-items-center justify-content-between"
                                                        style={{
                                                            cursor: 'pointer',
                                                            backgroundColor: sibling.relation_type === 'blood' ? '#e7f1ff' : '#fff3cd'
                                                        }}
                                                        onClick={() => toggleSiblingExpand(index)}
                                                    >
                                                        <div className="d-flex align-items-center flex-grow-1">
                                                            <div className="me-2">
                                                                {sibling.image_url ? (
                                                                    <img
                                                                        src={`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/${sibling.image_url}`}
                                                                        alt={sibling.first_name}
                                                                        className="rounded-circle"
                                                                        style={{ width: '40px', height: '40px', objectFit: 'cover' }}
                                                                    />
                                                                ) : (
                                                                    <div
                                                                        className="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white"
                                                                        style={{ width: '40px', height: '40px' }}
                                                                    >
                                                                        <i className="bi bi-person-fill"></i>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <strong>{sibling.first_name} {sibling.last_name}</strong>
                                                                <span className="badge bg-primary ms-2 small">{sibling.admission_no}</span>
                                                                <br />
                                                                <small className="text-muted">
                                                                    {sibling.relation_type === 'blood' ? (
                                                                        <><i className="bi bi-people-fill text-primary me-1"></i>Blood Sibling</>
                                                                    ) : (
                                                                        <><i className="bi bi-diagram-3-fill text-warning me-1"></i>Cousin</>
                                                                    )}
                                                                    {sibling.class_name && ` | ${sibling.class_name}`}
                                                                </small>
                                                            </div>
                                                        </div>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-outline-danger"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    removeSibling(index);
                                                                }}
                                                            >
                                                                <i className="bi bi-trash"></i>
                                                            </button>
                                                            <i className={`bi ${sibling.isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'} fs-5`}></i>
                                                        </div>
                                                    </div>

                                                    {/* Expanded Details */}
                                                    {sibling.isExpanded && (
                                                        <div className="card-body animate__animated animate__fadeIn animate__faster">
                                                            <div className="row g-2 mb-3">
                                                                <div className="col-md-6">
                                                                    <small className="text-muted d-block">Father Name:</small>
                                                                    <strong>{sibling.father_name || 'N/A'}</strong>
                                                                </div>
                                                                <div className="col-md-6">
                                                                    <small className="text-muted d-block">Mother Name:</small>
                                                                    <strong>{sibling.mother_name || 'N/A'}</strong>
                                                                </div>
                                                                <div className="col-md-6">
                                                                    <small className="text-muted d-block">Father Phone:</small>
                                                                    <strong>{sibling.father_phone || 'N/A'}</strong>
                                                                </div>
                                                                <div className="col-md-6">
                                                                    <small className="text-muted d-block">Mother Phone:</small>
                                                                    <strong>{sibling.mother_phone || 'N/A'}</strong>
                                                                </div>
                                                                <div className="col-md-6">
                                                                    <small className="text-muted d-block">Father CNIC:</small>
                                                                    <strong>{sibling.father_cnic || 'N/A'}</strong>
                                                                </div>
                                                                <div className="col-md-6">
                                                                    <small className="text-muted d-block">Mother CNIC:</small>
                                                                    <strong>{sibling.mother_cnic || 'N/A'}</strong>
                                                                </div>
                                                                <div className="col-12">
                                                                    <small className="text-muted d-block">Current Address:</small>
                                                                    <strong>{sibling.current_address || 'N/A'}</strong>
                                                                </div>
                                                                <div className="col-md-6">
                                                                    <small className="text-muted d-block">City:</small>
                                                                    <strong>{sibling.city || 'N/A'}</strong>
                                                                </div>
                                                                <div className="col-md-6">
                                                                    <small className="text-muted d-block">Class & Section:</small>
                                                                    <strong>{sibling.class_name} {sibling.section_name && `- ${sibling.section_name}`}</strong>
                                                                </div>
                                                                {sibling.family_id && (
                                                                    <div className="col-12">
                                                                        <small className="text-muted d-block">Family ID:</small>
                                                                        <span className="badge bg-info">{sibling.family_id}</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Relationship Type Evaluator */}
                                                            {(() => {
                                                                const currentFather = (form.father_name || '').trim().toLowerCase();
                                                                const siblingFather = (sibling.father_name || '').trim().toLowerCase();
                                                                const isBlood = currentFather !== '' && siblingFather !== '' && currentFather === siblingFather;
                                                                return (
                                                                    <div className="border-top pt-3 text-center">
                                                                        <label className="form-label fw-bold small me-2">Detected Relation:</label>
                                                                        {isBlood ? (
                                                                            <span className="badge bg-primary px-3 py-2">
                                                                                <i className="bi bi-people-fill me-1"></i> Blood Sibling
                                                                            </span>
                                                                        ) : (
                                                                            <span className="badge bg-warning text-dark px-3 py-2">
                                                                                <i className="bi bi-diagram-3-fill me-1"></i> Cousin
                                                                            </span>
                                                                        )}
                                                                        {isBlood ? (
                                                                            <div className="alert alert-info alert-sm mt-3 mb-0 py-2 px-3 text-start">
                                                                                <small>
                                                                                    <i className="bi bi-info-circle me-1"></i>
                                                                                    Since father names match, they will be mapped as Blood Siblings on saving.
                                                                                </small>
                                                                            </div>
                                                                        ) : (currentFather !== '' && (
                                                                            <div className="alert alert-warning alert-sm mt-3 mb-0 py-2 px-3 text-start">
                                                                                <small>
                                                                                    <i className="bi bi-info-circle me-1"></i>
                                                                                    Father names do not match, they will be mapped as Cousins on saving.
                                                                                </small>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
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
                                {/* Parents Section - Always visible unless Orphan, but User said parents data required regardless... 
                                   "parents ma sa father ya mother ma sa aik gardian hota ha tou dono ma sa jo gardian ho ga wo select hona par info add ho jay gi"
                                   Also: "atleast name gardian jo bhi ho aska cnic aur contant number aur address" implies strict validation on Guardian.
                                */}
                                <div className={`row g-3 ${form.is_orphan ? 'opacity-50' : ''}`}>
                                    <h6 className="fw-bold text-muted border-bottom pb-2">Parents Information <span className="small text-secondary fw-normal">(Required even if not Guardian)</span></h6>
                                    {/* FATHER */}
                                    <div className="col-md-3 position-relative">
                                        <label className="form-label fw-bold">Father Name <span className="text-danger">*</span></label>
                                        <input type="text" className="form-control" required={!form.is_orphan}
                                            value={form.father_name}
                                            onChange={e => {
                                                const val = e.target.value;
                                                handleTextChange("father_name", val);
                                                searchFatherSuggestions(val);
                                            }}
                                            onFocus={() => {
                                                if (form.father_name && form.father_name.length >= 2) {
                                                    searchFatherSuggestions(form.father_name);
                                                }
                                            }} />
                                        {/* Father Auto-Suggestions Dropdown */}
                                        {showFatherSuggestions && fatherSuggestions.length > 0 && (
                                            <div className="position-absolute start-0 end-0 bg-white border rounded-3 shadow-lg z-3 mt-1 p-2"
                                                style={{ maxHeight: '220px', overflowY: 'auto', top: '100%', minWidth: '260px' }}>
                                                <div className="d-flex justify-content-between align-items-center mb-1 pb-1 border-bottom">
                                                    <small className="fw-bold text-muted">Matching Existing Fathers:</small>
                                                    <button type="button" className="btn-close btn-sm" onClick={() => setShowFatherSuggestions(false)}></button>
                                                </div>
                                                {fatherSuggestions.map((item, idx) => (
                                                    <div key={idx}
                                                        className="p-2 border-bottom cursor-pointer rounded mb-1 bg-light-subtle"
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => applyFatherDetails(item)}>
                                                        <div className="fw-bold text-primary" style={{ fontSize: '0.85rem' }}>
                                                            <i className="bi bi-person-fill me-1"></i>{item.father_name}
                                                        </div>
                                                        <div className="small text-dark" style={{ fontSize: '0.78rem' }}>
                                                            <i className="bi bi-telephone-fill text-success me-1"></i>Phone: <strong>{item.father_phone || 'N/A'}</strong>
                                                        </div>
                                                        {item.first_name && (
                                                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                                                                Student: {item.first_name} {item.last_name} ({item.admission_no})
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label fw-bold">Father Phone</label>
                                        <input type="text" className="form-control"
                                            value={form.father_phone} onChange={e => handlePhoneChange("father_phone", e.target.value)} />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label fw-bold">Father CNIC</label>
                                        <input type="text" className="form-control"
                                            value={form.father_cnic} onChange={e => handleCNICChange("father_cnic", e.target.value)} />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label fw-bold">Occupation</label>
                                        <input type="text" className="form-control"
                                            value={form.father_occupation} onChange={e => handleTextChange("father_occupation", e.target.value)} />
                                    </div>

                                    {/* MOTHER */}
                                    <div className="col-md-3">
                                        <label className="form-label fw-bold">Mother Name</label>
                                        <input type="text" className="form-control"
                                            value={form.mother_name} onChange={e => handleTextChange("mother_name", e.target.value)} />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label fw-bold">Mother Phone</label>
                                        <input type="text" className="form-control"
                                            value={form.mother_phone} onChange={e => handlePhoneChange("mother_phone", e.target.value)} />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label fw-bold">Mother CNIC</label>
                                        <input type="text" className="form-control"
                                            value={form.mother_cnic} onChange={e => handleCNICChange("mother_cnic", e.target.value)} />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label fw-bold">Occupation</label>
                                        <input type="text" className="form-control"
                                            value={form.mother_occupation} onChange={e => handleTextChange("mother_occupation", e.target.value)} />
                                    </div>
                                </div>

                                {/* Guardian Section */}
                                <div className={`row g-3 mt-4 p-3 rounded-3 ${form.is_orphan ? 'bg-danger-subtle border border-danger' : 'bg-light border'}`}>
                                    <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2">
                                        <h6 className="fw-bold text-muted mb-0">Guardian Information <span className="badge bg-danger ms-2">REQUIRED</span></h6>
                                        <div className="d-flex align-items-center gap-3">
                                            <span className="fw-bold small text-secondary">Who is Guardian?</span>
                                            <div className="btn-group btn-group-sm" role="group">
                                                <button type="button" className={`btn ${guardianType === 'Father' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                    onClick={() => setGuardianType('Father')} disabled={form.is_orphan}>Father</button>
                                                <button type="button" className={`btn ${guardianType === 'Mother' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                    onClick={() => setGuardianType('Mother')} disabled={form.is_orphan}>Mother</button>
                                                <button type="button" className={`btn ${guardianType === 'Other' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                    onClick={() => setGuardianType('Other')}>Other</button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-md-4">
                                        <label className="form-label fw-bold">Guardian Name <span className="text-danger">*</span></label>
                                        <input type="text" className="form-control" required
                                            readOnly={guardianType !== 'Other'}
                                            value={form.guardian_name} onChange={e => handleTextChange("guardian_name", e.target.value)} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label fw-bold">Relation <span className="text-danger">*</span></label>
                                        <input type="text" className="form-control" placeholder="e.g. Uncle, Grandfather" required
                                            readOnly={guardianType !== 'Other'}
                                            value={form.guardian_relation} onChange={e => handleTextChange("guardian_relation", e.target.value)} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label fw-bold">Guardian Phone <span className="text-danger">*</span></label>
                                        <input type="text" className="form-control" required
                                            readOnly={guardianType !== 'Other'}
                                            value={form.guardian_phone} onChange={e => handlePhoneChange("guardian_phone", e.target.value)} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label fw-bold">Guardian CNIC <span className="text-danger">*</span></label>
                                        <input type="text" className="form-control" required
                                            readOnly={guardianType !== 'Other'}
                                            value={form.guardian_cnic} onChange={e => handleCNICChange("guardian_cnic", e.target.value)} />
                                    </div>
                                    <div className="col-md-8">
                                        <label className="form-label fw-bold">Guardian Address <span className="text-danger">*</span></label>
                                        <input type="text" className="form-control" required
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
                                            value={form.mobile_no} onChange={e => handlePhoneChange("mobile_no", e.target.value)} />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label fw-bold">Email</label>
                                        <input type="email" className="form-control"
                                            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label fw-bold">City</label>
                                        <input type="text" className="form-control"
                                            value={form.city} onChange={e => handleTextChange("city", e.target.value)} />
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

                                {/* FAMILY FEE MODE when sibling is selected */}
                                {hasSibling && selectedSiblings.length > 0 && selectedSiblings[0].family_id ? (
                                    <>
                                        <div className="alert alert-warning d-flex align-items-start gap-2 mb-3">
                                            <i className="bi bi-people-fill fs-5 mt-1"></i>
                                            <div>
                                                <strong>Family Fee Mode</strong>
                                                <div className="small mt-1">
                                                    This student joins an existing family unit
                                                    {familyFeeInfo && familyFeeInfo.family_size > 1
                                                        ? ` (${familyFeeInfo.family_size} existing member${familyFeeInfo.family_size > 1 ? 's' : ''})`
                                                        : ''}.
                                                    One fee slip will be generated for the whole family.
                                                </div>
                                            </div>
                                        </div>
                                        <div className="row g-3">
                                            <div className="col-12">
                                                <label className="form-label fw-bold fs-5">
                                                    <i className="bi bi-house-heart-fill me-2 text-warning"></i>Family Monthly Fee <span className="text-danger">*</span>
                                                </label>
                                                {familyFeeInfo !== null && (
                                                    <div className="alert alert-info py-2 px-3 mb-2 d-flex align-items-center">
                                                        <i className="bi bi-info-circle-fill me-2 fs-5"></i>
                                                        <div>
                                                            Current Family Fee: <strong className="text-success fs-5">Rs. {familyFeeInfo.family_fee.toLocaleString()}</strong>
                                                            <div className="small text-muted mt-1">
                                                                Update the amount below if adding this student changes the total family fee.
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="input-group">
                                                    <span className="input-group-text">Rs.</span>
                                                    <input type="text" className="form-control form-control-lg" placeholder="0.00" required
                                                        value={form.family_fee}
                                                        onChange={e => handleNumberChange("family_fee", e.target.value)} />
                                                </div>
                                                <small className="text-muted">
                                                    <i className="bi bi-info-circle me-1"></i>
                                                    This amount will be charged for the entire family every month.
                                                </small>
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold">Admission Fee (One Time)</label>
                                                <div className="input-group">
                                                    <span className="input-group-text">Rs.</span>
                                                    <input type="text" className="form-control" placeholder="0.00"
                                                        value={form.admission_fee} onChange={e => handleNumberChange("admission_fee", e.target.value)} />
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold">Other Charges</label>
                                                <div className="input-group">
                                                    <span className="input-group-text">Rs.</span>
                                                    <input type="text" className="form-control" placeholder="0.00"
                                                        value={form.other_charges} onChange={e => handleNumberChange("other_charges", e.target.value)} />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    /* INDIVIDUAL FEE MODE normal student */
                                    <>
                                        <div className="alert alert-info">
                                            <i className="bi bi-info-circle me-2"></i> Set the initial fee obligations for this student.
                                        </div>
                                        <div className="row g-3">
                                            <div className="col-12">
                                                <label className="form-label fw-bold display-6 fs-5">Monthly Tuition Fee <span className="text-danger">*</span></label>
                                                <div className="input-group">
                                                    <span className="input-group-text">Rs.</span>
                                                    <input type="text" className="form-control form-control-lg" placeholder="0.00" required
                                                        value={form.monthly_fee} onChange={e => handleNumberChange("monthly_fee", e.target.value)} />
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold">Admission Fee (One Time)</label>
                                                <div className="input-group">
                                                    <span className="input-group-text">Rs.</span>
                                                    <input type="text" className="form-control" placeholder="0.00"
                                                        value={form.admission_fee} onChange={e => handleNumberChange("admission_fee", e.target.value)} />
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold">Other Charges</label>
                                                <div className="input-group">
                                                    <span className="input-group-text">Rs.</span>
                                                    <input type="text" className="form-control" placeholder="0.00"
                                                        value={form.other_charges} onChange={e => handleNumberChange("other_charges", e.target.value)} />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* ── OPENING BALANCE (always shown, any mode) ── */}
                                <div className="mt-3 p-3 rounded-3" style={{ background: 'rgba(254,127,45,0.07)', border: '1.5px solid rgba(254,127,45,0.25)' }}>
                                    <div className="d-flex align-items-center gap-2 mb-2">
                                        <i className="bi bi-clock-history" style={{ color: 'var(--accent-orange)', fontSize: '1.1rem' }} />
                                        <strong style={{ color: 'var(--primary-dark)', fontSize: '0.95rem' }}>Opening Balance (Purana Baqi)</strong>
                                        <span className="badge rounded-pill ms-1" style={{ background: 'rgba(254,127,45,0.15)', color: 'var(--accent-orange)', fontSize: '0.72rem' }}>Optional</span>
                                    </div>
                                    <small className="text-muted d-block mb-2">Agar is family ka koi purana baqi ho (software install se pehle ka) tou yahan enter karo. Yeh family account mein track hoga aur gradually collect kiya jay ga.</small>
                                    <div className="input-group">
                                        <span className="input-group-text bg-white"><i className="bi bi-wallet2" style={{ color: 'var(--accent-orange)' }} /></span>
                                        <span className="input-group-text bg-white fw-semibold">Rs.</span>
                                        <input type="text" className="form-control" placeholder="0.00 (agar koi purana baqi ho)"
                                            value={form.opening_balance} onChange={e => handleNumberChange("opening_balance", e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="col-12 text-end mb-5">
                        {hasPermission('students', 'write') && (
                            <button type="submit" className="btn btn-lg text-white px-5 py-3 shadow-lg rounded-pill" disabled={loading}
                                style={{ backgroundColor: 'var(--primary-teal)', fontSize: '1.2rem' }}>
                                {loading ? <i className="bi bi-hourglass-split me-2"></i> : <i className="bi bi-check-circle-fill me-2"></i>}
                                Confirm Admission
                            </button>
                        )}
                    </div>
                </div>
            </form>
        </div>
    );
}

