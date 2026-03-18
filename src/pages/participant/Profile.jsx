import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  API_BASE_URL,
  getStoredToken,
  clearStoredTokens,
  requestEmailUpdateInSupabase,
} from "../../lib/auth";
import "./Profile.css";

/* ─── fetch helper (same pattern as Dashboard.jsx — known to work) ── */
const apiFetch = async (path, token, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.message || `Request failed (${response.status})`);
    err.status = response.status;
    throw err;
  }
  return data;
};

/* ─── Validators ─────────────────────────────────────────────────── */
const trim = (v) => String(v || "").trim();
const hasVal = (v) => trim(v).length > 0;

const VALIDATORS = {
  full_name:           (v) => !hasVal(v) ? "Full name is required." : null,
  email:               (v) => !hasVal(v) ? "Email is required." : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trim(v)) ? "Enter a valid email address." : null,
  address_line1:       (v) => !hasVal(v) ? "Address Line 1 is required." : null,
  city:                (v) => !hasVal(v) ? "City is required." : null,
  state:               (v) => !hasVal(v) ? "State is required." : null,
  pincode:             (v) => !hasVal(v) ? "Pincode is required." : !/^\d{6}$/.test(trim(v)) ? "Enter a valid 6-digit pincode." : null,
  bank_account_name:   (v) => !hasVal(v) ? "Account holder name is required." : null,
  bank_account_number: (v) => !hasVal(v) ? "Account number is required." : !/^\d{9,18}$/.test(trim(v)) ? "Enter a valid account number (9–18 digits)." : null,
  bank_ifsc:           (v) => !hasVal(v) ? "IFSC code is required." : !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(trim(v).toUpperCase()) ? "Enter a valid IFSC code (e.g. HDFC0001234)." : null,
  bank_name:           (v) => !hasVal(v) ? "Bank name is required." : null,
  pan_number:          (v) => !hasVal(v) ? "PAN number is required." : !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(trim(v).toUpperCase()) ? "Enter a valid PAN (e.g. ABCDE1234F)." : null,
};

const initialForm = {
  full_name: "", email: "", role: "", status: "", created_at: "",
  address_line1: "", address_line2: "", city: "", state: "",
  pincode: "", country: "India",
  bank_account_name: "", bank_account_number: "", bank_ifsc: "",
  bank_name: "", pan_number: "",
};

