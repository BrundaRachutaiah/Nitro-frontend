import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUpWithSupabase } from "../../lib/auth";
import "./Register.css";

const SIGNUP_COOLDOWN_UNTIL_KEY = "nitro_signup_cooldown_until";

const Register = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [accountType, setAccountType] = useState("SAVINGS");
  const [upiId, setUpiId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    const savedUntil = Number(localStorage.getItem(SIGNUP_COOLDOWN_UNTIL_KEY) || 0);
    const now = Date.now();
    if (savedUntil > now) {
      setCooldownSeconds(Math.ceil((savedUntil - now) / 1000));
    }
  }, []);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      localStorage.removeItem(SIGNUP_COOLDOWN_UNTIL_KEY);
      return undefined;
    }

    localStorage.setItem(SIGNUP_COOLDOWN_UNTIL_KEY, String(Date.now() + (cooldownSeconds * 1000)));

    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!fullName.trim() || !email.trim() || !phone.trim() || !password) {
      setError("Full name, email, phone, and password are required.");
      return;
    }

    if (!accountHolderName.trim() || !accountNumber.trim() || !confirmAccountNumber.trim() || !ifscCode.trim()) {
      setError("Bank details are required: account holder, account number, confirm account number, and IFSC.");
      return;
    }

    if (accountNumber.trim() !== confirmAccountNumber.trim()) {
      setError("Bank account numbers do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (cooldownSeconds > 0) {
      setError(`Too many attempts. Please wait ${cooldownSeconds}s and try again.`);
      return;
    }

    setIsSubmitting(true);

    try {
      await signUpWithSupabase({
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
            upi_id: upiId.trim() || null
          },
          terms_accepted: false,
          terms_accepted_at: null
        }
      });

      setSuccess(
        "Successfully registered for Nitro. Login access will be granted after admin approval."
      );

      setTimeout(() => {
        navigate("/login/participant", { replace: true });
      }, 1800);
    } catch (err) {
      const raw = String(err?.message || "");
      const lower = raw.toLowerCase();

      if (err?.status === 429 || lower.includes("too many requests") || lower.includes("rate limit") || lower.includes("429")) {
        const waitSeconds = Number(err?.retryAfter) > 0 ? Number(err.retryAfter) : 60;
        setCooldownSeconds(waitSeconds);
        setError(`Too many signup attempts. Please wait ${waitSeconds}s before trying again.`);
      } else if (lower.includes("already") && lower.includes("registered")) {
        setError("This email is already registered. Please sign in instead.");
      } else if (lower.includes("password")) {
        setError(`Password policy error: ${raw}`);
      } else if (lower.includes("signup") && lower.includes("disabled")) {
        setError("Signup is disabled in Supabase settings. Contact the project admin.");
      } else if (lower.includes("captcha")) {
        setError("Signup requires CAPTCHA in Supabase settings. Please disable CAPTCHA or pass a captcha token.");
      } else {
        setError(raw || "Unable to register.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextStep = () => {
    setError("");
    setSuccess("");

    if (!fullName.trim() || !email.trim() || !phone.trim() || !password) {
      setError("Full name, email, phone, and password are required.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setCurrentStep(2);
  };

  return (
    <div className="register-page d-flex justify-content-center px-3 px-sm-4 py-5">
      <div className="register-shell w-100">
        <header className="text-center mb-4 mb-sm-5">
          <h1 className="register-brand mb-1">Nitro</h1>
          <p className="register-subtitle mb-0">BY TEAMSUCCESSO</p>
        </header>

        <section className="register-card card border-0 shadow-sm">
          <div className="card-body p-4 p-sm-5">
            <h2 className="register-title mb-4">Create Account</h2>

            {error ? <div className="alert alert-danger py-2 mb-3">{error}</div> : null}
            {success ? <div className="alert alert-success py-2 mb-3">{success}</div> : null}
            <div className="register-stepper mb-4">
              <button
                type="button"
                className={`register-step-pill ${currentStep === 1 ? "active" : ""}`}
                onClick={() => setCurrentStep(1)}
              >
                1. Personal Details
              </button>
              <button
                type="button"
                className={`register-step-pill ${currentStep === 2 ? "active" : ""}`}
                onClick={() => setCurrentStep(2)}
              >
                2. Bank Details
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {currentStep === 1 ? (
                <>
                  <div className="mb-3">
                    <label htmlFor="fullName" className="form-label register-label mb-2">
                      Full Name
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      className="form-control register-input"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Your full name"
                      autoComplete="name"
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="email" className="form-label register-label mb-2">
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      className="form-control register-input"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="name@company.com"
                      autoComplete="email"
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="phone" className="form-label register-label mb-2">
                      Phone Number
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      className="form-control register-input"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="10-digit mobile number"
                      autoComplete="tel"
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="password" className="form-label register-label mb-2">
                      Password
                    </label>
                    <div className="position-relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        className="form-control register-input pe-5"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Enter password"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="btn register-eye"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <svg className="register-eye-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.9}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7C20.268 16.057 16.477 19 12 19S3.732 16.057 2.458 12z"
                            />
                            <circle cx="12" cy="12" r="3" strokeWidth={1.9} />
                          </svg>
                        ) : (
                          <svg className="register-eye-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.9}
                              d="M3 3l18 18M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-4.4M9.9 5.1A9.8 9.8 0 0 1 12 5c4.48 0 8.27 2.94 9.54 7a9.67 9.67 0 0 1-2.36 3.8M6.2 6.2A9.76 9.76 0 0 0 2.46 12C3.73 16.06 7.52 19 12 19c1.74 0 3.37-.45 4.78-1.23"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label htmlFor="confirmPassword" className="form-label register-label mb-2">
                      Confirm Password
                    </label>
                    <div className="position-relative">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        className="form-control register-input pe-5"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Re-enter password"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="btn register-eye"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      >
                        {showConfirmPassword ? (
                          <svg className="register-eye-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.9}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7C20.268 16.057 16.477 19 12 19S3.732 16.057 2.458 12z"
                            />
                            <circle cx="12" cy="12" r="3" strokeWidth={1.9} />
                          </svg>
                        ) : (
                          <svg className="register-eye-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.9}
                              d="M3 3l18 18M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-4.4M9.9 5.1A9.8 9.8 0 0 1 12 5c4.48 0 8.27 2.94 9.54 7a9.67 9.67 0 0 1-2.36 3.8M6.2 6.2A9.76 9.76 0 0 0 2.46 12C3.73 16.06 7.52 19 12 19c1.74 0 3.37-.45 4.78-1.23"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="register-submit w-100"
                    onClick={handleNextStep}
                    disabled={isSubmitting || cooldownSeconds > 0}
                  >
                    Continue to Bank Details
                  </button>
                </>
              ) : (
                <>
                  <h3 className="register-section-title mb-3">Bank Details</h3>

                  <div className="mb-3">
                    <label htmlFor="accountHolderName" className="form-label register-label mb-2">
                      Account Holder Name
                    </label>
                    <input
                      id="accountHolderName"
                      type="text"
                      className="form-control register-input"
                      value={accountHolderName}
                      onChange={(event) => setAccountHolderName(event.target.value)}
                      placeholder="Name as per bank account"
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="accountNumber" className="form-label register-label mb-2">
                      Account Number
                    </label>
                    <input
                      id="accountNumber"
                      type="text"
                      className="form-control register-input"
                      value={accountNumber}
                      onChange={(event) => setAccountNumber(event.target.value)}
                      placeholder="Bank account number"
                      autoComplete="off"
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="confirmAccountNumber" className="form-label register-label mb-2">
                      Confirm Account Number
                    </label>
                    <input
                      id="confirmAccountNumber"
                      type="text"
                      className="form-control register-input"
                      value={confirmAccountNumber}
                      onChange={(event) => setConfirmAccountNumber(event.target.value)}
                      placeholder="Re-enter account number"
                      autoComplete="off"
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="ifscCode" className="form-label register-label mb-2">
                      IFSC Code
                    </label>
                    <input
                      id="ifscCode"
                      type="text"
                      className="form-control register-input"
                      value={ifscCode}
                      onChange={(event) => setIfscCode(event.target.value.toUpperCase())}
                      placeholder="e.g. HDFC0001234"
                      autoComplete="off"
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="accountType" className="form-label register-label mb-2">
                      Account Type
                    </label>
                    <select
                      id="accountType"
                      className="form-control register-input"
                      value={accountType}
                      onChange={(event) => setAccountType(event.target.value)}
                    >
                      <option value="SAVINGS">Savings</option>
                      <option value="CURRENT">Current</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="upiId" className="form-label register-label mb-2">
                      UPI ID (Optional)
                    </label>
                    <input
                      id="upiId"
                      type="text"
                      className="form-control register-input"
                      value={upiId}
                      onChange={(event) => setUpiId(event.target.value)}
                      placeholder="name@upi"
                    />
                  </div>

                  <div className="register-actions">
                    <button
                      type="button"
                      className="register-back-btn"
                      onClick={() => setCurrentStep(1)}
                      disabled={isSubmitting}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="register-submit"
                      disabled={isSubmitting || cooldownSeconds > 0}
                    >
                      {isSubmitting ? "Creating..." : cooldownSeconds > 0 ? `Try again in ${cooldownSeconds}s` : "Create Account"}
                    </button>
                  </div>
                </>
              )}
            </form>

          </div>
        </section>

        <p className="text-center register-login mt-4 mb-0">
          Already have an account?
          <Link to="/login/participant" className="ms-2 fw-semibold register-link">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
