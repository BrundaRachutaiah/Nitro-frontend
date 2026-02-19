import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  clearOauthHash,
  extractAccessTokenFromHash,
  getGoogleAuthorizeUrl,
  resendSignupConfirmation,
  signInWithSupabase,
  storeToken,
  verifyBackendUser
} from "../../lib/auth";
import "./Login.css";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
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
      setIsGoogleSubmitting(true);
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
      } finally {
        setIsGoogleSubmitting(false);
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

  const handleGoogleLogin = () => {
    setError("");

    try {
      setIsGoogleSubmitting(true);
      window.location.assign(getGoogleAuthorizeUrl());
    } catch (err) {
      setIsGoogleSubmitting(false);
      setError(err.message || "Unable to start Google sign-in.");
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
            <h2 className="login-title mb-4">Sign In</h2>

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
                <div className="text-end mt-2">
                  <a href="#" className="login-link">
                    Forgot password?
                  </a>
                </div>
              </div>

              <button
                type="submit"
                className="btn fw-semibold login-submit w-100"
                disabled={isSubmitting || isGoogleSubmitting || isResending}
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
              </button>
            </form>

            {canResendConfirmation ? (
              <button
                type="button"
                className="btn btn-outline-secondary w-100 mt-2"
                onClick={handleResendConfirmation}
                disabled={isSubmitting || isGoogleSubmitting || isResending}
              >
                {isResending ? "Sending..." : "Resend Verification Email"}
              </button>
            ) : null}

            <button
              type="button"
              className="btn btn-outline-secondary w-100 mt-3 google-btn"
              onClick={handleGoogleLogin}
              disabled={isSubmitting || isGoogleSubmitting || isResending}
            >
              <svg className="google-icon me-2" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {isGoogleSubmitting ? "Connecting..." : "Continue with Google"}
            </button>
          </div>
        </section>

        <p className="text-center login-register mt-4 mb-0">
          New participant?
          <Link to="/register" className="ms-2 fw-semibold login-link">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
