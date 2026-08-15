'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastHelper';

type Term = { id: number; term_name: string };
type ClassItem = { class_id: number; class_name: string };
type SectionItem = { section_id: number; section_name: string; class_id: number };

type StudentListRow = {
  student_id: number;
  first_name: string;
  last_name: string;
  father_name?: string | null;
  admission_no?: string | null;
  roll_no?: string | null;
  marked_subjects: number;
  total_marks: number;
  obtained_marks: number;
  position: number | null;
  ordinal_position: string | null;
  percentage: number | null;
  grade: string | null;
};

type ResultMeta = {
  term_id: number;
  term_name: string;
  academic_year_id: number;
  year_name: string;
  class_id: number;
  class_name: string;
  section_id: number;
  section_name: string;
};

type SchoolInfo = {
  school_name?: string;
  school_address?: string;
  phone_number?: string;
  school_phone2?: string;
  school_phone3?: string;
  school_logo_url?: string;
};

type CardSubjectRow = {
  subject_id: number;
  subject_name: string;
  subject_code?: string | null;
  total_marks: number | null;
  obtained_marks: number | null;
};

type CardStudent = {
  student_id: number;
  first_name: string;
  last_name: string;
  father_name?: string | null;
  admission_no?: string | null;
  roll_no?: string | null;
  position: number | null;
  ordinal_position: string | null;
  percentage: number | null;
  grade: string | null;
  subject_rows: CardSubjectRow[];
  grand_total_marks: number;
  grand_obtained_marks: number;
};

type CardPayload = {
  meta: ResultMeta;
  school: SchoolInfo;
  students: CardStudent[];
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

function fmtNum(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.00$/, '');
}

