import { useState } from "react";
import { useNavigate } from "react-router-dom";

const RoleSelection = () => {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .rs-root {
          min-height: 100vh;
          background: #040d12;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
          position: relative;
        }

        /* Animated background mesh */
        .rs-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
        }
        .rs-bg-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          opacity: 0.18;
          animation: orbFloat 12s ease-in-out infinite alternate;
        }
        .rs-bg-orb-1 {
          width: 600px; height: 600px;
          background: radial-gradient(circle, #00c6ff, #0072ff);
          top: -15%; left: -10%;
          animation-delay: 0s;
        }
        .rs-bg-orb-2 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, #00e5a0, #00b4d8);
          bottom: -10%; right: -8%;
          animation-delay: -4s;
          opacity: 0.12;
        }
        .rs-bg-orb-3 {
          width: 350px; height: 350px;
          background: radial-gradient(circle, #4facfe, #00f2fe);
          top: 50%; left: 55%;
          animation-delay: -8s;
          opacity: 0.08;
        }
        @keyframes orbFloat {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(30px, -20px) scale(1.05); }
          100% { transform: translate(-20px, 30px) scale(0.95); }
        }

        /* Grid lines overlay */
        .rs-grid {
          position: fixed;
          inset: 0;
          z-index: 0;
          background-image:
            linear-gradient(rgba(0,198,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,198,255,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        /* Main container */
        .rs-container {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 760px;
          padding: 2rem;
          animation: fadeUp 0.8s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Logo / Brand */
        .rs-brand {
          text-align: center;
          margin-bottom: 3.5rem;
        }
        .rs-logo-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 52px; height: 52px;
          border-radius: 14px;
          background: linear-gradient(135deg, #00c6ff 0%, #00e5a0 100%);
          margin-bottom: 1.25rem;
          box-shadow: 0 0 40px rgba(0,198,255,0.35), 0 0 80px rgba(0,198,255,0.15);
          animation: logoPulse 3s ease-in-out infinite;
        }
        @keyframes logoPulse {
          0%, 100% { box-shadow: 0 0 30px rgba(0,198,255,0.3), 0 0 60px rgba(0,198,255,0.12); }
          50%       { box-shadow: 0 0 50px rgba(0,198,255,0.5), 0 0 100px rgba(0,198,255,0.2); }
        }
        .rs-logo-mark svg { width: 26px; height: 26px; }

        .rs-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(2.4rem, 6vw, 3.5rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #ffffff;
          line-height: 1;
          margin-bottom: 0.6rem;
        }
        .rs-title span {
          background: linear-gradient(90deg, #00c6ff, #00e5a0);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .rs-subtitle {
          font-size: 1rem;
          font-weight: 300;
          color: rgba(255,255,255,0.45);
          letter-spacing: 0.02em;
        }

        /* Cards grid */
        .rs-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }
        @media (max-width: 540px) {
          .rs-cards { grid-template-columns: 1fr; }
        }

        .rs-card {
          position: relative;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 2rem 1.75rem;
          cursor: pointer;
          text-align: left;
          transition: transform 0.35s cubic-bezier(0.22,1,0.36,1),
                      border-color 0.3s ease,
                      background 0.3s ease,
                      box-shadow 0.35s ease;
          overflow: hidden;
          outline: none;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .rs-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          opacity: 0;
          transition: opacity 0.35s ease;
          background: radial-gradient(ellipse at top left, rgba(0,198,255,0.12), transparent 70%);
        }
        .rs-card:hover::before,
        .rs-card:focus-visible::before { opacity: 1; }

        .rs-card:hover,
        .rs-card:focus-visible {
          transform: translateY(-6px) scale(1.01);
          border-color: rgba(0,198,255,0.3);
          background: rgba(255,255,255,0.07);
          box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 0 40px rgba(0,198,255,0.08);
        }

        .rs-card-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px; height: 44px;
          border-radius: 12px;
          margin-bottom: 1.25rem;
          transition: transform 0.3s ease;
        }
        .rs-card:hover .rs-card-icon { transform: scale(1.1); }

        .rs-card-icon-admin {
          background: linear-gradient(135deg, rgba(0,198,255,0.2), rgba(0,198,255,0.05));
          border: 1px solid rgba(0,198,255,0.25);
        }
        .rs-card-icon-participant {
          background: linear-gradient(135deg, rgba(0,229,160,0.2), rgba(0,229,160,0.05));
          border: 1px solid rgba(0,229,160,0.25);
        }
        .rs-card-icon svg { width: 22px; height: 22px; }

        .rs-card-tag {
          display: inline-block;
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 3px 10px;
          border-radius: 100px;
          margin-bottom: 0.75rem;
        }
        .rs-card-tag-admin {
          color: #00c6ff;
          background: rgba(0,198,255,0.12);
          border: 1px solid rgba(0,198,255,0.2);
        }
        .rs-card-tag-participant {
          color: #00e5a0;
          background: rgba(0,229,160,0.12);
          border: 1px solid rgba(0,229,160,0.2);
        }

        .rs-card-title {
          font-family: 'Syne', sans-serif;
          font-size: 1.2rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 0.45rem;
          letter-spacing: -0.01em;
        }
        .rs-card-desc {
          font-size: 0.875rem;
          font-weight: 300;
          color: rgba(255,255,255,0.45);
          line-height: 1.55;
          margin-bottom: 1.5rem;
        }

        .rs-card-cta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          font-weight: 500;
          transition: gap 0.25s ease;
        }
        .rs-card-cta-admin   { color: #00c6ff; }
        .rs-card-cta-participant { color: #00e5a0; }
        .rs-card:hover .rs-card-cta { gap: 0.75rem; }
        .rs-card-cta svg { width: 16px; height: 16px; }

        /* Divider / footer note */
        .rs-footer {
          text-align: center;
          margin-top: 2.5rem;
          font-size: 0.78rem;
          color: rgba(255,255,255,0.2);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 400;
        }

        /* Shimmer line on top of page */
        .rs-shimmer {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, #00c6ff, #00e5a0, transparent);
          z-index: 2;
          animation: shimmerSlide 4s ease-in-out infinite;
        }
        @keyframes shimmerSlide {
          0%   { opacity: 0.4; }
          50%  { opacity: 1; }
          100% { opacity: 0.4; }
        }
      `}</style>

      <div className="rs-root">
        <div className="rs-shimmer" />
        <div className="rs-bg">
          <div className="rs-bg-orb rs-bg-orb-1" />
          <div className="rs-bg-orb rs-bg-orb-2" />
          <div className="rs-bg-orb rs-bg-orb-3" />
        </div>
        <div className="rs-grid" />

        <div className="rs-container">
          {/* Brand */}
          <div className="rs-brand">
            <div className="rs-logo-mark">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="white" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="rs-title">Nitro<span>.</span></h1>
            <p className="rs-subtitle">Choose your access level to continue</p>
          </div>

          {/* Role Cards */}
          <div className="rs-cards">

            {/* Admin Card */}
            <button
              className="rs-card"
              onClick={() => navigate("/login/admin")}
              onMouseEnter={() => setHovered("admin")}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="rs-card-icon rs-card-icon-admin">
                <svg viewBox="0 0 24 24" fill="none" stroke="#00c6ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <span className="rs-card-tag rs-card-tag-admin">Admin</span>
              <h2 className="rs-card-title">Admin Login</h2>
              <p className="rs-card-desc">Secure access for Admins and Super Admins to manage platform operations.</p>
              <div className="rs-card-cta rs-card-cta-admin">
                <span>Sign in as Admin</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </button>

            {/* Participant Card */}
            <button
              className="rs-card"
              onClick={() => navigate("/login/participant")}
              onMouseEnter={() => setHovered("participant")}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="rs-card-icon rs-card-icon-participant">
                <svg viewBox="0 0 24 24" fill="none" stroke="#00e5a0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <span className="rs-card-tag rs-card-tag-participant">Participant</span>
              <h2 className="rs-card-title">Participant Login</h2>
              <p className="rs-card-desc">Sign in or create your participant account to access your dashboard and submissions.</p>
              <div className="rs-card-cta rs-card-cta-participant">
                <span>Sign in or Register</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </button>

          </div>

          <p className="rs-footer">By TeamSuccesso &nbsp;·&nbsp; Nitro Platform</p>
        </div>
      </div>
    </>
  );
};

export default RoleSelection;