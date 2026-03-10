import { Link, useNavigate } from "react-router-dom";
import Footer from "../../components/common/Footer";

const Section = ({ title, children }) => (
  <div style={{ marginBottom: "2rem" }}>
    <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#e8f7ff", marginBottom: ".6rem", paddingBottom: ".4rem", borderBottom: "1px solid rgba(0,198,255,.15)" }}>{title}</h2>
    <div style={{ fontSize: ".88rem", color: "rgba(255,255,255,.55)", lineHeight: 1.8 }}>{children}</div>
  </div>
);

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  return (
    <div style={{ minHeight: "100vh", background: "#040d12", fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,#00c6ff,#0072ff)", top: "-15%", left: "-10%", opacity: .07, filter: "blur(90px)" }}/>
        <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,#00e5a0,#00b4d8)", bottom: "-10%", right: "-8%", opacity: .05, filter: "blur(90px)" }}/>
      </div>

      <header style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(4,13,18,.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,.07)", padding: ".9rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#00c6ff,#00e5a0)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 24 24" fill="white" width="14" height="14"><path d="M13 2L3 14H12L11 22L21 10H12L13 2Z"/></svg>
          </div>
          <span style={{ fontWeight: 800, color: "#fff", fontSize: "1rem" }}>Nitro</span>
        </div>
        <button onClick={() => navigate(-1)} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, color: "rgba(255,255,255,.55)", fontSize: ".8rem", padding: ".4rem .9rem", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
          ← Back
        </button>
      </header>

      <main style={{ position: "relative", zIndex: 1, flex: 1, maxWidth: 780, width: "100%", margin: "0 auto", padding: "3rem 1.5rem 4rem" }}>
        <div style={{ marginBottom: "2.5rem" }}>
          <div style={{ display: "inline-block", fontSize: ".7rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#00e5a0", background: "rgba(0,229,160,.1)", border: "1px solid rgba(0,229,160,.2)", borderRadius: 100, padding: "3px 12px", marginBottom: ".9rem" }}>Legal</div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(1.6rem,4vw,2.2rem)", fontWeight: 800, color: "#fff", letterSpacing: "-.025em", marginBottom: ".5rem" }}>Privacy Policy</h1>
          <p style={{ color: "rgba(255,255,255,.35)", fontSize: ".85rem" }}>Last updated: January {year} &nbsp;·&nbsp; TeamSuccesso / Nitro</p>
        </div>

        <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, padding: "2rem 1.75rem" }}>

          <Section title="1. Introduction">
            TeamSuccesso ("we", "our", "us") operates the Nitro platform. This Privacy Policy explains how we collect, use, store, and protect your personal information when you register and use Nitro. By using our platform, you consent to the practices described in this policy.
          </Section>

          <Section title="2. Information We Collect">
            We collect the following types of information:
            <ul style={{ marginTop: ".5rem", paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: ".3rem" }}>
              <li><strong style={{ color: "rgba(255,255,255,.75)" }}>Identity information:</strong> Full name, email address, phone number</li>
              <li><strong style={{ color: "rgba(255,255,255,.75)" }}>Financial information:</strong> Bank account number, IFSC code, account holder name</li>
              <li><strong style={{ color: "rgba(255,255,255,.75)" }}>KYC information:</strong> PAN card number (required for tax compliance)</li>
              <li><strong style={{ color: "rgba(255,255,255,.75)" }}>Address information:</strong> Delivery address for product allocation</li>
              <li><strong style={{ color: "rgba(255,255,255,.75)" }}>Activity data:</strong> Reviews submitted, products allocated, payout history</li>
              <li><strong style={{ color: "rgba(255,255,255,.75)" }}>Technical data:</strong> Login timestamps, device type, IP address (for security)</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            Your information is used to:
            <ul style={{ marginTop: ".5rem", paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: ".3rem" }}>
              <li>Process product allocations and manage your account</li>
              <li>Process payouts to your bank account</li>
              <li>Comply with Indian tax regulations (TDS deductions, Form 26AS)</li>
              <li>Verify your identity and prevent fraud</li>
              <li>Send you notifications about your allocations and payouts</li>
              <li>Improve our platform and services</li>
            </ul>
          </Section>

          <Section title="4. PAN Card and Financial Data">
            Your PAN number is collected solely for the purpose of tax compliance under Indian law (Income Tax Act, 1961). It is stored securely and used only for issuing TDS certificates and filing returns where applicable. We do not use your PAN for any other purpose, and we do not sell or share it with third parties except as required by law or tax authorities.
          </Section>

          <Section title="5. Data Storage and Security">
            All data is stored on secure servers. We use industry-standard encryption (TLS/HTTPS) for data in transit and encryption at rest for sensitive financial data. Access to your personal data is restricted to authorised personnel only. However, no system is completely secure — please use a strong password and keep your credentials confidential.
          </Section>

          <Section title="6. Data Sharing">
            We do not sell your personal data. We may share your data with:
            <ul style={{ marginTop: ".5rem", paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: ".3rem" }}>
              <li>Payment processors, solely to process your payouts</li>
              <li>Government and tax authorities, as required by Indian law</li>
              <li>Brand partners, only aggregated non-identifiable review data</li>
            </ul>
            We do not share your PAN, bank account, or address details with brand partners.
          </Section>

          <Section title="7. Data Retention">
            We retain your personal data for as long as your account is active and for up to 7 years after account closure, as required by Indian financial and tax regulations. You may request deletion of non-legally-required data by contacting us.
          </Section>

          <Section title="8. Your Rights">
            You have the right to:
            <ul style={{ marginTop: ".5rem", paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: ".3rem" }}>
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and non-mandatory data</li>
              <li>Withdraw consent for non-essential data processing</li>
            </ul>
            To exercise these rights, contact us at <a href="mailto:support@teamsuccesso.com" style={{ color: "#00c6ff", textDecoration: "none" }}>support@teamsuccesso.com</a>.
          </Section>

          <Section title="9. Cookies">
            Nitro uses session tokens stored in your browser (localStorage/sessionStorage) to keep you logged in. We do not use third-party advertising cookies. You can clear these at any time by logging out or clearing your browser storage.
          </Section>

          <Section title="10. Changes to This Policy">
            We may update this Privacy Policy periodically. We will notify you of significant changes via email or an in-app notice. Continued use of the platform after changes constitutes acceptance of the updated policy.
          </Section>

          <Section title="11. Contact Us">
            For any privacy-related questions or requests, contact us at{" "}
            <a href="mailto:support@teamsuccesso.com" style={{ color: "#00c6ff", textDecoration: "none" }}>support@teamsuccesso.com</a>.
          </Section>
        </div>

        <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
          <Link to="/terms-and-conditions" style={{ color: "#00c6ff", fontSize: ".83rem", textDecoration: "none" }}>
            Read our Terms &amp; Conditions →
          </Link>
        </div>
      </main>

      <Footer variant="dark" />
    </div>
  );
};

export default PrivacyPolicy;