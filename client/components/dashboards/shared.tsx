import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';

import { NotificationBell } from '../notifications/NotificationBell';

// Quick Actions Dropdown Component
export function QuickActionsDropdown() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const items = [
    { href: '/students/admission', label: 'New Admission', sub: 'Register a new student', icon: 'bi-person-plus-fill', color: '#FE7F2D' },
    { href: '/fees/collect', label: 'Collect Fee', sub: 'Receive student fee payment', icon: 'bi-cash-coin', color: '#10b981' },
    { href: '/fees/generate', label: 'Generate Slips', sub: 'Issue monthly fee vouchers', icon: 'bi-file-earmark-text-fill', color: '#6366f1' },
    { href: '/attendance/students', label: 'Take Attendance', sub: 'Mark student attendance', icon: 'bi-calendar-check-fill', color: '#06b6d4' },
    { href: '/academic/classes', label: 'Manage Classes', sub: 'Classes & sections setup', icon: 'bi-building', color: '#8b5cf6' },
    { href: '/hrm/employees', label: 'Employees / Staff', sub: 'Manage staff & teachers', icon: 'bi-person-badge-fill', color: '#ec4899' },
    { href: '/examination/marks', label: 'Exam Marks', sub: 'Record student exam marks', icon: 'bi-journal-check', color: '#14b8a6' },
    { href: '/reports/students', label: 'Reports', sub: 'Financial & academic data', icon: 'bi-bar-chart-fill', color: '#f59e0b' },
    { href: '/expenses/add', label: 'Add Expense', sub: 'Record operational expense', icon: 'bi-wallet2', color: '#ef4444' },
    { href: '/settings/general', label: 'School Settings', sub: 'School info & logo setup', icon: 'bi-gear-fill', color: '#64748b' },
  ];

  return (
    <div ref={dropdownRef} className="quick-actions-dropdown-wrapper" style={{ position: 'relative', zIndex: 200 }}>
      <button
        onClick={() => setOpen(!open)}
        className="quick-actions-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          background: 'linear-gradient(135deg, #FE7F2D 0%, #f97316 100%)',
          color: '#ffffff',
          border: 'none',
          borderRadius: 14,
          padding: '11px 22px',
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(254,127,45,0.4)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
      >
        <i className="bi bi-lightning-charge-fill" style={{ fontSize: 14 }} />
        <span>Quick Actions</span>
        <i className={`bi bi-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 11, marginLeft: 2 }} />
      </button>

      {open && (
        <div className="quick-actions-dropdown-panel" style={{
          position: 'absolute',
          top: 'calc(100% + 10px)',
          right: 0,
          width: 290,
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 12px 35px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e2e8f0',
          padding: '8px',
          zIndex: 1000,
        }}>
          <div style={{
            padding: '6px 12px 6px',
            fontSize: 10,
            fontWeight: 800,
            color: '#94a3b8',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            borderBottom: '1px solid #f1f5f9',
            marginBottom: 4,
          }}>
            Quick Actions Menu
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto', paddingRight: 2 }}>
            {items.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                }}
                className="quick-action-item"
              >
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: `${item.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <i className={`bi ${item.icon}`} style={{ color: item.color, fontSize: 15 }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{item.sub}</div>
                </div>
                <i className="bi bi-chevron-right" style={{ fontSize: 11, color: '#cbd5e1' }} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Page Shell
export function DashShell({
  children, title, subtitle, actions, greeting,
}: {
  children: React.ReactNode; title: string;
  subtitle?: string; actions?: React.ReactNode; greeting?: string;
}) {
  const [logoUrl, setLogoUrl] = useState<string>('');

  useEffect(() => {
    fetch(API + '/settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.logo_url) {
          const src = data.logo_url.startsWith('data:') || data.logo_url.startsWith('http')
            ? data.logo_url
            : `${API}${data.logo_url}?t=${Date.now()}`;
          setLogoUrl(src);
        }
      })
      .catch(() => { });
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#f4f7f6', padding: '0 0 48px' }}>
      {/* Top Green Hero Header - Flush top, rounded bottom corners */}
      <div className="dash-hero" style={{
        background: 'linear-gradient(135deg, #1e3644 0%, #195053 100%)',
        padding: '24px 28px',
        borderRadius: '0 0 24px 24px',
        position: 'relative' as const,
        zIndex: 100,
        overflow: 'visible',
        boxShadow: '0 6px 20px rgba(33,94,97,0.18)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        {/* Background Ambient Accents Container */}
        <div style={{ position: 'absolute' as const, inset: 0, overflow: 'hidden', borderRadius: '0 0 24px 24px', pointerEvents: 'none' as const }}>
          <div style={{ position: 'absolute' as const, top: -40, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' as const }} />
          <div style={{ position: 'absolute' as const, bottom: -60, right: 140, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' as const }} />
        </div>

        <div className="dash-hero-container" style={{ position: 'relative' as const, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 16 }}>

          {/* Left Side: Standard Logo Avatar + Title + Subtitle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, flex: 1 }}>
            <div className="dash-header-logo-avatar" title="School Logo">
              {logoUrl ? (
                <img src={logoUrl} alt="School Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '3px' }} />
              ) : (
                <span style={{ fontSize: '1.6rem' }}>🏫</span>
              )}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{title}</h1>
              {subtitle && (
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="bi bi-calendar3" style={{ fontSize: 11 }} />{subtitle}
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Quick Actions & Notification Bell (Bell Icon Most Right) */}
          <div className="dash-actions-wrapper" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            {actions || <QuickActionsDropdown />}
            <NotificationBell />
          </div>
        </div>
      </div>

      {/* Main Content Area - Cards positioned cleanly BELOW the header */}
      <div className="dash-content" style={{ padding: '0 28px', marginTop: 24, position: 'relative' as const, zIndex: 1 }}>
        {children}
      </div>

      <style jsx global>{`
        @keyframes dashFadeInUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes dashHeroFade {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .dash-hero {
          animation: dashHeroFade 0.4s ease-out forwards;
        }

        .dash-stat-grid > div {
          animation: dashFadeInUp 0.45s ease-out forwards;
          animation-fill-mode: both;
        }

        .dash-stat-grid > div:nth-child(1) { animation-delay: 0.04s; }
        .dash-stat-grid > div:nth-child(2) { animation-delay: 0.08s; }
        .dash-stat-grid > div:nth-child(3) { animation-delay: 0.12s; }
        .dash-stat-grid > div:nth-child(4) { animation-delay: 0.16s; }
        .dash-stat-grid > div:nth-child(5) { animation-delay: 0.20s; }

        .dash-panel-card-animated {
          animation: dashFadeInUp 0.55s ease-out forwards;
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease !important;
        }

        .dash-panel-card-animated:hover {
          transform: translateY(-3px) !important;
          box-shadow: 0 10px 28px rgba(35,61,77,0.12) !important;
          border-color: rgba(33,94,97,0.2) !important;
        }

        .dash-header-logo-avatar {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: #ffffff;
          border: 3px solid rgba(255,255,255,0.95);
          box-shadow: 0 4px 14px rgba(0,0,0,0.18), 0 0 12px rgba(254,127,45,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          cursor: pointer;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .dash-header-logo-avatar:hover {
          transform: scale(1.12) rotate(5deg) !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.25), 0 0 20px rgba(254,127,45,0.6) !important;
          border-color: #FE7F2D !important;
        }

        .quick-action-item:hover {
          background: #f8fafc !important;
          transform: translateX(4px);
        }

        @media (max-width: 640px) {
          .dash-hero {
            padding: 18px 16px !important;
            border-radius: 0 0 16px 16px !important;
          }
          .dash-content {
            padding: 0 14px !important;
            margin-top: 16px !important;
          }
          .dash-header-logo-avatar {
            width: 44px !important;
            height: 44px !important;
          }
        }
      `}</style>
    </div>
  );
}

// Constants
export const API = process.env.NEXT_PUBLIC_API_URL || "https://demo-school-soxa.onrender.com";
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}
export function fmtPKR(n: number) {
  return 'Rs ' + Number(n).toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

export function MaskedAmount({ amount }: { amount: number | string }) {
  const [show, setShow] = useState(false);
  const numericAmount = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]+/g, "")) : amount;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span>{show ? fmtPKR(numericAmount) : 'Rs *****'}</span>
      <i
        className={show ? "bi bi-eye-slash" : "bi bi-eye"}
        style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '0.85em' }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShow(!show); }}
      />
    </div>
  );
}

export const C = {
  dark: '#233D4D',
  teal: '#215E61',
  orange: '#FE7F2D',
  green: '#16a34a',
  red: '#dc2626',
  amber: '#d97706',
  purple: '#7c3aed',
  indigo: '#4f46e5',
  bg: '#F5FBE6',
};

// Stat Card
export function StatCard({
  icon, label, value, sub, accent,
}: {
  icon: string; label: string; value: React.ReactNode;
  sub?: React.ReactNode; color?: string; accent: string;
}) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 18,
      padding: '22px 24px 20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06),0 4px 20px rgba(35,61,77,0.07)',
      border: '1px solid #f1f5f9',
      borderLeft: '4px solid ' + accent,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 14,
      transition: 'box-shadow 0.2s,transform 0.2s',
    }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = '0 8px 30px rgba(35,61,77,0.13)';
        el.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06),0 4px 20px rgba(35,61,77,0.07)';
        el.style.transform = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{label}</div>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: accent + '1a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className={'bi ' + icon} style={{ fontSize: 17, color: accent }} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#1a2e3b', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 5, fontWeight: 500 }}>{sub}</div>}
      </div>
    </div>
  );
}

