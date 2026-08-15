'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface PermissionGuardProps {
    module: string;
    action?: 'read' | 'write' | 'delete';
    children: React.ReactNode;
    /** When true, renders an inline "Access Denied" card instead of redirecting */
    inline?: boolean;
}

/**
 * Wraps any content/page and blocks rendering if the current user lacks the
 * required permission.  By default it checks 'read' access.
 *
 * Usage (in a layout.tsx or page):
 *   <PermissionGuard module="students">...</PermissionGuard>
 *   <PermissionGuard module="students" action="write">...</PermissionGuard>
 */
export default function PermissionGuard({
    module,
    action = 'read',
    children,
    inline = false,
}: PermissionGuardProps) {
    const { isLoggedIn, isLoading, hasPermission } = useAuth();
    const router = useRouter();

    const allowed = isLoading ? null : hasPermission(module, action);

    useEffect(() => {
        if (!isLoading && !isLoggedIn) {
            router.replace('/login');
        }
    }, [isLoading, isLoggedIn, router]);

    // Still resolving auth state show nothing (avoids flicker)
    if (isLoading) {
        return (
            <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '50vh' }}>
                <div className="spinner-border text-secondary" role="status" />
            </div>
        );
    }

    // Not authenticated
    if (!isLoggedIn) return null;

    // Has permission render children
    if (allowed) return <>{children}</>;

    // No permission show Access Denied
    const deniedUI = (
        <div
            className="d-flex flex-column align-items-center justify-content-center text-center"
            style={{ minHeight: inline ? '200px' : '70vh', padding: '40px 20px' }}
        >
            <div
                style={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: '#fef2f2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 24,
                    fontSize: 36,
                }}
            >
                🔒
            </div>
            <h2 className="fw-bold text-danger mb-2" style={{ fontSize: '1.5rem' }}>
                Access Denied
            </h2>
            <p className="text-muted mb-4" style={{ maxWidth: 400 }}>
                You don&apos;t have{' '}
                <strong>{action}</strong> permission for the{' '}
                <strong>{module}</strong> module.
                <br />
                Please contact your administrator.
            </p>
            <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => router.back()}
            >
                ← Go Back
            </button>
        </div>
    );

    return deniedUI;
}
