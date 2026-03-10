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
import { savePaymentDetails } from "../../api/allocation.api";
import Footer from "../../components/common/Footer";

const SIGNUP_COOLDOWN_UNTIL_KEY = "nitro_signup_cooldown_until";
const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
const isValidPAN  = (v) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(String(v).trim());

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

/* ── Confirmation Modal ── */
const ConfirmModal = ({ data, onConfirm, onEdit, submitting }) => {
  const maskAcc = (n) => (!n || n.length < 4) ? n : "*".repeat(n.length - 4) + n.slice(-4);
  return (
    <div style={{position:"fixed",inset:0,zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem",background:"rgba(4,13,18,0.88)",backdropFilter:"blur(6px)"}}>
      <div style={{background:"linear-gradient(160deg,rgba(0,198,255,0.09) 0%,rgba(4,13,18,0.98) 60%)",border:"1.5px solid rgba(0,198,255,0.25)",borderRadius:"22px",padding:"2rem 1.75rem",maxWidth:"480px",width:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 0 60px rgba(0,198,255,0.12),0 24px 64px rgba(0,0,0,0.6)"}}>
        
        {/* header */}
        <div style={{textAlign:"center",marginBottom:"1.5rem"}}>
          <div style={{width:52,height:52,borderRadius:"50%",background:"rgba(0,198,255,0.12)",border:"1.5px solid rgba(0,198,255,0.3)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto .9rem",fontSize:"1.4rem"}}>✓</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:"1.2rem",fontWeight:800,color:"#e8f7ff",marginBottom:".3rem"}}>Review Your Details</div>
          <div style={{fontSize:".8rem",color:"rgba(255,255,255,.38)"}}>Please verify before submitting. Click Edit to go back and change anything.</div>
        </div>

        {/* Personal */}
        <div style={{marginBottom:"1rem"}}>
          <div style={{fontSize:".68rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:".6rem"}}>👤 Personal</div>
          <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:".85rem 1rem",display:"flex",flexDirection:"column",gap:".45rem"}}>
            {[["Full Name", data.fullName],["Email", data.email],["Phone", data.phone]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:".82rem",borderBottom:"1px dashed rgba(255,255,255,.06)",paddingBottom:".35rem"}}>
                <span style={{color:"rgba(255,255,255,.38)"}}>{l}</span>
                <span style={{color:"rgba(255,255,255,.85)",fontWeight:500}}>{v||"—"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Address */}
        <div style={{marginBottom:"1rem"}}>
          <div style={{fontSize:".68rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:".6rem"}}>📍 Address</div>
          <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:".85rem 1rem",display:"flex",flexDirection:"column",gap:".45rem"}}>
            {[
              ["Line 1", data.address_line1],
              ["Line 2", data.address_line2||"—"],
              ["City", data.city],
              ["State", data.state],
              ["Pincode", data.pincode],
              ["Country", data.country||"India"],
            ].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:".82rem",borderBottom:"1px dashed rgba(255,255,255,.06)",paddingBottom:".35rem"}}>
                <span style={{color:"rgba(255,255,255,.38)"}}>{l}</span>
                <span style={{color:"rgba(255,255,255,.85)",fontWeight:500}}>{v||"—"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bank */}
        <div style={{marginBottom:"1rem"}}>
          <div style={{fontSize:".68rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:".6rem"}}>🏦 Bank</div>
          <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:".85rem 1rem",display:"flex",flexDirection:"column",gap:".45rem"}}>
            {[
              ["Holder Name", data.accountHolderName],
              ["Account No.", maskAcc(data.accountNumber)],
              ["IFSC", data.ifscCode],
              ["Account Type", data.accountType],
            ].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:".82rem",borderBottom:"1px dashed rgba(255,255,255,.06)",paddingBottom:".35rem"}}>
                <span style={{color:"rgba(255,255,255,.38)"}}>{l}</span>
                <span style={{color:"rgba(255,255,255,.85)",fontWeight:500,fontFamily:l==="Account No."?"monospace":"inherit"}}>{v||"—"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* KYC */}
        <div style={{marginBottom:"1.5rem"}}>
          <div style={{fontSize:".68rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:".6rem"}}>🪪 KYC</div>
          <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:".85rem 1rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:".82rem"}}>
              <span style={{color:"rgba(255,255,255,.38)"}}>PAN Number</span>
              <span style={{color:"#00c6ff",fontWeight:700,fontFamily:"monospace",letterSpacing:".1em"}}>{data.panNumber||"—"}</span>
            </div>
          </div>
        </div>

        {/* warning */}
        <div style={{background:"rgba(255,159,0,.08)",border:"1px solid rgba(255,159,0,.25)",borderRadius:10,padding:".75rem 1rem",display:"flex",gap:".6rem",marginBottom:"1.5rem",fontSize:".78rem",color:"rgba(255,210,120,.8)"}}>
          <span style={{flexShrink:0}}>⚠️</span>
          <span>Incorrect bank or PAN details may delay payouts. Please double-check before confirming.</span>
        </div>

        {/* actions */}
        <div style={{display:"flex",gap:".75rem"}}>
          <button type="button" disabled={submitting}
            onClick={onEdit}
            style={{flex:1,padding:".82rem",borderRadius:11,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.6)",fontSize:".88rem",fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
            ✏️ Edit
          </button>
          <button type="button" disabled={submitting}
            onClick={onConfirm}
            style={{flex:1.6,padding:".82rem",borderRadius:11,border:"none",background:"#00c6ff",color:"#040d12",fontSize:".88rem",fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",boxShadow:"0 0 24px rgba(0,198,255,.3)"}}>
            {submitting ? "Creating Account…" : "✓ Confirm & Submit"}
          </button>
        </div>
      </div>
    </div>
  );
};

const Register = () => {
  const navigate = useNavigate();

  // step: 1=Personal, 2=Bank, 3=KYC+Address, 4=Review(modal)
  const [step, setStep] = useState(1);

  // Step 1 — Personal
  const [fullName, setFullName]               = useState("");
  const [email, setEmail]                     = useState("");
  const [emailTouched, setEmailTouched]       = useState(false);
  const [phone, setPhone]                     = useState("");
  const [password, setPassword]               = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw]                   = useState(false);
  const [showCPw, setShowCPw]                 = useState(false);

  // Step 2 — Bank
  const [accountHolderName, setAccountHolderName]         = useState("");
  const [accountNumber, setAccountNumber]                 = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber]   = useState("");
  const [ifscCode, setIfscCode]                           = useState("");
  const [accountType, setAccountType]                     = useState("SAVINGS");
  const [upiId, setUpiId]                                 = useState("");

  // Step 3 — Address + KYC
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity]                 = useState("");
  const [state, setState]               = useState("");
  const [pincode, setPincode]           = useState("");
  const [country, setCountry]           = useState("India");
  const [panNumber, setPanNumber]       = useState("");
  const [panTouched, setPanTouched]     = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [cooldown, setCooldown]           = useState(0);
  const [error, setError]                 = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);

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
    if (password.length >= 6)  s++;
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
  const panValid     = isValidPAN(panNumber);
  const panInvalid   = panTouched && panNumber && !panValid;

  /* ── Step navigation ── */
  const handleStep1Next = () => {
    setError("");
    if (!fullName.trim())             { setError("Full name is required."); return; }
    if (!email.trim())                { setError("Email address is required."); return; }
    if (!emailValid)                  { setEmailTouched(true); setError("Enter a valid email address."); return; }
    if (!phone.trim())                { setError("Phone number is required."); return; }
    if (!password)                    { setError("Password is required."); return; }
    if (password.length < 6)          { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setStep(2);
  };

  const handleStep2Next = () => {
    setError("");
    if (!accountHolderName.trim() || !accountNumber.trim() || !confirmAccountNumber.trim() || !ifscCode.trim()) {
      setError("Account holder name, account number and IFSC code are required."); return;
    }
    if (accountNumber.trim() !== confirmAccountNumber.trim()) {
      setError("Bank account numbers do not match."); return;
    }
    setStep(3);
  };

  const handleStep3Next = () => {
    setError("");
    if (!addressLine1.trim()) { setError("Address Line 1 is required."); return; }
    if (!city.trim())         { setError("City is required."); return; }
    if (!state.trim())        { setError("State is required."); return; }
    if (!pincode.trim())      { setError("Pincode is required."); return; }
    if (!panNumber.trim())    { setError("PAN card number is required."); return; }
    setPanTouched(true);
    if (!panValid) { setError("Invalid PAN format. Expected: ABCDE1234F"); return; }
    if (!termsAccepted) { setError("You must accept the Terms & Conditions and Privacy Policy to continue."); return; }
    setShowConfirm(true);
  };

  /* ── Final submit ── */
  const handleConfirmSubmit = async () => {
    if (cooldown > 0) { setError(`Too many attempts. Wait ${cooldown}s.`); return; }
    setIsSubmitting(true);
    setError("");
    try {
      const signupData = await signUpWithSupabase({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim(),
        registrationDetails: {
          phone: phone.trim(),
          bank_details: {
            account_holder_name: accountHolderName.trim(),
            account_number: accountNumber.trim(),
            ifsc_code: ifscCode.trim().toUpperCase(),
            account_type: accountType,
            upi_id: upiId.trim() || null,
          },
          kyc: { pan_number: panNumber.trim().toUpperCase() },
          address: {
            address_line1: addressLine1.trim(),
            address_line2: addressLine2.trim() || null,
            city: city.trim(),
            state: state.trim(),
            pincode: pincode.trim(),
            country: country.trim() || "India",
          },
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
        },
      });

      // Save all details to backend immediately after signup
      const accessToken = signupData?.access_token || signupData?.session?.access_token;
      if (accessToken) {
        try {
          storeToken(accessToken, false);
          await savePaymentDetails({
            address: {
              address_line1: addressLine1.trim(),
              address_line2: addressLine2.trim() || null,
              city: city.trim(),
              state: state.trim(),
              pincode: pincode.trim(),
              country: country.trim() || "India",
            },
            bankDetails: {
              bank_account_name: accountHolderName.trim(),
              bank_account_number: accountNumber.trim(),
              bank_ifsc: ifscCode.trim().toUpperCase(),
              bank_name: accountType,
            },
            kycDetails: {
              pan_number: panNumber.trim().toUpperCase(),
            },
          });
        } catch {
          // Non-fatal: can be updated later from Profile page
        } finally {
          import("../../lib/auth").then(({ clearStoredTokens }) => clearStoredTokens());
        }
      }

      setShowConfirm(false);
      setShowSuccessModal(true);
    } catch (err) {
      setShowConfirm(false);
      const raw = String(err?.message || "");
      const low = raw.toLowerCase();
      if (err?.status === 429 || low.includes("rate limit")) {
        const w = Number(err?.retryAfter) > 0 ? Number(err.retryAfter) : 60;
        setCooldown(w);
        setError("Too many sign-up attempts. Please wait " + w + " seconds before trying again.");
      } else if (
        err?.code === "email_already_registered" ||
        err?.status === 409 ||
        low.includes("already registered") ||
        low.includes("already been registered") ||
        low.includes("user already registered") ||
        low.includes("email already")
      ) {
        setError("This email address is already registered. Please sign in instead, or use a different email.");
      } else if (low.includes("password") && (low.includes("weak") || low.includes("strength"))) {
        setError("Your password is too weak. Use at least 8 characters with a mix of letters, numbers and symbols.");
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

  const confirmData = {
    fullName, email, phone,
    address_line1: addressLine1, address_line2: addressLine2,
    city, state, pincode, country,
    accountHolderName, accountNumber, ifscCode, accountType,
    panNumber,
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
        .rg-stepper{display:flex;align-items:center;margin-bottom:1.85rem;gap:0;}
        .rg-step{flex:1;display:flex;align-items:center;gap:.45rem;padding:.55rem .6rem;border-radius:10px;font-size:.72rem;font-weight:500;border:1px solid transparent;color:rgba(255,255,255,.28);transition:all .3s;cursor:default;}
        .rg-step.done{color:rgba(255,255,255,.45);}
        .rg-step.active{background:rgba(0,198,255,.1);border-color:rgba(0,198,255,.25);color:#00c6ff;}
        .rg-step-num{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:700;flex-shrink:0;background:rgba(255,255,255,.08);transition:background .3s,color .3s;}
        .rg-step.active .rg-step-num{background:#00c6ff;color:#040d12;}
        .rg-step.done  .rg-step-num{background:rgba(0,198,255,.25);color:#00c6ff;}
        .rg-step-div{width:16px;height:1px;background:rgba(255,255,255,.1);flex-shrink:0;}
        .rg-heading{font-family:'Syne',sans-serif;font-size:1.55rem;font-weight:800;color:#fff;letter-spacing:-.025em;margin-bottom:.3rem;}
        .rg-sub{font-size:.845rem;font-weight:300;color:rgba(255,255,255,.38);margin-bottom:1.4rem;}
        .rg-google{width:100%;padding:.82rem 1rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:.65rem;color:rgba(255,255,255,.82);font-size:.9rem;font-weight:500;font-family:'DM Sans',sans-serif;transition:background .25s,border-color .25s,transform .2s;margin-bottom:1.25rem;}
        .rg-google:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2);transform:translateY(-2px);}
        .rg-google svg{width:18px;height:18px;flex-shrink:0;}
        .rg-divider{display:flex;align-items:center;gap:.75rem;margin-bottom:1.35rem;}
        .rg-div-line{flex:1;height:1px;background:rgba(255,255,255,.08);}
        .rg-div-txt{font-size:.75rem;color:rgba(255,255,255,.25);font-weight:300;white-space:nowrap;}
        .rg-alert{border-radius:12px;padding:.85rem 1rem;font-size:.85rem;margin-bottom:1.25rem;animation:rgU .3s ease both;display:flex;align-items:flex-start;gap:.6rem;line-height:1.45;}
        .rg-err{background:rgba(255,80,80,.12);border:1px solid rgba(255,80,80,.35);color:#ff8080;}
        .rg-fg{margin-bottom:1.1rem;}
        .rg-fg-last{margin-bottom:1.5rem;}
        .rg-lbl{display:block;font-size:.8rem;font-weight:500;color:rgba(255,255,255,.52);margin-bottom:.42rem;letter-spacing:.02em;}
        .rg-req{color:#ff6b6b;margin-left:2px;}
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
        .rg-btn-primary:disabled{opacity:.45;cursor:not-allowed;}
        .rg-btn-ghost{width:100%;padding:.82rem 1rem;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:12px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:.9rem;font-weight:500;color:rgba(255,255,255,.5);transition:background .2s,border-color .2s;margin-top:.6rem;}
        .rg-btn-ghost:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.18);color:rgba(255,255,255,.75);}
        .rg-btn-ghost:disabled{opacity:.4;cursor:not-allowed;}
        .rg-foot{text-align:center;margin-top:1.5rem;font-size:.845rem;font-weight:300;color:rgba(255,255,255,.3);}
        .rg-foot a{color:#00c6ff;font-weight:500;text-decoration:none;transition:opacity .2s;}
        .rg-foot a:hover{opacity:.75;}
        .rg-sc{display:none;}
        .rg-sc.active{display:block;animation:rgU .4s cubic-bezier(.22,1,.36,1) both;}
        .rg-pan-note{font-size:.74rem;color:rgba(255,255,255,.28);margin-top:.38rem;display:flex;align-items:center;gap:.35rem;}
        /* Success Modal */
        .rg-modal-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:1.5rem;background:rgba(4,13,18,0.82);backdrop-filter:blur(6px);animation:rgU .25s ease both;}
        .rg-modal{background:linear-gradient(160deg,rgba(0,198,255,0.09) 0%,rgba(4,13,18,0.97) 55%);border:1.5px solid rgba(0,198,255,0.25);border-radius:24px;padding:2.5rem 2.25rem 2rem;max-width:420px;width:100%;text-align:center;box-shadow:0 0 60px rgba(0,198,255,0.12),0 24px 64px rgba(0,0,0,0.6);animation:modalPop .45s cubic-bezier(.22,1,.36,1) both;}
        @keyframes modalPop{from{opacity:0;transform:scale(.88) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .rg-modal-icon{width:64px;height:64px;border-radius:50%;background:rgba(0,198,255,0.1);border:1.5px solid rgba(0,198,255,0.25);display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;}
        .rg-modal-icon svg{width:30px;height:30px;color:#00c6ff;}
        .rg-modal-title{font-family:'Syne',sans-serif;font-size:1.45rem;font-weight:800;color:#e8f7ff;letter-spacing:-.02em;margin-bottom:.6rem;}
        .rg-modal-steps{list-style:none;margin:1.25rem 0 1.75rem;display:flex;flex-direction:column;gap:.75rem;text-align:left;}
        .rg-modal-step{display:flex;align-items:flex-start;gap:.75rem;padding:.75rem .9rem;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);}
        .rg-modal-step-num{width:22px;height:22px;border-radius:50%;background:rgba(0,198,255,.15);border:1px solid rgba(0,198,255,.3);color:#00c6ff;font-size:.68rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
        .rg-modal-step-text{font-size:.83rem;font-weight:400;color:rgba(255,255,255,.6);line-height:1.5;}
        .rg-modal-step-text strong{color:rgba(255,255,255,.88);font-weight:600;display:block;margin-bottom:2px;}
        .rg-modal-btn{width:100%;padding:.88rem 1rem;background:#00c6ff;border:none;border-radius:12px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:.93rem;font-weight:700;color:#040d12;letter-spacing:.01em;box-shadow:0 0 28px rgba(0,198,255,.28);transition:opacity .2s,transform .2s;}
        .rg-modal-btn:hover{opacity:.9;transform:translateY(-2px);}
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
            {/* Stepper — 3 steps */}
            <div className="rg-stepper">
              <div className={`rg-step ${step === 1 ? "active" : "done"}`}>
                <div className="rg-step-num">{step > 1 ? <CheckIcon/> : "1"}</div>
                Personal
              </div>
              <div className="rg-step-div"/>
              <div className={`rg-step ${step === 2 ? "active" : step > 2 ? "done" : ""}`}>
                <div className="rg-step-num">{step > 2 ? <CheckIcon/> : "2"}</div>
                Bank
              </div>
              <div className="rg-step-div"/>
              <div className={`rg-step ${step === 3 ? "active" : ""}`}>
                <div className="rg-step-num">3</div>
                KYC & Address
              </div>
            </div>

            {error && (
              <div className="rg-alert rg-err" role="alert">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:"2px"}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>{error}</span>
              </div>
            )}

            {/* ── STEP 1: Personal ── */}
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

              <div className="rg-fg">
                <label htmlFor="fullName" className="rg-lbl">Full Name <span className="rg-req">*</span></label>
                <input id="fullName" type="text" className="rg-inp" value={fullName}
                  onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" autoComplete="name"/>
              </div>

              <div className="rg-fg">
                <label htmlFor="email" className="rg-lbl">Email Address <span className="rg-req">*</span></label>
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

              <div className="rg-fg">
                <label htmlFor="phone" className="rg-lbl">Phone Number <span className="rg-req">*</span></label>
                <input id="phone" type="tel" className="rg-inp" value={phone}
                  onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" autoComplete="tel"/>
              </div>

              <div className="rg-fg">
                <label htmlFor="password" className="rg-lbl">Password <span className="rg-req">*</span></label>
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

              <div className="rg-fg rg-fg-last">
                <label htmlFor="cpw" className="rg-lbl">Confirm Password <span className="rg-req">*</span></label>
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

              <button type="button" className="rg-btn-primary" onClick={handleStep1Next} disabled={cooldown > 0}>
                Continue to Bank Details →
              </button>
            </div>

            {/* ── STEP 2: Bank ── */}
            <div className={`rg-sc ${step === 2 ? "active" : ""}`}>
              <h1 className="rg-heading">Bank Details</h1>
              <p className="rg-sub">Required for payout processing. Kept securely.</p>

              <div className="rg-sec-lbl">Account Info</div>

              <div className="rg-fg">
                <label htmlFor="holderName" className="rg-lbl">Account Holder Name <span className="rg-req">*</span></label>
                <input id="holderName" type="text" className="rg-inp" value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)} placeholder="Name as per bank account"/>
              </div>
              <div className="rg-fg">
                <label htmlFor="accNum" className="rg-lbl">Account Number <span className="rg-req">*</span></label>
                <input id="accNum" type="text" className="rg-inp" value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)} placeholder="Bank account number" autoComplete="off"/>
              </div>
              <div className="rg-fg">
                <label htmlFor="confAccNum" className="rg-lbl">Confirm Account Number <span className="rg-req">*</span></label>
                <input id="confAccNum" type="text" className="rg-inp" value={confirmAccountNumber}
                  onChange={(e) => setConfirmAccountNumber(e.target.value)} placeholder="Re-enter account number" autoComplete="off"/>
                {confirmAccountNumber && (
                  <div className={`rg-match ${confirmAccountNumber === accountNumber ? "rg-match-ok" : "rg-match-bad"}`}>
                    {confirmAccountNumber === accountNumber ? "✓ Account numbers match" : "✗ Don't match"}
                  </div>
                )}
              </div>
              <div className="rg-fg">
                <label htmlFor="ifsc" className="rg-lbl">IFSC Code <span className="rg-req">*</span></label>
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

              <button type="button" className="rg-btn-primary" onClick={handleStep2Next}>
                Continue to KYC & Address →
              </button>
              <button type="button" className="rg-btn-ghost" onClick={() => { setError(""); setStep(1); }}>
                ← Back to Personal Details
              </button>
            </div>

            {/* ── STEP 3: Address + KYC ── */}
            <div className={`rg-sc ${step === 3 ? "active" : ""}`}>
              <h1 className="rg-heading">KYC & Address</h1>
              <p className="rg-sub">Required for product delivery and tax compliance.</p>

              <div className="rg-sec-lbl">Delivery Address</div>

              <div className="rg-fg">
                <label htmlFor="addrLine1" className="rg-lbl">Address Line 1 <span className="rg-req">*</span></label>
                <input id="addrLine1" type="text" className="rg-inp" value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)} placeholder="House / Flat / Building no."/>
              </div>
              <div className="rg-fg">
                <label htmlFor="addrLine2" className="rg-lbl">Address Line 2 <span className="rg-optional">Optional</span></label>
                <input id="addrLine2" type="text" className="rg-inp" value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)} placeholder="Street / Area / Landmark"/>
              </div>
              <div className="rg-fg">
                <label htmlFor="city" className="rg-lbl">City <span className="rg-req">*</span></label>
                <input id="city" type="text" className="rg-inp" value={city}
                  onChange={(e) => setCity(e.target.value)} placeholder="e.g. Bengaluru"/>
              </div>
              <div className="rg-fg">
                <label htmlFor="state" className="rg-lbl">State <span className="rg-req">*</span></label>
                <input id="state" type="text" className="rg-inp" value={state}
                  onChange={(e) => setState(e.target.value)} placeholder="e.g. Karnataka"/>
              </div>
              <div className="rg-fg">
                <label htmlFor="pincode" className="rg-lbl">Pincode <span className="rg-req">*</span></label>
                <input id="pincode" type="text" className="rg-inp" value={pincode}
                  onChange={(e) => setPincode(e.target.value)} placeholder="6-digit pincode" maxLength={10}/>
              </div>
              <div className="rg-fg">
                <label htmlFor="country" className="rg-lbl">Country</label>
                <input id="country" type="text" className="rg-inp" value={country}
                  onChange={(e) => setCountry(e.target.value)}/>
              </div>

              <div className="rg-sec-lbl" style={{ marginTop:"1.25rem" }}>KYC Details</div>

              <div className="rg-fg rg-fg-last">
                <label htmlFor="pan" className="rg-lbl">PAN Card Number <span className="rg-req">*</span></label>
                <input id="pan" type="text"
                  className={`rg-inp uc ${panTouched && panNumber ? (panValid ? "valid" : "invalid") : ""}`}
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  onBlur={() => setPanTouched(true)}
                  placeholder="e.g. ABCDE1234F"
                  maxLength={10}
                  autoComplete="off"/>
                {panInvalid && (
                  <div className="rg-field-hint rg-hint-err">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    Invalid format. Expected: ABCDE1234F (5 letters + 4 digits + 1 letter)
                  </div>
                )}
                {panTouched && panValid && (
                  <div className="rg-field-hint rg-hint-ok">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                    Valid PAN format
                  </div>
                )}
                <div className="rg-pan-note">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  Required for tax compliance and payout processing
                </div>
              </div>

              {/* Terms & Conditions checkbox */}
              <div style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${termsAccepted ? "rgba(0,198,255,.35)" : "rgba(255,255,255,.09)"}`, borderRadius: 12, padding: ".9rem 1rem", marginBottom: "1rem", transition: "border-color .25s", cursor: "pointer" }} onClick={() => setTermsAccepted(v => !v)}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: ".75rem", cursor: "pointer" }}>
                  <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${termsAccepted ? "#00c6ff" : "rgba(255,255,255,.25)"}`, background: termsAccepted ? "#00c6ff" : "transparent", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s" }}>
                    {termsAccepted && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#040d12" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                  </div>
                  <span style={{ fontSize: ".82rem", color: "rgba(255,255,255,.55)", lineHeight: 1.5 }} onClick={e => e.stopPropagation()}>
                    I have read and agree to the{" "}
                    <a href="/terms-and-conditions" target="_blank" rel="noopener noreferrer"
                      style={{ color: "#00c6ff", textDecoration: "none", fontWeight: 600 }}
                      onClick={e => e.stopPropagation()}>
                      Terms &amp; Conditions
                    </a>
                    {" "}and{" "}
                    <a href="/privacy-policy" target="_blank" rel="noopener noreferrer"
                      style={{ color: "#00c6ff", textDecoration: "none", fontWeight: 600 }}
                      onClick={e => e.stopPropagation()}>
                      Privacy Policy
                    </a>
                    , including the collection and use of my PAN and bank details for payout and tax purposes.
                  </span>
                </label>
              </div>

              <button type="button" className="rg-btn-primary" onClick={handleStep3Next} disabled={cooldown > 0 || !termsAccepted} style={{ opacity: termsAccepted ? 1 : 0.45 }}>
                Review & Submit →
              </button>
              <button type="button" className="rg-btn-ghost" onClick={() => { setError(""); setStep(2); }}>
                ← Back to Bank Details
              </button>
            </div>
          </div>

          <p className="rg-foot">Already have an account?&nbsp;<Link to="/login/participant">Sign In</Link></p>
        </div>
      </div>

      {/* ── Confirmation Modal ── */}
      {showConfirm && (
        <ConfirmModal
          data={confirmData}
          submitting={isSubmitting}
          onConfirm={handleConfirmSubmit}
          onEdit={() => { setShowConfirm(false); setError(""); }}
        />
      )}

      {/* ── Success Modal ── */}
      {showSuccessModal && (
        <div className="rg-modal-overlay">
          <div className="rg-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="rg-modal-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <path d="m9 11 3 3L22 4"/>
              </svg>
            </div>
            <div className="rg-modal-title" id="modal-title">Registration Successful!</div>
            <ol className="rg-modal-steps">
              <li className="rg-modal-step">
                <div className="rg-modal-step-num">1</div>
                <div className="rg-modal-step-text">
                  <strong>Verify your email</strong>
                  A verification link has been sent to <span style={{color:"#00c6ff"}}>{email}</span>. Please check your inbox and confirm your email address.
                </div>
              </li>
              <li className="rg-modal-step">
                <div className="rg-modal-step-num">2</div>
                <div className="rg-modal-step-text">
                  <strong>Await admin approval</strong>
                  Your registration request has been sent to the Nitro admin team. They will review and approve your account.
                </div>
              </li>
              <li className="rg-modal-step">
                <div className="rg-modal-step-num">3</div>
                <div className="rg-modal-step-text">
                  <strong>Watch for our email</strong>
                  Once approved, you'll receive a confirmation email from Nitro. You can then sign in and start using your account.
                </div>
              </li>
            </ol>
            <button
              className="rg-modal-btn"
              onClick={() => navigate("/login/participant", { replace: true })}
            >
              Go to Sign In
            </button>
          </div>
        </div>
      )}
      <Footer variant="dark" />
    </>
  );
};

export default Register;