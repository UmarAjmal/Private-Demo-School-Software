'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastHelper';

type AcademicYear = {
    id: number;
    year_name: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
    status: string;
    is_configured: boolean;
};

type Term = {
    term_name: string;
    has_summer_work: boolean;
    has_winter_work: boolean;
};

export default function AcademicSetup() {
    const [years, setYears] = useState<AcademicYear[]>([]);
    const [selectedYear, setSelectedYear] = useState<AcademicYear | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { hasPermission } = useAuth();
    const [fetchError, setFetchError] = useState<string | null>(null);

    // Form States
    const [activationData, setActivationData] = useState({ start_date: '', end_date: '' });
    const [saveError, setSaveError] = useState<string | null>(null);
    const [terms, setTerms] = useState<Term[]>([
        { term_name: 'First Term', has_summer_work: false, has_winter_work: false },
        { term_name: 'Final Term', has_summer_work: false, has_winter_work: false }
    ]);
    const [mode, setMode] = useState<'view' | 'configure' | 'activate' | 'terms'>('view');

    // Helper: Validate Dates based on Year Name (e.g., "2025-2026")
    const getMinMaxDates = (yearName: string | undefined) => {
        if (!yearName) return { minStart: '', maxStart: '' };
        const startYear = parseInt(yearName.split('-')[0]);
        return {
            minStart: `${startYear}-01-01`,
            maxStart: `${startYear}-12-31`
        };
    };

    // Bug 3 Fix: Timezone-safe date display DB returns UTC ISO string,
    // but user entered local (PKT) date. Convert back to local before display.
    const formatDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone
    };

    // Fetch Years
    useEffect(() => {
        fetchYears();
    }, []);

    // Fetch Terms when Selected Year Changes
    useEffect(() => {
        if (selectedYear) {
            fetchTerms(selectedYear.id);
        }
    }, [selectedYear]);

    const fetchTerms = async (yearId: number) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/terms/${yearId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.length > 0) {
                    setTerms(data);
                } else {
                    // Default terms only for configuring new/upcoming years
                    setTerms([
                        { term_name: 'First Term', has_summer_work: false, has_winter_work: false },
                        { term_name: 'Final Term', has_summer_work: false, has_winter_work: false }
                    ]);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchYears = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/years`);
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            const data = await res.json();
            setYears(data);

            // Auto Select Active
            const active = data.find((y: AcademicYear) => y.is_active);
            if (active) setSelectedYear(active);
            else if (data.length > 0) setSelectedYear(data[0]);

            setLoading(false);
        } catch (err: any) {
            // Bug 1 Fix: always stop spinner + show error message on failure
            console.error(err);
            setFetchError('Could not connect to server. Please ensure the server is running.');
            setLoading(false);
        }
    };

    const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const yearId = parseInt(e.target.value);
        const year = years.find(y => y.id === yearId) || null;
        setSelectedYear(year);

        // Reset terms to defaults when switching years if not loaded
        //Ideally we would fetch terms for this year if it's already configured
        setMode('view');
    };

    const handleConfigure = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedYear) return;
        setSaving(true);
        setSaveError(null);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/years/configure/${selectedYear.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(activationData)
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                setSaveError(errData.error || `Configuration failed (${res.status})`);
                return;
            }
            showToast.success('Year configured successfully! Now you can setup terms and promote students.');
            await fetchYears();
            setMode('terms');
        } catch (err) {
            console.error(err);
            setSaveError('Network error. Could not configure year.');
        } finally {
            setSaving(false);
        }
    };

    const handleActivate = async () => {
        if (!selectedYear) return;
        if (!selectedYear.is_configured) {
            setSaveError('Please configure the year dates and terms first before activation.');
            return;
        }

        if (!confirm(`Activate ${selectedYear.year_name}? This will close the current active year and make this year active.`)) {
            return;
        }

        setSaving(true);
        setSaveError(null);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/years/activate/${selectedYear.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                setSaveError(errData.error || `Activation failed (${res.status})`);
                return;
            }
            showToast.success('Academic year activated successfully!');
            await fetchYears();
            setMode('view');
        } catch (err) {
            console.error(err);
            setSaveError('Network error. Could not activate year.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveTerms = async () => {
        if (!selectedYear) return;
        setSaving(true);
        setSaveError(null);
        try {
            // Bug 2 Fix: check res.ok server returns 403 for completed years
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/academic/terms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ academic_year_id: selectedYear.id, terms })
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                setSaveError(errData.error || `Save failed (${res.status}). Please try again.`);
                return;
            }
            setSaveError(null);
            showToast.success('Terms saved successfully!');
            setMode('view');
        } catch (err: any) {
            console.error(err);
            setSaveError('Network error. Could not save terms.');
        } finally {
            setSaving(false);
        }
    };

    const addTerm = () => setTerms([...terms, { term_name: '', has_summer_work: false, has_winter_work: false }]);
    const updateTerm = (index: number, field: keyof Term, value: any) => {
        const newTerms = [...terms];
        (newTerms[index] as any)[field] = value;
        setTerms(newTerms);
    };

    // Bug 1 Fix: show error when server unreachable instead of infinite spinner
    if (loading) return <div className="spinner-center">Loading...</div>;
    if (fetchError) return (
        <div className="container-fluid settings-page-wrap">
            <div className="alert alert-danger d-flex align-items-center gap-3" role="alert">
                <i className="bi bi-exclamation-triangle-fill fs-4"></i>
                <div>
                    <strong>Connection Error</strong><br />
                    <span className="small">{fetchError}</span>
                </div>
                <button className="btn btn-sm btn-outline-danger ms-auto" onClick={() => { setFetchError(null); setLoading(true); fetchYears(); }}>Retry</button>
            </div>
        </div>
    );

    const { minStart, maxStart } = getMinMaxDates(selectedYear?.year_name);

    return (
        <div className="container-fluid settings-page-wrap animate__animated animate__fadeIn">
            <div className="text-center mb-5 pb-3 border-bottom border-primary-subtle">
                <h2 className="display-6 fw-bold text-primary-dark">Academic Calendar</h2>
                <p className="text-muted">Configure session dates, terms, and exams schedule.</p>
            </div>

            {/* Main Configuration Card */}
            <div className="card card-custom p-4">

                {/* 1. Header & Selector */}
                <div className="row align-items-end mb-4">
                    <div className="col-12 col-md-8">
                        <label className="form-label fw-bold text-primary-teal">
                            Select Academic Year
                        </label>
                        <select
                            className="form-select form-select-lg"
                            value={selectedYear?.id || ''}
                            onChange={handleYearChange}
                        >
                            {/* Bug 6 Fix: filter to relevant years only completed/active + upcoming within next 5 years */}
                            {years
                                .filter(y => {
                                    if (y.status !== 'upcoming') return true; // always show active/completed
                                    const startYear = parseInt(y.year_name.split('-')[0]);
                                    return startYear <= new Date().getFullYear() + 5;
                                })
                                .map(year => (
                                    <option key={year.id} value={year.id}>
                                        {year.year_name} {year.is_active ? '(Active)' : ''}
                                    </option>
                                ))}
                        </select>
                    </div>

                    {selectedYear && (
                        <div className="col-12 col-md-4 text-md-end mt-3 mt-md-0">
                            <div className={`badge rounded-pill px-3 py-2 ${selectedYear.is_active ? 'bg-success' : 'bg-secondary'}`}>
                                {selectedYear.status.toUpperCase()}
                            </div>
                        </div>
                    )}
                </div>

                {selectedYear ? (
                    <>
                        {/* 2. Action Area */}
                        {mode === 'view' && (
                            <div className="bg-light p-4 rounded border">
                                {saveError && (
                                    <div className="alert alert-danger d-flex align-items-center mb-4 animate__animated animate__shakeX">
                                        <i className="bi bi-exclamation-triangle-fill fs-5 me-2"></i>
                                        <div className="text-start flex-grow-1">{saveError}</div>
                                        <button type="button" className="btn-close" onClick={() => setSaveError(null)} aria-label="Close"></button>
                                    </div>
                                )}
                                {selectedYear.status === 'active' && (
                                    <div className="text-center text-md-start">
                                        <div className="d-flex align-items-center mb-3">
                                            <i className="bi bi-check-circle-fill text-success fs-4 me-2"></i>
                                            <h4 className="mb-0 text-success">Active Session: {selectedYear.year_name}</h4>
                                        </div>
                                        <div className="row g-3">
                                            <div className="col-6">
                                                <small className="text-muted d-block uppercase fw-bold">Start Date</small>
                                                {/* Bug 3 Fix: use formatDate() for timezone-safe display */}
                                                <span className="fs-5">{formatDate(selectedYear.start_date)}</span>
                                            </div>
                                            <div className="col-6">
                                                <small className="text-muted d-block uppercase fw-bold">End Date</small>
                                                <span className="fs-5">{formatDate(selectedYear.end_date)}</span>
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-3 border-top">
                                            <button className="btn btn-secondary-custom" onClick={() => setMode('terms')}>
                                                <i className="bi bi-calendar3 me-2"></i>Manage Terms & Exams
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Bug 4 Fix: removed 'ongoing' server never sets that status */}
                                {selectedYear.status === 'upcoming' && !selectedYear.is_configured && (
                                    <div className="text-center py-4">
                                        <p className="lead text-muted mb-4">
                                            This academic year is upcoming and not configured.
                                        </p>
                                        {hasPermission('settings', 'write') && (
                                            <button className="btn btn-primary-custom btn-lg mb-3" onClick={() => setMode('configure')}>
                                                <i className="bi bi-gear me-2"></i>Configure Year ({selectedYear.year_name})
                                            </button>
                                        )}
                                        <p className="small text-muted mt-3">Configure dates and terms to enable student promotion without activating the year</p>
                                    </div>
                                )}

                                {selectedYear.status === 'upcoming' && selectedYear.is_configured && (
                                    <div className="text-center py-4">
                                        <div className="alert alert-success mb-4">
                                            <i className="bi bi-check-circle-fill me-2"></i>
                                            Year configured and ready for promotion
                                        </div>
                                        <div className="row g-3 mb-4">
                                            <div className="col-6">
                                                <small className="text-muted d-block uppercase fw-bold">Start Date</small>
                                                <span className="fs-5">{formatDate(selectedYear.start_date)}</span>
                                            </div>
                                            <div className="col-6">
                                                <small className="text-muted d-block uppercase fw-bold">End Date</small>
                                                <span className="fs-5">{formatDate(selectedYear.end_date)}</span>
                                            </div>
                                        </div>
                                        <div className="d-flex gap-2 justify-content-center">
                                            {hasPermission('settings', 'write') && (
                                                <button className="btn btn-success btn-lg" onClick={handleActivate}>
                                                    <i className="bi bi-play-circle me-2"></i>Activate Year Now
                                                </button>
                                            )}
                                            <button className="btn btn-secondary-custom" onClick={() => setMode('terms')}>
                                                <i className="bi bi-calendar3 me-2"></i>Manage Terms
                                            </button>
                                        </div>
                                        <p className="small text-muted mt-3">You can promote students before activating</p>
                                    </div>
                                )}

                                {selectedYear.status === 'completed' && (
                                    <>
                                        <div className="d-flex align-items-center mb-3 text-warning-emphasis">
                                            <i className="bi bi-lock-fill fs-4 me-2"></i>
                                            <h4 className="mb-0">Past Session: {selectedYear.year_name} (Completed)</h4>
                                        </div>
                                        <div className="row g-3 mb-4">
                                            <div className="col-6"><strong>Start:</strong> {formatDate(selectedYear.start_date)}</div>
                                            <div className="col-6"><strong>End:</strong> {formatDate(selectedYear.end_date)}</div>
                                        </div>

                                        <h5 className="border-bottom pb-2 mb-3">Historical Term Record</h5>
                                        <div className="list-group">
                                            {terms.length > 0 ? terms.map((t, idx) => (
                                                <div key={idx} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                                                    <div>
                                                        <strong>{t.term_name}</strong>
                                                        <div className="small text-muted mt-1">
                                                            {!t.has_summer_work && !t.has_winter_work && <span>Standard Term</span>}
                                                            {t.has_summer_work && <span className="badge bg-warning text-dark me-1">☀️ Summer Work</span>}
                                                            {t.has_winter_work && <span className="badge bg-info text-dark">❄️ Winter Work</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            )) : <p className="text-muted fst-italic">No term records found.</p>}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* 3. Configuration Form */}
                        {mode === 'configure' && (
                            <form onSubmit={handleConfigure} className="animate__animated animate__fadeInRight">
                                <div className="d-flex align-items-center border-bottom pb-3 mb-4">
                                    <h3 className="h5 mb-0 text-primary-dark">Configure {selectedYear.year_name} Session</h3>
                                </div>

                                <div className="row g-3">
                                    <div className="col-12 col-md-6">
                                        <label className="form-label">Session Start Date</label>
                                        <div className="form-text mb-1">Must be in {selectedYear.year_name.split('-')[0]}</div>
                                        <input
                                            type="date" className="form-control" required
                                            min={minStart} max={maxStart}
                                            onChange={e => setActivationData({ ...activationData, start_date: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-12 col-md-6">
                                        <label className="form-label">Session End Date</label>
                                        <div className="form-text mb-1 text-transparent">End Date</div>
                                        <input type="date" className="form-control" required
                                            min={activationData.start_date}
                                            onChange={e => setActivationData({ ...activationData, end_date: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="alert alert-info mt-4 d-flex align-items-center">
                                    <i className="bi bi-info-circle-fill me-2 fs-5"></i>
                                    <div>Configuring this year will allow you to promote students to it without making it active yet.</div>
                                </div>

                                {saveError && (
                                    <div className="alert alert-danger d-flex align-items-center gap-2 py-2 mt-3">
                                        <i className="bi bi-exclamation-triangle-fill"></i>
                                        {saveError}
                                    </div>
                                )}

                                <div className="d-flex justify-content-end gap-2 mt-4 flex-wrap">
                                    <button type="button" className="btn btn-light" onClick={() => setMode('view')}>Cancel</button>
                                    {hasPermission('settings', 'write') && (
                                        <button type="submit" className="btn btn-primary-custom" disabled={saving}>
                                            {saving ? 'Configuring...' : 'Save Configuration'}
                                        </button>
                                    )}
                                </div>
                            </form>
                        )}

                        {/* 4. Terms Configuration */}
                        {mode === 'terms' && (
                            <div className="animate__animated animate__fadeInRight">
                                <h3 className="h5 mb-4 text-primary-dark">Configure Terms for {selectedYear.year_name}</h3>

                                {terms.map((term, idx) => (
                                    <div key={idx} className="card mb-3 border-light shadow-sm bg-body-tertiary">
                                        <div className="card-body">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <h5 className="h6 mb-0 text-primary-teal fw-bold">Term {idx + 1}</h5>
                                                {idx > 1 && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => {
                                                    const newTerms = terms.filter((_, i) => i !== idx);
                                                    setTerms(newTerms);
                                                }}>Remove</button>}
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label">Term Name</label>
                                                <input
                                                    type="text" className="form-control" placeholder="e.g. First Term"
                                                    value={term.term_name}
                                                    onChange={e => updateTerm(idx, 'term_name', e.target.value)}
                                                />
                                            </div>

                                            <div className="bg-white p-3 rounded border">
                                                <label className="form-label small text-uppercase fw-bold text-muted mb-2">Vacation Work & Exams</label>
                                                <div className="d-flex gap-3">
                                                    <div className="form-check">
                                                        <input
                                                            className="form-check-input" type="checkbox" id={`summer-${idx}`}
                                                            checked={term.has_summer_work}
                                                            onChange={e => updateTerm(idx, 'has_summer_work', e.target.checked)}
                                                        />
                                                        <label className="form-check-label" htmlFor={`summer-${idx}`}>Include Summer Work</label>
                                                    </div>
                                                    <div className="form-check">
                                                        <input
                                                            className="form-check-input" type="checkbox" id={`winter-${idx}`}
                                                            checked={term.has_winter_work}
                                                            onChange={e => updateTerm(idx, 'has_winter_work', e.target.checked)}
                                                        />
                                                        <label className="form-check-label" htmlFor={`winter-${idx}`}>Include Winter Work</label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <button className="btn btn-outline-secondary w-100 dashed-border mb-4" onClick={addTerm}>
                                    <i className="bi bi-plus-circle me-2"></i>Add Another Term
                                </button>

                                {/* Bug 2 Fix: show server error inline instead of silent fail */}
                                {saveError && (
                                    <div className="alert alert-danger d-flex align-items-center gap-2 py-2">
                                        <i className="bi bi-exclamation-triangle-fill"></i>
                                        {saveError}
                                    </div>
                                )}
                                <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top flex-wrap">
                                    <button className="btn btn-light" onClick={() => setMode('view')}>Back</button>
                                    {hasPermission('settings', 'write') && (
                                        <button className="btn btn-primary-custom" onClick={handleSaveTerms} disabled={saving}>
                                            {saving ? 'Saving...' : 'Save Configuration'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-5">
                        <div className="spinner-border text-secondary" role="status" style={{ display: loading ? 'block' : 'none', margin: '0 auto' }}></div>
                        {!loading && <p className="text-muted">Please select an academic year to manage.</p>}
                    </div>
                )}
            </div>
        </div>
    );
}
