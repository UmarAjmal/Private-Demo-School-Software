'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { requestMobileNotificationPermissions, triggerNativeDeviceNotification } from '../../utils/nativeNotifications';

const API = process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com";

interface NotificationItem {
    id: number;
    user_id?: number;
    family_id?: string;
    student_id?: number;
    role?: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    is_read: boolean;
    created_at: string;
}

export function NotificationBell({ role = 'all', familyId = '', userId = '', studentId = '' }: { role?: string; familyId?: string; userId?: string; studentId?: number | string }) {
    const router = useRouter();
    const { user } = useAuth() || {};
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'approvals'>('all');
    const [schoolLogo, setSchoolLogo] = useState<string>('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fetch School Logo & Request Mobile Notification Permissions
    const notifiedSetRef = useRef<Set<number>>(new Set());

    useEffect(() => {
        requestMobileNotificationPermissions();
        fetch(`${API}/settings`)
            .then(res => res.json())
            .then(data => {
                if (data && data.logo_url) {
                    const src = data.logo_url.startsWith('data:') || data.logo_url.startsWith('http')
                        ? data.logo_url
                        : `${API}${data.logo_url}`;
                    setSchoolLogo(src);
                }
            })
            .catch(() => { });
    }, []);

    // Load Notifications
    const fetchNotifications = async () => {
        try {
            const activeRole = (role && role !== 'all') ? role : (user?.role_name || user?.dashboard_access || 'all');
            const activeUserId = userId || user?.id || '';

            const params = new URLSearchParams();
            if (activeRole) params.append('role', activeRole);
            if (familyId) params.append('family_id', familyId);
            if (activeUserId) params.append('user_id', String(activeUserId));

            const res = await fetch(`${API}/notifications?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                const list: NotificationItem[] = data.notifications || [];
                setNotifications(list);
                setUnreadCount(data.unread_count || 0);

                // Trigger Mobile OS Native Notification for newly arrived unread alerts
                list.forEach(n => {
                    if (!n.is_read && !notifiedSetRef.current.has(n.id)) {
                        notifiedSetRef.current.add(n.id);
                        triggerNativeDeviceNotification(n.id, n.title, n.message, n.link);
                    }
                });
            }
        } catch (err) {
            console.error("Error loading notifications:", err);
        }
    };

    // Initial load & 12s polling interval
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 12000);
        return () => clearInterval(interval);
    }, [role, familyId, userId]);

    // Handle Click Outside Dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Mark single notification as read & navigate
    const handleNotificationClick = async (notif: NotificationItem) => {
        if (!notif.is_read) {
            try {
                await fetch(`${API}/notifications/${notif.id}/read`, { method: 'PUT' });
                setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
                setUnreadCount(prev => Math.max(0, prev - 1));
            } catch (e) { }
        }
        setOpen(false);
        if (notif.link) {
            router.push(notif.link);
        }
    };

    // Mark all as read
    const markAllAsRead = async () => {
        try {
            await fetch(`${API}/notifications/mark-all-read`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role, family_id: familyId, user_id: userId })
            });
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (e) { }
    };

    // Format Relative Time
    const formatTime = (dateStr: string) => {
        if (!dateStr) return '';
        const now = new Date();
        const past = new Date(dateStr);
        const diffMs = now.getTime() - past.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        return `${diffDays}d ago`;
    };

    // Get Notification Type Styling
    const getTypeStyle = (type: string) => {
        switch (type) {
            case 'fee_payment':
                return { icon: 'bi-cash-coin', bg: '#ecfdf5', color: '#10b981' };
            case 'attendance':
                return { icon: 'bi-calendar-check-fill', bg: '#ecfeff', color: '#06b6d4' };
            case 'exam_approval':
                return { icon: 'bi-clipboard-check-fill', bg: '#f5f3ff', color: '#8b5cf6' };
            case 'test_marks':
                return { icon: 'bi-journal-check', bg: '#f0fdf4', color: '#14b8a6' };
            case 'staff_attendance':
                return { icon: 'bi-person-badge-fill', bg: '#fdf2f8', color: '#ec4899' };
            default:
                return { icon: 'bi-bell-fill', bg: '#fff7ed', color: '#f97316' };
        }
    };

    // Filter Notifications by Tab
    const filteredList = notifications.filter(n => {
        if (activeTab === 'unread') return !n.is_read;
        if (activeTab === 'approvals') return n.type === 'exam_approval';
        return true;
    });

    return (
        <div ref={dropdownRef} className="notif-bell-wrapper" style={{ position: 'relative', zIndex: 250 }}>
            {/* Sleek Bell Toggle Button */}
            <button
                onClick={() => setOpen(!open)}
                className="notif-bell-btn"
                title="Notifications"
                style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    background: open ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
            >
                <i className="bi bi-bell-fill" style={{ fontSize: 18, color: '#ffffff' }} />

                {/* Animated Unread Badge Counter */}
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        background: '#ef4444',
                        color: '#ffffff',
                        fontSize: 10,
                        fontWeight: 800,
                        minWidth: 19,
                        height: 19,
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 4px',
                        border: '2px solid #195053',
                        boxShadow: '0 2px 6px rgba(239,68,68,0.5)',
                        animation: 'bellPulse 2s infinite ease-in-out',
                    }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Notifications Dropdown Panel */}
            {open && (
                <div
                    className="notif-dropdown-panel"
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 12px)',
                        right: 0,
                        width: 370,
                        maxWidth: '92vw',
                        background: '#ffffff',
                        borderRadius: 20,
                        boxShadow: '0 20px 45px rgba(0,0,0,0.22), 0 6px 16px rgba(0,0,0,0.08)',
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden',
                        zIndex: 1000,
                        animation: 'notifFadeIn 0.2s ease-out',
                    }}
                >
                    {/* Header Banner with School Logo */}
                    <div style={{
                        background: 'linear-gradient(135deg, #1e3644 0%, #195053 100%)',
                        padding: '14px 18px',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                overflow: 'hidden',
                            }}>
                                {schoolLogo ? (
                                    <img src={schoolLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }} />
                                ) : (
                                    <span style={{ fontSize: 16 }}>🏫</span>
                                )}
                            </div>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>Notifications</div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
                                    {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
                                </div>
                            </div>
                        </div>

                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                style={{
                                    background: 'rgba(255,255,255,0.18)',
                                    border: '1px solid rgba(255,255,255,0.25)',
                                    color: '#ffffff',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    padding: '4px 10px',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.3)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* Filter Tabs */}
                    <div style={{
                        display: 'flex',
                        background: '#f8fafc',
                        borderBottom: '1px solid #f1f5f9',
                        padding: '4px 8px',
                        gap: 4,
                    }}>
                        <button
                            onClick={() => setActiveTab('all')}
                            style={{
                                flex: 1,
                                padding: '6px 0',
                                border: 'none',
                                background: activeTab === 'all' ? '#ffffff' : 'transparent',
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: activeTab === 'all' ? 700 : 600,
                                color: activeTab === 'all' ? '#215E61' : '#64748b',
                                boxShadow: activeTab === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                cursor: 'pointer',
                            }}
                        >
                            All ({notifications.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('unread')}
                            style={{
                                flex: 1,
                                padding: '6px 0',
                                border: 'none',
                                background: activeTab === 'unread' ? '#ffffff' : 'transparent',
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: activeTab === 'unread' ? 700 : 600,
                                color: activeTab === 'unread' ? '#ef4444' : '#64748b',
                                boxShadow: activeTab === 'unread' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                cursor: 'pointer',
                            }}
                        >
                            Unread ({unreadCount})
                        </button>
                        <button
                            onClick={() => setActiveTab('approvals')}
                            style={{
                                flex: 1,
                                padding: '6px 0',
                                border: 'none',
                                background: activeTab === 'approvals' ? '#ffffff' : 'transparent',
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: activeTab === 'approvals' ? 700 : 600,
                                color: activeTab === 'approvals' ? '#8b5cf6' : '#64748b',
                                boxShadow: activeTab === 'approvals' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                cursor: 'pointer',
                            }}
                        >
                            Approvals
                        </button>
                    </div>

                    {/* Notifications List Body */}
                    <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                        {filteredList.length === 0 ? (
                            <div style={{ padding: '36px 20px', textAlign: 'center', color: '#94a3b8' }}>
                                <i className="bi bi-bell-slash" style={{ fontSize: 28, display: 'block', marginBottom: 6, opacity: 0.5 }} />
                                <div style={{ fontSize: 13, fontWeight: 600 }}>No notifications found</div>
                                <div style={{ fontSize: 11, marginTop: 2 }}>You are completely up to date!</div>
                            </div>
                        ) : (
                            filteredList.map(n => {
                                const style = getTypeStyle(n.type);
                                return (
                                    <div
                                        key={n.id}
                                        onClick={() => handleNotificationClick(n)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 12,
                                            padding: '12px 14px',
                                            borderBottom: '1px solid #f1f5f9',
                                            background: n.is_read ? '#ffffff' : '#f0fdf4',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                            position: 'relative',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                                        onMouseLeave={e => (e.currentTarget.style.background = n.is_read ? '#ffffff' : '#f0fdf4')}
                                    >
                                        {/* Left Type Icon */}
                                        <div style={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: 10,
                                            background: style.bg,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                            marginTop: 2,
                                        }}>
                                            <i className={`bi ${style.icon}`} style={{ fontSize: 16, color: style.color }} />
                                        </div>

                                        {/* Content */}
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                                <div style={{ fontSize: 13, fontWeight: n.is_read ? 700 : 800, color: '#1e293b', lineHeight: 1.2 }}>
                                                    {n.title}
                                                </div>
                                                <div style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                                    {formatTime(n.created_at)}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 11.5, color: '#475569', marginTop: 4, lineHeight: 1.35, wordBreak: 'break-word' }}>
                                                {n.message}
                                            </div>
                                        </div>

                                        {/* Unread Status Dot */}
                                        {!n.is_read && (
                                            <div style={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                background: '#215E61',
                                                flexShrink: 0,
                                                marginTop: 6,
                                            }} />
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            <style jsx global>{`
                @keyframes bellPulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.18); }
                    100% { transform: scale(1); }
                }
                @keyframes notifFadeIn {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @media (max-width: 576px) {
                    .notif-dropdown-panel {
                        position: fixed !important;
                        top: 70px !important;
                        left: 10px !important;
                        right: 10px !important;
                        width: calc(100vw - 20px) !important;
                        max-width: 100vw !important;
                        border-radius: 16px !important;
                        box-shadow: 0 16px 40px rgba(0,0,0,0.3) !important;
                        z-index: 9999 !important;
                    }
                }
            `}</style>
        </div>
    );
}
