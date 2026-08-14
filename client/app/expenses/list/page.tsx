'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface Category {
    category_id: number;
    category_name: string;
}

interface Expense {
    expense_id: number;
    expense_date: string;
    expense_title: string;
    category_name: string;
    amount: number;
    paid_to?: string;
    description?: string;
    payment_method?: string;
}

interface Summary {
    total_expenses: number;
    total_amount: number;
}

interface Filters {
    category_id: string;
    from_date: string;
    to_date: string;
    search: string;
}

export default function ExpenseListPage() {
    const router = useRouter();
    const { hasPermission } = useAuth();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [summary, setSummary] = useState<Summary>({
        total_expenses: 0,
        total_amount: 0
    });
    const [filters, setFilters] = useState<Filters>({
        category_id: '',
        from_date: '',
        to_date: '',
        search: ''
    });
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0
    });
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        fetchExpenses();
        fetchSummary();
    }, [filters, pagination.page]);

    const fetchCategories = async () => {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/expense-categories/active`);
            const data = await response.json();
            setCategories(data);
        } catch (err) {
            console.error('Failed to fetch categories');
        }
    };

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('page', pagination.page.toString());
            params.append('limit', pagination.limit.toString());

            Object.keys(filters).forEach(key => {
                const value = filters[key as keyof Filters];
                if (value) params.append(key, value);
            });

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/expenses?${params}`);
            const data = await response.json();

            setExpenses(data.expenses);
            setPagination(prev => ({
                ...prev,
                total: data.total,
                totalPages: data.totalPages
            }));
        } catch (err) {
            console.error('Failed to fetch expenses');
        } finally {
            setLoading(false);
        }
    };

    const fetchSummary = async () => {
        try {
            const params = new URLSearchParams();
            Object.keys(filters).forEach(key => {
                const value = filters[key as keyof Filters];
                if (value) params.append(key, value);
            });
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/expenses/stats/summary?${params}`);
            const data = await response.json();
            setSummary(data);
        } catch (err) {
            console.error('Failed to fetch summary');
        }
    };

    const handleFilterChange = (field: keyof Filters, value: string) => {
        setFilters(prev => ({ ...prev, [field]: value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this expense?')) return;

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/expenses/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchExpenses();
                fetchSummary();
            } else {
                alert('Failed to delete expense');
            }
        } catch (err) {
            console.error('Error deleting expense:', err);
            alert('Error deleting expense');
        }
    };

    const handleView = (expense: Expense) => {
        setSelectedExpense(expense);
        setShowViewModal(true);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-PK', {
            style: 'currency',
            currency: 'PKR'
        }).format(amount);
    };

    return (
        <div className="container-fluid p-4 animate__animated animate__fadeIn">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="fw-bold" style={{ color: 'var(--primary-dark)' }}>
                    <i className="bi bi-wallet2 me-2"></i> Expense Management
                </h2>
                {hasPermission('expenses', 'write') && (
                    <button
                        className="btn btn-primary-custom shadow-sm d-flex align-items-center gap-2"
                        onClick={() => router.push('/expenses/add')}
                    >
                        <i className="bi bi-plus-lg"></i> Add New Expense
                    </button>
                )}
            </div>

            {/* Summary Cards */}
            <div className="row g-3 mb-4">
                <div className="col-md-6">
                    <div className="card shadow-sm border-0 h-100 animate__animated animate__fadeInUp" style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                        <div className="card-body">
                            <h6 className="text-muted text-uppercase small fw-bold">Total Expenses Count</h6>
                            <h3 className="mb-0 fw-bold" style={{ color: 'var(--primary-teal)' }}>{summary?.total_expenses || 0}</h3>
                        </div>
                    </div>
                </div>
                <div className="col-md-6">
                    <div className="card shadow-sm border-0 h-100 animate__animated animate__fadeInUp" style={{ animationDelay: '0.1s', borderLeft: '4px solid var(--primary-dark)' }}>
                        <div className="card-body">
                            <h6 className="text-muted text-uppercase small fw-bold">Total Amount Spent</h6>
                            <h3 className="mb-0 fw-bold" style={{ color: 'var(--primary-dark)' }}>{formatCurrency(summary?.total_amount || 0)}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="card shadow-sm mb-4 border-0 animate__animated animate__fadeInUp" style={{ animationDelay: '0.2s' }}>
                <div className="card-body bg-white rounded">
                    <div className="row g-3">
                        <div className="col-md-4">
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0"><i className="bi bi-search"></i></span>
                                <input
                                    type="text"
                                    className="form-control border-start-0 ps-0"
                                    placeholder="Search by title..."
                                    value={filters.search}
                                    onChange={(e) => handleFilterChange('search', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="col-md-3">
                            <select
                                className="form-select"
                                value={filters.category_id}
                                onChange={(e) => handleFilterChange('category_id', e.target.value)}
                            >
                                <option value="">All Categories</option>
                                {categories.map(cat => (
                                    <option key={cat.category_id} value={cat.category_id}>
                                        {cat.category_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <input type="date" className="form-control" value={filters.from_date} onChange={e => handleFilterChange('from_date', e.target.value)} />
                        </div>
                        <div className="col-md-2">
                            <input type="date" className="form-control" value={filters.to_date} onChange={e => handleFilterChange('to_date', e.target.value)} />
                        </div>
                        <div className="col-md-1 d-grid">
                            <button className="btn btn-secondary-custom" onClick={() => setFilters({ category_id: '', from_date: '', to_date: '', search: '' })}>
                                <i className="bi bi-arrow-counterclockwise"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Expenses Table */}
            <div className="card shadow-sm border-0 animate__animated animate__fadeInUp" style={{ animationDelay: '0.3s' }}>
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="bg-light">
                                <tr>
                                    <th className="ps-4 py-3 text-secondary">Date</th>
                                    <th className="py-3 text-secondary">Title & Category</th>
                                    <th className="py-3 text-secondary">Details</th>
                                    <th className="py-3 text-secondary">Amount</th>
                                    <th className="pe-4 py-3 text-end text-secondary">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-5">
                                            <div className="spinner-border text-primary" role="status">
                                                <span className="visually-hidden">Loading...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : expenses.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-5 text-muted">
                                            <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                                            No expenses found
                                        </td>
                                    </tr>
                                ) : (
                                    expenses.map((expense) => (
                                        <tr key={expense.expense_id} style={{ transition: 'all 0.2s' }}>
                                            <td className="ps-4 fw-medium text-nowrap">
                                                <i className="bi bi-calendar3 me-2 text-muted"></i>
                                                {new Date(expense.expense_date).toLocaleDateString()}
                                            </td>
                                            <td>
                                                <div className="fw-bold text-dark">{expense.expense_title}</div>
                                                <span className="badge bg-light text-secondary border rounded-pill mt-1">
                                                    {expense.category_name}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="small text-muted">
                                                    {expense.paid_to && <div><i className="bi bi-person me-1"></i> {expense.paid_to}</div>}
                                                    {expense.payment_method && <div><i className="bi bi-credit-card me-1"></i> {expense.payment_method}</div>}
                                                </div>
                                            </td>
                                            <td className="fw-bold" style={{ color: 'var(--primary-dark)' }}>
                                                {formatCurrency(expense.amount)}
                                            </td>
                                            <td className="pe-4 text-end">
                                                <div className="btn-group">
                                                    <button
                                                        className="btn btn-sm btn-light text-primary"
                                                        title="View"
                                                        onClick={() => handleView(expense)}
                                                    >
                                                        <i className="bi bi-eye"></i>
                                                    </button>
                                                    {hasPermission('expenses', 'write') && (
                                                        <button
                                                            className="btn btn-sm btn-light text-warning"
                                                            title="Edit"
                                                            onClick={() => router.push(`/expenses/edit/${expense.expense_id}`)}
                                                        >
                                                            <i className="bi bi-pencil"></i>
                                                        </button>
                                                    )}
                                                    {hasPermission('expenses', 'delete') && (
                                                        <button
                                                            className="btn btn-sm btn-light text-danger"
                                                            title="Delete"
                                                            onClick={() => handleDelete(expense.expense_id)}
                                                        >
                                                            <i className="bi bi-trash"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination */}
                <div className="card-footer bg-white py-3 border-top-0 d-flex justify-content-between align-items-center">
                    <span className="text-muted small">
                        Showing {expenses.length} of {pagination.total} entries
                    </span>
                    <nav aria-label="Page navigation">
                        <ul className="pagination pagination-sm mb-0">
                            <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
                                <button className="page-link border-0 text-dark" onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}>
                                    <i className="bi bi-chevron-left"></i>
                                </button>
                            </li>
                            <li className="page-item active">
                                <span className="page-link border-0" style={{ backgroundColor: 'var(--primary-teal)' }}>
                                    {pagination.page}
                                </span>
                            </li>
                            <li className={`page-item ${pagination.page >= pagination.totalPages ? 'disabled' : ''}`}>
                                <button className="page-link border-0 text-dark" onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>
                                    <i className="bi bi-chevron-right"></i>
                                </button>
                            </li>
                        </ul>
                    </nav>
                </div>
            </div>

            {/* View Modal */}
            {showViewModal && selectedExpense && (
                <>
                    <div className="modal-backdrop fade show"></div>
                    <div className="modal fade show d-block animate__animated animate__fadeInDown" tabIndex={-1}>
                        <div className="modal-dialog modal-dialog-centered">
                            <div className="modal-content border-0 shadow-lg">
                                <div className="modal-header text-white" style={{ backgroundColor: 'var(--primary-dark)' }}>
                                    <h5 className="modal-title">Expense Details</h5>
                                    <button type="button" className="btn-close btn-close-white" onClick={() => setShowViewModal(false)}></button>
                                </div>
                                <div className="modal-body p-4">
                                    <div className="mb-3">
                                        <label className="text-muted small fw-bold">Title</label>
                                        <div className="fw-bold fs-5">{selectedExpense.expense_title}</div>
                                    </div>
                                    <div className="row g-3 mb-3">
                                        <div className="col-6">
                                            <label className="text-muted small fw-bold">Category</label>
                                            <div>{selectedExpense.category_name}</div>
                                        </div>
                                        <div className="col-6">
                                            <label className="text-muted small fw-bold">Amount</label>
                                            <div className="fw-bold text-success">{formatCurrency(selectedExpense.amount)}</div>
                                        </div>
                                    </div>
                                    <div className="row g-3 mb-3">
                                        <div className="col-6">
                                            <label className="text-muted small fw-bold">Date</label>
                                            <div>{new Date(selectedExpense.expense_date).toLocaleDateString()}</div>
                                        </div>
                                        <div className="col-6">
                                            <label className="text-muted small fw-bold">Payment Method</label>
                                            <div>{selectedExpense.payment_method || '-'}</div>
                                        </div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="text-muted small fw-bold">Paid To</label>
                                        <div>{selectedExpense.paid_to || '-'}</div>
                                    </div>
                                    {selectedExpense.description && (
                                        <div className="mb-3">
                                            <label className="text-muted small fw-bold">Description</label>
                                            <div className="p-2 bg-light rounded small">{selectedExpense.description}</div>
                                        </div>
                                    )}
                                </div>
                                <div className="modal-footer bg-light">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowViewModal(false)}>Close</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}