// Panel (ChartCard)
export function Panel({
  title, icon, children, action, noPad,
}: {
  title: string; icon?: string; children: React.ReactNode;
  action?: React.ReactNode; noPad?: boolean;
}) {
  return (
    <div className="dash-panel-card-animated" style={{
      background: '#fff', borderRadius: 18,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05),0 4px 20px rgba(35,61,77,0.06)',
      border: '1px solid #f1f5f9', overflow: 'hidden',
      display: 'flex', flexDirection: 'column' as const,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '15px 22px',
        borderBottom: '1px solid #f1f5f9',
        background: 'linear-gradient(135deg,#fafcff 0%,#f8fdf7 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          {icon && (
            <div style={{
              width: 28, height: 28, borderRadius: 8, background: 'rgba(254,127,45,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i className={'bi ' + icon} style={{ fontSize: 13, color: '#FE7F2D' }} />
            </div>
          )}
          <span style={{ fontWeight: 700, fontSize: 14, color: '#1a2e3b', letterSpacing: '-0.01em' }}>{title}</span>
        </div>
        {action}
      </div>
      <div style={{ padding: noPad ? 0 : '18px 22px', flex: 1 }}>{children}</div>
    </div>
  );
}
// Global Mobile-Responsive Attendance Details Popup Modal
export function AttendanceDetailsModal({
  isOpen,
  onClose,
  type,
  status,
  classId,
  sectionId,
}: {
  isOpen: boolean;
  onClose: () => void;
  type: string;
  status: string;
  classId?: number;
  sectionId?: number;
}) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSearch('');
    let url = `${API}/dashboard/attendance-details?type=${type}&status=${status}`;
    if (classId) url += `&class_id=${classId}`;
    if (sectionId) url += `&section_id=${sectionId}`;

    fetch(url)
      .then(res => res.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, [isOpen, type, status, classId, sectionId]);

  if (!isOpen || !mounted) return null;

  const filtered = data.filter(item => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = (item.name || '').toLowerCase();
    const guardian = (item.guardian || '').toLowerCase();
    const cls = (item.class_name || '').toLowerCase();
    const phone = (item.phone || '').toLowerCase();
    return name.includes(q) || guardian.includes(q) || cls.includes(q) || phone.includes(q);
  });

  const getWaLink = (phone: string) => {
    if (!phone) return '#';
    const cleaned = phone.replace(/\D/g, '');
    const finalPhone = cleaned.startsWith('0') ? `92${cleaned.substring(1)}` : cleaned;
    return `https://wa.me/${finalPhone}`;
  };

  const statusColor = status.toLowerCase() === 'present' ? '#16a34a' : status.toLowerCase() === 'absent' ? '#dc2626' : '#d97706';
  const statusBg = status.toLowerCase() === 'present' ? '#dcfce7' : status.toLowerCase() === 'absent' ? '#fee2e2' : '#fef3c7';

  const modalJSX = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          width: '100%',
          maxWidth: 660,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%', background: statusBg, color: statusColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 'bold'
              }}>
                <i className={status.toLowerCase() === 'present' ? "bi bi-check-circle-fill" : status.toLowerCase() === 'absent' ? "bi bi-x-circle-fill" : "bi bi-clock-history"} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, color: '#0f172a', fontWeight: 800 }}>
                  Today's {status} {type === 'staff' ? 'Staff' : 'Students'}
                </h3>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                  {loading ? 'Fetching records...' : `Total ${filtered.length} of ${data.length} records`}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: '#e2e8f0', border: 'none', width: 32, height: 32, borderRadius: '50%',
                cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'bold', transition: 'all 0.2s'
              }}
              title="Close"
            >
              <i className="bi bi-x-lg" style={{ fontSize: 14 }} />
            </button>
          </div>

          {/* Search bar inside header */}
          <div style={{ position: 'relative' }}>
            <i className="bi bi-search" style={{ position: 'absolute', left: 12, top: 10, color: '#94a3b8', fontSize: 13 }} />
            <input
              type="text"
              placeholder="Search name, class, father or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px 8px 34px', borderRadius: 10,
                border: '1px solid #cbd5e1', fontSize: 13, background: '#ffffff', outline: 'none'
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 10, top: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <i className="bi bi-x-circle-fill" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <div className="spinner-border spinner-border-sm" style={{ width: '2rem', height: '2rem', color: '#0f766e', marginBottom: 12 }} />
              <div style={{ fontWeight: 600, fontSize: 13 }}>Loading attendance records...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 20px', background: '#fff', borderRadius: 12, border: '1px dashed #cbd5e1' }}>
              <i className="bi bi-inbox" style={{ fontSize: 36, color: '#cbd5e1', display: 'block', marginBottom: 10 }} />
              <div style={{ fontWeight: 600 }}>No {status.toLowerCase()} records found.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map((item, i) => (
                <div
                  key={i}
                  style={{
                    background: '#ffffff', padding: '14px 16px', borderRadius: 12, border: '1px solid #e2e8f0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, color: '#0f172a', fontSize: 15 }}>{item.name}</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 800,
                        background: statusBg, color: statusColor, textTransform: 'uppercase'
                      }}>
                        {status}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                      {item.class_name && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <i className="bi bi-mortarboard-fill" style={{ color: '#0f766e' }} />
                          <span style={{ fontWeight: 700, color: '#334155' }}>{item.class_name} {item.section_name ? `(${item.section_name})` : ''}</span>
                        </span>
                      )}

                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <i className="bi bi-person-fill" style={{ color: '#64748b' }} />
                        <span>Guardian: <strong>{item.guardian || '—'}</strong></span>
                      </span>

                      {item.phone && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <i className="bi bi-telephone-fill" style={{ color: '#64748b' }} />
                          <span>{item.phone}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {item.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <a
                        href={`tel:${item.phone}`}
                        style={{
                          width: 36, height: 36, borderRadius: '50%', background: '#e2e8f0', color: '#1e293b',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none'
                        }}
                        title="Call"
                      >
                        <i className="bi bi-telephone-outbound-fill" style={{ fontSize: 14 }} />
                      </a>
                      <a
                        href={getWaLink(item.phone)}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          width: 36, height: 36, borderRadius: '50%', background: '#25D366', color: '#ffffff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
                          boxShadow: '0 2px 8px rgba(37,211,102,0.3)'
                        }}
                        title="WhatsApp Message"
                      >
                        <i className="bi bi-whatsapp" style={{ fontSize: 18 }} />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalJSX, document.body);
}

