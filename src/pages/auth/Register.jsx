import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  signUpWithSupabase,
  getGoogleAuthorizeUrl,
  clearOauthHash,
  extractAccessTokenFromHash,
  verifyBackendUser,
  storeToken,
} from "../../lib/auth";

const SIGNUP_COOLDOWN_UNTIL_KEY = "nitro_signup_cooldown_until";

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());

const EyeOpen = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7C20.268 16.057 16.477 19 12 19S3.732 16.057 2.458 12z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOff = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3l18 18M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-4.4M9.9 5.1A9.8 9.8 0 0 1 12 5c4.48 0 8.27 2.94 9.54 7a9.67 9.67 0 0 1-2.36 3.8M6.2 6.2A9.76 9.76 0 0 0 2.46 12C3.73 16.06 7.52 19 12 19c1.74 0 3.37-.45 4.78-1.23"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5"/>
  </svg>
);

const Register = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showCPw, setShowCPw] = useState(false);

  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [accountType, setAccountType] = useState("SAVINGS");
  const [upiId, setUpiId] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* Google OAuth callback */
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
        setError(err.message || "Google sign-in failed. Please complete registration manually.");
      }
    })();
  }, [navigate]);

  /* cooldown */
  useEffect(() => {
    const saved = Number(localStorage.getItem(SIGNUP_COOLDOWN_UNTIL_KEY) || 0);
    if (saved > Date.now()) setCooldown(Math.ceil((saved - Date.now()) / 1000));
  }, []);
  useEffect(() => {
    if (cooldown <= 0) { localStorage.removeItem(SIGNUP_COOLDOWN_UNTIL_KEY); return; }
    localStorage.setItem(SIGNUP_COOLDOWN_UNTIL_KEY, String(Date.now() + cooldown * 1000));
    const t = setInterval(() => setCooldown((p) => (p > 1 ? p - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  /* password strength */
  const pwStrength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  const pwLabel  = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"][pwStrength];
  const pwColors = ["", "#ff4d4d", "#ff9f00", "#f0c040", "#00c6ff", "#00e5a0"];

  const emailValid   = isValidEmail(email);
  const emailInvalid = emailTouched && email && !emailValid;

  const handleNext = () => {
    setError(""); setSuccess("");
    if (!fullName.trim())         { setError("Full name is required."); return; }
    if (!email.trim())            { setError("Email address is required."); return; }
    if (!emailValid)              { setEmailTouched(true); setError("Enter a valid email address (e.g. name@example.com)."); return; }
    if (!phone.trim())            { setError("Phone number is required."); return; }
    if (!password)                { setError("Password is required."); return; }
    if (password.length < 6)      { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!accountHolderName.trim() || !accountNumber.trim() || !confirmAccountNumber.trim() || !ifscCode.trim()) {
      setError("Account holder name, account number and IFSC code are required."); return;
    }
    if (accountNumber.trim() !== confirmAccountNumber.trim()) { setError("Bank account numbers do not match."); return; }
    if (cooldown > 0) { setError(`Too many attempts. Wait ${cooldown}s.`); return; }

    setIsSubmitting(true);
    try {
      await signUpWithSupabase({
        email: email.trim(), password,
        fullName: fullName.trim(), phone: phone.trim(),
        registrationDetails: {
          phone: phone.trim(),
          bank_details: {
            account_holder_name: accountHolderName.trim(),
            account_number: accountNumber.trim(),
            ifsc_code: ifscCode.trim().toUpperCase(),
            account_type: accountType,
            upi_id: upiId.trim() || null,
          },
          terms_accepted: false, terms_accepted_at: null,
        },
      });
      setSuccess("Account created! Check your email to verify, then await admin approval. Redirecting…");
      setTimeout(() => navigate("/login/participant", { replace: true }), 2500);
    } catch (err) {
      const raw = String(err?.message || "");
      const low = raw.toLowerCase();
      if (err?.status === 429 || low.includes("rate limit")) {
        const w = Number(err?.retryAfter) > 0 ? Number(err.retryAfter) : 60;
        setCooldown(w); setError(`Too many attempts. Wait ${w}s before trying again.`);
      } else if (low.includes("already registered") || low.includes("already been registered")) {
        setError("This email is already registered. Sign in instead.");
      } else {
        setError(raw || "Unable to register. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = () => {
    try { window.location.href = getGoogleAuthorizeUrl(); }
    catch (err) { setError(err.message || "Google sign-up unavailable."); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        .rg-root{min-height:100vh;background:#040d12;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif;position:relative;overflow-x:hidden;padding:2rem 1.25rem;}
        .rg-orb{position:fixed;border-radius:50%;filter:blur(90px);pointer-events:none;}
        .rg-orb-1{width:560px;height:560px;background:radial-gradient(circle,#00c6ff,#0072ff);top:-15%;left:-10%;opacity:.13;animation:rgO 14s ease-in-out infinite alternate;}
        .rg-orb-2{width:440px;height:440px;background:radial-gradient(circle,#00e5a0,#00b4d8);bottom:-12%;right:-8%;opacity:.09;animation:rgO 10s ease-in-out infinite alternate-reverse;}
        @keyframes rgO{from{transform:translate(0,0) scale(1)}to{transform:translate(22px,-16px) scale(1.06)}}
        .rg-grid{position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(0,198,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,198,255,.025) 1px,transparent 1px);background-size:60px 60px;}
        .rg-shimmer{position:fixed;top:0;left:0;right:0;height:1px;z-index:10;background:linear-gradient(90deg,transparent,#00c6ff 40%,#00e5a0 60%,transparent);animation:rgS 4s ease-in-out infinite;}
        @keyframes rgS{0%,100%{opacity:.35}50%{opacity:1}}
        .rg-wrap{position:relative;z-index:1;width:100%;max-width:500px;animation:rgU .75s cubic-bezier(.22,1,.36,1) both;}
        @keyframes rgU{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
        .rg-back{display:inline-flex;align-items:center;gap:.4rem;color:rgba(255,255,255,.32);font-size:.8rem;text-decoration:none;margin-bottom:1.75rem;transition:color .2s;}
        .rg-back:hover{color:rgba(255,255,255,.65);}
        .rg-back svg{width:14px;height:14px;}
        .rg-brand{display:flex;align-items:center;justify-content:center;gap:.7rem;margin-bottom:2rem;}
        .rg-mark{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#00c6ff,#00e5a0);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 0 24px rgba(0,198,255,.45);}
        .rg-mark svg{width:18px;height:18px;}
        .rg-name{font-family:'Syne',sans-serif;font-weight:800;font-size:1.15rem;color:#fff;letter-spacing:-.02em;}
        .rg-by{font-size:.7rem;font-weight:300;color:rgba(255,255,255,.32);letter-spacing:.1em;text-transform:uppercase;}
        .rg-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:22px;padding:2.25rem 2rem;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);}
        .rg-stepper{display:flex;align-items:center;margin-bottom:1.85rem;}
        .rg-step{flex:1;display:flex;align-items:center;gap:.55rem;padding:.6rem .85rem;border-radius:10px;font-size:.8rem;font-weight:500;border:1px solid transparent;color:rgba(255,255,255,.28);transition:all .3s;cursor:default;}
        .rg-step.done{color:rgba(255,255,255,.45);}
        .rg-step.active{background:rgba(0,198,255,.1);border-color:rgba(0,198,255,.25);color:#00c6ff;}
        .rg-step-num{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;flex-shrink:0;background:rgba(255,255,255,.08);transition:background .3s,color .3s;}
        .rg-step.active .rg-step-num{background:#00c6ff;color:#040d12;}
        .rg-step.done  .rg-step-num{background:rgba(0,198,255,.25);color:#00c6ff;}
        .rg-step-div{width:28px;height:1px;background:rgba(255,255,255,.1);flex-shrink:0;margin:0 .15rem;}
        .rg-heading{font-family:'Syne',sans-serif;font-size:1.6rem;font-weight:800;color:#fff;letter-spacing:-.025em;margin-bottom:.3rem;}
        .rg-sub{font-size:.845rem;font-weight:300;color:rgba(255,255,255,.38);margin-bottom:1.4rem;}
        .rg-google{width:100%;padding:.82rem 1rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:.65rem;color:rgba(255,255,255,.82);font-size:.9rem;font-weight:500;font-family:'DM Sans',sans-serif;transition:background .25s,border-color .25s,transform .2s;margin-bottom:1.25rem;}
        .rg-google:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2);transform:translateY(-2px);}
        .rg-google svg{width:18px;height:18px;flex-shrink:0;}
        .rg-divider{display:flex;align-items:center;gap:.75rem;margin-bottom:1.35rem;}
        .rg-div-line{flex:1;height:1px;background:rgba(255,255,255,.08);}
        .rg-div-txt{font-size:.75rem;color:rgba(255,255,255,.25);font-weight:300;white-space:nowrap;}
        .rg-alert{border-radius:10px;padding:.7rem 1rem;font-size:.845rem;margin-bottom:1.25rem;animation:rgU .3s ease both;}
        .rg-err{background:rgba(255,80,80,.1);border:1px solid rgba(255,80,80,.25);color:#ff8080;}
        .rg-ok{background:rgba(0,229,160,.1);border:1px solid rgba(0,229,160,.25);color:#00e5a0;}
        .rg-fg{margin-bottom:1.1rem;}
        .rg-fg-last{margin-bottom:1.5rem;}
        .rg-lbl{display:block;font-size:.8rem;font-weight:500;color:rgba(255,255,255,.52);margin-bottom:.42rem;letter-spacing:.02em;}
        .rg-inp{width:100%;padding:.76rem 1rem;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:11px;color:#fff;font-size:.9rem;font-family:'DM Sans',sans-serif;outline:none;transition:border-color .25s,box-shadow .25s,background .25s;}
        .rg-inp::placeholder{color:rgba(255,255,255,.2);}
        .rg-inp:focus{border-color:#00c6ff;box-shadow:0 0 0 3px rgba(0,198,255,.09);background:rgba(255,255,255,.07);}
        .rg-inp.invalid{border-color:rgba(255,80,80,.5) !important;box-shadow:0 0 0 3px rgba(255,80,80,.08) !important;}
        .rg-inp.valid{border-color:rgba(0,229,160,.4);}
        .rg-inp-pw{padding-right:3rem;}
        .rg-inp.uc{letter-spacing:.06em;font-weight:500;}
        select.rg-inp option{background:#0d1f2d;color:#fff;}
        .rg-field-hint{font-size:.74rem;margin-top:.38rem;display:flex;align-items:center;gap:.35rem;}
        .rg-hint-err{color:#ff8080;}
        .rg-hint-ok{color:#00e5a0;}
        .rg-hint-info{color:rgba(255,255,255,.28);}
        .rg-pw-wrap{position:relative;}
        .rg-eye{position:absolute;right:.85rem;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;padding:4px;color:rgba(255,255,255,.3);display:flex;align-items:center;transition:color .2s;}
        .rg-eye:hover{color:rgba(255,255,255,.65);}
        .rg-eye svg{width:17px;height:17px;}
        .rg-pw-bar{display:flex;gap:4px;margin-top:.5rem;}
        .rg-pw-seg{flex:1;height:3px;border-radius:100px;background:rgba(255,255,255,.08);transition:background .4s;}
        .rg-match{font-size:.75rem;margin-top:.4rem;}
        .rg-match-ok{color:#00e5a0;}
        .rg-match-bad{color:#ff8080;}
        .rg-type-group{display:flex;gap:.6rem;}
        .rg-type-pill{flex:1;padding:.65rem;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);color:rgba(255,255,255,.45);font-size:.85rem;font-weight:500;cursor:pointer;text-align:center;font-family:'DM Sans',sans-serif;transition:all .25s;}
        .rg-type-pill.sel{background:rgba(0,198,255,.1);border-color:rgba(0,198,255,.3);color:#00c6ff;}
        .rg-sec-lbl{font-size:.7rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.25);margin-bottom:1rem;display:flex;align-items:center;gap:.6rem;}
        .rg-sec-lbl::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.07);}
        .rg-optional{display:inline-block;font-size:.65rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;padding:2px 8px;border-radius:100px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.3);border:1px solid rgba(255,255,255,.08);margin-left:.45rem;vertical-align:middle;}
        .rg-btn-primary{width:100%;padding:.86rem 1rem;background:#00c6ff;border:none;border-radius:12px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:.93rem;font-weight:600;color:#040d12;letter-spacing:.01em;box-shadow:0 0 28px rgba(0,198,255,.28);transition:opacity .2s,transform .2s,box-shadow .2s;margin-top:.25rem;}
        .rg-btn-primary:hover:not(:disabled){opacity:.9;transform:translateY(-2px);box-shadow:0 6px 36px rgba(0,198,255,.35);}
        .rg-btn-primary:active:not(:disabled){transform:translateY(0);}
        .rg-btn-primary:disabled{opacity:.45;cursor:not-allowed;}
        .rg-btn-ghost{width:100%;padding:.82rem 1rem;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:12px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:.9rem;font-weight:500;color:rgba(255,255,255,.5);transition:background .2s,border-color .2s;margin-top:.6rem;}
        .rg-btn-ghost:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.18);color:rgba(255,255,255,.75);}
        .rg-btn-ghost:disabled{opacity:.4;cursor:not-allowed;}
        .rg-foot{text-align:center;margin-top:1.5rem;font-size:.845rem;font-weight:300;color:rgba(255,255,255,.3);}
        .rg-foot a{color:#00c6ff;font-weight:500;text-decoration:none;transition:opacity .2s;}
        .rg-foot a:hover{opacity:.75;}
        .rg-sc{display:none;}
        .rg-sc.active{display:block;animation:rgU .4s cubic-bezier(.22,1,.36,1) both;}
      `}</style>

      <div className="rg-root">
        <div className="rg-shimmer"/>
        <div className="rg-orb rg-orb-1"/><div className="rg-orb rg-orb-2"/>
        <div className="rg-grid"/>

        <div className="rg-wrap">
          <Link to="/login/participant" className="rg-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Back to sign in
          </Link>

          <div className="rg-brand">
            <div className="rg-mark"><svg viewBox="0 0 24 24" fill="white"><path d="M13 2L3 14H12L11 22L21 10H12L13 2Z"/></svg></div>
            <div><div className="rg-name">Nitro</div><div className="rg-by">By TeamSuccesso</div></div>
          </div>

          <div className="rg-card">
            {/* Stepper */}
            <div className="rg-stepper">
              <div className={`rg-step ${step === 1 ? "active" : "done"}`}>
                <div className="rg-step-num">{step > 1 ? <CheckIcon/> : "1"}</div>
                Personal Details
              </div>
              <div className="rg-step-div"/>
              <div className={`rg-step ${step === 2 ? "active" : ""}`}>
                <div className="rg-step-num">2</div>
                Bank Details
              </div>
            </div>

            {error   && <div className="rg-alert rg-err">{error}</div>}
            {success && <div className="rg-alert rg-ok">{success}</div>}

            {/* ── STEP 1 ── */}
            <div className={`rg-sc ${step === 1 ? "active" : ""}`}>
              <h1 className="rg-heading">Create Account</h1>
              <p className="rg-sub">Sign up with Google or fill your details below.</p>

              <button type="button" className="rg-google" onClick={handleGoogle}>
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <div className="rg-divider">
                <div className="rg-div-line"/><span className="rg-div-txt">or register with email</span><div className="rg-div-line"/>
              </div>

              {/* Full Name */}
              <div className="rg-fg">
                <label htmlFor="fullName" className="rg-lbl">Full Name</label>
                <input id="fullName" type="text" className="rg-inp" value={fullName}
                  onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" autoComplete="name"/>
              </div>

              {/* Email with live validation */}
              <div className="rg-fg">
                <label htmlFor="email" className="rg-lbl">Email Address</label>
                <input id="email" type="email"
                  className={`rg-inp ${emailTouched && email ? (emailValid ? "valid" : "invalid") : ""}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  placeholder="name@example.com" autoComplete="email"/>
                {emailInvalid && (
                  <div className="rg-field-hint rg-hint-err">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    Enter a valid email like name@example.com
                  </div>
                )}
                {emailTouched && emailValid && (
                  <div className="rg-field-hint rg-hint-ok">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                    Looks good!
                  </div>
                )}
                {!emailTouched && (
                  <div className="rg-field-hint rg-hint-info">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    Use your real email — we'll send a verification link
                  </div>
                )}
              </div>

              {/* Phone */}
              <div className="rg-fg">
                <label htmlFor="phone" className="rg-lbl">Phone Number</label>
                <input id="phone" type="tel" className="rg-inp" value={phone}
                  onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" autoComplete="tel"/>
              </div>

              {/* Password */}
              <div className="rg-fg">
                <label htmlFor="password" className="rg-lbl">Password</label>
                <div className="rg-pw-wrap">
                  <input id="password" type={showPw ? "text" : "password"} className="rg-inp rg-inp-pw"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters" autoComplete="new-password"/>
                  <button type="button" className="rg-eye" onClick={() => setShowPw(v => !v)}>{showPw ? <EyeOpen/> : <EyeOff/>}</button>
                </div>
                {password && (
                  <>
                    <div className="rg-pw-bar">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="rg-pw-seg" style={{ background: i <= pwStrength ? pwColors[pwStrength] : "rgba(255,255,255,.08)" }}/>
                      ))}
                    </div>
                    <div style={{ fontSize:".72rem", color: pwColors[pwStrength], marginTop:".3rem" }}>{pwLabel}</div>
                  </>
                )}
              </div>

              {/* Confirm Password */}
              <div className="rg-fg rg-fg-last">
                <label htmlFor="cpw" className="rg-lbl">Confirm Password</label>
                <div className="rg-pw-wrap">
                  <input id="cpw" type={showCPw ? "text" : "password"} className="rg-inp rg-inp-pw"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password" autoComplete="new-password"/>
                  <button type="button" className="rg-eye" onClick={() => setShowCPw(v => !v)}>{showCPw ? <EyeOpen/> : <EyeOff/>}</button>
                </div>
                {confirmPassword && (
                  <div className={`rg-match ${confirmPassword === password ? "rg-match-ok" : "rg-match-bad"}`}>
                    {confirmPassword === password ? "✓ Passwords match" : "✗ Passwords don't match"}
                  </div>
                )}
              </div>

              <button type="button" className="rg-btn-primary" onClick={handleNext} disabled={cooldown > 0}>
                Continue to Bank Details →
              </button>
            </div>

            {/* ── STEP 2 ── */}
            <div className={`rg-sc ${step === 2 ? "active" : ""}`}>
              <form onSubmit={handleSubmit} noValidate>
                <h1 className="rg-heading">Bank Details</h1>
                <p className="rg-sub">Required for payout processing. Kept securely.</p>

                <div className="rg-sec-lbl">Account Info</div>

                <div className="rg-fg">
                  <label htmlFor="holderName" className="rg-lbl">Account Holder Name</label>
                  <input id="holderName" type="text" className="rg-inp" value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)} placeholder="Name as per bank account"/>
                </div>
                <div className="rg-fg">
                  <label htmlFor="accNum" className="rg-lbl">Account Number</label>
                  <input id="accNum" type="text" className="rg-inp" value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)} placeholder="Bank account number" autoComplete="off"/>
                </div>
                <div className="rg-fg">
                  <label htmlFor="confAccNum" className="rg-lbl">Confirm Account Number</label>
                  <input id="confAccNum" type="text" className="rg-inp" value={confirmAccountNumber}
                    onChange={(e) => setConfirmAccountNumber(e.target.value)} placeholder="Re-enter account number" autoComplete="off"/>
                  {confirmAccountNumber && (
                    <div className={`rg-match ${confirmAccountNumber === accountNumber ? "rg-match-ok" : "rg-match-bad"}`}>
                      {confirmAccountNumber === accountNumber ? "✓ Account numbers match" : "✗ Don't match"}
                    </div>
                  )}
                </div>
                <div className="rg-fg">
                  <label htmlFor="ifsc" className="rg-lbl">IFSC Code</label>
                  <input id="ifsc" type="text" className="rg-inp uc" value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())} placeholder="e.g. HDFC0001234" autoComplete="off"/>
                </div>
                <div className="rg-fg">
                  <label className="rg-lbl">Account Type</label>
                  <div className="rg-type-group">
                    {["SAVINGS","CURRENT"].map(t => (
                      <button key={t} type="button" className={`rg-type-pill ${accountType === t ? "sel" : ""}`}
                        onClick={() => setAccountType(t)}>{t.charAt(0)+t.slice(1).toLowerCase()}</button>
                    ))}
                  </div>
                </div>

                <div className="rg-sec-lbl" style={{ marginTop:"1.25rem" }}>
                  UPI <span className="rg-optional">Optional</span>
                </div>
                <div className="rg-fg rg-fg-last">
                  <label htmlFor="upi" className="rg-lbl">UPI ID</label>
                  <input id="upi" type="text" className="rg-inp" value={upiId}
                    onChange={(e) => setUpiId(e.target.value)} placeholder="name@upi"/>
                </div>

                <button type="submit" className="rg-btn-primary" disabled={isSubmitting || cooldown > 0}>
                  {isSubmitting ? "Creating Account…" : cooldown > 0 ? `Try again in ${cooldown}s` : "Create Account"}
                </button>
                <button type="button" className="rg-btn-ghost" onClick={() => { setError(""); setStep(1); }} disabled={isSubmitting}>
                  ← Back to Personal Details
                </button>
              </form>
            </div>
          </div>

          <p className="rg-foot">Already have an account?&nbsp;<Link to="/login/participant">Sign In</Link></p>
        </div>
      </div>
    </>
  );
};

export default Register;