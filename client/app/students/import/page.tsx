'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import { notify, toast } from '@/app/utils/notify';

export default function ImportStudents() {
    const router = useRouter();
    const { hasPermission } = useAuth();
    const [activeTab, setActiveTab] = useState('import');

    // Phase 1: Import
    const [excelData, setExcelData] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [fileName, setFileName] = useState('');
    const [loading, setLoading] = useState(false);
    const [importResults, setImportResults] = useState<any>(null);

    // Phase 2: Review Duplicates
    const [duplicates, setDuplicates] = useState<any[]>([]);
    const [loadingDuplicates, setLoadingDuplicates] = useState(false);

    // Phase 3: Manual Link
    const [student1, setStudent1] = useState<any>(null);
    const [student2, setStudent2] = useState<any>(null);
    const [search1, setSearch1] = useState('');
    const [search2, setSearch2] = useState('');
    const [results1, setResults1] = useState<any[]>([]);
    const [results2, setResults2] = useState<any[]>([]);
    const [relationType, setRelationType] = useState('cousin');
    const [searchingS1, setSearchingS1] = useState(false);
    const [searchingS2, setSearchingS2] = useState(false);

    useEffect(() => {
        if (activeTab === 'review') {
            fetchDuplicates();
        }
    }, [activeTab]);

    const downloadTemplate = () => {
        const ws = XLSX.utils.json_to_sheet([
            {
                admission_no: 'AUTO',
                admission_date: '2026-02-17',
                first_name: 'Ahmed',
                last_name: 'Khan',
                gender: 'Male',
                dob: '2015-05-20',
                cnic_bform: '12345-1234567-1',
                class_name: 'Class 1',
                section_name: 'A',
                roll_no: '101',
                category: 'Normal',
                student_mobile: '03001234567',
                email: 'ahmed@example.com',
                city: 'Karachi',
                current_address: 'House 123, Block A',
                permanent_address: 'House 123, Block A',
                father_name: 'Muhammad Khan',
                father_phone: '03211234567',
                father_cnic: '42201-1234567-1',
                father_occupation: 'Engineer',
                mother_name: 'Fatima Khan',
                mother_phone: '03331234567',
                mother_cnic: '42202-1234567-2',
                mother_occupation: 'Teacher',
                guardian_name: 'Muhammad Khan',
                guardian_relation: 'Father',
                guardian_phone: '03211234567',
                guardian_cnic: '42201-1234567-1',
                guardian_address: 'House 123, Block A',
                religion: 'Islam',
                blood_group: 'B+',
                monthly_fee: 5000,
                admission_fee: 2000,
                opening_balance: 0
            }
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Students");
        XLSX.writeFile(wb, "Student_Import_Template.xlsx");
        notify.success("Template downloaded!");
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
            if (data && data.length > 0) {
                setHeaders(data[0] as string[]);
                const jsonData = XLSX.utils.sheet_to_json(ws);
                setExcelData(jsonData);
                notify.success("File parsed successfully!");
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleImport = async () => {
        if (excelData.length === 0) {
            notify.error("No data to import");
            return;
        }
        if (!confirm(`Import ${excelData.length} students? Family relationships will be auto-detected using Father CNIC.`)) return;
        setLoading(true);
        const toastId = toast.loading("Importing students...");
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/students/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ students: excelData })
            });
            const result = await res.json();
            if (res.ok) {
                setImportResults(result.results);
                toast.update(toastId, {
                    render: `✅ Import Complete! Success: ${result.results.success}, Failed: ${result.results.failed}`,
                    type: "success",
                    isLoading: false,
                    autoClose: 5000
                });
                const stats = result.results.familyStats;
                if (stats) {
                    setTimeout(() => {
                        toast.info(
                            `📊 Family Stats: ${stats.linkedByCNIC} linked by CNIC, ${stats.linkedByNamePhone} by Name+Phone, ${stats.newFamilies} new families`,
                            { autoClose: 7000 }
                        );
                    }, 1000);
                }
                if (result.results.failed > 0) {
                    console.error("Failed records:", result.results.errors);
                }
            } else {
                toast.update(toastId, { render: result.error || "Import Failed", type: "error", isLoading: false, autoClose: 5000 });
            }
        } catch (err) {
            toast.update(toastId, { render: "Server Connection Error", type: "error", isLoading: false, autoClose: 5000 });
        } finally {
            setLoading(false);
        }
    };

    const fetchDuplicates = async () => {
        setLoadingDuplicates(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/students/families/potential-duplicates`);
            if (res.ok) {
                const data = await res.json();
                setDuplicates(data);
            }
        } catch (err) {
            console.error(err);
            notify.error('Failed to load duplicates');
        } finally {
            setLoadingDuplicates(false);
        }
    };

    const handleMerge = async (family1: string, family2: string, relationType: string) => {
        if (!confirm(`Merge ${family2} into ${family1} as ${relationType}?`)) return;
        const toastId = toast.loading('Merging families...');
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/students/families/merge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    primaryFamilyId: family1,
                    secondaryFamilyId: family2,
                    relationType: relationType
                })
            });
            const data = await res.json();
            if (res.ok) {
                toast.update(toastId, { render: `✅ ${data.message}`, type: 'success', isLoading: false, autoClose: 3000 });
                fetchDuplicates();
            } else {
                toast.update(toastId, { render: data.error || 'Merge failed', type: 'error', isLoading: false, autoClose: 3000 });
            }
        } catch (err) {
            toast.update(toastId, { render: 'Connection error', type: 'error', isLoading: false, autoClose: 3000 });
        }
    };

    const searchStudents = async (query: string, resultSetter: any, loadingSetter: any) => {
        if (query.length < 2) {
            resultSetter([]);
            return;
        }
        loadingSetter(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/students/families/search-for-link?query=${encodeURIComponent(query)}`);
            if (res.ok) {
                const data = await res.json();
                resultSetter(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            loadingSetter(false);
        }
    };

    const handleManualLink = async () => {
        if (!student1 || !student2) {
            notify.error('Please select both students');
            return;
        }
        if (student1.student_id === student2.student_id) {
            notify.error('Cannot link a student to themselves');
            return;
        }
        const toastId = toast.loading('Linking students...');
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/students/families/manual-link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student1_id: student1.student_id,
                    student2_id: student2.student_id,
                    relation_type: relationType
                })
            });
            const data = await res.json();
            if (res.ok) {
                toast.update(toastId, { render: `✅ ${data.message}`, type: 'success', isLoading: false, autoClose: 3000 });
                setStudent1(null);
                setStudent2(null);
                setSearch1('');
                setSearch2('');
                setResults1([]);
                setResults2([]);
            } else {
                toast.update(toastId, { render: data.error || 'Link failed', type: 'error', isLoading: false, autoClose: 3000 });
            }
        } catch (err) {
            toast.update(toastId, { render: 'Connection error', type: 'error', isLoading: false, autoClose: 3000 });
        }
    };

    return (
        <div className="container-fluid p-4">
            <h2 className="mb-4 fw-bold animate__animated animate__fadeInDown" style={{ color: 'var(--primary-dark)' }}>
                <i className="bi bi-file-earmark-spreadsheet-fill me-2"></i>Import & Family Management
            </h2>

            {/* TABS */}
            <ul className="nav nav-pills mb-4 bg-white p-2 rounded-4 shadow-sm">
                <li className="nav-item">
                    <button
                        className={`nav-link ${activeTab === 'import' ? 'active' : ''}`}
                        onClick={() => setActiveTab('import')}
                        style={{ backgroundColor: activeTab === 'import' ? 'var(--primary-teal)' : 'transparent' }}
                    >
                        <i className="bi bi-cloud-upload me-2"></i>1. Import Students
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link ${activeTab === 'review' ? 'active' : ''}`}
                        onClick={() => setActiveTab('review')}
                        style={{ backgroundColor: activeTab === 'review' ? 'var(--primary-teal)' : 'transparent' }}
                    >
                        <i className="bi bi-search me-2"></i>2. Review Duplicates
                        {duplicates.length > 0 && <span className="badge bg-warning ms-2">{duplicates.length}</span>}
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link ${activeTab === 'manual' ? 'active' : ''}`}
                        onClick={() => setActiveTab('manual')}
                        style={{ backgroundColor: activeTab === 'manual' ? 'var(--primary-teal)' : 'transparent' }}
                    >
                        <i className="bi bi-link-45deg me-2"></i>3. Manual Link
                    </button>
                </li>
            </ul>

            {/* TAB CONTENT */}
            {activeTab === 'import' && (
                <div className="animate__animated animate__fadeIn">
                    {/* Instructions */}
                    <div className="card shadow-sm border-0 rounded-4 mb-4">
                        <div className="card-header text-white p-3" style={{ backgroundColor: 'var(--primary-teal)' }}>
                            <h5 className="mb-0"><i className="bi bi-info-circle me-2"></i>How It Works</h5>
                        </div>
                        <div className="card-body">
                            <div className="alert alert-success border-0">
                                <h6 className="fw-bold">🎯 Automatic Family Linking!</h6>
                                <p className="mb-2">When you import students, the system automatically detects siblings using:</p>
                                <ol className="mb-0">
                                    <li><strong>Father CNIC Match (Most Reliable):</strong> Students with same Father CNIC → Blood Siblings</li>
                                    <li><strong>Father Name + Phone Match:</strong> Same name & phone → Blood Siblings</li>
                                    <li><strong>New Family ID:</strong> No match → New family created</li>
                                </ol>
                            </div>
                            <div className="alert alert-warning border-0 mb-0">
                                <i className="bi bi-exclamation-triangle me-2"></i>
                                <strong>Important:</strong> Make sure to fill <code>father_cnic</code> accurately in Excel for best results!
                            </div>
                        </div>
                    </div>

                    {/* Upload */}
                    <div className="card shadow-sm border-0 rounded-4 mb-4">
                        <div className="card-header text-white p-3" style={{ backgroundColor: 'var(--primary-teal)' }}>
                            <h5 className="mb-0"><i className="bi bi-cloud-upload me-2"></i>Upload Excel File</h5>
                        </div>
                        <div className="card-body">
                            <div className="d-flex gap-3">
                                <button className="btn btn-outline-primary" onClick={downloadTemplate}>
                                    <i className="bi bi-download me-2"></i>Download Template
                                </button>
                                <div className="flex-grow-1">
                                    <input
                                        type="file"
                                        className="form-control"
                                        accept=".xlsx, .xls"
                                        onChange={handleFileUpload}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Import Results Stats */}
                    {importResults && (
                        <div className="row g-3 mb-4">
                            <div className="col-md-3">
                                <div className="card border-0 shadow-sm bg-success bg-opacity-10">
                                    <div className="card-body text-center">
                                        <i className="bi bi-check-circle fs-1 text-success"></i>
                                        <h3 className="fw-bold mb-0">{importResults.success}</h3>
                                        <small className="text-muted">Imported Successfully</small>
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="card border-0 shadow-sm bg-primary bg-opacity-10">
                                    <div className="card-body text-center">
                                        <i className="bi bi-diagram-3 fs-1 text-primary"></i>
                                        <h3 className="fw-bold mb-0">{importResults.familyStats?.linkedByCNIC || 0}</h3>
                                        <small className="text-muted">Linked by CNIC</small>
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="card border-0 shadow-sm bg-info bg-opacity-10">
                                    <div className="card-body text-center">
                                        <i className="bi bi-telephone fs-1 text-info"></i>
                                        <h3 className="fw-bold mb-0">{importResults.familyStats?.linkedByNamePhone || 0}</h3>
                                        <small className="text-muted">Linked by Name+Phone</small>
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="card border-0 shadow-sm bg-warning bg-opacity-10">
                                    <div className="card-body text-center">
                                        <i className="bi bi-plus-circle fs-1 text-warning"></i>
                                        <h3 className="fw-bold mb-0">{importResults.familyStats?.newFamilies || 0}</h3>
                                        <small className="text-muted">New Families</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error Display */}
                    {importResults && importResults.errors && importResults.errors.length > 0 && (
                        <div className="card shadow-sm border-0 rounded-4 mb-4">
                            <div className="card-header bg-danger text-white p-3">
                                <h5 className="mb-0"><i className="bi bi-exclamation-triangle me-2"></i>Import Errors ({importResults.errors.length})</h5>
                            </div>
                            <div className="card-body">
                                <div className="alert alert-danger mb-0" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    {importResults.errors.slice(0, 10).map((err: any, idx: number) => (
                                        <div key={idx} className="mb-2 pb-2 border-bottom">
                                            <strong>{err.name || 'Unknown'}:</strong> {err.error}
                                        </div>
                                    ))}
                                    {importResults.errors.length > 10 && (
                                        <small className="text-muted">
                                            ...and {importResults.errors.length - 10} more errors. Check browser console for all details.
                                        </small>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Preview */}
                    {excelData.length > 0 && (
                        <div className="card shadow-sm border-0 rounded-4">
                            <div className="card-header bg-white p-3 d-flex justify-content-between align-items-center">
                                <h5 className="mb-0 fw-bold">
                                    <i className="bi bi-table me-2 text-warning"></i>
                                    Data Preview ({excelData.length} Records)
                                </h5>
                                {hasPermission('students', 'write') && (
                                    <button
                                        className="btn btn-lg text-white shadow-sm"
                                        onClick={handleImport}
                                        disabled={loading}
                                        style={{ backgroundColor: 'var(--primary-dark)' }}
                                    >
                                        {loading ? 'Importing...' : 'Start Import'} <i className="bi bi-arrow-right-circle ms-2"></i>
                                    </button>
                                )}
                            </div>
                            <div className="card-body p-0">
                                <div className="table-responsive" style={{ maxHeight: '500px' }}>
                                    <table className="table table-striped table-hover mb-0">
                                        <thead className="table-dark sticky-top">
                                            <tr>
                                                {headers.map((h, i) => <th key={i} className="text-nowrap">{h}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {excelData.map((row, i) => (
                                                <tr key={i}>
                                                    {headers.map((h, j) => <td key={j} className="text-nowrap">{row[h]}</td>)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'review' && (
                <div className="animate__animated animate__fadeIn">
                    <div className="card shadow-sm border-0 rounded-4">
                        <div className="card-header bg-warning bg-opacity-10 border-bottom border-warning p-3">
                            <h5 className="mb-0 fw-bold text-dark">
                                <i className="bi bi-exclamation-triangle text-warning me-2"></i>
                                Potential Duplicate Families ({duplicates.length})
                            </h5>
                            <p className="mb-0 small text-muted mt-2">Review these families - they may be related but have different Family IDs</p>
                        </div>
                        <div className="card-body p-4">
                            {loadingDuplicates ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status"></div>
                                    <p className="mt-3 text-muted">Analyzing families...</p>
                                </div>
                            ) : duplicates.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    <i className="bi bi-check-circle fs-1 text-success"></i>
                                    <h5 className="mt-3 text-success">No Potential Duplicates Found!</h5>
                                    <p>All families are properly organized.</p>
                                </div>
                            ) : (
                                duplicates.map((dup, idx) => (
                                    <div key={idx} className="card mb-3 border-2 border-warning">
                                        <div className="card-body">
                                            <div className="row align-items-center">
                                                <div className="col-md-5">
                                                    <h6 className="text-primary fw-bold">{dup.family1_id}</h6>
                                                    <ul className="list-unstyled mb-2">
                                                        {dup.family1_students.map((s: string, i: number) => (
                                                            <li key={i}>
                                                                <i className="bi bi-person-fill me-2"></i>
                                                                {s} <span className="badge bg-primary">{dup.family1_admission_nos[i]}</span>
                                                                <small className="text-muted ms-2">({dup.family1_classes[i]})</small>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    <small><strong>Father:</strong> {dup.father1_name}</small><br />
                                                    <small><strong>Phone:</strong> {dup.father1_phone}</small>
                                                </div>

                                                <div className="col-md-2 text-center">
                                                    <div className="badge bg-warning text-dark fs-5 mb-2">
                                                        {dup.match_score}%
                                                    </div>
                                                    <div><i className="bi bi-arrow-left-right fs-3"></i></div>
                                                </div>

                                                <div className="col-md-5">
                                                    <h6 className="text-info fw-bold">{dup.family2_id}</h6>
                                                    <ul className="list-unstyled mb-2">
                                                        {dup.family2_students.map((s: string, i: number) => (
                                                            <li key={i}>
                                                                <i className="bi bi-person-fill me-2"></i>
                                                                {s} <span className="badge bg-info">{dup.family2_admission_nos[i]}</span>
                                                                <small className="text-muted ms-2">({dup.family2_classes[i]})</small>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    <small><strong>Father:</strong> {dup.father2_name}</small><br />
                                                    <small><strong>Phone:</strong> {dup.father2_phone}</small>
                                                </div>
                                            </div>

                                            <div className="mt-3 d-flex gap-2">
                                                {hasPermission('students', 'write') && (
                                                    <button
                                                        className="btn btn-primary"
                                                        onClick={() => handleMerge(dup.family1_id, dup.family2_id, 'blood')}
                                                    >
                                                        <i className="bi bi-people-fill me-2"></i>Merge as Blood Siblings
                                                    </button>
                                                )}
                                                {hasPermission('students', 'write') && (
                                                    <button
                                                        className="btn btn-warning"
                                                        onClick={() => handleMerge(dup.family1_id, dup.family2_id, 'cousin')}
                                                    >
                                                        <i className="bi bi-diagram-3-fill me-2"></i>Merge as Cousins
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'manual' && (
                <div className="animate__animated animate__fadeIn">
                    <div className="card shadow-sm border-0 rounded-4">
                        <div className="card-header bg-info bg-opacity-10 border-bottom border-info p-3">
                            <h5 className="mb-0 fw-bold text-dark">
                                <i className="bi bi-link-45deg text-info me-2"></i>
                                Manual Sibling/Cousin Link
                            </h5>
                            <p className="mb-0 small text-muted mt-2">Link two students from different families manually</p>
                        </div>
                        <div className="card-body p-4">
                            <div className="row g-4">
                                {/* Student 1 */}
                                <div className="col-md-6">
                                    <label className="form-label fw-bold">Student 1:</label>
                                    {!student1 ? (
                                        <>
                                            <input
                                                type="text"
                                                className="form-control form-control-lg"
                                                placeholder="Search by name or admission no..."
                                                value={search1}
                                                onChange={e => {
                                                    setSearch1(e.target.value);
                                                    searchStudents(e.target.value, setResults1, setSearchingS1);
                                                }}
                                            />
                                            {searchingS1 && <div className="text-center mt-2"><div className="spinner-border spinner-border-sm"></div></div>}
                                            {results1.length > 0 && (
                                                <div className="list-group mt-2">
                                                    {results1.map(s => (
                                                        <button
                                                            key={s.student_id}
                                                            className="list-group-item list-group-item-action"
                                                            onClick={() => {
                                                                setStudent1(s);
                                                                setResults1([]);
                                                            }}
                                                        >
                                                            <strong>{s.first_name} {s.last_name}</strong> ({s.admission_no})<br />
                                                            <small className="text-muted">Family: {s.family_id} | Class: {s.class_name}</small>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="alert alert-success">
                                            <strong>{student1.first_name} {student1.last_name}</strong><br />
                                            <small>Family: {student1.family_id} | Class: {student1.class_name}</small>
                                            <button className="btn btn-sm btn-outline-danger float-end" onClick={() => setStudent1(null)}>
                                                <i className="bi bi-x"></i>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Student 2 */}
                                <div className="col-md-6">
                                    <label className="form-label fw-bold">Student 2:</label>
                                    {!student2 ? (
                                        <>
                                            <input
                                                type="text"
                                                className="form-control form-control-lg"
                                                placeholder="Search by name or admission no..."
                                                value={search2}
                                                onChange={e => {
                                                    setSearch2(e.target.value);
                                                    searchStudents(e.target.value, setResults2, setSearchingS2);
                                                }}
                                            />
                                            {searchingS2 && <div className="text-center mt-2"><div className="spinner-border spinner-border-sm"></div></div>}
                                            {results2.length > 0 && (
                                                <div className="list-group mt-2">
                                                    {results2.map(s => (
                                                        <button
                                                            key={s.student_id}
                                                            className="list-group-item list-group-item-action"
                                                            onClick={() => {
                                                                setStudent2(s);
                                                                setResults2([]);
                                                            }}
                                                        >
                                                            <strong>{s.first_name} {s.last_name}</strong> ({s.admission_no})<br />
                                                            <small className="text-muted">Family: {s.family_id} | Class: {s.class_name}</small>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="alert alert-info">
                                            <strong>{student2.first_name} {student2.last_name}</strong><br />
                                            <small>Family: {student2.family_id} | Class: {student2.class_name}</small>
                                            <button className="btn btn-sm btn-outline-danger float-end" onClick={() => setStudent2(null)}>
                                                <i className="bi bi-x"></i>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Relationship Type */}
                                {student1 && student2 && (
                                    <>
                                        <div className="col-12">
                                            <label className="form-label fw-bold">Relationship Type:</label>
                                            <div className="row g-3">
                                                <div className="col-md-6">
                                                    <div
                                                        className={`card ${relationType === 'blood' ? 'border-primary border-3' : ''}`}
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => setRelationType('blood')}
                                                    >
                                                        <div className="card-body text-center">
                                                            <i className="bi bi-people-fill text-primary fs-1"></i>
                                                            <h6 className="mt-2">Blood Siblings</h6>
                                                            <small className="text-muted">Same parents</small>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-md-6">
                                                    <div
                                                        className={`card ${relationType === 'cousin' ? 'border-warning border-3' : ''}`}
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => setRelationType('cousin')}
                                                    >
                                                        <div className="card-body text-center">
                                                            <i className="bi bi-diagram-3-fill text-warning fs-1"></i>
                                                            <h6 className="mt-2">Cousins</h6>
                                                            <small className="text-muted">Different parents, same family</small>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="col-12">
                                            <div className="alert alert-warning">
                                                <i className="bi bi-exclamation-triangle me-2"></i>
                                                <strong>Warning:</strong> {student2.first_name} will be moved to {student1.first_name}'s family ({student1.family_id})
                                            </div>
                                            {hasPermission('students', 'write') && (
                                                <button className="btn btn-lg btn-primary w-100" onClick={handleManualLink}>
                                                    <i className="bi bi-link-45deg me-2"></i>
                                                    Link as {relationType === 'blood' ? 'Blood Siblings' : 'Cousins'}
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

