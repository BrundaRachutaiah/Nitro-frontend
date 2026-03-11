import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getPaymentDetails, savePaymentDetails } from "../../api/allocation.api";
import "./ActionForms.css";
import "./PaymentDetailsConfirm.css";

const initialForm = {
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  bank_account_name: "",
  bank_account_number: "",
  bank_ifsc: "",
  bank_name: "",
  pan_number: ""
};

const maskAccountNumber = (num) => {
  if (!num || num.length < 4) return num;
  return "*".repeat(num.length - 4) + num.slice(-4);
};

const ConfirmationModal = ({ form, onConfirm, onEdit, saving }) => (
  <div className="pd-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="pd-modal-title">
    <div className="pd-modal">
      <div className="pd-modal-header">
        <div className="pd-modal-icon">✓</div>
        <h2 id="pd-modal-title">Review Your Details</h2>
        <p>Please verify everything is correct before submitting. You can edit if needed.</p>
      </div>

      <div className="pd-modal-body">
        <div className="pd-modal-section">
          <h3>📍 Address</h3>
          <div className="pd-modal-grid">
            <div className="pd-modal-row">
              <span className="pd-modal-label">Address Line 1</span>
              <span className="pd-modal-value">{form.address_line1 || "—"}</span>
            </div>
            {form.address_line2 ? (
              <div className="pd-modal-row">
                <span className="pd-modal-label">Address Line 2</span>
                <span className="pd-modal-value">{form.address_line2}</span>
              </div>
            ) : null}
            <div className="pd-modal-row">
              <span className="pd-modal-label">City</span>
              <span className="pd-modal-value">{form.city || "—"}</span>
            </div>
            <div className="pd-modal-row">
              <span className="pd-modal-label">State</span>
              <span className="pd-modal-value">{form.state || "—"}</span>
            </div>
            <div className="pd-modal-row">
              <span className="pd-modal-label">Pincode</span>
              <span className="pd-modal-value">{form.pincode || "—"}</span>
            </div>
            <div className="pd-modal-row">
              <span className="pd-modal-label">Country</span>
              <span className="pd-modal-value">{form.country || "India"}</span>
            </div>
          </div>
        </div>

        <div className="pd-modal-section">
          <h3>🏦 Bank Details</h3>
          <div className="pd-modal-grid">
            <div className="pd-modal-row">
              <span className="pd-modal-label">Account Holder</span>
              <span className="pd-modal-value">{form.bank_account_name || "—"}</span>
            </div>
            <div className="pd-modal-row">
              <span className="pd-modal-label">Account Number</span>
              <span className="pd-modal-value pd-modal-sensitive">{maskAccountNumber(form.bank_account_number) || "—"}</span>
            </div>
            <div className="pd-modal-row">
              <span className="pd-modal-label">IFSC Code</span>
              <span className="pd-modal-value">{form.bank_ifsc ? form.bank_ifsc.toUpperCase() : "—"}</span>
            </div>
            <div className="pd-modal-row">
              <span className="pd-modal-label">Bank Name</span>
              <span className="pd-modal-value">{form.bank_name || "—"}</span>
            </div>
          </div>
        </div>

        <div className="pd-modal-section">
          <h3>🪪 KYC / PAN Details</h3>
          <div className="pd-modal-grid">
            <div className="pd-modal-row">
              <span className="pd-modal-label">PAN Number</span>
              <span className="pd-modal-value pd-modal-pan">{form.pan_number ? form.pan_number.toUpperCase() : "—"}</span>
            </div>
          </div>
        </div>

        <div className="pd-modal-notice">
          <span>⚠️</span>
          <p>Incorrect details may delay product allocation or payouts. Double-check before confirming.</p>
        </div>
      </div>

      <div className="pd-modal-actions">
        <button type="button" className="pd-modal-edit-btn" onClick={onEdit} disabled={saving}>
          ✏️ Edit Details
        </button>
        <button type="button" className="pd-modal-confirm-btn" onClick={onConfirm} disabled={saving}>
          {saving ? "Saving..." : "✓ Confirm & Submit"}
        </button>
      </div>
    </div>
  </div>
);

const PaymentDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getPaymentDetails();
        const details = res?.data?.data?.details;
        if (details) {
          setForm({
            address_line1: details.address_line1 || "",
            address_line2: details.address_line2 || "",
            city: details.city || "",
            state: details.state || "",
            pincode: details.pincode || "",
            country: details.country || "India",
            bank_account_name: details.bank_account_name || "",
            bank_account_number: details.bank_account_number || "",
            bank_ifsc: details.bank_ifsc || "",
            bank_name: details.bank_name || "",
            pan_number: details.pan_number || ""
          });
        }
      } catch (err) {
        setError(err?.response?.data?.message || "Unable to load payment details.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleReviewAndSubmit = (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.bank_account_number || !form.bank_ifsc) {
      setError("Bank account number and IFSC code are required.");
      return;
    }
    if (!form.pan_number) {
      setError("PAN card number is required.");
      return;
    }
    const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i;
    if (!panPattern.test(form.pan_number.trim())) {
      setError("Invalid PAN format. Expected format: ABCDE1234F");
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirmSubmit = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await savePaymentDetails({
        address: {
          address_line1: form.address_line1,
          address_line2: form.address_line2,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          country: form.country || "India"
        },
        bankDetails: {
          bank_account_name: form.bank_account_name,
          bank_account_number: form.bank_account_number,
          bank_ifsc: form.bank_ifsc,
          bank_name: form.bank_name
        },
        kycDetails: {
          pan_number: form.pan_number.trim().toUpperCase()
        }
      });
      setShowConfirm(false);
      setMessage("Payment details saved. You can now access approved product links.");
      const nextPath = projectId
        ? `/participant/${id}/marketplace?project=${projectId}`
        : `/participant/${id}/marketplace`;
      navigate(nextPath, { replace: true });
    } catch (err) {
      setShowConfirm(false);
      setError(err?.response?.data?.message || "Unable to save payment details.");
    } finally {
      setSaving(false);
    }
  };

  const backPath = projectId
    ? `/participant/${id}/marketplace?project=${projectId}`
    : `/participant/${id}/marketplace`;

  return (
    <div className="participant-action-page">
      {showConfirm ? (
        <ConfirmationModal
          form={form}
          saving={saving}
          onConfirm={handleConfirmSubmit}
          onEdit={() => setShowConfirm(false)}
        />
      ) : null}

      <header className="participant-action-header">
        <div>
          <h1>Payment & KYC Details</h1>
          <p>Complete your address, bank, and PAN details to continue product requests.</p>
        </div>
        <button type="button" className="participant-action-back" onClick={() => navigate(backPath)}>
          Back to Products
        </button>
      </header>

      <section className="participant-action-card">
        {error ? <p className="participant-action-error">{error}</p> : null}
        {message ? <p className="participant-action-success">{message}</p> : null}
        {loading ? <p className="participant-action-muted">Loading existing details...</p> : null}

        {!loading ? (
          <form onSubmit={handleReviewAndSubmit} className="participant-action-form">

            <div className="participant-action-section-title">📍 Address Details</div>
            <label htmlFor="addressLine1">Address Line 1 <span className="pd-required">*</span></label>
            <input id="addressLine1" value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} placeholder="House / Flat / Building" />

            <label htmlFor="addressLine2">Address Line 2</label>
            <input id="addressLine2" value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} placeholder="Street / Area (optional)" />

            <label htmlFor="city">City <span className="pd-required">*</span></label>
            <input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />

            <label htmlFor="state">State <span className="pd-required">*</span></label>
            <input id="state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />

            <label htmlFor="pincode">Pincode <span className="pd-required">*</span></label>
            <input id="pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} maxLength={10} />

            <label htmlFor="country">Country</label>
            <input id="country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />

            <div className="participant-action-section-title">🏦 Bank Details</div>
            <label htmlFor="accountHolderName">Account Holder Name</label>
            <input id="accountHolderName" value={form.bank_account_name} onChange={(e) => setForm({ ...form, bank_account_name: e.target.value })} placeholder="As on bank records" />

            <label htmlFor="accountNumber">Bank Account Number <span className="pd-required">*</span></label>
            <input id="accountNumber" value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} />

            <label htmlFor="ifsc">IFSC Code <span className="pd-required">*</span></label>
            <input id="ifsc" value={form.bank_ifsc} onChange={(e) => setForm({ ...form, bank_ifsc: e.target.value.toUpperCase() })} placeholder="e.g. SBIN0001234" maxLength={11} />

            <label htmlFor="bankName">Bank Name</label>
            <input id="bankName" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />

            <div className="participant-action-section-title">🪪 KYC Details</div>
            <label htmlFor="panNumber">PAN Card Number <span className="pd-required">*</span></label>
            <input
              id="panNumber"
              value={form.pan_number}
              onChange={(e) => setForm({ ...form, pan_number: e.target.value.toUpperCase() })}
              placeholder="e.g. ABCDE1234F"
              maxLength={10}
            />
            <p className="participant-action-note">PAN is required for tax compliance and payout processing.</p>

            <div className="pd-required-note">Fields marked <span className="pd-required">*</span> are required.</div>

            <button type="submit" disabled={saving}>
              Review & Submit
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
};

export default PaymentDetails;
