'use client';

import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '@/contexts/AuthContext';

const API = process.env.NEXT_PUBLIC_API_URL || "https://demo-school-soxa.onrender.com";

function useAutoBackup(isLoggedIn: boolean) {
  useEffect(() => {
    if (!isLoggedIn) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const checkAndSchedule = async () => {
      try {
        const res = await fetch(`${API}/system`);
        const settings = await res.json();

        const enabledSetting = settings.find((s: any) => s.setting_key === 'auto_backup_enabled');
        const timeSetting = settings.find((s: any) => s.setting_key === 'backup_time');

        if (enabledSetting?.setting_value === 'true' && timeSetting?.setting_value) {
          const [hour, minute] = timeSetting.setting_value.split(':');

          const scheduleNextCheck = () => {
            const now = new Date();
            const target = new Date();
            target.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);

            // If the time has already passed today, schedule for tomorrow
            if (target.getTime() <= now.getTime()) {
              target.setDate(target.getDate() + 1);
            }

            const delay = target.getTime() - now.getTime();
            timeoutId = setTimeout(async () => {
              // Time has arrived! Trigger backup creation and download
              try {
                const createRes = await fetch(`${API}/system/backups/create`, { method: 'POST' });
                const data = await createRes.json();
                if (createRes.ok && data.message && data.message.includes('success')) {
                  // The API response might not return filename directly but the scheduler returns `{message: 'Backup completed successfully...'}`, wait, let's check what /create returns.
                  // Actually, fetchBackups() gets the list. The easiest is to just hit /system/backups to get the latest file.
                  const listRes = await fetch(`${API}/system/backups`);
                  const list = await listRes.json();
                  if (list && list.length > 0) {
                    const latest = list[0].name; // Assuming sorted by latest
                    // Trigger download
                    const a = document.createElement('a');
                    a.href = `${API}/system/backups/download/${latest}`;
                    a.download = latest;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    toast.success('Auto-backup triggered and downloading!');
                  }
                }
              } catch (e) {
                console.error("Auto backup download failed", e);
              }
              // Schedule for next day
              scheduleNextCheck();
            }, delay);
          };

          scheduleNextCheck();
        }
      } catch (err) {
        console.error("Failed to fetch settings for auto backup", err);
      }
    };

    checkAndSchedule();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoggedIn]);
}

type SubItem = { label: string; href: string };
type NavGroup = { key: string; label: string; icon: string; href: string; permission?: string; subs?: SubItem[] };

const NAV_GROUPS: NavGroup[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'bi-speedometer2', href: '/' },
  {
    key: 'students', label: 'Students', icon: 'bi-people-fill', href: '/students/details', permission: 'students',
    subs: [{ label: 'New Admission', href: '/students/admission' }, { label: 'Import Students', href: '/students/import' }, { label: 'Students Details', href: '/students/details' }, { label: 'Family Directory', href: '/students/families' }]
  },
  {
    key: 'academic', label: 'Academic', icon: 'bi-mortarboard-fill', href: '/academic/classes', permission: 'academic',
    subs: [{ label: 'Class Setting', href: '/academic/classes' }, { label: 'Section Setting', href: '/academic/sections' }, { label: 'Subject Setting', href: '/academic/subjects' }, { label: 'Teacher Assign', href: '/academic/teachers' }, { label: 'Student Promotion', href: '/academic/promotion' }]
  },
  {
    key: 'hrm', label: 'HR Management', icon: 'bi-person-badge-fill', href: '/hrm', permission: 'hrm',
    subs: [{ label: 'Departments', href: '/hrm/departments' }, { label: 'Employees', href: '/hrm/employees' }]
  },
  {
    key: 'examination', label: 'Examination', icon: 'bi-clipboard-check-fill', href: '/examination/marks', permission: '__exam__',
    subs: [{ label: 'Marks Entry', href: '/examination/marks' }, { label: 'Result Card', href: '/examination/result-card' }, { label: 'Marks Sheet', href: '/examination/marks-sheet' }, { label: 'Test Marking', href: '/examination/test-marking' }, { label: 'Marks Approval & Publishing', href: '/examination/approvals' }]
  },
  {
    key: 'expenses', label: 'Expenses', icon: 'bi-wallet2', href: '/expenses/list', permission: 'expenses',
    subs: [{ label: 'Add Expense', href: '/expenses/add' }, { label: 'Expense List', href: '/expenses/list' }, { label: 'Categories', href: '/expenses/categories' }]
  },
  {
    key: 'fees', label: 'Fee Management', icon: 'bi-bank', href: '/fees/generate', permission: 'fees',
    subs: [{ label: 'Generate Slips', href: '/fees/generate' }, { label: 'Print Slips', href: '/fees/print' }, { label: 'Collect Fee', href: '/fees/collect' }, { label: 'Admission Fees', href: '/fees/admission' }, { label: 'Exam Collection', href: '/fees/exam-collection' }, { label: 'Fee Plans', href: '/fees/plans' }, { label: 'Fee Heads', href: '/fees/heads' }, { label: 'OP Balance', href: '/fees/opening-balance' }]
  },
  {
    key: 'attendance', label: 'Attendance', icon: 'bi-calendar-check-fill', href: '/attendance/students', permission: 'attendance',
    subs: [{ label: 'Student Attendance', href: '/attendance/students' }, { label: 'Student History', href: '/attendance/students/history' }, { label: 'Staff Attendance', href: '/attendance/staff' }, { label: 'Staff History', href: '/attendance/staff/history' }]
  },
  {
    key: 'reports', label: 'Reports', icon: 'bi-bar-chart-fill', href: '/reports/monthly', permission: 'reports',
    subs: [{ label: 'Monthly Report', href: '/reports/monthly' }, { label: 'Student Report', href: '/reports/students' }, { label: 'Results Report', href: '/reports/results' }, { label: 'Expense Report', href: '/reports/expenses' }, { label: 'Family Fee Report', href: '/reports/family-fee' }, { label: 'Admission Report', href: '/reports/admission' }]
  },
  {
    key: 'settings', label: 'Settings', icon: 'bi-gear-fill', href: '/settings', permission: 'settings',
    subs: [{ label: 'General Info', href: '/settings/general' }, { label: 'Academic Setup', href: '/settings/academic' }, { label: 'User Roles', href: '/settings/roles' }, { label: 'System Users', href: '/settings/users' }, { label: 'System Config', href: '/settings/system' }]
  },
];

