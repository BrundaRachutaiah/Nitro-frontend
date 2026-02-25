import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  clearOauthHash,
  extractAccessTokenFromHash,
  resendSignupConfirmation,
  signInWithSupabase,
  storeToken,
  verifyBackendUser
} from "../../lib/auth";
import "./Login.css";

const Login = ({ mode = "participant" }) => {
  const navigate = useNavigate();
  const isAdminMode = mode === "admin";
  const title = isAdminMode ? "Admin Sign In" : "Participant Sign In";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);

  useEffect(() => {
    const token = extractAccessTokenFromHash();

    if (!token) {
      return;
    }

    const handleOAuthLogin = async () => {
      setError("");
      setInfo("");
      setCanResendConfirmation(false);

      try {
        await verifyBackendUser(token);
        storeToken(token, true);
        clearOauthHash();
        navigate("/dashboard", { replace: true });
      } catch (err) {
        clearOauthHash();
        setError(err.message || "Google sign-in failed.");
      }
    };

    handleOAuthLogin();
  }, [navigate]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setInfo("");
    setCanResendConfirmation(false);

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await signInWithSupabase({ email, password });
      await verifyBackendUser(token);
      storeToken(token, true);
      setPassword("");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const message = String(err?.message || "");
      const lower = message.toLowerCase();

      if (message === "User not approved") {
        setError("Your account is pending admin approval.");
      } else if (message === "User profile not found") {
        setError("Your profile is not set up yet. Please register first.");
      } else if (lower.includes("email not confirmed")) {
        setError("Email not confirmed. Please verify your email before signing in.");
        setCanResendConfirmation(true);
      } else {
        setError(message || "Unable to sign in.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    setError("");
    setInfo("");

    if (!email.trim()) {
      setError("Enter your email first, then click resend.");
      return;
    }

    setIsResending(true);
    try {
      await resendSignupConfirmation(email.trim());
      setInfo("Verification email sent. Please check your inbox and spam folder.");
      setCanResendConfirmation(false);
    } catch (err) {
      setError(err?.message || "Unable to resend verification email.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="login-page d-flex justify-content-center px-3 px-sm-4 py-5">
      <div className="login-shell w-100">
        <header className="text-center mb-4 mb-sm-5">
          <h1 className="login-brand mb-1">Nitro</h1>
          <p className="login-subtitle mb-0">BY TEAMSUCCESSO</p>
        </header>

        <section className="login-card card border-0 shadow-sm">
          <div className="card-body p-4 p-sm-5">
            <h2 className="login-title mb-2">{title}</h2>
            <p className="login-mode-note mb-4">
              {isAdminMode
                ? "Registration is not available for admins."
                : "Participants can sign in or create a new account."}
            </p>

            {error ? <div className="alert alert-danger py-2 mb-3">{error}</div> : null}
            {info ? <div className="alert alert-success py-2 mb-3">{info}</div> : null}

            <form onSubmit={handleLogin}>
              <div className="mb-3">
                <label htmlFor="email" className="form-label login-label mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  className="form-control login-input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                  autoComplete="email"
                />
              </div>

              <div className="mb-3">
                <label htmlFor="password" className="form-label login-label mb-2">
                  Password
                </label>
                <div className="position-relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="form-control login-input pe-5"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="........"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="btn login-eye"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="login-eye-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.9}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7C20.268 16.057 16.477 19 12 19S3.732 16.057 2.458 12z"
                        />
                        <circle cx="12" cy="12" r="3" strokeWidth={1.9} />
                      </svg>
                    ) : (
                      <svg className="login-eye-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
                type="submit"
                className="btn fw-semibold login-submit w-100"
                disabled={isSubmitting || isResending}
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
              </button>
            </form>

            {canResendConfirmation ? (
              <button
                type="button"
                className="btn btn-outline-secondary w-100 mt-2"
                onClick={handleResendConfirmation}
                disabled={isSubmitting || isResending}
              >
                {isResending ? "Sending..." : "Resend Verification Email"}
              </button>
            ) : null}
          </div>
        </section>

        {!isAdminMode ? (
          <p className="text-center login-register mt-4 mb-0">
            New participant?
            <Link to="/register" className="ms-2 fw-semibold login-link">
              Register here
            </Link>
          </p>
        ) : null}

        <p className="text-center login-register mt-3 mb-0">
          <Link to="/login" className="fw-semibold login-link">
            Back to login selection
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
