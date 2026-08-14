'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AnimatedBackground from '@/components/AnimatedBackground';

export default function LoginPage() {
    const { login, isLoggedIn, isLoading } = useAuth();
    const router = useRouter();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Splash Screen State
    const [showSplash, setShowSplash] = useState(true);

    // Security Policies State
    const [policies, setPolicies] = useState({
        max_login_attempts: 5,
        password_min_length: 6,
        session_timeout_minutes: 1440
    });

    // Dynamic State for Devs Info
    const [devUmar, setDevUmar] = useState({
        name: 'M. Umar Ajmal',
        bio: 'Software Eng. & Machine Learning',
        avatar: 'https://avatars.githubusercontent.com/u/126502013?v=4',
        url: 'https://muhammadumarajmal.vercel.app/'
    });

    const [devAbdullah, setDevAbdullah] = useState({
        name: 'Muhammad Abdullah',
        bio: 'AI Automation & Custom Software',
        avatar: 'https://raw.githubusercontent.com/AbdullahWali79/AbdullahImages/main/Professional.jpeg',
        url: 'https://muhammadabdullahwali.vercel.app/'
    });

    // Dynamic School Settings State
    const [schoolSettings, setSchoolSettings] = useState({
        school_name: 'Falcon School System',
        logo_url: '',
        tagline: 'Excellence in Education'
    });

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://shmool.onrender.com";

    useEffect(() => {
        if (!isLoading && isLoggedIn) {
            router.replace('/');
        }
    }, [isLoading, isLoggedIn, router]);

    // Auto dismiss Splash Screen after 2.2 seconds
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowSplash(false);
        }, 2200);
        return () => clearTimeout(timer);
    }, []);

    // Fetch School Settings for Branding
    useEffect(() => {
        fetch(`${API_URL}/settings`)
            .then(res => res.json())
            .then(data => {
                if (data && typeof data === 'object') {
                    const name = data.school_name || 'Falcon School System';
                    const logo = data.logo_url ? (
                        data.logo_url.startsWith('data:') || data.logo_url.startsWith('http')
                            ? data.logo_url
                            : `${API_URL}${data.logo_url}`
                    ) : '';
                    const tagline = data.tagline || 'Excellence in Education';

                    setSchoolSettings({
                        school_name: name,
                        logo_url: logo,
                        tagline: tagline
                    });
                }
            })
            .catch(() => { });
    }, [API_URL]);

    // Fetch Dynamic Security Policies from Server
    useEffect(() => {
        fetch(`${API_URL}/auth/security-policies`)
            .then(res => res.json())
            .then(data => {
                if (data && typeof data === 'object') {
                    setPolicies(prev => ({ ...prev, ...data }));
                }
            })
            .catch(() => { });
    }, [API_URL]);

    // Fetch dynamic GitHub data for Umar
    useEffect(() => {
        fetch('https://api.github.com/users/UmarAjmal')
            .then(res => res.json())
            .then(data => {
                if (data.name || data.avatar_url) {
                    setDevUmar(prev => ({
                        ...prev,
                        name: data.name || prev.name,
                        bio: data.bio || prev.bio,
                        avatar: data.avatar_url || prev.avatar
                    }));
                }
            })
            .catch(e => console.error('Failed to fetch Umar Ajmal data:', e));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!username.trim() || !password) {
            setError('Please enter both username and password.');
            return;
        }

        if (password.length < policies.password_min_length) {
            setError(`Password must be at least ${policies.password_min_length} characters according to system policy.`);
            return;
        }

        setSubmitting(true);
        const result = await login(username.trim(), password, rememberMe);
        setSubmitting(false);

        if (result.success) {
            router.replace('/');
        } else {
            setError(result.message || 'Login failed. Please check your credentials.');
        }
    };

    const handleQuickFill = () => {
        setUsername('root');
        setPassword('root123');
        setError('');
    };

    if (isLoading) {
        return (
            <div className="loader-screen">
                <div className="spinner-glow" />
            </div>
        );
    }

    // ── Dedicated Mobile & Tablet Splash Screen ──
    if (showSplash) {
        return (
            <div className="splash-screen-container">
                <AnimatedBackground />
                <div className="ambient-glow orb-teal" />
                <div className="ambient-glow orb-orange" />

                <div className="splash-card animate__animated animate__zoomIn">
                    <div className="splash-logo-halo">
                        {schoolSettings.logo_url ? (
                            <img src={schoolSettings.logo_url} alt={schoolSettings.school_name} className="splash-logo-img" />
                        ) : (
                            <i className="bi bi-mortarboard-fill splash-icon" />
                        )}
                    </div>
                    <h1 className="splash-title">{schoolSettings.school_name}</h1>
                    <p className="splash-subtitle">{schoolSettings.tagline || 'Excellence in Education'}</p>

                    <div className="splash-loader-bar">
                        <div className="splash-loader-progress" />
                    </div>

                    <button className="btn-splash-enter" onClick={() => setShowSplash(false)}>
                        <span>Enter Portal</span>
                        <i className="bi bi-arrow-right ms-2" />
                    </button>
                </div>

                <style jsx>{`
                    .splash-screen-container {
                        position: fixed;
                        inset: 0;
                        z-index: 9999;
                        background: #0d2b38;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 24px;
                        font-family: 'Inter', system-ui, -apple-system, sans-serif;
                    }
                    .splash-card {
                        text-align: center;
                        color: #fff;
                        max-width: 440px;
                        width: 100%;
                        background: rgba(15, 28, 36, 0.85);
                        backdrop-filter: blur(28px);
                        border-radius: 32px;
                        border: 1px solid rgba(255, 255, 255, 0.15);
                        padding: 44px 32px;
                        box-shadow: 0 35px 70px rgba(0, 0, 0, 0.75), 0 0 50px rgba(33, 94, 97, 0.3);
                        position: relative;
                        z-index: 10;
                    }
                    .splash-logo-halo {
                        width: 100px;
                        height: 100px;
                        margin: 0 auto 24px;
                        border-radius: 50%;
                        background: radial-gradient(circle, rgba(254, 127, 45, 0.3) 0%, rgba(33, 94, 97, 0.5) 100%);
                        border: 3px solid #FE7F2D;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 6px;
                        box-shadow: 0 0 35px rgba(254, 127, 45, 0.5);
                    }
                    .splash-logo-img {
                        width: 100%;
                        height: 100%;
                        object-fit: contain;
                        border-radius: 50%;
                    }
                    .splash-icon {
                        font-size: 46px;
                        color: #FE7F2D;
                    }
                    .splash-title {
                        font-size: 1.55rem;
                        font-weight: 800;
                        margin-bottom: 8px;
                        color: #ffffff;
                        line-height: 1.3;
                    }
                    .splash-subtitle {
                        font-size: 0.95rem;
                        color: rgba(255, 255, 255, 0.7);
                        margin-bottom: 28px;
                    }
                    .splash-loader-bar {
                        height: 4px;
                        width: 100%;
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 10px;
                        overflow: hidden;
                        margin-bottom: 28px;
                    }
                    .splash-loader-progress {
                        height: 100%;
                        width: 100%;
                        background: linear-gradient(90deg, #215e61, #FE7F2D);
                        animation: progressAnim 2.2s ease-in-out infinite;
                    }
                    @keyframes progressAnim {
                        0% { transform: translateX(-100%); }
                        100% { transform: translateX(100%); }
                    }
                    .btn-splash-enter {
                        background: linear-gradient(135deg, #FE7F2D, #d66418);
                        color: #fff;
                        border: none;
                        padding: 13px 32px;
                        border-radius: 30px;
                        font-weight: 700;
                        font-size: 0.95rem;
                        cursor: pointer;
                        box-shadow: 0 10px 25px rgba(254, 127, 45, 0.4);
                        transition: all 0.3s ease;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .btn-splash-enter:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 14px 30px rgba(254, 127, 45, 0.6);
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="login-page">
            <AnimatedBackground />

            {/* Enhanced Ambient Background Glow Orbs */}
            <div className="ambient-glow orb-teal" />
            <div className="ambient-glow orb-orange" />
            <div className="ambient-glow orb-top-center" />

            <div className="content-wrapper">
                <main className="glass-board">
                    {/* Left Brand & Quote Panel */}
                    <div className="brand-panel">
                        <div className="brand-top">
                            <div className="brand-hero">
                                <div className="brand-icon-halo" style={{ overflow: 'hidden', padding: schoolSettings.logo_url ? 4 : 0 }}>
                                    {schoolSettings.logo_url ? (
                                        <img
                                            src={schoolSettings.logo_url}
                                            alt={schoolSettings.school_name}
                                            style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }}
                                        />
                                    ) : (
                                        <i className="bi bi-mortarboard-fill" />
                                    )}
                                </div>
                                <h1 className="brand-title">
                                    {schoolSettings.school_name} <br />
                                    <span className="text-gradient" style={{ fontSize: '0.85em' }}>
                                        {schoolSettings.tagline || 'Management Portal'}
                                    </span>
                                </h1>
                            </div>
                        </div>

                        {/* Educational Quote Box */}
                        <div className="quote-container">
                            <div className="quote-icon-top">
                                <i className="bi bi-quote" />
                            </div>
                            <p className="quote-text">
                                &ldquo;Education is the most powerful weapon which you can use to change the world.&rdquo;
                            </p>
                            <div className="quote-author">
                                <span className="author-dash">&mdash;</span>
                                <span className="author-name">Nelson Mandela</span>
                            </div>
                        </div>

                        <div className="brand-footer-bar">
                            <span className="security-badge-pill">
                                <i className="bi bi-shield-lock-fill me-1" /> 24H Session Persistence Active
                            </span>
                        </div>
                    </div>

                    {/* Right Form Panel */}
                    <div className="form-panel">
                        <div className="form-header">
                            <div className="brand-logo-mobile d-md-none mb-3">
                                {schoolSettings.logo_url ? (
                                    <img src={schoolSettings.logo_url} alt={schoolSettings.school_name} className="mobile-logo-img" />
                                ) : (
                                    <div className="mobile-logo-icon"><i className="bi bi-mortarboard-fill" /></div>
                                )}
                            </div>
                            <h2>Welcome Back</h2>
                            <p className="school-subname-mobile d-md-none text-teal-light mb-1 fw-bold">{schoolSettings.school_name}</p>
                            <p>Sign in to access your portal account</p>
                        </div>

                        <form onSubmit={handleSubmit} noValidate className="login-form">
                            {error && (
                                <div className="error-alert animate__animated animate__headShake" role="alert">
                                    <i className="bi bi-exclamation-triangle-fill" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="form-group mb-3">
                                <label htmlFor="username-input">Username</label>
                                <div className="input-field-wrap">
                                    <i className="bi bi-person-fill input-icon" />
                                    <input
                                        id="username-input"
                                        type="text"
                                        className="form-input"
                                        placeholder="Enter your username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        disabled={submitting}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="form-group mb-3">
                                <label htmlFor="password-input">Password</label>
                                <div className="input-field-wrap">
                                    <i className="bi bi-lock-fill input-icon" />
                                    <input
                                        id="password-input"
                                        type={showPassword ? 'text' : 'password'}
                                        className="form-input"
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={submitting}
                                    />
                                    <button
                                        type="button"
                                        className="btn-toggle-password"
                                        onClick={() => setShowPassword(!showPassword)}
                                        tabIndex={-1}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        <i className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`} />
                                    </button>
                                </div>
                            </div>

                            {/* 24-Hour Remember Me & Security Policy Row */}
                            <div className="form-group mb-4">
                                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 py-1">
                                    <label className="remember-me-label d-flex align-items-center gap-2 cursor-pointer mb-0">
                                        <input
                                            type="checkbox"
                                            className="remember-checkbox"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                        />
                                        <span className="remember-text">Remember me for 24 Hours</span>
                                    </label>
                                    <span className="policy-hint text-muted small">
                                        <i className="bi bi-shield-check text-success me-1"></i>
                                        Min {policies.password_min_length} chars
                                    </span>
                                </div>
                            </div>

                            <button type="submit" className="btn-submit" disabled={submitting}>
                                {submitting ? (
                                    <span className="submit-spinner" />
                                ) : (
                                    <>
                                        <span>Sign In to Portal</span>
                                        <i className="bi bi-arrow-right-short btn-arrow" />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Default System Admin (Commented Out per user request) */}
                        {/* <div className="credentials-card mt-4">
                            <div className="credentials-content">
                                <i className="bi bi-key-fill key-icon" />
                                <div className="credentials-info">
                                    <span className="credentials-label">Default System Admin</span>
                                    <span className="credentials-val">Username: <strong>root</strong> &bull; Password: <strong>root123</strong></span>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="btn-quick-fill"
                                onClick={handleQuickFill}
                                title="Auto fill demo credentials"
                            >
                                Quick Fill
                            </button>
                        </div> */}
                    </div>
                </main>
            </div>

            {/* Developer / Company Credits Footer */}
            <footer className="dev-footer">
                {/* Individual Person Credits (Commented Out per user request) */}
                {/* <div className="dev-footer-title">
                    <span>Designed & Engineered By</span>
                </div>
                <div className="dev-cards-row">
                    <a
                        href={devUmar.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dev-card"
                    >
                        <div className="dev-avatar-wrapper">
                            <img src={devUmar.avatar} alt={devUmar.name} className="dev-avatar-img" />
                            <div className="dev-online-ring" />
                        </div>
                        <div className="dev-meta">
                            <span className="dev-role-badge">Full Stack Engineer</span>
                            <h3 className="dev-name">{devUmar.name}</h3>
                            <p className="dev-bio">{devUmar.bio}</p>
                        </div>
                        <i className="bi bi-box-arrow-up-right dev-external-icon" />
                    </a>

                    <div className="dev-card dev-card-static">
                        <div className="dev-avatar-wrapper">
                            <div className="dev-avatar-placeholder">A</div>
                        </div>
                        <div className="dev-meta">
                            <span className="dev-role-badge">SEO & Marketing</span>
                            <h3 className="dev-name">Abdullah</h3>
                            <p className="dev-bio">Search Engine Optimization Specialist</p>
                        </div>
                    </div>
                </div> */}

                {/* FalconSwift Official Company Profile */}
                <div className="company-credit-card animate__animated animate__fadeInUp">
                    <a
                        href="https://falconswift.online"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="company-credit-link"
                    >
                        <div className="company-logo-wrapper">
                            <img
                                src="https://falconswift.online/FalconSwift.png"
                                alt="FalconSwift Logo"
                                className="company-logo-img"
                                onError={(e: any) => {
                                    e.target.onerror = null;
                                    e.target.src = 'https://falconswift.online/FalconSwift.jpeg';
                                }}
                            />
                            <div className="company-glow-ring" />
                        </div>

                        <div className="company-details">
                            <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                                <span className="company-badge">Software House & Technology Partner</span>
                                <span className="company-ver-badge"><i className="bi bi-patch-check-fill me-1"></i>Official Developer</span>
                            </div>
                            <h3 className="company-name">
                                FalconSwift <span className="company-domain">www.falconswift.online</span>
                            </h3>
                            <p className="company-tagline">
                                Custom Web, Mobile Apps (iOS & Android) & AI Automation Solutions
                            </p>
                        </div>

                        <div className="company-action">
                            <span className="btn-visit-company">
                                <span>Visit Website</span>
                                <i className="bi bi-box-arrow-up-right ms-1" />
                            </span>
                        </div>
                    </a>
                </div>
            </footer>

            {/* Responsive & Theme Styles */}
            <style jsx>{`
                /* Loader */
                .loader-screen {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #0f1c24;
                }
                .spinner-glow {
                    width: 52px;
                    height: 52px;
                    border: 3px solid rgba(254, 127, 45, 0.2);
                    border-top-color: #FE7F2D;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                /* Page Root Layout */
                .login-page {
                    position: relative;
                    min-height: 100vh;
                    background: #0f1c24;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: space-between;
                    overflow-x: hidden;
                    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    padding: 36px 16px 24px;
                }

                /* Enhanced Ambient Background Glows */
                .ambient-glow {
                    position: fixed;
                    border-radius: 50%;
                    filter: blur(140px);
                    pointer-events: none;
                    z-index: 1;
                    opacity: 0.45;
                }
                .orb-teal {
                    width: 550px;
                    height: 550px;
                    background: radial-gradient(circle, rgba(33, 94, 97, 0.8) 0%, rgba(33, 94, 97, 0) 70%);
                    top: -120px;
                    left: -120px;
                }
                .orb-orange {
                    width: 500px;
                    height: 500px;
                    background: radial-gradient(circle, rgba(254, 127, 45, 0.6) 0%, rgba(254, 127, 45, 0) 70%);
                    bottom: -100px;
                    right: -100px;
                }
                .orb-top-center {
                    width: 400px;
                    height: 300px;
                    background: radial-gradient(circle, rgba(35, 61, 77, 0.7) 0%, rgba(15, 28, 36, 0) 70%);
                    top: 10%;
                    left: 50%;
                    transform: translateX(-50%);
                }

                /* Content Wrapper */
                .content-wrapper {
                    position: relative;
                    z-index: 10;
                    width: 100%;
                    max-width: 1060px;
                    margin: auto 0;
                    display: flex;
                    justify-content: center;
                }

                /* Glassmorphic Container */
                .glass-board {
                    display: flex;
                    width: 100%;
                    background: rgba(15, 28, 36, 0.75);
                    backdrop-filter: blur(28px);
                    -webkit-backdrop-filter: blur(28px);
                    border-radius: 28px;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    box-shadow: 0 35px 70px -15px rgba(0, 0, 0, 0.75),
                                0 0 50px rgba(33, 94, 97, 0.2);
                    overflow: hidden;
                }

                /* Brand & Quote Panel (Left) */
                .brand-panel {
                    flex: 1.25;
                    padding: 55px 48px;
                    color: white;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    background: linear-gradient(150deg, rgba(33, 94, 97, 0.45) 0%, rgba(23, 44, 56, 0.75) 100%);
                    border-right: 1px solid rgba(255, 255, 255, 0.08);
                    position: relative;
                }

                .brand-hero {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    margin-bottom: 36px;
                }
                .brand-icon-halo {
                    width: 68px;
                    height: 68px;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(254, 127, 45, 0.2) 0%, rgba(33, 94, 97, 0.4) 100%);
                    border: 2px solid #FE7F2D;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 32px;
                    color: #FE7F2D;
                    box-shadow: 0 0 25px rgba(254, 127, 45, 0.35);
                    flex-shrink: 0;
                }
                .brand-title {
                    font-size: 1.6rem;
                    font-weight: 800;
                    margin: 0;
                    line-height: 1.25;
                    color: #ffffff;
                }
                .text-gradient {
                    background: linear-gradient(135deg, #FE7F2D 0%, #ffaa6e 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .quote-container {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    padding: 24px;
                    position: relative;
                    margin: 30px 0;
                }
                .quote-icon-top {
                    font-size: 28px;
                    color: #FE7F2D;
                    margin-bottom: 6px;
                }
                .quote-text {
                    font-size: 0.95rem;
                    font-style: italic;
                    color: rgba(255, 255, 255, 0.85);
                    line-height: 1.5;
                    margin-bottom: 12px;
                }
                .quote-author {
                    font-size: 0.82rem;
                    font-weight: 600;
                    color: #FE7F2D;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .security-badge-pill {
                    display: inline-flex;
                    align-items: center;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: #215e61;
                    background: rgba(33, 94, 97, 0.25);
                    border: 1px solid rgba(33, 94, 97, 0.5);
                    padding: 6px 14px;
                    border-radius: 20px;
                }

                /* Form Panel (Right) */
                .form-panel {
                    flex: 1;
                    padding: 55px 48px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    background: rgba(15, 28, 36, 0.4);
                }
                .form-header {
                    margin-bottom: 30px;
                    color: white;
                }
                .form-avatar-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 14px;
                    background: rgba(33, 94, 97, 0.25);
                    border: 1px solid rgba(33, 94, 97, 0.4);
                    color: #215e61;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    margin-bottom: 16px;
                }
                .form-header h2 {
                    font-size: 1.75rem;
                    font-weight: 800;
                    margin-bottom: 6px;
                }
                .form-header p {
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 0.9rem;
                    margin: 0;
                }

                .error-alert {
                    background: rgba(220, 53, 69, 0.15);
                    border: 1px solid rgba(220, 53, 69, 0.4);
                    color: #ff6b6b;
                    padding: 12px 16px;
                    border-radius: 12px;
                    font-size: 0.85rem;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 20px;
                }

                .form-group label {
                    display: block;
                    font-size: 0.82rem;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.8);
                    margin-bottom: 8px;
                }
                .input-field-wrap {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .input-icon {
                    position: absolute;
                    left: 16px;
                    color: rgba(255, 255, 255, 0.4);
                    font-size: 18px;
                    pointer-events: none;
                }
                .form-input {
                    width: 100%;
                    height: 50px;
                    padding: 0 46px;
                    background: rgba(255, 255, 255, 0.06);
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 14px;
                    color: white;
                    font-size: 0.95rem;
                    transition: all 0.25s ease;
                }
                .form-input:focus {
                    outline: none;
                    background: rgba(255, 255, 255, 0.1);
                    border-color: #FE7F2D;
                    box-shadow: 0 0 20px rgba(254, 127, 45, 0.25);
                }
                .btn-toggle-password {
                    position: absolute;
                    right: 14px;
                    background: none;
                    border: none;
                    color: rgba(255, 255, 255, 0.4);
                    font-size: 18px;
                    cursor: pointer;
                    padding: 4px;
                }

                /* Remember Me Checkbox */
                .remember-me-label {
                    color: rgba(255, 255, 255, 0.75);
                    font-size: 0.85rem;
                    font-weight: 500;
                }
                .remember-checkbox {
                    width: 18px;
                    height: 18px;
                    accent-color: #FE7F2D;
                    cursor: pointer;
                }

                .btn-submit {
                    width: 100%;
                    height: 52px;
                    background: linear-gradient(135deg, #FE7F2D 0%, #e06512 100%);
                    color: white;
                    border: none;
                    border-radius: 14px;
                    font-size: 1rem;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    box-shadow: 0 12px 25px rgba(254, 127, 45, 0.35);
                    transition: all 0.3s ease;
                }
                .btn-submit:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 16px 30px rgba(254, 127, 45, 0.5);
                }

                .submit-spinner {
                    width: 22px;
                    height: 22px;
                    border: 2.5px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 0.7s linear infinite;
                }

                .credentials-card {
                    background: rgba(255, 255, 255, 0.04);
                    border: 1px dashed rgba(255, 255, 255, 0.15);
                    border-radius: 14px;
                    padding: 14px 16px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                }
                .credentials-content {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: rgba(255, 255, 255, 0.8);
                }
                .key-icon {
                    color: #FE7F2D;
                    font-size: 18px;
                }
                .credentials-info {
                    display: flex;
                    flex-direction: column;
                }
                .credentials-label {
                    font-size: 0.72rem;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: rgba(255, 255, 255, 0.5);
                }
                .credentials-val {
                    font-size: 0.82rem;
                }
                .btn-quick-fill {
                    background: rgba(254, 127, 45, 0.15);
                    color: #FE7F2D;
                    border: 1px solid rgba(254, 127, 45, 0.3);
                    padding: 6px 14px;
                    border-radius: 10px;
                    font-size: 0.78rem;
                    font-weight: 700;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.2s ease;
                }
                .btn-quick-fill:hover {
                    background: #FE7F2D;
                    color: white;
                }

                /* Dev Footer */
                .dev-footer {
                    position: relative;
                    z-index: 10;
                    margin-top: 30px;
                    text-align: center;
                }
                .dev-footer-title {
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: rgba(255, 255, 255, 0.4);
                    margin-bottom: 12px;
                }
                .dev-cards-row {
                    display: flex;
                    gap: 16px;
                    justify-content: center;
                    flex-wrap: wrap;
                }
                .dev-card {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    padding: 10px 16px;
                    color: white;
                    text-decoration: none;
                    transition: all 0.3s ease;
                }
                .dev-card:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: #FE7F2D;
                    transform: translateY(-2px);
                }
                .dev-avatar-wrapper {
                    position: relative;
                    width: 36px;
                    height: 36px;
                }
                .dev-avatar-img {
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    object-fit: cover;
                }
                .dev-online-ring {
                    position: absolute;
                    bottom: 0;
                    right: 0;
                    width: 10px;
                    height: 10px;
                    background: #198754;
                    border: 2px solid #0f1c24;
                    border-radius: 50%;
                }
                .dev-avatar-placeholder {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: #215e61;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                }
                .dev-meta {
                    text-align: left;
                }
                .dev-role-badge {
                    font-size: 0.65rem;
                    color: #FE7F2D;
                    font-weight: 700;
                    display: block;
                }
                .dev-name {
                    font-size: 0.85rem;
                    font-weight: 700;
                    margin: 0;
                    color: white;
                }
                .dev-bio {
                    font-size: 0.72rem;
                    color: rgba(255, 255, 255, 0.5);
                    margin: 0;
                }

                /* ── Android & Tablet Responsive Media Queries ── */
                @media (max-width: 991px) {
                    .login-page {
                        padding: 16px 12px 24px;
                    }
                    .glass-board {
                        flex-direction: column;
                        border-radius: 24px;
                    }
                    .brand-panel {
                        padding: 30px 24px 20px;
                        border-right: none;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                        align-items: center;
                        text-align: center;
                    }
                    .brand-hero {
                        flex-direction: column;
                        margin-bottom: 12px;
                        gap: 12px;
                    }
                    .quote-container {
                        display: none;
                    }
                    .form-panel {
                        padding: 32px 24px;
                    }
                    .brand-title {
                        font-size: 1.35rem;
                    }
                    .mobile-logo-img {
                        width: 64px;
                        height: 64px;
                        border-radius: 50%;
                        border: 2px solid #FE7F2D;
                        object-fit: contain;
                    }
                    .mobile-logo-icon {
                        width: 60px;
                        height: 60px;
                        border-radius: 50%;
                        background: #215e61;
                        color: #FE7F2D;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 28px;
                        margin: 0 auto;
                    }
                }

                /* FalconSwift Official Company Profile Styles */
                .company-credit-card {
                    max-width: 700px;
                    width: 100%;
                    margin: 0 auto;
                    background: rgba(15, 28, 36, 0.85);
                    backdrop-filter: blur(24px);
                    border: 1px solid rgba(254, 127, 45, 0.35);
                    border-radius: 20px;
                    padding: 16px 24px;
                    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5), 0 0 25px rgba(254, 127, 45, 0.15);
                    transition: all 0.35s ease;
                }
                .company-credit-card:hover {
                    border-color: #FE7F2D;
                    transform: translateY(-3px);
                    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.6), 0 0 35px rgba(254, 127, 45, 0.3);
                }
                .company-credit-link {
                    display: flex;
                    align-items: center;
                    gap: 18px;
                    text-decoration: none;
                    color: #ffffff;
                }
                .company-logo-wrapper {
                    position: relative;
                    width: 52px;
                    height: 52px;
                    flex-shrink: 0;
                    border-radius: 50%;
                    background: #001836;
                    padding: 3px;
                    border: 2px solid #FE7F2D;
                    box-shadow: 0 0 15px rgba(254, 127, 45, 0.4);
                }
                .company-logo-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    border-radius: 50%;
                }
                .company-glow-ring {
                    position: absolute;
                    inset: -4px;
                    border-radius: 50%;
                    border: 1px dashed rgba(254, 127, 45, 0.6);
                    animation: spinRing 12s linear infinite;
                }
                .company-details {
                    flex: 1;
                    min-width: 0;
                }
                .company-badge {
                    background: rgba(33, 94, 97, 0.45);
                    color: #8ce0e4;
                    border: 1px solid rgba(33, 94, 97, 0.7);
                    font-size: 0.7rem;
                    font-weight: 700;
                    padding: 2px 9px;
                    border-radius: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }
                .company-ver-badge {
                    background: rgba(254, 127, 45, 0.15);
                    color: #FE7F2D;
                    border: 1px solid rgba(254, 127, 45, 0.4);
                    font-size: 0.7rem;
                    font-weight: 700;
                    padding: 2px 9px;
                    border-radius: 12px;
                }
                .company-name {
                    font-size: 1.2rem;
                    font-weight: 800;
                    color: #ffffff;
                    margin: 4px 0 2px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                .company-domain {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #FE7F2D;
                    opacity: 0.95;
                }
                .company-tagline {
                    font-size: 0.8rem;
                    color: rgba(255, 255, 255, 0.75);
                    margin: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .btn-visit-company {
                    display: inline-flex;
                    align-items: center;
                    background: linear-gradient(135deg, #215e61, #164345);
                    color: #ffffff;
                    border: 1px solid rgba(140, 224, 228, 0.4);
                    padding: 8px 16px;
                    border-radius: 12px;
                    font-size: 0.8rem;
                    font-weight: 700;
                    white-space: nowrap;
                    transition: all 0.3s ease;
                }
                .company-credit-card:hover .btn-visit-company {
                    background: linear-gradient(135deg, #FE7F2D, #d66418);
                    border-color: #FE7F2D;
                    box-shadow: 0 4px 15px rgba(254, 127, 45, 0.4);
                }
                @media (max-width: 640px) {
                    .company-credit-link {
                        flex-direction: column;
                        text-align: center;
                        gap: 12px;
                    }
                    .company-name {
                        justify-content: center;
                    }
                    .company-tagline {
                        white-space: normal;
                    }
                }
            `}</style>
        </div>
    );
}