export const ChartCard = Panel;

// Donut Ring
export function DonutRing({
  present, absent, late, total, label, color,
}: {
  present: number; absent: number; late: number; total: number; label: string; color: string;
}) {
  const [modal, setModal] = useState<{ isOpen: boolean; type: string; status: string }>({ isOpen: false, type: '', status: '' });

  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  const r = 44, sw = 9, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  const handleOpen = (status: string) => {
    const type = label.toLowerCase().includes('staff') ? 'staff' : 'student';
    setModal({ isOpen: true, type, status });
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative' as const, width: 108, height: 108 }}>
          <svg width={108} height={108} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={54} cy={54} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
            <circle cx={54} cy={54} r={r} fill="none" stroke={color} strokeWidth={sw}
              strokeDasharray={dash + ' ' + (circ - dash)} strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 1s ease' }} />
          </svg>
          <div style={{
            position: 'absolute' as const, inset: 0, display: 'flex',
            flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 1,
          }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#1a2e3b', lineHeight: 1 }}>{pct}%</span>
            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>rate</span>
          </div>
        </div>
        <div style={{ textAlign: 'center' as const }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1a2e3b', marginBottom: 6 }}>{label}</div>
          <div style={{ display: 'flex', gap: 7, justifyContent: 'center' }}>
            <span onClick={() => handleOpen('Present')} title="Click to view details" style={{ cursor: 'pointer', background: '#16a34a1a', color: '#16a34a', borderRadius: 20, padding: '3px 9px', fontSize: 11, fontWeight: 700, transition: '0.2s' }}>P {present}</span>
            <span onClick={() => handleOpen('Absent')} title="Click to view details" style={{ cursor: 'pointer', background: '#dc26261a', color: '#dc2626', borderRadius: 20, padding: '3px 9px', fontSize: 11, fontWeight: 700, transition: '0.2s' }}>A {absent}</span>
            <span onClick={() => handleOpen('Late')} title="Click to view details" style={{ cursor: 'pointer', background: '#d976061a', color: '#d97706', borderRadius: 20, padding: '3px 9px', fontSize: 11, fontWeight: 700, transition: '0.2s' }}>L {late}</span>
          </div>
        </div>
      </div>

      <AttendanceDetailsModal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        type={modal.type}
        status={modal.status}
      />
    </>
  );
}




export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.09em', marginBottom: 10, marginTop: 8 }}>
      {children}
    </div>
  );
}

