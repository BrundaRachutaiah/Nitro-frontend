import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getGoogleAuthorizeUrl, signUpWithSupabase } from "../../lib/auth";
import "./Register.css";

const SIGNUP_COOLDOWN_UNTIL_KEY = "nitro_signup_cooldown_until";

const Register = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

    if (!fullName.trim() || !email.trim() || !password) {
      setError("Full name, email, and password are required.");
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
        fullName: fullName.trim()
      });

      setSuccess(
        "Successfully registered for Nitro. Login access will be granted after admin approval."
      );

      setTimeout(() => {
        navigate("/login", { replace: true });
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

  const handleGoogleSignup = () => {
    setError("");
    setSuccess("");

    try {
      setIsGoogleSubmitting(true);
      window.location.assign(getGoogleAuthorizeUrl());
    } catch (err) {
      setIsGoogleSubmitting(false);
      setError(err.message || "Unable to start Google sign-up.");
    }
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

            <form onSubmit={handleSubmit}>
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
                <label htmlFor="password" className="form-label register-label mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="form-control register-input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  autoComplete="new-password"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="confirmPassword" className="form-label register-label mb-2">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="form-control register-input"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                className="register-submit w-100"
                disabled={isSubmitting || isGoogleSubmitting || cooldownSeconds > 0}
              >
                {isSubmitting ? "Creating..." : cooldownSeconds > 0 ? `Try again in ${cooldownSeconds}s` : "Create Account"}
              </button>
            </form>

            <button
              type="button"
              className="btn btn-outline-secondary w-100 mt-3 register-google-btn"
              onClick={handleGoogleSignup}
              disabled={isSubmitting || isGoogleSubmitting}
            >
              <svg className="register-google-icon me-2" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {isGoogleSubmitting ? "Connecting..." : "Continue with Google"}
            </button>
          </div>
        </section>

        <p className="text-center register-login mt-4 mb-0">
          Already have an account?
          <Link to="/login" className="ms-2 fw-semibold register-link">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