function esc(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSubjectGrade(obtained: number | null, total: number | null): string {
  if (obtained === null || total === null || total <= 0) return '';
  const pct = (obtained / total) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

function getLogoUrl(rawLogo?: string): string {
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com").replace(/\/+$/, '');
  if (!rawLogo || !rawLogo.trim()) return '';
  const logoStr = rawLogo.trim();
  if (logoStr.startsWith('data:') || logoStr.startsWith('http://') || logoStr.startsWith('https://')) {
    return logoStr;
  }
  const cleanPath = logoStr.replace(/^\/+/, '');
  return `${API_URL}/${cleanPath}`;
}

function buildPrintHtml(payload: CardPayload, autoPrint = false): string {
  const { meta, school, students } = payload;
  const schoolName = school.school_name || 'Falcon School System';
  const address = school.school_address || '83m Madina Colony Vehari';
  const phones = [school.phone_number, school.school_phone2, school.school_phone3].filter(Boolean).join(' ; ') || '0300-7730141 ; 0308-7696430 ; 067-3366383';
  const logo = getLogoUrl(school.school_logo_url);
  const session = meta.year_name || meta.term_name || '2025 - 2026';

  const cardsHtml = students.map((student) => {
    const subjects = student.subject_rows || [];
    const isCompact = subjects.length > 9;

    const subjectRowsHtml = subjects.map((subj, idx) => {
      const i = idx + 1;
      const name = subj.subject_name || `Subject ${i}`;
      const total = subj.total_marks !== null && subj.total_marks !== undefined ? fmtNum(subj.total_marks) : '100';
      const obtained = subj.obtained_marks !== null && subj.obtained_marks !== undefined ? fmtNum(subj.obtained_marks) : '';
      const pctVal = subj.total_marks && subj.total_marks > 0 && subj.obtained_marks !== null && subj.obtained_marks !== undefined
        ? fmtNum((Number(subj.obtained_marks) / Number(subj.total_marks)) * 100) + '%'
        : '';
      const gradeVal = getSubjectGrade(subj.obtained_marks, subj.total_marks);

      return `
              <tr>
                <td>${i}</td>
                <td class="subject">${esc(name)}</td>
                <td>${esc(total)}</td>
                <td>${esc(obtained)}</td>
                <td>${esc(pctVal)}</td>
                <td>${esc(gradeVal)}</td>
              </tr>`;
    }).join('');

    const overallPctStr = student.percentage !== null && student.percentage !== undefined ? fmtNum(student.percentage) + ' %' : '—';
    const overallGradeStr = student.grade || '—';
    const positionStr = student.ordinal_position || (student.position ? String(student.position) : '—');
    const statusStr = student.grade === 'F' ? 'FAIL' : (student.percentage !== null ? 'PASS' : '—');

    return `
          <div class="page ${isCompact ? 'compact' : ''}">
            <!-- Header -->
            <div class="header">
              <div class="logo">
                ${logo ? `<img src="${esc(logo)}" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>` : 'DEEDS NOT WORDS<br>Falcon School System'}
              </div>
              <div class="school-info">
                <div class="school-name">${esc(schoolName)}</div>
                <div class="school-address">${esc(address)}</div>
                <div class="school-contact">${esc(phones)}</div>
              </div>
            </div>

            <!-- Title bar -->
            <div class="title-bar">
              <div class="title">ANNUAL RESULT CARD</div>
              <div class="session">Session: [ <span>${esc(session)}</span> ]</div>
            </div>

            <!-- Student info -->
            <table class="info-table">
              <tr>
                <td class="label">Student Name</td>
                <td class="value">${esc(`${student.first_name} ${student.last_name}`.trim())}</td>
                <td class="label">Father Name</td>
                <td class="value">${esc(student.father_name || '—')}</td>
              </tr>
              <tr>
                <td class="label">Class</td>
                <td class="value">${esc(meta.class_name)}</td>
                <td class="label">Section</td>
                <td class="value">${esc(meta.section_name)}</td>
              </tr>
              <tr>
                <td class="label">Roll No.</td>
                <td class="value">${esc(student.roll_no || '—')}</td>
                <td class="label">Admission No.</td>
                <td class="value">${esc(student.admission_no || '—')}</td>
              </tr>
            </table>

            <!-- Subject-wise Marks -->
            <div class="section-heading">Subject-wise Marks</div>
            <table class="marks-table">
              <thead>
                <tr>
                  <th style="width:6%;">S.#</th>
                  <th style="width:34%;">Subject</th>
                  <th style="width:15%;">Total Marks</th>
                  <th style="width:15%;">Marks Obtained</th>
                  <th style="width:15%;">%</th>
                  <th style="width:15%;">Grade</th>
                </tr>
              </thead>
              <tbody>
                ${subjectRowsHtml}
                <tr class="total-row">
                  <td colspan="2">Total</td>
                  <td>${esc(fmtNum(student.grand_total_marks))}</td>
                  <td>${esc(fmtNum(student.grand_obtained_marks))}</td>
                  <td>${student.percentage !== null && student.percentage !== undefined ? esc(fmtNum(student.percentage)) + '%' : ''}</td>
                  <td>&nbsp;</td>
                </tr>
              </tbody>
            </table>

            <!-- Summary -->
            <table class="summary-table">
              <tr>
                <th>Percentage</th>
                <th>Overall Grade</th>
                <th>Class Position</th>
                <th>Result Status</th>
              </tr>
              <tr>
                <td>${esc(overallPctStr)}</td>
                <td>${esc(overallGradeStr)}</td>
                <td>${esc(positionStr)}</td>
                <td>${esc(statusStr)}</td>
              </tr>
            </table>

            <!-- Grading scale -->
            <div class="grading-heading">Grading Scale</div>
            <table class="grading-table">
              <tr>
                <th>Grade</th>
                <th>A+</th>
                <th>A</th>
                <th>B</th>
                <th>C</th>
                <th>D</th>
              </tr>
              <tr>
                <th>Marks %</th>
                <td>90-100</td>
                <td>80-89</td>
                <td>70-79</td>
                <td>60-69</td>
                <td>Below 60</td>
              </tr>
            </table>

            <!-- Remarks -->
            <div class="remarks-heading">Class Teacher's Remarks:</div>
            <div class="remarks-line"></div>
            <div class="remarks-line"></div>

            <div class="bottom-spacer"></div>

            <!-- Signatures -->
            <div class="signatures">
              <div class="sig">
                <div class="sig-line"></div>
                <div class="sig-label">Class Teacher's Signature</div>
              </div>
              <div class="sig">
                <div class="sig-line"></div>
                <div class="sig-label">Exam Controller's Signature</div>
              </div>
              <div class="sig">
                <div class="sig-line"></div>
                <div class="sig-label">Principal's Signature</div>
              </div>
            </div>

            <div class="issue-date">Date of Issue: [ <span>__ / __ / ____</span> ]</div>
          </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Falcon School System - Annual Result Card</title>
<style>
  @page {
    size: A4 portrait;
    margin: 10mm;
  }
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif;
    color: #000;
    margin: 0;
    padding: 0;
    background: #e5e5e5;
  }
  .print-toolbar {
    position: fixed;
    top: 0; left: 0; right: 0;
    background: #215E61;
    color: #fff;
    padding: 8px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: Arial, sans-serif;
    font-size: 13px;
    z-index: 9999;
  }
  .print-toolbar button {
    background: #FE7F2D;
    color: #fff;
    border: none;
    padding: 6px 20px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: bold;
    cursor: pointer;
  }
  .page-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 46px;
  }
  @media print {
    .print-toolbar { display: none !important; }
    body { background: #fff; }
    .page-wrap { padding-top: 0; display: block; }
    .page { box-shadow: none; margin: 0 auto; page-break-after: always; break-after: page; height: 277mm; }
    .page:last-child { page-break-after: auto; break-after: auto; }
  }

  .page {
    width: 210mm;
    height: 277mm;
    padding: 10mm 12mm;
    margin: 8mm auto 20mm auto;
    background: #fff;
    box-shadow: 0 0 8px rgba(0,0,0,0.25);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  /* ---------- Header ---------- */
  .header {
    display: flex;
    align-items: center;
    gap: 14px;
    border-bottom: 3px solid #000;
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .logo {
    width: 68px;
    height: 68px;
    border-radius: 50%;
    border: 2px solid #000;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 6px;
    font-weight: bold;
    line-height: 1.1;
    flex-shrink: 0;
    padding: 4px;
    overflow: hidden;
  }
  .school-info {
    text-align: center;
    flex: 1;
  }
  .school-name {
    font-size: 35px;
    font-weight: bold;
    margin: 0 0 3px 0;
    line-height: 1.1;
  }
  .school-address, .school-contact {
    font-size: 17px;
    margin: 1px 0;
    line-height: 1.15;
  }
  /* ---------- Title bar ---------- */
  .title-bar {
    display: flex;
    border: 1.5px solid #000;
    margin-bottom: 10px;
  }
  .title-bar .title {
    flex: 2;
    background: #d9d9d9;
    text-align: center;
    font-weight: bold;
    font-size: 20px;
    padding: 6px;
    border-right: 1.5px solid #000;
    letter-spacing: 1px;
  }
  .title-bar .session {
    flex: 1;
    text-align: center;
    font-weight: bold;
    font-size: 17px;
    padding: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* ---------- Info table ---------- */
  table {
    width: 100%;
    border-collapse: collapse;
  }
  .info-table td {
    border: 1px solid #000;
    padding: 4px 8px;
    font-size: 13px;
  }
  .info-table td.label {
    font-weight: bold;
    width: 16%;
    background: #f2f2f2;
  }
  .info-table td.value {
    width: 34%;
  }
  .info-table {
    margin-bottom: 10px;
  }
  /* ---------- Section heading ---------- */
  .section-heading {
    font-weight: bold;
    font-size: 17px;
    margin: 0 0 5px 0;
  }
  /* ---------- Marks table ---------- */
  .marks-table {
    margin-bottom: 10px;
  }
  .marks-table th, .marks-table td {
    border: 1px solid #000;
    padding: 4px 8px;
    font-size: 17px;
    text-align: center;
  }
  .marks-table th {
    background: #d9d9d9;
    font-weight: bold;
  }
  .marks-table td.subject {
    text-align: left;
  }
  .marks-table tr.total-row td {
    font-weight: bold;
    background: #f2f2f2;
  }
  /* compact mode when subject count is high */
  .page.compact .marks-table th,
  .page.compact .marks-table td {
    padding: 2.5px 6px;
    font-size: 14.5px;
  }
  .page.compact .info-table td {
    padding: 3px 8px;
  }
  .page.compact .remarks-line {
    height: 16px;
    margin-bottom: 4px;
  }
  .page.compact .signatures {
    margin-top: 30px;
  }
  .page.compact .issue-date {
    margin-top: 14px;
  }
  .page.compact .header {
    margin-bottom: 6px;
    padding-bottom: 5px;
  }
  .page.compact .school-name { font-size: 30px; }
  .page.compact .title-bar { margin-bottom: 7px; }
  .page.compact .section-heading { margin-bottom: 3px; }
  /* ---------- Summary table ---------- */
  .summary-table {
    margin-bottom: 10px;
  }
  .summary-table th, .summary-table td {
    border: 1px solid #000;
    padding: 6px;
    text-align: center;
  }
  .summary-table th {
    background: #d9d9d9;
    font-weight: bold;
    font-size: 16px;
  }
  .summary-table td {
    font-size: 17px;
  }
  /* ---------- Grading scale ---------- */
  .grading-heading {
    font-weight: bold;
    font-style: italic;
    font-size: 17px;
    margin: 0 0 5px 0;
  }
  .grading-table {
    margin-bottom: 10px;
  }
  .grading-table th, .grading-table td {
    border: 1px solid #000;
    padding: 4px 8px;
    font-size: 16px;
    text-align: center;
  }
  .grading-table th {
    background: #f2f2f2;
    font-weight: bold;
  }
  /* ---------- Remarks ---------- */
  .remarks-heading {
    font-weight: bold;
    font-style: italic;
    font-size: 17px;
    margin: 0 0 8px 0;
  }
  .remarks-line {
    border-bottom: 1px solid #000;
    height: 20px;
    margin-bottom: 5px;
  }
  /* ---------- Signatures ---------- */
  .signatures {
    display: flex;
    justify-content: space-between;
    margin-top: 40px;
    text-align: center;
  }
  .signatures .sig {
    flex: 1;
  }
  .sig-line {
    border-bottom: 1px solid #000;
    width: 80%;
    margin: 0 auto 6px auto;
    height: 24px;
  }
  .sig-label {
    font-size: 15px;
    font-weight: bold;
  }
  .issue-date {
    text-align: center;
    font-style: italic;
    font-size: 12px;
    margin-top: 18px;
  }
  .bottom-spacer { flex: 1; }
</style>
</head>
<body>
<div class="print-toolbar">
  <span>📄 Result Card: ${esc(meta.class_name)} – ${esc(meta.section_name)} (${esc(meta.term_name)})</span>
  <button onclick="window.print()">🖨️ Print Card</button>
</div>
<div class="page-wrap">
  ${cardsHtml}
</div>
${autoPrint ? '<script>window.onload=function(){window.print();}<\/script>' : ''}
</body>
</html>`;
}

export default function ResultCardPage() {
  const { user } = useAuth();

  const [loadingContext, setLoadingContext] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [openingStudentId, setOpeningStudentId] = useState<number | null>(null);
  const [printing, setPrinting] = useState(false);

  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);

  const [activeYearName, setActiveYearName] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  const [students, setStudents] = useState<StudentListRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [msg, setMsg] = useState<{ type: 'success' | 'danger' | 'warning'; text: string } | null>(null);

  const canUsePage = !!user;

  const filteredSections = useMemo(() => {
    if (!selectedClass) return [];
    return sections.filter((s) => s.class_id === Number(selectedClass));
  }, [sections, selectedClass]);

  const ready = !!(selectedTerm && selectedClass && selectedSection && user?.id);

  const loadContext = async () => {
    if (!user?.id) {
      setLoadingContext(false);
      return;
    }
    setLoadingContext(true);
    setMsg(null);
    try {
      const d = await fetchJson(`${API}/exams/context?user_id=${user.id}`);
      setActiveYearName(d.active_year?.year_name || '');
      setTerms(d.terms || []);
      setClasses(d.classes || []);
      setSections(d.sections || []);

      const termList = d.terms || [];
      const classList = d.classes || [];

      setSelectedTerm((prev) => (prev && termList.some((t: Term) => String(t.id) === prev) ? prev : termList.length > 0 ? String(termList[0].id) : ''));
      setSelectedClass((prev) => (prev && classList.some((c: ClassItem) => String(c.class_id) === prev) ? prev : classList.length > 0 ? String(classList[0].class_id) : ''));
    } catch (e: any) {
      const errText = e.message || 'Failed to load context';
      setMsg({ type: 'danger', text: errText });
      showToast.error(errText);
    } finally {
      setLoadingContext(false);
    }
  };

  const loadStudents = async () => {
    if (!ready || !user?.id) return;
    setLoadingStudents(true);
    setMsg(null);
    try {
      const params = new URLSearchParams({
        user_id: String(user.id),
        term_id: selectedTerm,
        class_id: selectedClass,
        section_id: selectedSection
      });

      const d = await fetchJson(`${API}/exams/result-card/students?${params.toString()}`);
      setStudents(Array.isArray(d.students) ? d.students : []);
      setSelectedIds(new Set());
    } catch (e: any) {
      setStudents([]);
      setSelectedIds(new Set());
      const errText = e.message || 'Failed to load students';
      setMsg({ type: 'danger', text: errText });
      showToast.error(errText);
    } finally {
      setLoadingStudents(false);
    }
  };

  const fetchCards = async (studentIds: number[]): Promise<CardPayload> => {
    if (!user?.id || !ready) throw new Error('Please select term, class and section first');

    const d = await fetchJson(`${API}/exams/result-card/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        term_id: Number(selectedTerm),
        class_id: Number(selectedClass),
        section_id: Number(selectedSection),
        student_ids: studentIds
      })
    });

    return d as CardPayload;
  };

  const openInNewTab = (html: string) => {
    const win = window.open('', '_blank', 'width=1100,height=900');
    if (!win) {
      const txt = 'Popup blocked. Please allow popups for this site and try again.';
      setMsg({ type: 'danger', text: txt });
      showToast.warning(txt);
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  const openStudentCard = async (studentId: number) => {
    if (openingStudentId !== null) return;
    setOpeningStudentId(studentId);
    setMsg(null);
    try {
      const payload = await fetchCards([studentId]);
      if (!payload.students || payload.students.length === 0) {
        throw new Error('No result data found for this student');
      }
      openInNewTab(buildPrintHtml(payload, false));
      showToast.info('Result card opened');
    } catch (e: any) {
      const errText = e.message || 'Failed to open result card';
      setMsg({ type: 'danger', text: errText });
      showToast.error(errText);
    } finally {
      setOpeningStudentId(null);
    }
  };

  const handlePrintSelected = async () => {
    if (selectedIds.size === 0) {
      const txt = 'Select one or more students to print.';
      setMsg({ type: 'warning', text: txt });
      showToast.warning(txt);
      return;
    }

    setPrinting(true);
    setMsg(null);
    try {
      const payload = await fetchCards(Array.from(selectedIds));
      if (!payload.students || payload.students.length === 0) {
        throw new Error('No cards found for selected students');
      }
      openInNewTab(buildPrintHtml(payload, true));
      showToast.success(`Printing ${payload.students.length} result cards`);
    } catch (e: any) {
      const errText = e.message || 'Bulk print failed';
      setMsg({ type: 'danger', text: errText });
      showToast.error(errText);
    } finally {
      setPrinting(false);
    }
  };

  useEffect(() => {
    loadContext();
  }, [user?.id]);

  useEffect(() => {
    setSelectedSection('');
    setStudents([]);
    setSelectedIds(new Set());
  }, [selectedClass]);

  useEffect(() => {
    setStudents([]);
    setSelectedIds(new Set());
  }, [selectedTerm, selectedSection]);

  useEffect(() => {
    if (filteredSections.length === 1 && !selectedSection) {
      setSelectedSection(String(filteredSections[0].section_id));
    }
  }, [filteredSections, selectedSection]);

  useEffect(() => {
    if (ready) {
      loadStudents();
    }
  }, [ready, selectedTerm, selectedClass, selectedSection]);

  const filteredStudents = useMemo(() => {
    if (!searchKeyword.trim()) return students;
    const q = searchKeyword.toLowerCase().trim();
    return students.filter(s =>
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
      (s.roll_no || '').toLowerCase().includes(q) ||
      (s.admission_no || '').toLowerCase().includes(q)
    );
  }, [students, searchKeyword]);

  const allVisibleSelected = filteredStudents.length > 0 && filteredStudents.every((s) => selectedIds.has(s.student_id));

  if (!canUsePage) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger mb-0">You do not have permission to access Result Card.</div>
      </div>
    );
  }

  return (
    <div className="page-wrap" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh', padding: '1.5rem' }}>
      {/* Standard Theme Page Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="mb-1 fw-bold" style={{ color: 'var(--primary-dark)' }}>
            <i className="bi bi-file-earmark-text me-2" style={{ color: 'var(--accent-orange)' }} />
            Result Card
          </h4>
          <div className="text-muted small">Select term, class and section to open student result cards</div>
        </div>
        <span className="badge rounded-pill bg-light text-dark border">
          Academic Year: {activeYearName || '—'}
        </span>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type} alert-dismissible`} role="alert">
          {msg.text}
          <button type="button" className="btn-close" onClick={() => setMsg(null)} />
        </div>
      )}

      {/* Filters */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-bottom py-3" style={{ borderLeft: '4px solid var(--primary-teal)' }}>
          <h6 className="mb-0 fw-bold" style={{ color: 'var(--primary-dark)' }}>
            <i className="bi bi-funnel-fill me-2" style={{ color: 'var(--primary-teal)' }} />
            Result Card Filters
          </h6>
        </div>
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-sm-6 col-md-4">
              <label className="form-label fw-semibold small text-muted text-uppercase">Term</label>
              <select className="form-select rounded-3" value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} disabled={loadingContext}>
                <option value="">Select Term</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>{t.term_name}</option>
                ))}
              </select>
            </div>
            <div className="col-12 col-sm-6 col-md-4">
              <label className="form-label fw-semibold small text-muted text-uppercase">Class</label>
              <select className="form-select rounded-3" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} disabled={loadingContext}>
                <option value="">Select Class</option>
                {classes.map((c) => (
                  <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
                ))}
              </select>
            </div>
            <div className="col-12 col-sm-6 col-md-4">
              <label className="form-label fw-semibold small text-muted text-uppercase">Section</label>
              <select
                className="form-select rounded-3"
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                disabled={!selectedClass || loadingContext}
              >
                <option value="">Select Section</option>
                {filteredSections.map((s) => (
                  <option key={s.section_id} value={s.section_id}>{s.section_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Students Table Card */}
      {ready && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2 py-3" style={{ borderLeft: '4px solid var(--accent-orange)' }}>
            <div className="d-flex align-items-center gap-2">
              <span className="fw-semibold" style={{ color: 'var(--primary-dark)' }}>
                Students ({filteredStudents.length})
              </span>
              <span className="badge bg-light text-primary border" style={{ fontSize: 11 }}>
                {selectedIds.size} Selected
              </span>
            </div>

            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div className="input-group input-group-sm" style={{ width: 180 }}>
                <span className="input-group-text bg-light border-0"><i className="bi bi-search text-muted"></i></span>
                <input type="text" className="form-control border-0 bg-light" placeholder="Search..."
                  value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} />
              </div>

              <button className="btn btn-outline-primary btn-sm fw-bold px-3" onClick={handlePrintSelected} disabled={printing || selectedIds.size === 0 || students.length === 0}>
                {printing ? 'Printing...' : <><i className="bi bi-printer me-1"></i>Print Selected ({selectedIds.size})</>}
              </button>

              {filteredStudents.length > 0 && (
                <div className="form-check mb-0 ms-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="selectAllStudents"
                    checked={allVisibleSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(new Set(filteredStudents.map((s) => s.student_id)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                  />
                  <label htmlFor="selectAllStudents" className="form-check-label small fw-semibold" style={{ cursor: 'pointer' }}>Select All</label>
                </div>
              )}
            </div>
          </div>

          <div className="card-body p-0">
            {loadingStudents ? (
              <div className="text-center p-5">
                <div className="spinner-border text-teal" role="status" style={{ color: 'var(--primary-teal)' }}></div>
                <p className="text-muted mt-2 small fw-semibold">Loading student list...</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center p-5 text-muted">
                {students.length === 0 ? 'No active students found for selected filters.' : 'No student matching search query.'}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead style={{ background: 'var(--primary-dark)', color: '#fff' }}>
                    <tr>
                      <th style={{ width: 50 }} className="text-center">Select</th>
                      <th>Student</th>
                      <th style={{ width: 90 }}>Roll No</th>
                      <th style={{ width: 80 }} className="text-center">Subjects</th>
                      <th style={{ width: 90 }} className="text-center">Position</th>
                      <th style={{ width: 80 }} className="text-center">%</th>
                      <th style={{ width: 60 }} className="text-center">Grade</th>
                      <th style={{ width: 90 }} className="text-end pe-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s) => {
                      const checked = selectedIds.has(s.student_id);
                      const isOpening = openingStudentId === s.student_id;
                      return (
                        <tr
                          key={s.student_id}
                          style={{ cursor: openingStudentId !== null ? 'wait' : 'pointer' }}
                          onClick={() => openStudentCard(s.student_id)}
                        >
                          <td className="text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={checked}
                              disabled={openingStudentId !== null}
                              onChange={(e) => {
                                setSelectedIds((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(s.student_id);
                                  else next.delete(s.student_id);
                                  return next;
                                });
                              }}
                            />
                          </td>
                          <td>
                            <div className="fw-semibold d-flex align-items-center gap-2">
                              {s.first_name} {s.last_name}
                              {isOpening && <span className="spinner-border spinner-border-sm text-secondary" />}
                            </div>
                            <div className="small text-muted">Father: {s.father_name || '—'} | Adm: {s.admission_no || '—'}</div>
                          </td>
                          <td>{s.roll_no || '—'}</td>
                          <td className="text-center">
                            <span className={`badge ${s.marked_subjects > 0 ? 'bg-success-subtle text-success-emphasis border border-success-subtle' : 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'}`}>
                              {s.marked_subjects}
                            </span>
                          </td>
                          <td className="text-center">
                            {s.ordinal_position
                              ? <span className="badge fw-bold" style={{ backgroundColor: 'var(--primary-teal)', color: '#fff', fontSize: '0.82rem' }}>{s.ordinal_position}</span>
                              : <span className="text-muted small">—</span>}
                          </td>
                          <td className="text-center">
                            {s.percentage !== null ? `${s.percentage}%` : '—'}
                          </td>
                          <td className="text-center">
                            {s.grade
                              ? <span className={`badge ${s.grade === 'F' ? 'bg-danger' : s.grade === 'A+' ? 'bg-success' : 'bg-primary'}`}>{s.grade}</span>
                              : <span className="text-muted small">—</span>}
                          </td>
                          <td className="text-end pe-4" onClick={(e) => e.stopPropagation()}>
                            <button className="btn btn-sm btn-light border text-primary fw-semibold" onClick={() => openStudentCard(s.student_id)}>
                              <i className="bi bi-printer me-1"></i>Card
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