export function DashLoading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '65vh' }}>
      <div style={{ textAlign: 'center' as const }}>
        <div style={{ position: 'relative' as const, width: 64, height: 64, margin: '0 auto 20px' }}>
          <div style={{ position: 'absolute' as const, inset: 0, borderRadius: '50%', border: '4px solid #215E6120', borderTopColor: '#FE7F2D', animation: 'dspin 0.85s linear infinite' }} />
          <div style={{ position: 'absolute' as const, inset: 8, borderRadius: '50%', border: '3px solid #FE7F2D20', borderTopColor: '#215E61', animation: 'dspin 1.1s linear infinite reverse' }} />
          <div style={{ position: 'absolute' as const, inset: 18, borderRadius: '50%', background: '#233D4D12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="bi bi-mortarboard-fill" style={{ color: '#233D4D80', fontSize: 13 }} />
          </div>
        </div>
        <div style={{ fontWeight: 700, color: '#233D4D', fontSize: 15 }}>Loading dashboard</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Fetching latest data…</div>
        <style dangerouslySetInnerHTML={{ __html: '@keyframes dspin{to{transform:rotate(360deg)}}' }} />
      </div>
    </div>
  );
}

export function DashError({ msg }: { msg: string }) {
  return (
    <div style={{ margin: '24px 0', padding: '20px 24px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: 24, color: '#dc2626', flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 14, marginBottom: 3 }}>Failed to load dashboard</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>{msg}</div>
      </div>
    </div>
  );
}

export function EmptyChart({ text = 'No data available' }: { text?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: '52px 20px', color: '#cbd5e1', gap: 10 }}>
      <i className="bi bi-bar-chart" style={{ fontSize: 40 }} />
      <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>{text}</div>
    </div>
  );
}