/* ─── Confirm Review Modal ──────────────────────────────────────── */
const ConfirmModal = ({ form, onConfirm, onEdit, saving }) => {
  const sections = [
    { title: "Basic Information", icon: "👤", fields: [
      { label: "Full Name", value: form.full_name },
      { label: "Email",     value: form.email },
    ]},
    { title: "Address Details", icon: "🏠", fields: [
      { label: "Address Line 1", value: form.address_line1 },
      { label: "Address Line 2", value: form.address_line2 || "—" },
      { label: "City",    value: form.city },
      { label: "State",   value: form.state },
      { label: "Pincode", value: form.pincode },
      { label: "Country", value: form.country },
    ]},
    { title: "Bank Information", icon: "🏦", fields: [
      { label: "Account Holder", value: form.bank_account_name },
      { label: "Account Number", value: trim(form.bank_account_number).length > 4 ? "••••••" + trim(form.bank_account_number).slice(-4) : form.bank_account_number },
      { label: "IFSC Code",  value: trim(form.bank_ifsc).toUpperCase() },
      { label: "Bank Name",  value: form.bank_name },
    ]},
    { title: "KYC Details", icon: "🪪", fields: [
      { label: "PAN Number", value: trim(form.pan_number).toUpperCase() },
    ]},
  ];

  return (
    <div className="pp-confirm-overlay">
      <div className="pp-confirm-backdrop" />
      <div className="pp-confirm-modal">
        <div className="pp-confirm-header">
          <div className="pp-confirm-check">✅</div>
          <div>
            <h3 className="pp-confirm-title">Verify Your Details</h3>
            <p className="pp-confirm-sub">Review carefully before saving — these details are used for reimbursements.</p>
          </div>
        </div>
        <div className="pp-confirm-body">
          {sections.map((sec) => (
            <div key={sec.title} className="pp-confirm-section">
              <p className="pp-confirm-section-head"><span>{sec.icon}</span> {sec.title}</p>
              <div className="pp-confirm-grid">
                {sec.fields.map((f) => (
                  <div key={f.label} className="pp-confirm-row">
                    <span className="pp-confirm-row-label">{f.label}</span>
                    <span className="pp-confirm-row-value">{f.value || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="pp-confirm-warning">
          <span className="pp-confirm-warning-icon">⚠️</span>
          <span>Bank details and PAN are used for payout processing. Incorrect details will delay or block your reimbursements.</span>
        </div>
        <div className="pp-confirm-actions">
          <button className="pp-confirm-edit-btn" type="button" onClick={onEdit} disabled={saving}>✏️ Edit Again</button>
          <button className="pp-confirm-save-btn" type="button" onClick={onConfirm} disabled={saving}>
            {saving ? "Saving…" : "✓ Confirm & Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Field wrapper with live validation ────────────────────────── */
const Field = ({ label, error, required, children }) => (
  <label className={"pp-field" + (error ? " pp-field--error" : "")}>
    <span className="pp-field-label">{label}{required && <span className="pp-field-req"> *</span>}</span>
    {children}
    {error && <span className="pp-field-err">{error}</span>}
  </label>
);

/* ═══════════════════════════════════════════════════════════════ */
const Profile = () => {
  const navigate = useNavigate();
  const { id }   = useParams();
  const [searchParams] = useSearchParams();

  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [editing,     setEditing]     = useState(searchParams.get("edit") === "1");
  const [showConfirm, setShowConfirm] = useState(false);
  const [error,       setError]       = useState("");
  const [message,     setMessage]     = useState("");
  const [form,        setForm]        = useState(initialForm);
  const [initialLoadedForm, setInitialLoadedForm] = useState(initialForm);
  const [confirmEmail,  setConfirmEmail]  = useState("");
  const [fieldErrors,   setFieldErrors]   = useState({});
  const [touched,       setTouched]       = useState({});

  const paths = {
    dashboard:  id ? `/participant/${id}/dashboard`         : "/dashboard",
    allocation: id ? `/participant/${id}/allocation/active` : "/dashboard",
    payouts:    id ? `/participant/${id}/payouts`           : "/dashboard",
    profile:    id ? `/participant/${id}/profile`           : "/dashboard",
  };

  /* ── Load profile + payment details ── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      const token = getStoredToken();
      if (!token) { navigate("/login", { replace: true }); return; }
      try {
        const [profileRes, detailsRes] = await Promise.all([
          apiFetch("/users/me", token),
          apiFetch("/applications/payment-details", token),
        ]);

        const profile = profileRes?.data || {};
        const details = detailsRes?.data?.details || {};

        const merged = {
          full_name:           profile.full_name  || "",
          email:               profile.email      || "",
          role:                profile.role       || "",
          status:              profile.status     || "",
          created_at:          profile.created_at || "",
          address_line1:       details.address_line1       || profile.address_line1       || "",
          address_line2:       details.address_line2       || profile.address_line2       || "",
          city:                details.city                || profile.city                || "",
          state:               details.state               || profile.state               || "",
          pincode:             details.pincode             || profile.pincode             || "",
          country:             details.country             || profile.country             || "India",
          bank_account_name:   details.bank_account_name   || profile.bank_account_name   || "",
          bank_account_number: details.bank_account_number || profile.bank_account_number || "",
          bank_ifsc:           details.bank_ifsc           || profile.bank_ifsc           || "",
          bank_name:           details.bank_name           || profile.bank_name           || "",
          pan_number:          details.pan_number          || profile.pan_number          || "",
        };
        setForm(merged);
        setInitialLoadedForm(merged);
      } catch (err) {
        if (err.status === 401) { clearStoredTokens(); navigate("/login", { replace: true }); return; }
        setError(err.message || "Unable to load profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  /* ── Live field validation on blur ── */
  const setField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (touched[key] && VALIDATORS[key]) {
      setFieldErrors((e) => ({ ...e, [key]: VALIDATORS[key](value) }));
    }
  }, [touched]);

  const blurField = (key) => {
    setTouched((p) => ({ ...p, [key]: true }));
    if (VALIDATORS[key]) setFieldErrors((e) => ({ ...e, [key]: VALIDATORS[key](form[key]) }));
  };

  /* ── Submit: validate then show confirm modal ── */
  const handleSaveClick = (e) => {
    e.preventDefault();
    setError(""); setMessage("");

    const allTouched = {};
    Object.keys(VALIDATORS).forEach((k) => { allTouched[k] = true; });
    setTouched(allTouched);

    const errors = {};
    for (const [k, fn] of Object.entries(VALIDATORS)) {
      const msg = fn(form[k]);
      if (msg) errors[k] = msg;
    }
    const emailChanged = trim(form.email).toLowerCase() !== trim(initialLoadedForm.email).toLowerCase();
    if (emailChanged && !trim(confirmEmail)) errors.confirmEmail = "Please re-enter your new email to confirm.";
    if (emailChanged && trim(confirmEmail) && trim(form.email).toLowerCase() !== trim(confirmEmail).toLowerCase()) errors.confirmEmail = "Emails do not match.";

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("Please fix the highlighted errors before saving.");
      setTimeout(() => { const el = document.querySelector(".pp-field--error input"); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 80);
      return;
    }
    setShowConfirm(true);
  };

  /* ── Confirmed: actually save using fetch() directly ── */
  const handleConfirmSave = async () => {
    setSaving(true); setError("");
    const token = getStoredToken();
    if (!token) { navigate("/login", { replace: true }); return; }

    try {
      const normalizedName  = trim(form.full_name);
      const normalizedEmail = trim(form.email).toLowerCase();
      const emailChanged    = normalizedEmail !== trim(initialLoadedForm.email).toLowerCase();

      /* 1. Update name/email in profiles table */
      await apiFetch("/users/me", token, {
        method: "PATCH",
        body: { full_name: normalizedName, email: normalizedEmail },
      });

      /* 2. Save bank + address + kyc in participant_details */
      await apiFetch("/applications/payment-details", token, {
        method: "PUT",
        body: {
          address: {
            address_line1: trim(form.address_line1),
            address_line2: trim(form.address_line2),
            city:          trim(form.city),
            state:         trim(form.state),
            pincode:       trim(form.pincode),
            country:       trim(form.country) || "India",
          },
          bankDetails: {
            bank_account_name:   trim(form.bank_account_name),
            bank_account_number: trim(form.bank_account_number),
            bank_ifsc:           trim(form.bank_ifsc).toUpperCase(),
            bank_name:           trim(form.bank_name),
          },
          kycDetails: {
            pan_number: trim(form.pan_number).toUpperCase(),
          },
        },
      });

      /* 3. Email update is LAST — invalidates Supabase session token */
      if (emailChanged) {
        await requestEmailUpdateInSupabase({ token, email: normalizedEmail });
      }

      setShowConfirm(false);
      setInitialLoadedForm({ ...form, full_name: normalizedName, email: normalizedEmail });
      setConfirmEmail(""); setEditing(false); setFieldErrors({}); setTouched({});

      /* Navigate back to dashboard with success toast */
      navigate(paths.dashboard, {
        replace: true,
        state: {
          dashboardToast: emailChanged
            ? "Profile saved! Please verify your new email before your next login."
            : "Profile updated successfully. ✓",
          dashboardToastType: "success",
        },
      });

    } catch (err) {
      setShowConfirm(false);
      if (err.status === 401) {
        clearStoredTokens();
        navigate("/login", { replace: true });
        return;
      }
      setError(err.message || "Unable to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(initialLoadedForm); setConfirmEmail(""); setEditing(false);
    setError(""); setMessage(""); setFieldErrors({}); setTouched({});
  };

  const emailChanged = trim(form.email).toLowerCase() !== trim(initialLoadedForm.email).toLowerCase();

  return (
    <div className="participant-profile-page">
      {showConfirm && <ConfirmModal form={form} onConfirm={handleConfirmSave} onEdit={() => setShowConfirm(false)} saving={saving} />}

      <header className="participant-profile-topbar">
        <div className="participant-profile-brand">Nitro</div>
        <nav>
          <button type="button" onClick={() => navigate(paths.dashboard)}>Dashboard</button>
          <button type="button" onClick={() => navigate(paths.allocation)}>My Tasks</button>
          <button type="button" onClick={() => navigate(paths.payouts)}>Payouts</button>
          <button type="button" className="active">Profile</button>
        </nav>
      </header>

      <main className="participant-profile-main">
        <header className="participant-profile-head">
          <div>
            <h1>My Profile</h1>
            <p>View and update your personal, address, bank, and KYC details.</p>
          </div>
          {!loading && (
            <div className="participant-profile-head-actions">
              {!editing
                ? <button type="button" onClick={() => { setEditing(true); setMessage(""); setError(""); }}>Edit Profile</button>
                : <button type="button" className="secondary" onClick={handleCancel} disabled={saving}>Cancel Edit</button>
              }
            </div>
          )}
        </header>

        {error   && <p className="participant-profile-error">{error}</p>}
        {message && <p className="participant-profile-success">{message}</p>}
        {loading && <p className="participant-profile-muted">Loading profile…</p>}

        {!loading && (
          <form className="participant-profile-card" onSubmit={handleSaveClick} noValidate>

            {/* ── Basic ── */}
            <section className="participant-profile-section">
              <h2>Basic Information</h2>
              <div className="participant-profile-grid">
                <Field label="Full Name" error={fieldErrors.full_name} required>
                  <input value={form.full_name} onChange={(e) => setField("full_name", e.target.value)} onBlur={() => blurField("full_name")} readOnly={!editing} placeholder={editing ? "Enter your full name" : ""} className={fieldErrors.full_name ? "pp-input--error" : ""} />
                </Field>
                <Field label="Email" error={fieldErrors.email} required>
                  <input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} onBlur={() => blurField("email")} readOnly={!editing} placeholder={editing ? "your@email.com" : ""} className={fieldErrors.email ? "pp-input--error" : ""} />
                </Field>
                {editing && emailChanged && (
                  <Field label="Confirm New Email" error={fieldErrors.confirmEmail} required>
                    <input type="email" value={confirmEmail}
                      onChange={(e) => { setConfirmEmail(e.target.value); if (touched.confirmEmail) setFieldErrors((p) => ({ ...p, confirmEmail: trim(form.email).toLowerCase() !== trim(e.target.value).toLowerCase() ? "Emails do not match." : null })); }}
                      onBlur={() => { setTouched((p) => ({ ...p, confirmEmail: true })); setFieldErrors((p) => ({ ...p, confirmEmail: trim(form.email).toLowerCase() !== trim(confirmEmail).toLowerCase() ? "Emails do not match." : null })); }}
                      placeholder="Re-enter your new email" className={fieldErrors.confirmEmail ? "pp-input--error" : ""} />
                  </Field>
                )}
                <label><span className="pp-field-label">Role</span><input value={form.role} readOnly className="pp-readonly" /></label>
                <label><span className="pp-field-label">Status</span><input value={form.status} readOnly className="pp-readonly" /></label>
                <label><span className="pp-field-label">Joined At</span><input value={form.created_at ? new Date(form.created_at).toLocaleString() : "—"} readOnly className="pp-readonly" /></label>
              </div>
            </section>

            {/* ── Address ── */}
            <section className="participant-profile-section">
              <h2>Address Information</h2>
              <div className="participant-profile-grid">
                <Field label="Address Line 1" error={fieldErrors.address_line1} required>
                  <input value={form.address_line1} onChange={(e) => setField("address_line1", e.target.value)} onBlur={() => blurField("address_line1")} readOnly={!editing} placeholder={editing ? "House / Flat / Street" : ""} className={fieldErrors.address_line1 ? "pp-input--error" : ""} />
                </Field>
                <label><span className="pp-field-label">Address Line 2</span><input value={form.address_line2} onChange={(e) => setField("address_line2", e.target.value)} readOnly={!editing} placeholder={editing ? "Landmark / Area (optional)" : ""} /></label>
                <Field label="City" error={fieldErrors.city} required>
                  <input value={form.city} onChange={(e) => setField("city", e.target.value)} onBlur={() => blurField("city")} readOnly={!editing} placeholder={editing ? "City" : ""} className={fieldErrors.city ? "pp-input--error" : ""} />
                </Field>
                <Field label="State" error={fieldErrors.state} required>
                  <input value={form.state} onChange={(e) => setField("state", e.target.value)} onBlur={() => blurField("state")} readOnly={!editing} placeholder={editing ? "State" : ""} className={fieldErrors.state ? "pp-input--error" : ""} />
                </Field>
                <Field label="Pincode" error={fieldErrors.pincode} required>
                  <input value={form.pincode} onChange={(e) => setField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} onBlur={() => blurField("pincode")} readOnly={!editing} placeholder={editing ? "6-digit pincode" : ""} maxLength={6} className={fieldErrors.pincode ? "pp-input--error" : ""} />
                </Field>
                <label><span className="pp-field-label">Country</span><input value={form.country} onChange={(e) => setField("country", e.target.value)} readOnly={!editing} /></label>
              </div>
            </section>

            {/* ── Bank ── */}
            <section className="participant-profile-section">
              <h2>Bank Information</h2>
              <div className="participant-profile-grid">
                <Field label="Account Holder Name" error={fieldErrors.bank_account_name} required>
                  <input value={form.bank_account_name} onChange={(e) => setField("bank_account_name", e.target.value)} onBlur={() => blurField("bank_account_name")} readOnly={!editing} placeholder={editing ? "Name as on bank account" : ""} className={fieldErrors.bank_account_name ? "pp-input--error" : ""} />
                </Field>
                <Field label="Bank Account Number" error={fieldErrors.bank_account_number} required>
                  <input value={form.bank_account_number} onChange={(e) => setField("bank_account_number", e.target.value.replace(/\D/g, ""))} onBlur={() => blurField("bank_account_number")} readOnly={!editing} placeholder={editing ? "Digits only" : ""} maxLength={18} className={fieldErrors.bank_account_number ? "pp-input--error" : ""} style={{ fontFamily: "monospace", letterSpacing: "0.05em" }} />
                </Field>
                <Field label="IFSC Code" error={fieldErrors.bank_ifsc} required>
                  <input value={form.bank_ifsc} onChange={(e) => setField("bank_ifsc", e.target.value.toUpperCase().replace(/\s/g, ""))} onBlur={() => blurField("bank_ifsc")} readOnly={!editing} placeholder={editing ? "e.g. HDFC0001234" : ""} maxLength={11} className={fieldErrors.bank_ifsc ? "pp-input--error" : ""} style={{ fontFamily: "monospace", letterSpacing: "0.08em", fontWeight: 600 }} />
                </Field>
                <Field label="Bank Name" error={fieldErrors.bank_name} required>
                  <input value={form.bank_name} onChange={(e) => setField("bank_name", e.target.value)} onBlur={() => blurField("bank_name")} readOnly={!editing} placeholder={editing ? "e.g. HDFC Bank" : ""} className={fieldErrors.bank_name ? "pp-input--error" : ""} />
                </Field>
              </div>
            </section>

            {/* ── KYC ── */}
            <section className="participant-profile-section">
              <h2>KYC Details</h2>
              <div className="participant-profile-grid">
                <Field label="PAN Card Number" error={fieldErrors.pan_number} required>
                  <input value={form.pan_number} onChange={(e) => setField("pan_number", e.target.value.toUpperCase().replace(/\s/g, ""))} onBlur={() => blurField("pan_number")} readOnly={!editing} maxLength={10} placeholder={editing ? "e.g. ABCDE1234F" : ""} className={fieldErrors.pan_number ? "pp-input--error" : ""} style={{ fontFamily: "monospace", letterSpacing: "0.1em", fontWeight: 600 }} />
                </Field>
              </div>
            </section>

            {editing && (
              <div className="participant-profile-actions">
                <button type="submit" disabled={saving}>{saving ? "Saving…" : "Review & Save →"}</button>
                <button type="button" className="secondary" onClick={handleCancel} disabled={saving}>Cancel</button>
              </div>
            )}
          </form>
        )}
      </main>
    </div>
  );
};

export default Profile;