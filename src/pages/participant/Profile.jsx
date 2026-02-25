import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getPaymentDetails, savePaymentDetails } from "../../api/allocation.api";
import { getMyProfile, updateMyProfile } from "../../api/user.api";
import { getStoredToken, requestEmailUpdateInSupabase } from "../../lib/auth";
import "./Profile.css";

const initialForm = {
  full_name: "",
  email: "",
  role: "",
  status: "",
  created_at: "",
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

const Profile = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(initialForm);
  const [initialLoadedForm, setInitialLoadedForm] = useState(initialForm);
  const [confirmEmail, setConfirmEmail] = useState("");

  const participantDashboardPath = id ? `/participant/${id}/dashboard` : "/dashboard";
  const participantAllocationPath = id ? `/participant/${id}/allocation/active` : "/dashboard";
  const participantPayoutPath = id ? `/participant/${id}/payouts` : "/dashboard";
  const participantProfilePath = id ? `/participant/${id}/profile` : "/dashboard";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [profileRes, detailsRes] = await Promise.all([
          getMyProfile(),
          getPaymentDetails()
        ]);

        const profile = profileRes?.data?.data || {};
        const details = detailsRes?.data?.data?.details || {};

        setForm({
          full_name: profile.full_name || "",
          email: profile.email || "",
          role: profile.role || "",
          status: profile.status || "",
          created_at: profile.created_at || "",
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

        setInitialLoadedForm({
          full_name: profile.full_name || "",
          email: profile.email || "",
          role: profile.role || "",
          status: profile.status || "",
          created_at: profile.created_at || "",
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
      } catch (err) {
        setError(err?.response?.data?.message || "Unable to load profile.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const normalizedName = String(form.full_name || "").trim();
      const normalizedEmail = String(form.email || "").trim().toLowerCase();
      const initialEmail = String(initialLoadedForm.email || "").trim().toLowerCase();
      const emailChanged = normalizedEmail !== initialEmail;

      if (!normalizedName) {
        throw new Error("Full name is required.");
      }

      if (!isValidEmail(normalizedEmail)) {
        throw new Error("Please enter a valid email address.");
      }

      if (emailChanged) {
        const normalizedConfirmEmail = String(confirmEmail || "").trim().toLowerCase();
        if (!normalizedConfirmEmail) {
          throw new Error("Please re-enter your email in Confirm Email.");
        }
        if (normalizedEmail !== normalizedConfirmEmail) {
          throw new Error("Email and Confirm Email do not match.");
        }

        const token = getStoredToken();
        await requestEmailUpdateInSupabase({
          token,
          email: normalizedEmail
        });
      }

      await updateMyProfile({
        full_name: normalizedName,
        email: normalizedEmail
      });

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

      setMessage(
        emailChanged
          ? "Profile saved. Please verify your new email from your inbox before using it for next login."
          : "Profile updated successfully."
      );
      setInitialLoadedForm((prev) => ({
        ...form,
        full_name: normalizedName,
        email: emailChanged ? normalizedEmail : prev.email
      }));
      setConfirmEmail("");
      setEditing(false);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(initialLoadedForm);
    setConfirmEmail("");
    setEditing(false);
    setError("");
    setMessage("");
  };

  return (
    <div className="participant-profile-page">
      <header className="participant-profile-topbar">
        <div className="participant-profile-brand">Nitro</div>
        <nav>
          <button type="button" onClick={() => navigate(participantDashboardPath)}>Dashboard</button>
          <button type="button" onClick={() => navigate(participantAllocationPath)}>My Tasks</button>
          <button type="button" onClick={() => navigate(participantPayoutPath)}>Payouts</button>
          <button type="button" className="active" onClick={() => navigate(participantProfilePath)}>Profile</button>
        </nav>
      </header>

      <main className="participant-profile-main">
        <header className="participant-profile-head">
          <div>
            <h1>My Profile</h1>
            <p>View and update all participant information.</p>
          </div>
          {!loading ? (
            <div className="participant-profile-head-actions">
              {!editing ? (
                <button type="button" onClick={() => setEditing(true)}>Edit Profile</button>
              ) : (
                <button type="button" className="secondary" onClick={handleCancel} disabled={saving}>Cancel Edit</button>
              )}
            </div>
          ) : null}
        </header>

        {error ? <p className="participant-profile-error">{error}</p> : null}
        {message ? <p className="participant-profile-success">{message}</p> : null}
        {loading ? <p className="participant-profile-muted">Loading profile...</p> : null}

        {!loading ? (
          <form className="participant-profile-card" onSubmit={handleSave}>
            <section className="participant-profile-section">
              <h2>Basic Information</h2>
              <div className="participant-profile-grid">
                <label>
                  Full Name
                  <input value={form.full_name} onChange={(e) => setField("full_name", e.target.value)} readOnly={!editing} />
                </label>
                <label>
                  Email
                  <input
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    readOnly={!editing}
                    type="email"
                  />
                </label>
                {editing ? (
                  <label>
                    Confirm Email
                    <input
                      value={confirmEmail}
                      onChange={(e) => setConfirmEmail(e.target.value)}
                      type="email"
                      placeholder="Re-enter email to confirm"
                    />
                  </label>
                ) : null}
                <label>
                  Role
                  <input value={form.role} readOnly />
                </label>
                <label>
                  Status
                  <input value={form.status} readOnly />
                </label>
                <label>
                  Joined At
                  <input value={form.created_at ? new Date(form.created_at).toLocaleString() : "-"} readOnly />
                </label>
              </div>
            </section>

            <section className="participant-profile-section">
              <h2>Address Information</h2>
              <div className="participant-profile-grid">
                <label>
                  Address Line 1
                  <input value={form.address_line1} onChange={(e) => setField("address_line1", e.target.value)} readOnly={!editing} />
                </label>
                <label>
                  Address Line 2
                  <input value={form.address_line2} onChange={(e) => setField("address_line2", e.target.value)} readOnly={!editing} />
                </label>
                <label>
                  City
                  <input value={form.city} onChange={(e) => setField("city", e.target.value)} readOnly={!editing} />
                </label>
                <label>
                  State
                  <input value={form.state} onChange={(e) => setField("state", e.target.value)} readOnly={!editing} />
                </label>
                <label>
                  Pincode
                  <input value={form.pincode} onChange={(e) => setField("pincode", e.target.value)} readOnly={!editing} />
                </label>
                <label>
                  Country
                  <input value={form.country} onChange={(e) => setField("country", e.target.value)} readOnly={!editing} />
                </label>
              </div>
            </section>

            <section className="participant-profile-section">
              <h2>Bank Information</h2>
              <div className="participant-profile-grid">
                <label>
                  Account Holder Name
                  <input value={form.bank_account_name} onChange={(e) => setField("bank_account_name", e.target.value)} readOnly={!editing} />
                </label>
                <label>
                  Bank Account Number
                  <input value={form.bank_account_number} onChange={(e) => setField("bank_account_number", e.target.value)} readOnly={!editing} />
                </label>
                <label>
                  IFSC Code
                  <input value={form.bank_ifsc} onChange={(e) => setField("bank_ifsc", e.target.value)} readOnly={!editing} />
                </label>
                <label>
                  Bank Name
                  <input value={form.bank_name} onChange={(e) => setField("bank_name", e.target.value)} readOnly={!editing} />
                </label>
              </div>
            </section>

            <div className="participant-profile-actions">
              {editing ? (
                <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Profile"}</button>
              ) : null}
            </div>
          </form>
        ) : null}
      </main>
    </div>
  );
};

export default Profile;