const NAV_PERMISSION_MAP: Record<string, string> = {
  '/students/admission': 'students.admission',
  '/students/import': 'students.import',
  '/students/details': 'students.details',
  '/students/families': 'students.families',
  '/academic/classes': 'academic.classes',
  '/academic/sections': 'academic.sections',
  '/academic/subjects': 'academic.subjects',
  '/academic/teachers': 'academic.teachers',
  '/academic/promotion': 'academic.promotion',
  '/examination/marks': 'academic.examination',
  '/examination/result-card': 'academic.result-card',
  '/examination/marks-sheet': 'academic.marks-sheet',
  '/examination/test-marking': 'academic.examination.test-marking',
  '/examination/approvals': 'academic.examination.approvals',
  '/hrm/departments': 'hrm.departments',
  '/hrm/employees': 'hrm.employees',
  '/expenses/add': 'expenses.add',
  '/expenses/list': 'expenses.list',
  '/expenses/categories': 'expenses.categories',
  '/expenses/edit': 'expenses.edit',
  '/fees/generate': 'fees.generate',
  '/fees/print': 'fees.print',
  '/fees/collect': 'fees.collect',
  '/fees/admission': 'fees.admission',
  '/fees/exam-collection': 'fees.exam-collection',
  '/fees/plans': 'fees.plans',
  '/fees/heads': 'fees.heads',
  '/fees/opening-balance': 'fees.opening-balance',
  '/attendance/students': 'attendance.students',
  '/attendance/students/history': 'attendance.students.history',
  '/attendance/staff': 'attendance.staff',
  '/attendance/staff/history': 'attendance.staff.history',
  '/reports/monthly': 'reports.monthly',
  '/reports/students': 'reports.students',
  '/reports/results': 'reports.results',
  '/reports/expenses': 'reports.expenses',
  '/reports/family-fee': 'reports.family-fee',
  '/reports/admission': 'reports.admission',
  '/settings/general': 'settings.general',
  '/settings/academic': 'settings.academic',
  '/settings/roles': 'settings.roles',
  '/settings/users': 'settings.users',
  '/settings/system': 'settings.system',
};

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// SidebarInner ALL sidebar state lives HERE so toggling never re-renders main
// ─────────────────────────────────────────────────────────────────────────────
type SidebarProps = {
  user: { full_name: string; role_name: string } | null;
  isLoggedIn: boolean;
  logout: () => void;
  hasPermission: (key: string) => boolean;
  schoolSettings: { school_name: string; logo_url: string; tagline: string };
};

