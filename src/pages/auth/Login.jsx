import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  clearOauthHash,
  extractAccessTokenFromHash,
  getGoogleAuthorizeUrl,
  resendSignupConfirmation,
  signInWithSupabase,
  storeToken,
  verifyBackendUser,
} from "../../lib/auth";

/* ─── inline styles (no external CSS file needed) ─── */
const S = {
  root: {
    minHeight: "100vh",
    background: "#040d12",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'DM Sans', sans-serif",
    position: "relative",
    overflow: "hidden",
  },
};

const Login = ({ mode = "participant" }) => {
  const navigate = useNavigate();
  const isAdmin = mode === "admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [canResend, setCanResend] = useState(false);

  /* handle OAuth redirect */
  useEffect(() => {
    const token = extractAccessTokenFromHash();
    if (!token) return;
    (async () => {
      try {
        await verifyBackendUser(token);
        storeToken(token, true);
        clearOauthHash();
        navigate("/dashboard", { replace: true });
      } catch (err) {
        clearOauthHash();
        setError(err.message || "Google sign-in failed.");
      }
    })();
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setInfo(""); setCanResend(false);
    if (!email || !password) { setError("Email and password are required."); return; }
    setIsSubmitting(true);
    try {
      const token = await signInWithSupabase({ email, password });
      await verifyBackendUser(token);
      storeToken(token, true);
      setPassword("");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const msg = String(err?.message || "");
      const low = msg.toLowerCase();
      if (msg === "User not approved") setError("Your account is pending admin approval.");
      else if (msg === "User profile not found") setError("Profile not set up. Please register first.");
      else if (low.includes("email not confirmed")) { setError("Email not confirmed. Please verify your inbox."); setCanResend(true); }
      else setError(msg || "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError(""); setInfo("");
    if (!email.trim()) { setError("Enter your email first, then click resend."); return; }
    setIsResending(true);
    try {
      await resendSignupConfirmation(email.trim());
      setInfo("Verification email sent. Check your inbox and spam folder.");
      setCanResend(false);
    } catch (err) {
      setError(err?.message || "Unable to resend verification email.");
    } finally {
      setIsResending(false);
    }
  };

  const handleGoogle = () => {
    try { window.location.href = getGoogleAuthorizeUrl(); }
    catch (err) { setError(err.message || "Google sign-in unavailable."); }
  };

  const accentColor = isAdmin ? "#00c6ff" : "#00e5a0";
  const accentGlow  = isAdmin ? "rgba(0,198,255,0.25)" : "rgba(0,229,160,0.25)";
  const accentFaint = isAdmin ? "rgba(0,198,255,0.08)" : "rgba(0,229,160,0.08)";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          background: #040d12;
          display: flex; align-items: center; justify-content: center;
          font-family: 'DM Sans', sans-serif;
          position: relative; overflow: hidden;
        }

        /* Orbs */
        .l-orb {
          position: fixed; border-radius: 50%;
          filter: blur(90px); pointer-events: none;
        }
        .l-orb-1 {
          width: 550px; height: 550px;
          background: radial-gradient(circle, #00c6ff, #0072ff);
          top: -18%; left: -12%; opacity: 0.14;
          animation: lOrb 14s ease-in-out infinite alternate;
        }
        .l-orb-2 {
          width: 440px; height: 440px;
          background: radial-gradient(circle, #00e5a0, #00b4d8);
          bottom: -12%; right: -10%; opacity: 0.10;
          animation: lOrb 10s ease-in-out infinite alternate-reverse;
        }
        @keyframes lOrb {
          from { transform: translate(0,0) scale(1); }
          to   { transform: translate(25px,-18px) scale(1.06); }
        }

        /* Grid */
        .l-grid {
          position: fixed; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(0,198,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,198,255,0.025) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        /* Shimmer */
        .l-shimmer {
          position: fixed; top: 0; left: 0; right: 0; height: 1px; z-index: 10;
          background: linear-gradient(90deg, transparent, #00c6ff 40%, #00e5a0 60%, transparent);
          animation: lShimmer 4s ease-in-out infinite;
        }
        @keyframes lShimmer { 0%,100%{opacity:.35} 50%{opacity:1} }

        /* Card */
        .l-wrap {
          position: relative; z-index: 1;
          width: 100%; max-width: 460px;
          padding: 1.5rem;
          animation: lUp .75s cubic-bezier(.22,1,.36,1) both;
        }
        @keyframes lUp {
          from { opacity:0; transform:translateY(28px); }
          to   { opacity:1; transform:translateY(0); }
        }

        /* Back link */
        .l-back {
          display: inline-flex; align-items: center; gap: .4rem;
          color: rgba(255,255,255,.35); font-size: .8rem; font-weight: 400;
          text-decoration: none; margin-bottom: 2rem;
          transition: color .2s;
        }
        .l-back:hover { color: rgba(255,255,255,.7); }
        .l-back svg { width: 14px; height: 14px; }

        /* Brand mini */
        .l-brand {
          display: flex; align-items: center; justify-content: center; gap: .75rem;
          margin-bottom: 2.25rem;
        }
        .l-brand-mark {
          width: 36px; height: 36px; border-radius: 10px;
          background: linear-gradient(135deg,#00c6ff,#00e5a0);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 0 24px rgba(0,198,255,.4);
        }
        .l-brand-mark svg { width: 18px; height: 18px; }
        .l-brand-text { font-family:'Syne',sans-serif; font-weight:800; font-size:1.15rem; color:#fff; letter-spacing:-.02em; }
        .l-brand-sub  { font-size:.7rem; font-weight:300; color:rgba(255,255,255,.35); letter-spacing:.1em; text-transform:uppercase; }

        /* Card shell */
        .l-card {
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 22px;
          padding: 2.25rem 2rem;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }

        /* Role badge */
        .l-badge {
          display: inline-flex; align-items: center; gap: .35rem;
          font-size: .65rem; font-weight: 600; letter-spacing: .12em;
          text-transform: uppercase; padding: 4px 12px;
          border-radius: 100px; margin-bottom: 1rem;
        }
        .l-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

        .l-heading {
          font-family: 'Syne',sans-serif;
          font-size: 1.75rem; font-weight: 800;
          color: #fff; letter-spacing: -.025em;
          margin-bottom: .35rem;
        }
        .l-note { font-size:.845rem; font-weight:300; color:rgba(255,255,255,.38); margin-bottom:1.75rem; }

        /* Alerts */
        .l-alert {
          border-radius: 10px; padding: .7rem 1rem;
          font-size: .845rem; font-weight: 400;
          margin-bottom: 1.25rem;
          animation: lUp .3s ease both;
        }
        .l-alert-err { background: rgba(255,80,80,.1); border:1px solid rgba(255,80,80,.25); color:#ff8080; }
        .l-alert-ok  { background: rgba(0,229,160,.1); border:1px solid rgba(0,229,160,.25); color:#00e5a0; }

        /* Google button */
        .l-google {
          width: 100%; padding: .8rem 1rem;
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 12px; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: .65rem;
          color: rgba(255,255,255,.8); font-size: .9rem; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          transition: background .25s, border-color .25s, transform .2s;
          margin-bottom: 1.5rem;
        }
        .l-google:hover {
          background: rgba(255,255,255,.1);
          border-color: rgba(255,255,255,.2);
          transform: translateY(-2px);
        }
        .l-google:active { transform: translateY(0); }
        .l-google svg { width: 18px; height: 18px; flex-shrink: 0; }

        /* Divider */
        .l-divider {
          display: flex; align-items: center; gap: .75rem;
          margin-bottom: 1.5rem;
        }
        .l-divider-line { flex: 1; height: 1px; background: rgba(255,255,255,.08); }
        .l-divider-text { font-size: .75rem; color: rgba(255,255,255,.25); font-weight:300; white-space:nowrap; }

        /* Form */
        .l-form-group { margin-bottom: 1.1rem; }
        .l-label {
          display: block; font-size: .8rem; font-weight: 500;
          color: rgba(255,255,255,.55); margin-bottom: .45rem; letter-spacing: .02em;
        }
        .l-input {
          width: 100%; padding: .78rem 1rem;
          background: rgba(255,255,255,.05);
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 11px; color: #fff;
          font-size: .9rem; font-family: 'DM Sans', sans-serif; font-weight: 400;
          transition: border-color .25s, box-shadow .25s, background .25s;
          outline: none;
        }
        .l-input::placeholder { color: rgba(255,255,255,.2); }
        .l-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-faint);
          background: rgba(255,255,255,.07);
        }

        /* Password wrapper */
        .l-pw-wrap { position: relative; }
        .l-pw-wrap .l-input { padding-right: 3rem; }
        .l-eye {
          position: absolute; right: .85rem; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; padding: 4px;
          color: rgba(255,255,255,.3); transition: color .2s;
          display: flex; align-items: center;
        }
        .l-eye:hover { color: rgba(255,255,255,.65); }
        .l-eye svg { width: 17px; height: 17px; }

        /* Submit */
        .l-submit {
          width: 100%; padding: .85rem 1rem;
          background: var(--accent);
          border: none; border-radius: 12px; cursor: pointer;
          font-family: 'DM Sans', sans-serif; font-size: .93rem; font-weight: 600;
          color: #040d12; letter-spacing: .01em;
          box-shadow: 0 0 28px var(--accent-glow);
          transition: opacity .2s, transform .2s, box-shadow .2s;
          margin-top: .35rem;
        }
        .l-submit:hover:not(:disabled) {
          opacity: .9; transform: translateY(-2px);
          box-shadow: 0 6px 36px var(--accent-glow);
        }
        .l-submit:active:not(:disabled) { transform: translateY(0); }
        .l-submit:disabled { opacity: .5; cursor: not-allowed; }

        /* Resend */
        .l-resend {
          width: 100%; padding: .75rem 1rem; margin-top: .65rem;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 12px; cursor: pointer;
          font-family: 'DM Sans',sans-serif; font-size: .875rem; font-weight: 500;
          color: rgba(255,255,255,.55);
          transition: background .2s, border-color .2s;
        }
        .l-resend:hover { background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.18); }
        .l-resend:disabled { opacity:.45; cursor:not-allowed; }

        /* Footer links */
        .l-foot { text-align:center; margin-top:1.5rem; font-size:.845rem; font-weight:300; color:rgba(255,255,255,.3); }
        .l-link { font-weight:500; text-decoration:none; transition:opacity .2s; }
        .l-link:hover { opacity:.75; }
      `}</style>

      {/* CSS vars for accent colour */}
      <style>{`:root { --accent: ${accentColor}; --accent-glow: ${accentGlow}; --accent-faint: ${accentFaint}; }`}</style>

      <div className="login-root">
        <div className="l-shimmer" />
        <div className="l-orb l-orb-1" />
        <div className="l-orb l-orb-2" />
        <div className="l-grid" />

        <div className="l-wrap">

          {/* Back link */}
          <Link to="/login" className="l-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Back to login selection
          </Link>

          {/* Brand row */}
          <div className="l-brand">
            <div className="l-brand-mark">
              <svg viewBox="0 0 24 24" fill="white">
                <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z"/>
              </svg>
            </div>
            <div>
              <div className="l-brand-text">Nitro</div>
              <div className="l-brand-sub">By TeamSuccesso</div>
            </div>
          </div>

          {/* Card */}
          <div className="l-card">

            {/* Badge */}
            <div
              className="l-badge"
              style={{
                color: accentColor,
                background: accentFaint,
                border: `1px solid ${accentGlow}`,
              }}
            >
              <span className="l-badge-dot" />
              {isAdmin ? "Admin Access" : "Participant"}
            </div>

            <h1 className="l-heading">{isAdmin ? "Admin Sign In" : "Welcome back"}</h1>
            <p className="l-note">
              {isAdmin
                ? "Restricted to admins and super admins only."
                : "Sign in to your participant account."}
            </p>

            {/* Alerts */}
            {error && <div className="l-alert l-alert-err">{error}</div>}
            {info  && <div className="l-alert l-alert-ok">{info}</div>}

            {/* Google OAuth */}
            <button type="button" className="l-google" onClick={handleGoogle}>
              {/* Google colour logo */}
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className="l-divider">
              <div className="l-divider-line"/>
              <span className="l-divider-text">or sign in with email</span>
              <div className="l-divider-line"/>
            </div>

            {/* Email / Password form */}
            <form onSubmit={handleLogin} noValidate>
              <div className="l-form-group">
                <label htmlFor="email" className="l-label">Email Address</label>
                <input
                  id="email" type="email" className="l-input"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com" autoComplete="email"
                />
              </div>

              <div className="l-form-group">
                <label htmlFor="password" className="l-label">Password</label>
                <div className="l-pw-wrap">
                  <input
                    id="password" type={showPassword ? "text" : "password"}
                    className="l-input"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" autoComplete="current-password"
                  />
                  <button
                    type="button" className="l-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7C20.268 16.057 16.477 19 12 19S3.732 16.057 2.458 12z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3l18 18M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-4.4M9.9 5.1A9.8 9.8 0 0 1 12 5c4.48 0 8.27 2.94 9.54 7a9.67 9.67 0 0 1-2.36 3.8M6.2 6.2A9.76 9.76 0 0 0 2.46 12C3.73 16.06 7.52 19 12 19c1.74 0 3.37-.45 4.78-1.23"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit" className="l-submit"
                disabled={isSubmitting || isResending}
              >
                {isSubmitting ? "Signing in…" : "Sign In"}
              </button>
            </form>

            {canResend && (
              <button
                type="button" className="l-resend"
                onClick={handleResend}
                disabled={isSubmitting || isResending}
              >
                {isResending ? "Sending…" : "Resend Verification Email"}
              </button>
            )}
          </div>

          {/* Footer — only show register link for participants, no duplicate back link */}
          {!isAdmin && (
            <div className="l-foot">
              <p>
                New participant?&nbsp;
                <Link to="/register" className="l-link" style={{ color: accentColor }}>
                  Register here
                </Link>
              </p>
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default Login;