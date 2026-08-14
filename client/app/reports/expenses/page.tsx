'use client';
import { useState, useEffect, useRef } from 'react';

type Category = { category_id: number; category_name: string };
type Expense = {
    expense_id: number; expense_title: string; amount: number;
    expense_date: string; payment_method: string; paid_to: string;
    status: string; category_name: string;
};
type CategorySummary = { category: string; total: number };

export default function ExpenseReportPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [categorySummary, setCategorySummary] = useState<CategorySummary[]>([]);
    const [grandTotal, setGrandTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Default: current month
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        setFromDate(`${y}-${m}-01`);
        setToDate(`${y}-${m}-${new Date(y, now.getMonth() + 1, 0).getDate()}`);
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/reports/expense-categories`).then(r => r.json()).then(setCategories).catch(console.error);
    }, []);

    const loadReport = async () => {
        setLoading(true); setError('');
        try {
            const params = new URLSearchParams();
            if (fromDate) params.append('from_date', fromDate);
            if (toDate) params.append('to_date', toDate);
            if (categoryId) params.append('category_id', categoryId);
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/reports/expenses?${params}`);
            if (!res.ok) throw new Error((await res.json()).error || 'Failed');
            const data = await res.json();
            setExpenses(data.expenses.map((e: Expense) => ({ ...e, amount: Number(e.amount) })));
            setCategorySummary(data.categorySummary.map((c: CategorySummary) => ({ ...c, total: Number(c.total) })));
            setGrandTotal(Number(data.grandTotal));
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    };

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`<html><head><title>Expense Report</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
                h2 { text-align: center; margin-bottom: 4px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
                th { background: #233D4D; color: white; padding: 7px 8px; text-align: left; font-size: 11px; }
                td { padding: 6px 8px; border-bottom: 1px solid #e0e0e0; font-size: 11px; }
                tr:nth-child(even) { background: #f9f9f9; }
                .summary-section { margin-top: 20px; }
                .grand-total { font-size: 15px; font-weight: bold; text-align: right; margin-top: 8px; }
                @media print { body { margin: 10px; } }
            </style></head><body>${content.innerHTML}</body></html>`);
        win.document.close(); win.focus();
        setTimeout(() => { win.print(); win.close(); }, 400);
    };

    return (
        <div className="p-3 p-md-4" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>
            <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-4">
                <div>
                    <h4 className="mb-1 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-cash-stack me-2" style={{ color: 'var(--accent-orange)' }} />
                        Expense Report
                    </h4>
                    <div className="text-muted small">Category wise expense summary</div>
                </div>
            </div>

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-white border-bottom py-3" style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                    <h6 className="mb-0 fw-bold"><i className="bi bi-funnel me-2 text-muted" />Filters</h6>
                </div>
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-12 col-sm-6 col-md-2">
                            <label className="form-label fw-semibold small mb-1">From Date</label>
                            <input type="date" className="form-control form-control-sm" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                        </div>
                        <div className="col-12 col-sm-6 col-md-2">
                            <label className="form-label fw-semibold small mb-1">To Date</label>
                            <input type="date" className="form-control form-control-sm" value={toDate} onChange={e => setToDate(e.target.value)} />
                        </div>
                        <div className="col-12 col-sm-6 col-md-3">
                            <label className="form-label fw-semibold small mb-1">Category</label>
                            <select className="form-select form-select-sm" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                                <option value="">All Categories</option>
                                {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-md-3 d-flex gap-2">
                            <button className="btn btn-sm fw-bold px-4 flex-grow-1" style={{ background: 'var(--primary-teal)', color: '#fff', height: 34 }} onClick={loadReport} disabled={loading}>
                                {loading ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-search me-2" />}
                                Generate
                            </button>
                            {expenses.length > 0 && (
                                <button className="btn btn-outline-secondary btn-sm fw-bold px-3" onClick={handlePrint}>
                                    <i className="bi bi-printer" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {expenses.length > 0 && (
                <div ref={printRef}>
                    <h2 style={{ textAlign: 'center', padding: '16px 0 4px', color: '#233D4D', display: 'none' }}>Expense Report</h2>

                    <div className="row g-3 g-md-4 mb-4">
                        {/* Category Summary */}
                        <div className="col-12 col-md-4">
                            <div className="card border-0 shadow-sm h-100">
                                <div className="card-header bg-white border-bottom py-3" style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                                    <h6 className="mb-0 fw-bold">Category Summary</h6>
                                </div>
                                <div className="card-body p-0">
                                    <div className="table-responsive">
                                        <table className="table mb-0" style={{ fontSize: 13 }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ background: '#233D4D', color: 'white', padding: '8px 12px' }}>Category</th>
                                                    <th style={{ background: '#233D4D', color: 'white', padding: '8px 12px', textAlign: 'right' }}>Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {categorySummary.map(c => (
                                                    <tr key={c.category}>
                                                        <td style={{ padding: '8px 12px' }}>{c.category}</td>
                                                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>Rs. {c.total.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr style={{ background: '#f0f4f8' }}>
                                                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>Grand Total</td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#dc3545' }}>
                                                        Rs. {grandTotal.toLocaleString()}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Expense Detail */}
                        <div className="col-12 col-md-8">
                            <div className="card border-0 shadow-sm">
                                <div className="card-header bg-white border-bottom py-3" style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                                    <h6 className="mb-0 fw-bold">Expense Detail {expenses.length} records</h6>
                                </div>
                                <div className="card-body p-0">
                                    <div className="table-responsive">
                                        <table className="table table-hover mb-0" style={{ fontSize: 13 }}>
                                            <thead>
                                                <tr>
                                                    {['#', 'Date', 'Title', 'Category', 'Paid To', 'Payment', 'Amount', 'Status'].map(h => (
                                                        <th key={h} style={{ background: '#233D4D', color: 'white', padding: '10px 12px', whiteSpace: 'nowrap' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {expenses.map((e, i) => (
                                                    <tr key={e.expense_id}>
                                                        <td className="text-muted small">{i + 1}</td>
                                                        <td>{new Date(e.expense_date).toLocaleDateString('en-PK')}</td>
                                                        <td className="fw-semibold">{e.expense_title}</td>
                                                        <td>{e.category_name || '-'}</td>
                                                        <td>{e.paid_to || '-'}</td>
                                                        <td>{e.payment_method || '-'}</td>
                                                        <td className="fw-semibold">Rs. {e.amount.toLocaleString()}</td>
                                                        <td>
                                                            <span className={`badge ${e.status === 'approved' ? 'bg-success' : e.status === 'pending' ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                                                                {e.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!loading && expenses.length === 0 && (
                <div className="card border-0 shadow-sm">
                    <div className="card-body text-center py-5 text-muted">
                        <i className="bi bi-cash-stack fs-1 d-block mb-2" />
                        Select date range and click "Generate Report"
                    </div>
                </div>
            )}
        </div>
    );
}
