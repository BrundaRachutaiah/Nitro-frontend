import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  clearOauthHash,
  clearStoredTokens,
  extractAccessTokenFromHash,
  storeToken,
  verifyBackendUser,
} from "../../lib/auth";

const RoleSelection = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = extractAccessTokenFromHash();
    if (!token) return;
    (async () => {
      try {
        const user = await verifyBackendUser(token);
        storeToken(token, true);
        clearOauthHash();
        const routes = {
          SUPER_ADMIN: `/super-admin/${user.id}/dashboard`,
          ADMIN: `/admin/${user.id}/dashboard`,
          PARTICIPANT: `/participant/${user.id}/dashboard`,
          BRAND: `/brand/dashboard`,
        };
        navigate(routes[user.role] || "/login", { replace: true });
      } catch (err) {
        clearOauthHash();
        clearStoredTokens();
      }
    })();
  }, [navigate]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .rs-root {
          min-height: 100vh;
          display: grid;
          place-items: center;
          background: radial-gradient(circle at 20% 0%, #1a4153 0%, #112f3c 46%, #0a202a 100%);
          padding: clamp(1rem, 2vw, 1.4rem);
          font-family: 'DM Sans', sans-serif;
          position: relative;
          overflow: hidden;
        }
        .rs-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(78,176,205,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(78,176,205,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
          z-index: 0;
        }
        .rs-shimmer {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent 0%, #4eb0cd 30%, #6ad4f3 50%, #4eb0cd 70%, transparent 100%);
          opacity: 0.6;
          z-index: 10;
        }

        .rs-shell {
          position: relative;
          z-index: 1;
          width: min(420px, 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Header ── */
        .rs-head {
          text-align: center;
          margin-bottom: 1.6rem;
        }
        .rs-logo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 46px; height: 46px;
          border-radius: 13px;
          background: linear-gradient(135deg, #4eb0cd 0%, #6ad4f3 100%);
          margin-bottom: 1rem;
          box-shadow: 0 0 28px rgba(78,176,205,0.4), 0 0 56px rgba(78,176,205,0.15);
        }
        .rs-logo svg { width: 22px; height: 22px; }
        .rs-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(1.9rem, 5vw, 2.6rem);
          font-weight: 800;
          color: #e8f7ff;
          letter-spacing: -0.03em;
          line-height: 1;
          margin-bottom: 0.45rem;
        }
        .rs-title em { font-style: normal; color: #6ad4f3; }
        .rs-subtitle {
          color: #7aafc2;
          font-size: 0.92rem;
          font-weight: 300;
        }

        /* ── Admin pill — small, above participant card ── */
        .rs-admin-link {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(78,176,205,0.07);
          border: 1px solid rgba(78,176,205,0.18);
          border-radius: 100px;
          padding: 0.35rem 0.9rem 0.35rem 0.6rem;
          color: #5e9aae;
          font-size: 0.78rem;
          font-weight: 400;
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
          margin-bottom: 0.85rem;
          letter-spacing: 0.01em;
          outline: none;
        }
        .rs-admin-link:hover, .rs-admin-link:focus-visible {
          background: rgba(78,176,205,0.13);
          border-color: rgba(78,176,205,0.32);
          color: #8dc8d9;
        }
        .rs-admin-link svg { width: 13px; height: 13px; opacity: 0.7; flex-shrink: 0; }
        .rs-admin-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #4e8fa3;
          flex-shrink: 0;
        }

        /* ── Participant card — full featured ── */
        .rs-card {
          width: 100%;
          position: relative;
          background: linear-gradient(160deg, rgba(78,176,205,0.15) 0%, rgba(14,52,66,0.95) 55%);
          border: 1.5px solid rgba(106,212,243,0.45);
          border-radius: 18px;
          padding: 1.8rem 1.6rem;
          text-align: left;
          color: #e8f7ff;
          cursor: pointer;
          transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
          box-shadow: 0 0 36px rgba(78,176,205,0.1), 0 8px 32px rgba(0,0,0,0.35);
          outline: none;
        }
        .rs-card:hover, .rs-card:focus-visible {
          transform: translateY(-4px);
          border-color: rgba(106,212,243,0.75);
          box-shadow: 0 0 52px rgba(78,176,205,0.2), 0 16px 48px rgba(0,0,0,0.4);
        }

        .rs-card-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px; height: 42px;
          border-radius: 12px;
          background: rgba(78,176,205,0.16);
          border: 1px solid rgba(106,212,243,0.26);
          margin-bottom: 1.1rem;
          transition: transform 0.25s ease;
        }
        .rs-card:hover .rs-card-icon { transform: scale(1.08); }
        .rs-card-icon svg { width: 20px; height: 20px; }

        .rs-card-tag {
          display: inline-block;
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0.11em;
          text-transform: uppercase;
          padding: 2px 9px;
          border-radius: 100px;
          margin-bottom: 0.65rem;
          color: #6ad4f3;
          background: rgba(106,212,243,0.1);
          border: 1px solid rgba(106,212,243,0.22);
        }
        .rs-card-title {
          font-family: 'Syne', sans-serif;
          font-size: 1.25rem;
          font-weight: 700;
          color: #e8f7ff;
          margin-bottom: 0.45rem;
          letter-spacing: -0.01em;
        }
        .rs-card-desc {
          font-size: 0.88rem;
          font-weight: 300;
          color: rgba(232,247,255,0.48);
          line-height: 1.58;
          margin-bottom: 1.4rem;
        }
        .rs-card-cta {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.88rem;
          font-weight: 500;
          color: #6ad4f3;
          transition: gap 0.2s ease;
        }
        .rs-card:hover .rs-card-cta { gap: 0.7rem; }
        .rs-card-cta svg { width: 15px; height: 15px; }

        /* ── Footer ── */
        .rs-footer {
          text-align: center;
          margin-top: 1.6rem;
          font-size: 0.72rem;
          color: rgba(164,198,212,0.25);
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }
      `}</style>

      <div className="rs-root">
        <div className="rs-shimmer" />

        <div className="rs-shell">
          {/* Header */}
          <div className="rs-head">
            <div className="rs-logo">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="white"/>
              </svg>
            </div>
            <h1 className="rs-title">Nitro<em>.</em></h1>
            <p className="rs-subtitle">Choose your access level to continue</p>
          </div>

          {/* Admin — small pill link */}
          <button
            className="rs-admin-link"
            onClick={() => navigate("/login/admin")}
          >
            <div className="rs-admin-dot" />
            <span>Admin / Super Admin login</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>

          {/* Participant — main card */}
          <button
            className="rs-card"
            onClick={() => navigate("/login/participant")}
          >
            <div className="rs-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="#6ad4f3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <span className="rs-card-tag">Participant</span>
            <h2 className="rs-card-title">Participant Login</h2>
            <p className="rs-card-desc">Sign in or create your account to access your dashboard, projects, and submissions.</p>
            <div className="rs-card-cta">
              <span>Sign in or Register</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </button>

          <p className="rs-footer">By TeamSuccesso &nbsp;·&nbsp; Nitro Platform</p>
        </div>
      </div>
    </>
  );
};

export default RoleSelection;