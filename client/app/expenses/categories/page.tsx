'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Category {
    category_id: number;
    category_name: string;
    description: string;
    is_active: boolean;
}

export default function ExpenseCategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentCategory, setCurrentCategory] = useState<Category>({
        category_id: 0,
        category_name: '',
        description: '',
        is_active: true
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { hasPermission } = useAuth();

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/expense-categories`);
            const data = await response.json();
            setCategories(data);
            setLoading(false);
        } catch (err: any) {
            setError('Failed to fetch categories');
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const url = editMode
                ? `${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/expense-categories/${currentCategory.category_id}`
                : `${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/expense-categories`;

            const method = editMode ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category_name: currentCategory.category_name,
                    description: currentCategory.description,
                    is_active: currentCategory.is_active
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save category');
            }

            setShowModal(false);
            fetchCategories();
            resetForm();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleEdit = (category: Category) => {
        setCurrentCategory(category);
        setEditMode(true);
        setShowModal(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this category?')) return;

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com"}/expense-categories/${id}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.error);
                return;
            }

            fetchCategories();
        } catch (err) {
            alert('Failed to delete category');
        }
    };

    const resetForm = () => {
        setCurrentCategory({
            category_id: 0,
            category_name: '',
            description: '',
            is_active: true
        });
        setEditMode(false);
        setError('');
    };

    const closeModal = () => {
        setShowModal(false);
        resetForm();
    };

    return (
        <div className="container-fluid p-4 animate__animated animate__fadeIn">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="fw-bold" style={{ color: 'var(--primary-dark)' }}>
                    <i className="bi bi-tags me-2"></i> Expense Categories
                </h2>
                {hasPermission('expenses', 'write') && (
                    <button
                        className="btn btn-primary-custom shadow-sm"
                        onClick={() => setShowModal(true)}
                    >
                        <i className="bi bi-plus-lg me-2"></i> Add New Category
                    </button>
                )}
            </div>

            <div className="row">
                <div className="col-md-12">
                    <div className="card shadow-md border-0">
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="bg-light">
                                        <tr>
                                            <th className="ps-4 py-3 text-secondary">Category Name</th>
                                            <th className="py-3 text-secondary">Description</th>
                                            <th className="py-3 text-secondary">Status</th>
                                            <th className="pe-4 py-3 text-end text-secondary">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan={4} className="text-center py-5">
                                                <div className="spinner-border text-primary" role="status"></div>
                                            </td></tr>
                                        ) : categories.length === 0 ? (
                                            <tr><td colSpan={4} className="text-center py-5 text-muted">No categories found</td></tr>
                                        ) : (
                                            categories.map((category) => (
                                                <tr key={category.category_id}>
                                                    <td className="ps-4 fw-bold text-dark">{category.category_name}</td>
                                                    <td className="text-muted small">{category.description || '-'}</td>
                                                    <td>
                                                        <span className={`badge rounded-pill ${category.is_active ? 'bg-success' : 'bg-secondary'}`}>
                                                            {category.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                    <td className="pe-4 text-end">
                                                        {hasPermission('expenses', 'write') && (
                                                            <button
                                                                className="btn btn-sm btn-light text-primary me-2"
                                                                onClick={() => handleEdit(category)}
                                                                title="Edit"
                                                            >
                                                                <i className="bi bi-pencil"></i>
                                                            </button>
                                                        )}
                                                        {hasPermission('expenses', 'delete') && (
                                                            <button
                                                                className="btn btn-sm btn-light text-danger"
                                                                onClick={() => handleDelete(category.category_id)}
                                                                title="Delete"
                                                            >
                                                                <i className="bi bi-trash"></i>
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
                </div>
            </div>

            {/* Modal Overlay */}
            {showModal && (
                <>
                    <div className="modal-backdrop fade show"></div>
                    <div className="modal fade show d-block animate__animated animate__fadeInDown" tabIndex={-1} role="dialog">
                        <div className="modal-dialog modal-dialog-centered">
                            <div className="modal-content border-0 shadow-lg">
                                <div className="modal-header text-white" style={{ backgroundColor: 'var(--primary-dark)' }}>
                                    <h5 className="modal-title">
                                        {editMode ? 'Edit Category' : 'Add New Category'}
                                    </h5>
                                    <button type="button" className="btn-close btn-close-white" onClick={closeModal}></button>
                                </div>
                                <div className="modal-body p-4">
                                    {error && <div className="alert alert-danger">{error}</div>}

                                    <form onSubmit={handleSubmit}>
                                        <div className="mb-3">
                                            <label className="form-label fw-bold small text-muted">Category Name <span className="text-danger">*</span></label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={currentCategory.category_name}
                                                onChange={(e) => setCurrentCategory({ ...currentCategory, category_name: e.target.value })}
                                                required
                                                placeholder="e.g. Utilities"
                                            />
                                        </div>
                                        <div className="mb-3">
                                            <label className="form-label fw-bold small text-muted">Description</label>
                                            <textarea
                                                className="form-control"
                                                rows={3}
                                                value={currentCategory.description}
                                                onChange={(e) => setCurrentCategory({ ...currentCategory, description: e.target.value })}
                                                placeholder="Optional description..."
                                            ></textarea>
                                        </div>
                                        <div className="mb-3 form-check">
                                            <input
                                                type="checkbox"
                                                className="form-check-input"
                                                id="isActive"
                                                checked={currentCategory.is_active}
                                                onChange={(e) => setCurrentCategory({ ...currentCategory, is_active: e.target.checked })}
                                            />
                                            <label className="form-check-label" htmlFor="isActive">Active Category</label>
                                        </div>
                                        <div className="d-flex justify-content-end gap-2 mt-4">
                                            <button type="button" className="btn btn-light" onClick={closeModal}>Cancel</button>
                                            {hasPermission('expenses', 'write') && <button type="submit" className="btn btn-primary-custom px-4">Save Category</button>}
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}