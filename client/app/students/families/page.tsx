'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const API = process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com";

interface StudentMember {
    student_id: number;
    admission_no: string;
    first_name: string;
    last_name: string;
    full_name: string;
    father_name: string;
    father_phone: string;
    father_cnic: string;
    mother_name: string;
    mother_phone: string;
    mother_cnic: string;
    guardian_name: string;
    guardian_phone: string;
    current_address: string;
    class_id: number;
    class_name: string;
    section_id: number;
    section_name: string;
    status: string;
}

interface FamilyData {
    family_id: string;
    family_name: string; // Majority father name
    father_name: string;
    mother_name: string;
    father_phone: string;
    mother_phone: string;
    guardian_phone: string;
    primary_phone: string;
    total_children: number;
    children_names: string[];
    classes_list: string[];
    sections_list: string[];
    family_fee: number;
    opening_balance: number;
    total_billed?: number;
    total_paid?: number;
    total_balance?: number;
    fee_status?: 'unpaid' | 'partial' | 'paid' | string;
    members: StudentMember[];
}

interface SchoolInfo {
    school_name: string;
    school_address: string;
    phone_number: string;
    school_phone2: string;
    school_phone3: string;
    school_logo_url: string;
}

export default function FamilyListPage() {
    const router = useRouter();
    const [families, setFamilies] = useState<FamilyData[]>([]);
    const [classes, setClasses] = useState<{ class_id: number; class_name: string }[]>([]);
    const [stats, setStats] = useState<{ total_families: number; total_students: number; average_family_size: number | string } | null>(null);
    const [school, setSchool] = useState<SchoolInfo>({
        school_name: '', school_address: '', phone_number: '', school_phone2: '', school_phone3: '', school_logo_url: ''
    });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [showFeeColumns, setShowFeeColumns] = useState(false);

    // Fetch families, classes, and school settings
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // Fetch classes for filter
                fetch(`${API}/academic`).then(r => r.json()).then(setClasses).catch(() => { });

                // Fetch school settings
                fetch(`${API}/settings`).then(r => r.json()).then((data: any) => {
                    if (data && typeof data === 'object' && !Array.isArray(data)) {
                        const getLogo = (raw?: string) => {
                            if (!raw || !raw.trim()) return `${API}/icon.png`;
                            const s = raw.trim();
                            if (s.startsWith('data:') || s.startsWith('http://') || s.startsWith('https://')) return s;
                            return `${API}/${s.replace(/^\/+/, '')}`;
                        };
                        setSchool({
                            school_name: data.school_name || 'Falcon School System',
                            school_address: data.address || 'Main Campus, Vehari',
                            phone_number: data.contact_number || '',
                            school_phone2: '',
                            school_phone3: '',
                            school_logo_url: getLogo(data.logo_url)
                        });
                    }
                }).catch(() => { });

                // Fetch families directory
                const res = await fetch(`${API}/students/families-directory`);
                const data = await res.json();
                if (res.ok) {
                    setFamilies(data.families || []);
                    setStats(data.stats || null);
                } else {
                    console.error("Failed to load families:", data.error);
                }
            } catch (err) {
                console.error("Error loading families directory:", err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // Filter & Sort families based on search term, class filter, and sequence status
    // Sequence order: Unpaid (1 - Top), Partial (2 - Middle), Paid (3 - Bottom)
    const filteredFamilies = useMemo(() => {
        const list = families.filter(fam => {
            const s = searchTerm.toLowerCase().trim();
            const matchesSearch = !s || (
                fam.family_id.toLowerCase().includes(s) ||
                fam.family_name.toLowerCase().includes(s) ||
                fam.father_name.toLowerCase().includes(s) ||
                fam.mother_name.toLowerCase().includes(s) ||
                fam.father_phone.includes(s) ||
                fam.mother_phone.includes(s) ||
                fam.children_names.some(c => c.toLowerCase().includes(s)) ||
                fam.members.some(m => m.admission_no.toLowerCase().includes(s))
            );

            const matchesClass = !selectedClass || fam.members.some(m => m.class_id?.toString() === selectedClass || m.class_name.toLowerCase() === selectedClass.toLowerCase());

            return matchesSearch && matchesClass;
        });

        const statusPriority: Record<string, number> = { unpaid: 1, partial: 2, paid: 3 };

        return list.sort((a, b) => {
            const pA = statusPriority[a.fee_status || 'paid'] || 3;
            const pB = statusPriority[b.fee_status || 'paid'] || 3;
            if (pA !== pB) return pA - pB;
            return a.family_id.localeCompare(b.family_id, undefined, { numeric: true });
        });
    }, [families, searchTerm, selectedClass]);

    // Format phone for WhatsApp URL (e.g. 03001234567 -> 923001234567)
    const formatWhatsAppNumber = (phone: string) => {
        if (!phone) return '';
        const cleaned = phone.replace(/[^0-9]/g, '');
        if (cleaned.startsWith('0')) {
            return '92' + cleaned.substring(1);
        }
        if (cleaned.startsWith('92')) {
            return cleaned;
        }
        return '92' + cleaned;
    };

    // ── Export Functions ──────────────────────────────────────────────

    // 1. Export Excel
    const exportExcel = () => {
        if (filteredFamilies.length === 0) return;

        const excelData: any[] = [];
        let sr = 1;

        filteredFamilies.forEach(f => {
            f.members.forEach(m => {
                excelData.push({
                    "Sr.#": sr,
                    "Family Name": f.family_name,
                    "Family ID": f.family_id,
                    "Fee Status": f.fee_status ? f.fee_status.toUpperCase() : "PAID",
                    "Total Bill (PKR)": f.total_billed || 0,
                    "Paid (PKR)": f.total_paid || 0,
                    "Balance (PKR)": f.total_balance || 0,
                    "Student Name": m.full_name,
                    "Admission No": m.admission_no,
                    "Class": m.class_name,
                    "Section": m.section_name,
                    "Father Name": m.father_name || f.father_name || "N/A",
                    "Mother Name": m.mother_name || f.mother_name || "N/A",
                    "Father Phone": m.father_phone || f.father_phone || "N/A",
                    "Mother Phone": m.mother_phone || f.mother_phone || "N/A"
                });
            });
            sr++;
        });

        const ws = XLSX.utils.json_to_sheet(excelData);
        ws['!cols'] = [
            { wch: 6 },  // Sr
            { wch: 22 }, // Family Name
            { wch: 16 }, // Family ID
            { wch: 12 }, // Fee Status
            { wch: 16 }, // Total Bill
            { wch: 14 }, // Paid
            { wch: 14 }, // Balance
            { wch: 25 }, // Student Name
            { wch: 15 }, // Admission No
            { wch: 14 }, // Class
            { wch: 10 }, // Section
            { wch: 22 }, // Father Name
            { wch: 22 }, // Mother Name
            { wch: 16 }, // Father Phone
            { wch: 16 }, // Mother Phone
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Family Directory");
        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Falcon School System_School_Family_Directory_${dateStr}.xlsx`);
    };

    // 2. Export CSV
    const exportCSV = () => {
        if (filteredFamilies.length === 0) return;

        const headers = ["Sr.#", "Family Name", "Family ID", "Fee Status", "Total Bill", "Paid", "Balance", "Student Name", "Admission No", "Class", "Section", "Father Name", "Mother Name", "Father Phone", "Mother Phone"];
        const rows: string[][] = [];
        let sr = 1;

        filteredFamilies.forEach(f => {
            f.members.forEach(m => {
                rows.push([
                    sr.toString(),
                    `"${(f.family_name || '').replace(/"/g, '""')}"`,
                    `"${(f.family_id || '').replace(/"/g, '""')}"`,
                    `"${(f.fee_status || 'paid').toUpperCase()}"`,
                    `"${f.total_billed || 0}"`,
                    `"${f.total_paid || 0}"`,
                    `"${f.total_balance || 0}"`,
                    `"${(m.full_name || '').replace(/"/g, '""')}"`,
                    `"${(m.admission_no || '').replace(/"/g, '""')}"`,
                    `"${(m.class_name || '').replace(/"/g, '""')}"`,
                    `"${(m.section_name || '').replace(/"/g, '""')}"`,
                    `"${(m.father_name || f.father_name || '').replace(/"/g, '""')}"`,
                    `"${(m.mother_name || f.mother_name || '').replace(/"/g, '""')}"`,
                    `"${(m.father_phone || f.father_phone || '').replace(/"/g, '""')}"`,
                    `"${(m.mother_phone || f.mother_phone || '').replace(/"/g, '""')}"`
                ]);
            });
            sr++;
        });

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        const dateStr = new Date().toISOString().split('T')[0];
        link.setAttribute("download", `Falcon School System_School_Family_Directory_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // 3. Print / PDF Export with Hierarchical Child Rows
    const exportPDF = () => {
        if (filteredFamilies.length === 0) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        const tableRowsHtml = filteredFamilies.map((f, idx) => {
            const M = f.members.length;
            const feeStatusStr = f.fee_status ? f.fee_status.toUpperCase() : 'PAID';
            const statusColor = f.fee_status === 'unpaid' ? '#dc3545' : f.fee_status === 'partial' ? '#fd7e14' : '#198754';

            return f.members.map((m, mIdx) => {
                if (mIdx === 0) {
                    return `
                        <tr style="border-top: 2px solid #215E61;">
                            <td rowspan="${M}" style="text-align: center; border: 1px solid #333; padding: 6px; font-weight: bold; vertical-align: middle; background-color: #fafafa;">${idx + 1}</td>
                            <td rowspan="${M}" style="border: 1px solid #333; padding: 6px; font-weight: bold; vertical-align: middle;">
                                <div style="font-size: 10pt; color: ${statusColor};">${f.family_name}</div>
                                <div style="font-size: 8pt; color: #666; font-weight: normal;">${f.total_children} Child${f.total_children > 1 ? 'ren' : ''}</div>
                                <div style="font-size: 7.5pt; font-weight: bold; color: ${statusColor}; margin-top: 2px;">Status: ${feeStatusStr}</div>
                            </td>
                            <td rowspan="${M}" style="text-align: center; border: 1px solid #333; padding: 6px; font-weight: bold; vertical-align: middle; background-color: #f8f9fa;">${f.family_id}</td>
                            ${showFeeColumns ? `
                                <td rowspan="${M}" style="text-align: right; border: 1px solid #333; padding: 6px; font-weight: bold; vertical-align: middle;">PKR ${(f.total_billed || 0).toLocaleString('en-PK')}</td>
                                <td rowspan="${M}" style="text-align: right; border: 1px solid #333; padding: 6px; font-weight: bold; color: #198754; vertical-align: middle;">PKR ${(f.total_paid || 0).toLocaleString('en-PK')}</td>
                                <td rowspan="${M}" style="text-align: right; border: 1px solid #333; padding: 6px; font-weight: bold; color: ${(f.total_balance || 0) > 0 ? '#dc3545' : '#198754'}; vertical-align: middle;">PKR ${(f.total_balance || 0).toLocaleString('en-PK')}</td>
                            ` : ''}
                            <td style="border: 1px solid #333; padding: 6px; font-weight: bold; color: #111;">
                                ${m.full_name} <span style="font-size: 8pt; color: #555; font-weight: normal;">(${m.admission_no})</span>
                            </td>
                            <td style="text-align: center; border: 1px solid #333; padding: 6px;">${m.class_name}</td>
                            <td style="text-align: center; border: 1px solid #333; padding: 6px;">${m.section_name}</td>
                            <td rowspan="${M}" style="border: 1px solid #333; padding: 6px; vertical-align: middle;">
                                <div><strong>Father:</strong> ${f.father_name || 'N/A'}</div>
                                ${f.mother_name ? `<div style="font-size: 8pt; color: #555;"><strong>Mother:</strong> ${f.mother_name}</div>` : ''}
                            </td>
                            <td rowspan="${M}" style="border: 1px solid #333; padding: 6px; vertical-align: middle; white-space: nowrap;">
                                <div>${f.father_phone ? `Father: ${f.father_phone}` : ''}</div>
                                <div>${f.mother_phone ? `Mother: ${f.mother_phone}` : ''}</div>
                            </td>
                        </tr>
                    `;
                } else {
                    return `
                        <tr>
                            <td style="border: 1px solid #333; padding: 6px; font-weight: bold; color: #111;">
                                ${m.full_name} <span style="font-size: 8pt; color: #555; font-weight: normal;">(${m.admission_no})</span>
                            </td>
                            <td style="text-align: center; border: 1px solid #333; padding: 6px;">${m.class_name}</td>
                            <td style="text-align: center; border: 1px solid #333; padding: 6px;">${m.section_name}</td>
                        </tr>
                    `;
                }
            }).join('');
        }).join('');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Family Directory Report - ${school.school_name || 'Falcon School System'}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 12mm 10mm; color: #000; background: #fff; }
                    .header { display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
                    .logo { width: 65px; height: 65px; object-fit: contain; margin-right: 15px; }
                    .school-name { font-size: 18pt; font-weight: bold; text-transform: uppercase; color: #233D4D; text-align: center; }
                    .school-sub { font-size: 9.5pt; text-align: center; margin-top: 3px; color: #444; }
                    .title-bar { background-color: #215E61; color: #fff; text-align: center; padding: 6px; font-size: 11.5pt; font-weight: bold; text-transform: uppercase; margin: 10px 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .meta-info { display: flex; justify-content: space-between; font-size: 9pt; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
                    table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
                    th { background-color: #f0f4f5; border: 1px solid #333; padding: 6px; font-weight: bold; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    @page { size: A4 landscape; margin: 10mm; }
                </style>
            </head>
            <body>
                <div class="header">
                    ${school.school_logo_url ? `<img src="${school.school_logo_url}" class="logo" alt="Logo" />` : ''}
                    <div>
                        <div class="school-name">${school.school_name || 'Falcon School System'}</div>
                        <div class="school-sub">${school.school_address} ${school.phone_number ? `| Ph: ${school.phone_number}` : ''}</div>
                    </div>
                </div>
                <div class="title-bar">FAMILY DIRECTORY & STUDENT LIST</div>
                <div class="meta-info">
                    <div><strong>Total Families Listed:</strong> ${filteredFamilies.length}</div>
                    <div><strong>Date Generated:</strong> ${dateStr}</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 4%;">Sr.#</th>
                            <th style="width: 16%;">Family Name</th>
                            <th style="width: 10%;">Family ID</th>
                            ${showFeeColumns ? `
                                <th style="width: 9%;">Total Bill</th>
                                <th style="width: 9%;">Paid</th>
                                <th style="width: 9%;">Balance</th>
                            ` : ''}
                            <th style="width: 20%;">Student / Child Name</th>
                            <th style="width: 8%;">Class</th>
                            <th style="width: 7%;">Section</th>
                            <th style="width: 14%;">Parents Name</th>
                            <th style="width: 12%;">Phone Numbers</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
                <script>
                    window.onload = function() {
                        window.print();
                    }
                </script>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div className="container-fluid p-4 animate__animated animate__fadeIn">
            {/* Top Page Header */}
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
                <div>
                    <h2 className="fw-bold mb-1" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-people-fill me-2" style={{ color: 'var(--primary-teal)' }}></i>
                        Family Directory
                    </h2>
                    <p className="text-muted small mb-0">
                        Complete family units directory with fee statuses, fee history toggle, parents info, and direct student profile navigation.
                    </p>
                </div>
            </div>

            {/* Summary Stat Cards */}
            {stats && (
                <div className="row g-3 mb-4">
                    <div className="col-6 col-md-3">
                        <div className="card border-0 shadow-sm rounded-3" style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                            <div className="card-body py-2 px-3">
                                <div className="text-muted small fw-bold text-uppercase">Total Families</div>
                                <div className="fw-bold fs-4" style={{ color: 'var(--primary-dark)' }}>{stats.total_families}</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="card border-0 shadow-sm rounded-3" style={{ borderLeft: '4px solid var(--accent-orange)' }}>
                            <div className="card-body py-2 px-3">
                                <div className="text-muted small fw-bold text-uppercase">Total Students</div>
                                <div className="fw-bold fs-4" style={{ color: 'var(--accent-orange)' }}>{stats.total_students}</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="card border-0 shadow-sm rounded-3" style={{ borderLeft: '4px solid #0d6efd' }}>
                            <div className="card-body py-2 px-3">
                                <div className="text-muted small fw-bold text-uppercase">Avg. Family Size</div>
                                <div className="fw-bold fs-4 text-primary">{stats.average_family_size} <span className="fs-6 text-muted font-normal">kids</span></div>
                            </div>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="card border-0 shadow-sm rounded-3" style={{ borderLeft: '4px solid #198754' }}>
                            <div className="card-body py-2 px-3">
                                <div className="text-muted small fw-bold text-uppercase">Filtered Results</div>
                                <div className="fw-bold fs-4 text-success">{filteredFamilies.length}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Card with Table Header Actions */}
            <div className="card border-0 shadow-sm rounded-3">
                {/* Card Header with Integrated Search, Filter & Sleek Top-Right Icon Buttons */}
                <div className="card-header bg-white border-bottom py-3 px-3">
                    <div className="row g-3 align-items-center justify-content-between">
                        {/* Search & Class Filter */}
                        <div className="col-12 col-md-7 col-lg-6">
                            <div className="d-flex flex-wrap gap-2">
                                <div className="input-group flex-grow-1" style={{ minWidth: '200px' }}>
                                    <span className="input-group-text bg-light border-end-0">
                                        <i className="bi bi-search text-muted"></i>
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control border-start-0 ps-0 bg-light"
                                        placeholder="Search Family Name, ID, Child, Phone..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                    {searchTerm && (
                                        <button className="btn btn-light border border-start-0" type="button" onClick={() => setSearchTerm('')}>
                                            <i className="bi bi-x text-muted"></i>
                                        </button>
                                    )}
                                </div>
                                <select
                                    className="form-select bg-light"
                                    style={{ width: 'auto', minWidth: '160px' }}
                                    value={selectedClass}
                                    onChange={e => setSelectedClass(e.target.value)}
                                >
                                    <option value="">All Classes</option>
                                    {classes.map(c => (
                                        <option key={c.class_id} value={c.class_id.toString()}>
                                            {c.class_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Top-Right Sleek Export & Fee Icon Toggle Buttons */}
                        <div className="col-12 col-md-5 col-lg-6 d-flex justify-content-md-end align-items-center gap-2">
                            {/* Sequence Legend Indicator */}
                            <div className="d-none d-lg-flex align-items-center gap-2 me-2 small">
                                <span className="badge bg-danger bg-opacity-10 text-danger border border-danger-subtle">Unpaid</span>
                                <span className="badge bg-warning bg-opacity-15 text-dark border border-warning">Partial</span>
                                <span className="badge bg-light text-dark border">Paid</span>
                            </div>

                            <div className="btn-group shadow-sm rounded-3" role="group" aria-label="Export & Fee Actions">
                                {/* Fee Toggle Icon Button */}
                                <button
                                    type="button"
                                    className={`btn btn-sm ${showFeeColumns ? 'btn-teal text-white' : 'btn-light border'} px-2.5 d-inline-flex align-items-center justify-content-center`}
                                    style={{ width: '36px', height: '34px', color: showFeeColumns ? '#fff' : 'var(--primary-teal)', backgroundColor: showFeeColumns ? 'var(--primary-teal)' : undefined }}
                                    onClick={() => setShowFeeColumns(!showFeeColumns)}
                                    title={showFeeColumns ? "Hide Fee Summary Columns" : "Show Fee Summary Columns (Total Bill, Paid, Balance)"}
                                >
                                    <i className={`bi ${showFeeColumns ? 'bi-cash-stack' : 'bi-currency-dollar'} fs-5`}></i>
                                </button>
                                {/* PDF Icon Button */}
                                <button
                                    type="button"
                                    className="btn btn-sm btn-light border text-danger px-2.5 d-inline-flex align-items-center justify-content-center"
                                    style={{ width: '36px', height: '34px' }}
                                    onClick={exportPDF}
                                    title="Export PDF / Print Document"
                                >
                                    <i className="bi bi-file-earmark-pdf-fill fs-5"></i>
                                </button>
                                {/* Excel Icon Button */}
                                <button
                                    type="button"
                                    className="btn btn-sm btn-light border text-success px-2.5 d-inline-flex align-items-center justify-content-center"
                                    style={{ width: '36px', height: '34px' }}
                                    onClick={exportExcel}
                                    title="Export to Excel Spreadsheet"
                                >
                                    <i className="bi bi-file-earmark-excel-fill fs-5"></i>
                                </button>
                                {/* CSV Icon Button */}
                                <button
                                    type="button"
                                    className="btn btn-sm btn-light border text-primary px-2.5 d-inline-flex align-items-center justify-content-center"
                                    style={{ width: '36px', height: '34px' }}
                                    onClick={exportCSV}
                                    title="Export to CSV File"
                                >
                                    <i className="bi bi-file-earmark-text-fill fs-5"></i>
                                </button>
                                {/* Print Icon Button */}
                                <button
                                    type="button"
                                    className="btn btn-sm btn-light border text-dark px-2.5 d-inline-flex align-items-center justify-content-center"
                                    style={{ width: '36px', height: '34px' }}
                                    onClick={exportPDF}
                                    title="Print Family Directory"
                                >
                                    <i className="bi bi-printer-fill fs-5"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table Body with Hierarchical Child Rows & Clickable Profile Navigation */}
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-teal mb-2" role="status" style={{ color: 'var(--primary-teal)' }}></div>
                            <div className="text-muted small">Loading Family Directory...</div>
                        </div>
                    ) : filteredFamilies.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            <i className="bi bi-people fs-1 d-block mb-2 opacity-50"></i>
                            <p className="mb-0">No family records found matching your search criteria.</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.88rem' }}>
                                <thead style={{ backgroundColor: 'var(--primary-dark)', color: '#fff' }}>
                                    <tr>
                                        <th className="text-center" style={{ width: '3%', padding: '10px 8px' }}>Sr.#</th>
                                        <th style={{ width: showFeeColumns ? '15%' : '18%', padding: '10px 8px' }}>Family Name</th>
                                        <th style={{ width: showFeeColumns ? '10%' : '12%', padding: '10px 8px' }}>Family ID</th>
                                        {showFeeColumns && (
                                            <>
                                                <th className="text-end" style={{ width: '9%', padding: '10px 8px', backgroundColor: '#1e3a8a' }}>Total Bill</th>
                                                <th className="text-end" style={{ width: '9%', padding: '10px 8px', backgroundColor: '#065f46' }}>Paid</th>
                                                <th className="text-end" style={{ width: '9%', padding: '10px 8px', backgroundColor: '#991b1b' }}>Balance</th>
                                            </>
                                        )}
                                        <th style={{ width: showFeeColumns ? '17%' : '22%', padding: '10px 8px' }}>Student / Child Name</th>
                                        <th style={{ width: '8%', padding: '10px 8px' }}>Class</th>
                                        <th style={{ width: '6%', padding: '10px 8px' }}>Section</th>
                                        <th style={{ width: '12%', padding: '10px 8px' }}>Parents Name</th>
                                        <th style={{ width: '9%', padding: '10px 8px' }}>Contact Numbers</th>
                                        <th className="text-center" style={{ width: '5%', padding: '10px 8px' }}>WhatsApp</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredFamilies.map((fam, famIdx) => {
                                        const waNumber = formatWhatsAppNumber(fam.primary_phone);
                                        const M = fam.members.length;
                                        const feeStatus = fam.fee_status || 'paid';
                                        const isUnpaid = feeStatus === 'unpaid';
                                        const isPartial = feeStatus === 'partial';

                                        return fam.members.map((m, mIdx) => {
                                            const isFirst = mIdx === 0;

                                            return (
                                                <tr
                                                    key={`${fam.family_id}-${m.student_id}`}
                                                    onClick={() => router.push(`/students/profile/${m.student_id}`)}
                                                    title={`Click to view ${m.full_name}'s profile`}
                                                    style={{
                                                        backgroundColor: famIdx % 2 === 0 ? '#ffffff' : '#fafafa',
                                                        borderTop: isFirst ? '2px solid #dee2e6' : '1px dashed #e9ecef',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {/* 1. Sr.# (Rowspan) */}
                                                    {isFirst && (
                                                        <td
                                                            rowSpan={M}
                                                            className="text-center text-muted fw-bold align-middle border-end bg-light bg-opacity-50"
                                                        >
                                                            {famIdx + 1}
                                                        </td>
                                                    )}

                                                    {/* 2. Family Name (Rowspan) with Status Colorization */}
                                                    {isFirst && (
                                                        <td rowSpan={M} className="align-middle border-end">
                                                            <div className="d-flex align-items-center gap-1">
                                                                {isUnpaid ? (
                                                                    <i className="bi bi-exclamation-triangle-fill text-danger me-1"></i>
                                                                ) : isPartial ? (
                                                                    <i className="bi bi-pie-chart-fill me-1" style={{ color: '#fd7e14' }}></i>
                                                                ) : (
                                                                    <i className="bi bi-house-door-fill me-1 text-teal" style={{ color: 'var(--primary-teal)' }}></i>
                                                                )}
                                                                <span
                                                                    className="fw-bold"
                                                                    style={{
                                                                        color: isUnpaid ? '#dc3545' : isPartial ? '#fd7e14' : '#212529'
                                                                    }}
                                                                >
                                                                    {fam.family_name}
                                                                </span>
                                                            </div>
                                                            <small className="text-muted d-block mt-0.5" style={{ fontSize: '0.75rem' }}>
                                                                {fam.total_children} child{fam.total_children > 1 ? 'ren' : ''} in family
                                                            </small>
                                                        </td>
                                                    )}

                                                    {/* 3. Family ID (Rowspan) with Status Colorization */}
                                                    {isFirst && (
                                                        <td rowSpan={M} className="align-middle border-end">
                                                            {isUnpaid ? (
                                                                <span className="badge rounded-pill bg-danger bg-opacity-10 text-danger border border-danger-subtle px-2 py-1" style={{ fontSize: '0.78rem' }}>
                                                                    <i className="bi bi-tag-fill me-1 text-danger"></i>
                                                                    {fam.family_id}
                                                                </span>
                                                            ) : isPartial ? (
                                                                <span className="badge rounded-pill text-dark border border-warning px-2 py-1" style={{ backgroundColor: '#fff3cd', color: '#856404', fontSize: '0.78rem' }}>
                                                                    <i className="bi bi-tag-fill me-1" style={{ color: '#fd7e14' }}></i>
                                                                    {fam.family_id}
                                                                </span>
                                                            ) : (
                                                                <span className="badge rounded-pill text-dark border px-2 py-1" style={{ backgroundColor: '#f1f5f9', fontSize: '0.78rem' }}>
                                                                    <i className="bi bi-tag-fill me-1 text-secondary"></i>
                                                                    {fam.family_id}
                                                                </span>
                                                            )}
                                                        </td>
                                                    )}

                                                    {/* Optional Fee Columns: Total Bill, Paid, Balance */}
                                                    {showFeeColumns && isFirst && (
                                                        <>
                                                            <td rowSpan={M} className="align-middle text-end border-end fw-bold text-dark" style={{ backgroundColor: '#f8fafc' }}>
                                                                PKR {(fam.total_billed || 0).toLocaleString('en-PK')}
                                                            </td>
                                                            <td rowSpan={M} className="align-middle text-end border-end fw-bold text-success" style={{ backgroundColor: '#f0fdf4' }}>
                                                                PKR {(fam.total_paid || 0).toLocaleString('en-PK')}
                                                            </td>
                                                            <td rowSpan={M} className="align-middle text-end border-end fw-bold" style={{ backgroundColor: (fam.total_balance || 0) > 0 ? '#fef2f2' : '#f0fdf4', color: (fam.total_balance || 0) > 0 ? '#dc3545' : '#166534' }}>
                                                                PKR {(fam.total_balance || 0).toLocaleString('en-PK')}
                                                            </td>
                                                        </>
                                                    )}

                                                    {/* 4. Student / Child Sub-Row Name */}
                                                    <td>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <i className="bi bi-person-circle text-teal" style={{ color: 'var(--primary-teal)', fontSize: '0.9rem' }}></i>
                                                            <div>
                                                                <span className="fw-semibold text-dark" style={{ fontSize: '0.88rem' }}>
                                                                    {m.full_name}
                                                                </span>
                                                                <span className="badge bg-light text-muted border ms-1" style={{ fontSize: '0.7rem' }}>
                                                                    {m.admission_no}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* 5. Class */}
                                                    <td>
                                                        <span className="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle px-2 py-1" style={{ fontSize: '0.78rem' }}>
                                                            {m.class_name}
                                                        </span>
                                                    </td>

                                                    {/* 6. Section */}
                                                    <td>
                                                        <span className="badge bg-secondary bg-opacity-10 text-dark border px-2 py-1" style={{ fontSize: '0.78rem' }}>
                                                            {m.section_name}
                                                        </span>
                                                    </td>

                                                    {/* 7. Father / Mother Name (Rowspan) */}
                                                    {isFirst && (
                                                        <td rowSpan={M} className="align-middle border-start border-end">
                                                            <div className="small">
                                                                <div className="fw-semibold text-dark">
                                                                    <i className="bi bi-person-badge me-1 text-primary"></i>
                                                                    {fam.father_name || 'N/A'}
                                                                </div>
                                                                {fam.mother_name && (
                                                                    <div className="text-muted mt-1" style={{ fontSize: '0.78rem' }}>
                                                                        <i className="bi bi-person me-1 text-secondary"></i>
                                                                        Mother: {fam.mother_name}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}

                                                    {/* 8. Contact Numbers (Rowspan) */}
                                                    {isFirst && (
                                                        <td rowSpan={M} className="align-middle border-end" style={{ whiteSpace: 'nowrap' }}>
                                                            <div className="small">
                                                                {fam.father_phone ? (
                                                                    <div>
                                                                        <a
                                                                            href={`tel:${fam.father_phone}`}
                                                                            onClick={e => e.stopPropagation()}
                                                                            className="text-decoration-none text-dark fw-semibold"
                                                                        >
                                                                            <i className="bi bi-telephone-fill me-1 text-success" style={{ fontSize: '0.75rem' }}></i>
                                                                            {fam.father_phone}
                                                                        </a>
                                                                    </div>
                                                                ) : fam.mother_phone ? (
                                                                    <div>
                                                                        <a
                                                                            href={`tel:${fam.mother_phone}`}
                                                                            onClick={e => e.stopPropagation()}
                                                                            className="text-decoration-none text-dark fw-semibold"
                                                                        >
                                                                            <i className="bi bi-telephone-fill me-1 text-success" style={{ fontSize: '0.75rem' }}></i>
                                                                            {fam.mother_phone}
                                                                        </a>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-muted">—</span>
                                                                )}
                                                                {fam.mother_phone && fam.father_phone && (
                                                                    <div className="text-muted mt-1" style={{ fontSize: '0.72rem' }}>
                                                                        M: {fam.mother_phone}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}

                                                    {/* 9. WhatsApp Icon Action (Rowspan) */}
                                                    {isFirst && (
                                                        <td rowSpan={M} className="text-center align-middle">
                                                            {waNumber ? (
                                                                <a
                                                                    href={`https://wa.me/${waNumber}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={e => e.stopPropagation()}
                                                                    className="btn btn-success btn-sm rounded-circle d-inline-flex align-items-center justify-content-center shadow-sm"
                                                                    style={{ width: '34px', height: '34px', backgroundColor: '#25D366', borderColor: '#25D366' }}
                                                                    title={`Send WhatsApp message to ${fam.primary_phone}`}
                                                                >
                                                                    <i className="bi bi-whatsapp fs-6 text-white"></i>
                                                                </a>
                                                            ) : (
                                                                <button className="btn btn-sm btn-light text-muted rounded-circle" disabled style={{ width: '34px', height: '34px' }}>
                                                                    <i className="bi bi-whatsapp fs-6 opacity-50"></i>
                                                                </button>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        });
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