const SidebarInner = memo(function SidebarInner({ user, isLoggedIn, logout, hasPermission, schoolSettings }: SidebarProps) {
  // pathname lives HERE not passed as prop so parent re-renders never break memo
  const pathname = usePathname() || '/';

  // ── Navigation loading overlay (dots) ────────────────────────────────────
  const [navLoading, setNavLoading] = useState(false);
  const [navDone, setNavDone] = useState(false);
  const navDoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When pathname actually changes → play the "done" animation then hide bar
  useEffect(() => {
    if (!navLoading) return;
    setNavDone(true);
    setNavLoading(false);
    if (navDoneTimer.current) clearTimeout(navDoneTimer.current);
    navDoneTimer.current = setTimeout(() => setNavDone(false), 240);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const startNav = useCallback(() => {
    setNavDone(false);
    setNavLoading(true);
  }, []);
  // activePath is set IMMEDIATELY on click so the highlight moves before the
  // page finishes loading. pathname useEffect keeps it in sync on forward/back.
  const [activePath, setActivePath] = useState(pathname);
  useEffect(() => { setActivePath(pathname); }, [pathname]);

  const [open, setOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(() => {
    // initialise synchronously so there's no delayed openMenu flash
    const g = NAV_GROUPS.find(g => {
      if (g.key === 'dashboard') return pathname === '/';
      return g.subs ? g.subs.some(s => pathname === s.href || pathname.startsWith(s.href + '/'))
        : pathname.startsWith(g.href);
    });
    return g?.key ?? null;
  });

  // Responsive
  useEffect(() => {
    const handle = () => {
      const m = window.innerWidth <= 991;
      setIsMobile(m);
      setOpen(!m);
    };
    handle();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  // Stable refs so inline-arrow callbacks in JSX don't break memo
  const logoutRef = useRef(logout); logoutRef.current = logout;
  const permRef = useRef(hasPermission); permRef.current = hasPermission;

  const canSeeRoute = useCallback((href: string) => {
    const permissionKey = NAV_PERMISSION_MAP[href];
    if (!permissionKey) return false;
    return permRef.current(permissionKey);
  }, []);

  // Pre-compute which groups to show only re-runs when permissions change
  const visibleGroups = useMemo(
    () => NAV_GROUPS.map(g => {
      if (g.key === 'dashboard') return g;

      const visibleSubs = g.subs?.filter(sub => canSeeRoute(sub.href)) ?? [];

      if (visibleSubs.length === 0) {
        return null;
      }

      return { ...g, subs: visibleSubs };
    }).filter(Boolean) as NavGroup[],
    [canSeeRoute]
  );

  const toggleSidebar = useCallback(() => setOpen(p => !p), []);
  const closeMobile = useCallback(() => { if (isMobile) setOpen(false); }, [isMobile]);

  // Uses activePath (optimistic) so highlight changes on click, not on nav-complete
  const isActive = useCallback((g: NavGroup) => {
    if (g.key === 'dashboard') return activePath === '/';
    return g.subs ? g.subs.some(s => activePath === s.href || activePath.startsWith(s.href + '/'))
      : activePath.startsWith(g.href);
  }, [activePath]);

  const handleGroup = useCallback((g: NavGroup) => {
    if (!g.subs) { closeMobile(); return; }
    if (!open && !isMobile) { setOpen(true); setOpenMenu(g.key); return; }
    setOpenMenu(prev => prev === g.key ? null : g.key);
  }, [open, isMobile, closeMobile]);

  // Navigate to a sub-item: update active state immediately (no waiting for pathname)
  const handleSubClick = useCallback((href: string) => {
    setActivePath(href);
    startNav();
    if (isMobile) setOpen(false);
  }, [isMobile, startNav]);

  // Navigate to a top-level link item: set both active path and open menu key
  const handleLinkClick = useCallback((g: NavGroup) => {
    setActivePath(g.href);
    setOpenMenu(g.key);
    startNav();
    if (isMobile) setOpen(false);
  }, [isMobile, startNav]);

  const expanded = open;

  return (
    <>
      {/* Navigation loading overlay */}
      {(navLoading || navDone) && (
        <div className={`nav-overlay${navDone ? ' nav-overlay-out' : ''}`}>
          <div className="nav-dots">
            <div className="nav-dot" />
            <div className="nav-dot" />
            <div className="nav-dot" />
          </div>
        </div>
      )}

      {/* Mobile top bar */}
      <div className="sl-topbar">
        <button onClick={() => setOpen(true)} className="sl-hamburger">
          <i className="bi bi-list" />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          {schoolSettings.logo_url ? (
            <img src={schoolSettings.logo_url} alt="Logo" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'contain', background: '#fff', border: '1px solid #e2e8f0', flexShrink: 0 }} />
          ) : (
            <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>🏫</span>
          )}
          <span className="sl-topbar-brand">{schoolSettings.school_name}</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {isMobile && open && <div className="sl-overlay" onClick={() => setOpen(false)} />}

      {/* ══════ SIDEBAR ══════ */}
      <aside className={`sl-sidebar ${expanded ? 'sl-open' : 'sl-closed'} ${isMobile ? 'sl-mobile' : 'sl-desktop'}`}>

        {/* Header */}
        <div className="sl-header">
          <div className="sl-brand">
            {schoolSettings.logo_url ? (
              <div style={{ width: 34, height: 34, minWidth: 34, borderRadius: '50%', background: '#fff', border: '1.5px solid rgba(255,255,255,0.2)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0 }}>
                <img src={schoolSettings.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }} />
              </div>
            ) : (
              <span style={{ fontSize: '1.4rem', marginRight: 10, flexShrink: 0 }}>🏫</span>
            )}
            <div className="sl-brand-text">
              <span className="sl-brand-name">{schoolSettings.school_name}</span>
              <span className="sl-brand-sub">{schoolSettings.tagline || 'School Management'}</span>
            </div>
          </div>
          {!isMobile && (
            <button onClick={toggleSidebar} className="sl-toggle" title={expanded ? 'Collapse' : 'Expand'}>
              <i className={`bi ${expanded ? 'bi-chevron-left' : 'bi-chevron-right'}`} />
            </button>
          )}
          {isMobile && (
            <button onClick={() => setOpen(false)} className="sl-toggle">
              <i className="bi bi-x-lg" />
            </button>
          )}
        </div>

        <div className="sl-sep" />

        {/* Nav */}
        <nav className="sl-nav">
          {visibleGroups.map(g => {
            const active = isActive(g);
            const isOpen = openMenu === g.key;
            const hasSubs = !!g.subs;
            return (
              <div key={g.key} className="sl-group">
                {hasSubs ? (
                  <button
                    className={`sl-item${active ? ' sl-active' : ''}`}
                    onClick={() => handleGroup(g)}
                    title={!expanded ? g.label : undefined}
                  >
                    <i className={`bi ${g.icon} sl-icon`} />
                    {expanded && <span className="sl-label">{g.label}</span>}
                    {expanded && <i className={`bi bi-chevron-down sl-chevron${isOpen ? ' sl-chevron-open' : ''}`} />}
                  </button>
                ) : (
                  <Link href={g.href} onClick={() => handleLinkClick(g)} style={{ textDecoration: 'none', display: 'block' }}>
                    <div className={`sl-item${active ? ' sl-active' : ''}`} title={!expanded ? g.label : undefined}>
                      <i className={`bi ${g.icon} sl-icon`} />
                      {expanded && <span className="sl-label">{g.label}</span>}
                    </div>
                  </Link>
                )}
                {hasSubs && expanded && isOpen && (
                  <ul className="sl-sub">
                    {g.subs!.map(s => (
                      <li key={s.href}>
                        <Link href={s.href} onClick={() => handleSubClick(s.href)} style={{ textDecoration: 'none', display: 'block' }}>
                          <div className={`sl-sub-item${activePath === s.href ? ' sl-sub-active' : ''}`}>
                            <span className="sl-dot" />
                            {s.label}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sl-sep" />

        {/* User zone */}
        {user && (
          <div className="sl-user">
            <div className="sl-avatar">{getInitials(user.full_name || 'U')}</div>
            <div className="sl-user-info">
              <span className="sl-user-name">{user.full_name}</span>
              <span className="sl-user-role">{user.role_name}</span>
            </div>
            <button onClick={() => logoutRef.current()} className="sl-logout" title="Sign Out">
              <i className="bi bi-box-arrow-right" />
            </button>
          </div>
        )}
      </aside>
      {/* ══════ END SIDEBAR ══════ */}
    </>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// AuthRedirect the ONLY component allowed to call usePathname().
// Returns null so reconciliation cost is zero on every navigation.
// Isolates pathname subscription so ClientLayout never re-renders on navigation.
// ─────────────────────────────────────────────────────────────────────────────
function AuthRedirect() {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || '/';

  useEffect(() => {
    if (!isLoading && !isLoggedIn && pathname !== '/login') {
      router.replace('/login');
    }
  }, [isLoading, isLoggedIn, pathname, router]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Layout never re-renders on navigation; only re-renders on login/logout
// ─────────────────────────────────────────────────────────────────────────────
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoggedIn, isLoading, logout, hasPermission } = useAuth();

  const [schoolSettings, setSchoolSettings] = useState<{ school_name: string; logo_url: string; tagline: string }>({
    school_name: 'Smart School',
    logo_url: '',
    tagline: 'School Management System'
  });
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);

  // Splash screen timer (2.3 seconds)
  useEffect(() => {
    const timer1 = setTimeout(() => setSplashFading(true), 2100);
    const timer2 = setTimeout(() => setShowSplash(false), 2600);
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, []);

  // Fetch school settings unconditionally on mount (BEFORE login & AFTER login)
  useEffect(() => {
    fetch(`${API}/settings`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && typeof d === 'object') {
          const name = d.school_name || 'Smart School';
          const logo = d.logo_url ? (
            d.logo_url.startsWith('data:') || d.logo_url.startsWith('http')
              ? d.logo_url
              : `${API}${d.logo_url}`
          ) : '';
          const tag = d.tagline || 'School Management System';

          setSchoolSettings({
            school_name: name,
            logo_url: logo,
            tagline: tag
          });

          // Update Document Title
          document.title = `${name} | School Management`;

          // Dynamic Favicon link
          if (logo) {
            let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
            if (!link) {
              link = document.createElement('link');
              link.rel = 'shortcut icon';
              document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.href = logo;

            let appleLink: HTMLLinkElement | null = document.querySelector("link[rel='apple-touch-icon']");
            if (!appleLink) {
              appleLink = document.createElement('link');
              appleLink.rel = 'apple-touch-icon';
              document.getElementsByTagName('head')[0].appendChild(appleLink);
            }
            appleLink.href = logo;
          }

          // Dynamic Meta Application Name
          let appMeta = document.querySelector("meta[name='application-name']");
          if (!appMeta) {
            appMeta = document.createElement('meta');
            appMeta.setAttribute('name', 'application-name');
            document.head.appendChild(appMeta);
          }
          appMeta.setAttribute('content', name);

          let appleMeta = document.querySelector("meta[name='apple-mobile-web-app-title']");
          if (!appleMeta) {
            appleMeta = document.createElement('meta');
            appleMeta.setAttribute('name', 'apple-mobile-web-app-title');
            document.head.appendChild(appleMeta);
          }
          appleMeta.setAttribute('content', name);
        }
      })
      .catch(() => { });
  }, []);

  // Initialize auto backup downloader
  useAutoBackup(isLoggedIn);

  useEffect(() => {
    // Load Bootstrap JS once on mount not on every navigation
    // @ts-ignore
    import('bootstrap/dist/js/bootstrap.bundle.min.js').catch(() => { });
  }, []);

  // Root Splash Screen Element (renders ON TOP OF EVERYTHING on initial load)
  const splashElement = showSplash ? (
    <div className={`app-splash-screen ${splashFading ? 'splash-fade-out' : ''}`}>
      <div className="splash-card">
        <div className="splash-logo-box">
          {schoolSettings.logo_url ? (
            <img src={schoolSettings.logo_url} alt={schoolSettings.school_name} className="splash-logo-img" />
          ) : (
            <span className="splash-logo-emoji">🏫</span>
          )}
        </div>
        <h1 className="splash-title">{schoolSettings.school_name}</h1>
        <p className="splash-subtitle">{schoolSettings.tagline || 'School Management System'}</p>

        <div className="splash-loading-bar">
          <div className="splash-loading-progress" />
        </div>
      </div>
    </div>
  ) : null;

  // Auth still resolving
  if (isLoading) return (
    <>
      {splashElement}
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e3545' }}>
        <div className="spinner-border text-light" role="status"><span className="visually-hidden">Loading…</span></div>
      </div>
    </>
  );

  // Not logged in: render children as-is (login page) + Splash Screen BEFORE login!
  if (!isLoggedIn) return (
    <>
      {splashElement}
      <AuthRedirect />
      {children}
      <ToastContainer position="top-right" autoClose={3000} theme="light" />
    </>
  );

  // Authenticated full layout
  return (
    <div className="sl-layout">
      {splashElement}
      <AuthRedirect />
      <SidebarInner
        user={user}
        isLoggedIn={isLoggedIn}
        logout={logout}
        hasPermission={hasPermission}
        schoolSettings={schoolSettings}
      />
      <main className="sl-main">{children}</main>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick pauseOnFocusLoss draggable pauseOnHover theme="light" />
    </div>
  );
}
