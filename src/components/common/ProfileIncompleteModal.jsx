/**
 * ProfileIncompleteModal.jsx
 * ─────────────────────────────────────────────────────────────────
 * Shows a prominent popup when the participant's profile is not 100%
 * complete. Used on:
 *   1. Participant Dashboard — auto-shown after login if incomplete
 *   2. SuperAdmin Dashboard  — shown when clicking "Participant View"
 *      before navigating, so the admin knows their profile is incomplete.
 *
 * Props:
 *   open          {boolean}   – whether to show
 *   onClose       {function}  – called when user dismisses
 *   onComplete    {function}  – called when user clicks "Complete Profile"
 *   profileData   {object}    – merged profile + participant_details fields
 *   percentage    {number}    – 0-100
 *   isSuperAdmin  {boolean}   – changes copy slightly
 */

import "./ProfileIncompleteModal.css";

/* ─── which fields belong to which section ────────────────────── */
const SECTIONS = [
  {
    key: "basic",
    label: "Basic Information",
    icon: "👤",
    fields: [
      { key: "full_name",  label: "Full Name" },
      { key: "email",      label: "Email Address" },
    ],
  },
  {
    key: "address",
    label: "Address Details",
    icon: "🏠",
    fields: [
      { key: "address_line1", label: "Address Line 1" },
      { key: "city",          label: "City" },
      { key: "state",         label: "State" },
      { key: "pincode",       label: "Pincode" },
    ],
  },
  {
    key: "bank",
    label: "Bank Information",
    icon: "🏦",
    fields: [
      { key: "bank_account_name",   label: "Account Holder Name" },
      { key: "bank_account_number", label: "Account Number" },
      { key: "bank_ifsc",           label: "IFSC Code" },
      { key: "bank_name",           label: "Bank Name" },
    ],
  },
  {
    key: "kyc",
    label: "KYC / Identity",
    icon: "🪪",
    fields: [
      { key: "pan_number", label: "PAN Card Number" },
    ],
  },
];

const hasValue = (v) => String(v || "").trim().length > 0;

/* All required fields across all sections */
const ALL_REQUIRED_FIELDS = SECTIONS.flatMap((s) => s.fields);

/* compute which sections have missing fields */
const getMissingSections = (profileData) => {
  if (!profileData) return SECTIONS.map((s) => ({ ...s, missing: s.fields }));
  return SECTIONS.map((section) => {
    const missing = section.fields.filter((f) => !hasValue(profileData[f.key]));
    return { ...section, missing };
  }).filter((s) => s.missing.length > 0);
};

/* compute accurate completion % from actual profile fields */
const computePercentage = (profileData) => {
  if (!profileData) return 0;
  const filled = ALL_REQUIRED_FIELDS.filter((f) => hasValue(profileData[f.key])).length;
  return Math.round((filled / ALL_REQUIRED_FIELDS.length) * 100);
};

const ProfileIncompleteModal = ({
  open,
  onClose,
  onComplete,
  profileData,
  percentage: percentageProp = 0,
  isSuperAdmin = false,
}) => {
  if (!open) return null;

  // Always compute from actual fields — backend only checks 3 fields (full_name, email, approved)
  // but we need all 12 fields for reimbursement
  const percentage = profileData ? computePercentage(profileData) : percentageProp;
  const missingSections = getMissingSections(profileData);
  const totalMissing = missingSections.reduce((acc, s) => acc + s.missing.length, 0);

  /* ring stroke */
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (percentage / 100) * circumference;
  const ringColor = percentage < 40 ? "#ef4444" : percentage < 75 ? "#f59e0b" : "#10b981";

  return (
    <div className="pim-overlay" role="dialog" aria-modal="true" aria-label="Complete your profile">
      <div className="pim-backdrop" onClick={onClose} />

      <div className="pim-modal">

        {/* ── urgent banner ── */}
        <div className="pim-banner">
          <span className="pim-banner-icon">⚠️</span>
          <span>Profile Incomplete — Action Required</span>
        </div>

        {/* ── header ── */}
        <div className="pim-header">
          {/* progress ring */}
          <div className="pim-ring-wrap">
            <svg className="pim-ring" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <circle
                cx="36" cy="36" r={radius}
                fill="none"
                stroke={ringColor}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 36 36)"
                style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }}
              />
            </svg>
            <div className="pim-ring-pct" style={{ color: ringColor }}>{percentage}%</div>
          </div>

          <div className="pim-header-text">
            <h2 className="pim-title">
              {isSuperAdmin
                ? "Your participant profile is incomplete"
                : "Complete your profile to get started"}
            </h2>
            <p className="pim-subtitle">
              {isSuperAdmin
                ? "Your profile needs to be 100% complete before you can browse products, apply for campaigns, and receive reimbursements."
                : "We need your complete details for reimbursement processing. Without a complete profile, you won't be able to receive payouts for completed campaigns."}
            </p>
            {totalMissing > 0 && (
              <div className="pim-missing-count">
                <span className="pim-dot pim-dot--red" />
                {totalMissing} required field{totalMissing !== 1 ? "s" : ""} missing across {missingSections.length} section{missingSections.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>

        {/* ── importance note ── */}
        <div className="pim-importance-box">
          <div className="pim-importance-icon">💳</div>
          <div className="pim-importance-text">
            <strong>Why this is important for reimbursement</strong>
            <p>Your bank details and PAN number are mandatory for processing payouts. Address details are required for product shipping. Incomplete profiles cannot receive payments.</p>
          </div>
        </div>

        {/* ── missing sections ── */}
        {missingSections.length > 0 && (
          <div className="pim-sections">
            <p className="pim-sections-label">Missing information:</p>
            <div className="pim-sections-grid">
              {missingSections.map((section) => (
                <div key={section.key} className="pim-section-card">
                  <div className="pim-section-head">
                    <span className="pim-section-icon">{section.icon}</span>
                    <span className="pim-section-name">{section.label}</span>
                    <span className="pim-section-count">{section.missing.length} missing</span>
                  </div>
                  <ul className="pim-field-list">
                    {section.missing.map((f) => (
                      <li key={f.key} className="pim-field-item">
                        <span className="pim-field-dot" />
                        {f.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── actions ── */}
        <div className="pim-actions">
          <button type="button" className="pim-btn-primary" onClick={onComplete}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Complete My Profile Now
          </button>
          <button type="button" className="pim-btn-secondary" onClick={onClose}>
            Remind me later
          </button>
        </div>

      </div>
    </div>
  );
};

export default ProfileIncompleteModal;