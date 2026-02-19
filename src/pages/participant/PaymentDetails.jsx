import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getPaymentDetails, savePaymentDetails } from "../../api/allocation.api";
import "./ActionForms.css";

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
  bank_name: ""
};

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
            bank_name: details.bank_name || ""
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

  const handleSubmit = async (event) => {
    event.preventDefault();
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
        }
      });
      setMessage("Payment details saved. You can now access approved product links.");
      const nextPath = projectId
        ? `/participant/${id}/marketplace?project=${projectId}`
        : `/participant/${id}/marketplace`;
      navigate(nextPath, { replace: true });
    } catch (err) {
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
      <header className="participant-action-header">
        <div>
          <h1>Payment Details</h1>
          <p>Complete address and bank details to unlock approved product links.</p>
        </div>
        <button type="button" className="participant-action-back" onClick={() => navigate(backPath)}>
          Back to Marketplace
        </button>
      </header>

      <section className="participant-action-card">
        {error ? <p className="participant-action-error">{error}</p> : null}
        {message ? <p className="participant-action-success">{message}</p> : null}
        {loading ? <p className="participant-action-muted">Loading existing details...</p> : null}

        {!loading ? (
          <form onSubmit={handleSubmit} className="participant-action-form">
            <label htmlFor="addressLine1">Address line 1</label>
            <input id="addressLine1" value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} />

            <label htmlFor="addressLine2">Address line 2</label>
            <input id="addressLine2" value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} />

            <label htmlFor="city">City</label>
            <input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />

            <label htmlFor="state">State</label>
            <input id="state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />

            <label htmlFor="pincode">Pincode</label>
            <input id="pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />

            <label htmlFor="country">Country</label>
            <input id="country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />

            <label htmlFor="accountHolderName">Account Holder Name</label>
            <input id="accountHolderName" value={form.bank_account_name} onChange={(e) => setForm({ ...form, bank_account_name: e.target.value })} />

            <label htmlFor="accountNumber">Bank Account Number</label>
            <input id="accountNumber" value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} />

            <label htmlFor="ifsc">IFSC Code</label>
            <input id="ifsc" value={form.bank_ifsc} onChange={(e) => setForm({ ...form, bank_ifsc: e.target.value })} />

            <label htmlFor="bankName">Bank Name</label>
            <input id="bankName" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />

            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Payment Details"}
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
};

export default PaymentDetails;
