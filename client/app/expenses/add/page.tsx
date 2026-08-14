'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface Category {
    category_id: number;
    category_name: string;
}

interface ExpenseFormData {
    category_id: string;
    expense_title: string;
    amount: string;
    expense_date: string;
    payment_method: string;
    reference_no: string;
    paid_to: string;
    description: string;
}

export default function AddExpensePage() {
    const router = useRouter();
    const { hasPermission } = useAuth();
    const [categories, setCategories] = useState<Category[]>([]);
    const [formData, setFormData] = useState<ExpenseFormData>({
        category_id: '',
        expense_title: '',
        amount: '',
        expense_date: new Date().toISOString().split('T')[0],
        payment_method: '',
        reference_no: '',
        paid_to: '',
        description: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/expense-categories/active`);
            const data = await response.json();
            setCategories(data);
        } catch (err) {
            console.error('Failed to fetch categories');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/expenses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    amount: parseFloat(formData.amount)
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to add expense');
            }

            // Success animation or toast could go here
            router.push('/expenses/list');
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    const handleChange = (field: keyof ExpenseFormData, value: string) => {
        setFormData({ ...formData, [field]: value });
    };

    return (
        <div className="container-fluid p-4 animate__animated animate__fadeIn">
            <div className="row justify-content-center">
                <div className="col-lg-8">

                    {/* Header */}
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <h2 className="fw-bold" style={{ color: 'var(--primary-dark)' }}>
                            <i className="bi bi-plus-circle me-2"></i>Add New Expense
                        </h2>
                        <button
                            className="btn btn-secondary-custom shadow-sm d-flex align-items-center"
                            onClick={() => router.push('/expenses/list')}
                        >
                            <i className="bi bi-arrow-left me-2"></i> Back to List
                        </button>
                    </div>

                    {/* Form Card */}
                    <div className="card shadow-lg border-0 animate__animated animate__fadeInUp">
                        {/* Decorative Top Border */}
                        <div className="card-body p-5 position-relative" style={{ borderTop: '5px solid var(--primary-teal)' }}>

                            {error && (
                                <div className="alert alert-danger d-flex align-items-center mb-4 animate__animated animate__headShake" role="alert">
                                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                    <div>{error}</div>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="row g-4">
                                <h5 className="text-muted border-bottom pb-2 mb-3">
                                    <i className="bi bi-info-circle me-2"></i>Basic Information
                                </h5>

                                <div className="col-md-6">
                                    <label className="form-label fw-bold small text-muted">Expense Title <span className="text-danger">*</span></label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-light"><i className="bi bi-type"></i></span>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={formData.expense_title}
                                            onChange={(e) => handleChange('expense_title', e.target.value)}
                                            placeholder="e.g. Office Stationery"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <label className="form-label fw-bold small text-muted">Category <span className="text-danger">*</span></label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-light"><i className="bi bi-tag"></i></span>
                                        <select
                                            className="form-select"
                                            value={formData.category_id}
                                            onChange={(e) => handleChange('category_id', e.target.value)}
                                            required
                                        >
                                            <option value="">Select Category</option>
                                            {categories.map(cat => (
                                                <option key={cat.category_id} value={cat.category_id}>
                                                    {cat.category_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <label className="form-label fw-bold small text-muted">Amount <span className="text-danger">*</span></label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-light fw-bold">PKR</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="form-control"
                                            value={formData.amount}
                                            onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                            onChange={(e) => handleChange('amount', e.target.value)}
                                            placeholder="0.00"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <label className="form-label fw-bold small text-muted">Date <span className="text-danger">*</span></label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-light"><i className="bi bi-calendar-event"></i></span>
                                        <input
                                            type="date"
                                            className="form-control"
                                            value={formData.expense_date}
                                            onChange={(e) => handleChange('expense_date', e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <h5 className="text-muted border-bottom pb-2 mb-3 mt-4">
                                    <i className="bi bi-cash-stack me-2"></i>Payment Details
                                </h5>

                                <div className="col-md-6">
                                    <label className="form-label fw-bold small text-muted">Payment Method</label>
                                    <select
                                        className="form-select"
                                        value={formData.payment_method}
                                        onChange={(e) => handleChange('payment_method', e.target.value)}
                                    >
                                        <option value="">Select Method</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Check">Check</option>
                                        <option value="Online">Online</option>
                                    </select>
                                </div>

                                <div className="col-md-6">
                                    <label className="form-label fw-bold small text-muted">Paid To</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={formData.paid_to}
                                        onChange={(e) => handleChange('paid_to', e.target.value)}
                                        placeholder="Vendor or Person Name"
                                    />
                                </div>

                                <div className="col-12">
                                    <label className="form-label fw-bold small text-muted">Description/Notes</label>
                                    <textarea
                                        className="form-control"
                                        rows={3}
                                        value={formData.description}
                                        onChange={(e) => handleChange('description', e.target.value)}
                                        placeholder="Additional details about the expense..."
                                    ></textarea>
                                </div>

                                <div className="col-12 mt-5 d-flex justify-content-end gap-3">
                                    <button
                                        type="button"
                                        className="btn btn-secondary-custom px-4"
                                        onClick={() => router.push('/expenses/list')}
                                    >
                                        Cancel
                                    </button>
                                    {hasPermission('expenses', 'write') && (
                                        <button
                                            type="submit"
                                            className="btn btn-primary-custom px-5 shadow-sm"
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="bi bi-check-lg me-2"></i> Save Expense
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}