export function RecentPaymentsTable({ rows }: { rows: any[] }) {
  if (rows.length === 0) {
    return (
      <div style={{ textAlign: 'center' as const, padding: '32px 0', color: '#94a3b8', fontSize: 13 }}>
        <i className="bi bi-inbox" style={{ fontSize: 30, display: 'block', marginBottom: 8 }} />
        No recent payments
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto' as const }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
        <thead>
          <tr>
            {['Student', 'Class', 'Month', 'Amount', 'Method', 'Date'].map(h => (
              <th key={h} style={{
                padding: '9px 14px', textAlign: 'left' as const,
                color: '#64748b', fontWeight: 700, fontSize: 11,
                textTransform: 'uppercase' as const, letterSpacing: '0.05em',
                borderBottom: '2px solid #f1f5f9', whiteSpace: 'nowrap' as const,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p: any, i: number) => (
            <tr key={p.payment_id ?? i}
              style={{ borderBottom: '1px solid #f8fafc', transition: 'background 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8fdf7'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <td style={{ padding: '11px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: 'linear-gradient(135deg,#215E61,#233D4D)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, color: '#fff',
                  }}>
                    {(p.student_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#1a2e3b', fontSize: 13 }}>{p.student_name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.admission_no}</div>
                  </div>
                </div>
              </td>
              <td style={{ padding: '11px 14px', color: '#475569' }}>{p.class_name || ''}</td>
              <td style={{ padding: '11px 14px', color: '#475569' }}>{MONTHS[(p.month || 1) - 1]} {p.year}</td>
              <td style={{ padding: '11px 14px' }}>
                <span style={{ fontWeight: 800, color: '#16a34a' }}><MaskedAmount amount={p.amount_paid} /></span>
              </td>
              <td style={{ padding: '11px 14px' }}>
                <span style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' as const,
                  background: p.payment_method === 'cash' ? '#16a34a1a' : '#4f46e51a',
                  color: p.payment_method === 'cash' ? '#16a34a' : '#4f46e5',
                }}>{p.payment_method || 'cash'}</span>
              </td>
              <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: 12 }}>
                {new Date(p.payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


export function DailyFeeReceipts() {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [tab, setTab] = useState<'not_printed' | 'printed'>('not_printed');
  const [data, setData] = useState<any>({ stats: {}, payments: [] });
  const [loading, setLoading] = useState(true);
  const [showAmounts, setShowAmounts] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(API + '/dashboard/daily-fee-receipts?date=' + date)
      .then(async r => {
        if (r.ok) setData(await r.json());
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [date]);

  const filtered = data.payments?.filter((p: any) => tab === 'printed' ? p.is_printed : !p.is_printed) || [];
  const totalCollected = data.stats?.total_collected || 0;
  const unprintedCount = data.stats?.unprinted_count || 0;
  const printedCount = data.stats?.printed_count || 0;

  const AmtCell = ({ v }: { v: number }) => (
    <span style={{ fontWeight: 700, color: '#1a2e3b' }}>
      {showAmounts ? fmtPKR(v) : 'Rs *****'}
    </span>
  );

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        background: '#fff',
        borderRadius: 18,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05),0 4px 20px rgba(35,61,77,0.06)',
        border: '1px solid #f1f5f9',
        borderLeft: `4px solid ${C.teal}`,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '15px 22px',
          borderBottom: '1px solid #f1f5f9',
          background: 'linear-gradient(135deg,#fafcff 0%,#f0f9f4 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, background: `${C.teal}1a`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i className="bi bi-receipt-cutoff" style={{ fontSize: 13, color: C.teal }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#1a2e3b', letterSpacing: '-0.01em' }}>
              Daily Fee Collection &amp; Receipts
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Eye Toggle */}
            <button
              onClick={() => setShowAmounts(s => !s)}
              title={showAmounts ? 'Hide Amounts' : 'Show Amounts'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0',
                background: showAmounts ? `${C.teal}1a` : '#f8fafc',
                cursor: 'pointer', transition: 'all 0.2s',
                color: showAmounts ? C.teal : '#94a3b8',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.teal; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; }}
            >
              <i className={showAmounts ? 'bi bi-eye-slash' : 'bi bi-eye'} style={{ fontSize: 13 }} />
            </button>
            {/* Date Picker */}
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{
                fontSize: 12, padding: '4px 10px', width: 135,
                border: '1px solid #e2e8f0', borderRadius: 8, color: '#475569',
                outline: 'none', background: '#f8fafc',
              }} />
          </div>
        </div>

        <div style={{ padding: '18px 22px', flex: 1 }}>
          {/* Summary stats row */}
          {/* {!loading && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{
                flex: 1, background: `${C.teal}0d`, borderRadius: 12,
                padding: '12px 16px', border: `1px solid ${C.teal}22`,
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.teal, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Total Collected
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#1a2e3b', lineHeight: 1.2 }}>
                  {showAmounts ? fmtPKR(totalCollected) : 'Rs *****'}
                </div>
              </div>
              <div style={{
                flex: 1, background: '#fffbeb', borderRadius: 12,
                padding: '12px 16px', border: '1px solid #fef08a',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Not Printed</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#1a2e3b', lineHeight: 1.2 }}>{unprintedCount}</div>
              </div>
              <div style={{
                flex: 1, background: '#f0fdf4', borderRadius: 12,
                padding: '12px 16px', border: '1px solid #bbf7d0',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Printed</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#1a2e3b', lineHeight: 1.2 }}>{printedCount}</div>
              </div>
            </div>
          )} */}

          {loading ? <DashLoading /> : (
            <>
              {/* Tab Buttons */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button onClick={() => setTab('not_printed')}
                  style={{
                    flex: 1, padding: '8px 12px', fontSize: 12, fontWeight: 600,
                    border: '1px solid', borderRadius: 8, cursor: 'pointer', transition: 'all 0.18s',
                    backgroundColor: tab === 'not_printed' ? '#fffbeb' : '#fff',
                    borderColor: tab === 'not_printed' ? '#fef08a' : '#e2e8f0',
                    color: tab === 'not_printed' ? '#b45309' : '#64748b',
                  }}>
                  <i className="bi bi-exclamation-circle me-2" />
                  Not Printed ({unprintedCount})
                </button>
                <button onClick={() => setTab('printed')}
                  style={{
                    flex: 1, padding: '8px 12px', fontSize: 12, fontWeight: 600,
                    border: '1px solid', borderRadius: 8, cursor: 'pointer', transition: 'all 0.18s',
                    backgroundColor: tab === 'printed' ? '#f0fdf4' : '#fff',
                    borderColor: tab === 'printed' ? '#bbf7d0' : '#e2e8f0',
                    color: tab === 'printed' ? '#15803d' : '#64748b',
                  }}>
                  <i className="bi bi-printer me-2" />
                  Printed ({printedCount})
                </button>
              </div>

              {filtered.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: 13,
                  background: '#f8fafc', borderRadius: 10, border: '1px dashed #e2e8f0'
                }}>
                  <i className="bi bi-inbox" style={{ fontSize: 32, display: 'block', marginBottom: 8, opacity: 0.5 }} />
                  No {tab === 'printed' ? 'printed' : 'unprinted'} receipts for this date.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid #f1f5f9', borderRadius: 10 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Student', 'Class', 'Month', 'Amount', 'Method', 'Status', 'Action'].map(h => (
                          <th key={h} style={{
                            padding: '9px 14px', textAlign: h === 'Action' ? 'center' : 'left', fontWeight: 700,
                            fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em',
                            color: '#64748b', borderBottom: '2px solid #f1f5f9', whiteSpace: 'nowrap',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p: any, i: number) => (
                        <tr key={i}
                          style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f8fafc' : 'none', transition: 'background 0.15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8fdf7'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                          <td style={{ padding: '11px 14px', fontWeight: 600, color: '#334155' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                                background: `linear-gradient(135deg,${C.teal},${C.dark})`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 800, color: '#fff',
                              }}>
                                {(p.is_family_slip ? 'F' : (p.student_name || '?').charAt(0)).toUpperCase()}
                              </div>
                              <span>{p.is_family_slip ? `Family: ${p.family_id}` : p.student_name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '11px 14px', color: '#64748b' }}>
                            {p.is_family_slip ? (
                              <span style={{ background: `${C.teal}1a`, color: C.teal, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>Family</span>
                            ) : (p.class_name || '—')}
                          </td>
                          <td style={{ padding: '11px 14px', color: '#64748b' }}>{p.month} {p.year}</td>
                          <td style={{ padding: '11px 14px' }}><AmtCell v={parseFloat(p.amount_paid)} /></td>
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{
                              padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                              textTransform: 'capitalize',
                              background: p.payment_method === 'cash' ? '#16a34a1a' : '#4f46e51a',
                              color: p.payment_method === 'cash' ? '#16a34a' : '#4f46e5',
                            }}>{p.payment_method || 'cash'}</span>
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{
                              padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                              background: p.is_printed ? '#16a34a1a' : '#fef9c3',
                              color: p.is_printed ? '#16a34a' : '#b45309',
                            }}>
                              <i className={`bi ${p.is_printed ? 'bi-printer-fill' : 'bi-exclamation-circle'} me-1`} />
                              {p.is_printed ? 'Printed' : 'Not Printed'}
                            </span>
                          </td>
                          <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                            <Link
                              href={`/fees/collect?search=${encodeURIComponent(p.is_family_slip ? (p.family_id || '') : (p.student_name || ''))}`}
                              title="Go to Fee Collection Page"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #FE7F2D 0%, #d66418 100%)',
                                color: '#ffffff',
                                textDecoration: 'none',
                                boxShadow: '0 3px 10px rgba(254,127,45,0.4)',
                                transition: 'all 0.2s ease',
                              }}
                              onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.transform = 'scale(1.12)';
                                (e.currentTarget as HTMLElement).style.boxShadow = '0 5px 15px rgba(254,127,45,0.6)';
                              }}
                              onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.transform = 'none';
                                (e.currentTarget as HTMLElement).style.boxShadow = '0 3px 10px rgba(254,127,45,0.4)';
                              }}
                            >
                              <i className="bi bi-arrow-right-short" style={{ fontSize: 20, fontWeight: 800 }} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}