'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export interface Permission {
    module_name: string;
    can_read: boolean;
    can_write: boolean;
    can_delete: boolean;
}

export interface AuthUser {
    id: number;
    username: string;
    full_name: string;
    email: string;
    role_id: number;
    role_name: string;
    role_level?: number;
    dashboard_access?: string;
    is_active: boolean;
    permissions: Permission[];
    employee_id?: number;
    incharge_class?: { class_id: number, section_id: number } | null;
    token?: string;
    remember_me?: boolean;
    expires_at?: string;
}

interface AuthContextType {
    user: AuthUser | null;
    isLoggedIn: boolean;
    isLoading: boolean;
    login: (username: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; message?: string }>;
    logout: () => void;
    hasPermission: (module: string, action?: 'read' | 'write' | 'delete') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = 'sms_user_session';
const REMEMBER_KEY = 'sms_remember_session';
const OFFLINE_SESSION_KEY = 'sms_offline_user_session';
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com";

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    // Restore session from sessionStorage or persistent localStorage on mount
    useEffect(() => {
        try {
            const storedSession = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(OFFLINE_SESSION_KEY) || localStorage.getItem(REMEMBER_KEY);
            if (storedSession) {
                const parsed = JSON.parse(storedSession);
                setUser(parsed);
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
                localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify(parsed));
            }
        } catch {
            sessionStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(REMEMBER_KEY);
            localStorage.removeItem(OFFLINE_SESSION_KEY);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const login = useCallback(async (username: string, password: string, rememberMe: boolean = false): Promise<{ success: boolean; message?: string }> => {
        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, remember_me: rememberMe }),
            });

            const data = await res.json();

            if (!res.ok) {
                return { success: false, message: data.message || 'Login failed' };
            }

            setUser(data);
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
            localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify(data));

            if (rememberMe) {
                localStorage.setItem(REMEMBER_KEY, JSON.stringify(data));
            } else {
                localStorage.removeItem(REMEMBER_KEY);
            }

            return { success: true };
        } catch (err) {
            // Check if there is an offline cached session matching this user
            const cached = localStorage.getItem(OFFLINE_SESSION_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.username && parsed.username.toLowerCase() === username.toLowerCase()) {
                    setUser(parsed);
                    sessionStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
                    return { success: true, message: 'Logged in using offline cached credentials.' };
                }
            }
            return { success: false, message: 'Cannot connect to server. Please check your internet connection.' };
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            if (user?.token) {
                fetch(`${API_URL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${user.token}`
                    }
                }).catch(() => { });
            }
        } catch (e) { }

        setUser(null);
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(REMEMBER_KEY);
        localStorage.removeItem(OFFLINE_SESSION_KEY);
        router.push('/login');
    }, [user, router]);

    // Returns true if Administrator/Supervisor can access, OR if role has explicit permission.
    const hasPermission = useCallback((module: string, action: 'read' | 'write' | 'delete' = 'read'): boolean => {
        if (!user) return false;

        const roleLevel = user.role_level || 0;
        const moduleLower = module.toLowerCase();

        // 1. Admin (role_level >= 90): Full access to everything
        if (roleLevel >= 90) return true;

        // 2. Supervisor (role_level >= 65): Access to academic & operational modules
        const supervisorModules = ['attendance', 'academic', 'exams', 'marks', 'result', 'exam_fees', 'fees', 'classes', 'sections', 'dashboard'];
        const isModuleAllowed = supervisorModules.some(m =>
            moduleLower === m || moduleLower.startsWith(m + '.')
        );

        if (roleLevel >= 65 && isModuleAllowed) {
            if (action === 'delete') return false;
            return true;
        }

        const perms = user.permissions || [];

        // 3. Try exact match
        const exact = perms.find(p => p.module_name.toLowerCase() === moduleLower);
        if (exact) {
            if (action === 'read') return exact.can_read;
            if (action === 'write') return exact.can_write;
            if (action === 'delete') return exact.can_delete;
        }

        // 4. Fallback to parent module
        const parentModule = module.includes('.') ? module.split('.')[0] : null;
        if (parentModule) {
            const parent = perms.find(p => p.module_name.toLowerCase() === parentModule.toLowerCase());
            if (parent) {
                if (action === 'read') return parent.can_read;
                if (action === 'write') return parent.can_write;
                if (action === 'delete') return parent.can_delete;
            }
        }

        // 5. Module-level check
        if (!module.includes('.')) {
            const prefix = moduleLower + '.';
            const anyPageAccess = perms.some(p => {
                if (!p.module_name.toLowerCase().startsWith(prefix)) return false;
                if (action === 'read') return p.can_read;
                if (action === 'write') return p.can_write;
                if (action === 'delete') return p.can_delete;
                return false;
            });
            if (anyPageAccess) return true;
        }

        return false;
    }, [user]);

    const ctxValue = useMemo(
        () => ({ user, isLoggedIn: !!user, isLoading, login, logout, hasPermission }),
        [user, isLoading, login, logout, hasPermission]
    );

    return (
        <AuthContext.Provider value={ctxValue}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
    return ctx;
}
