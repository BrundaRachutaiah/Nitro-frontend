import { Link, useNavigate } from "react-router-dom";
import Footer from "../../components/common/Footer";

const Section = ({ title, children }) => (
  <div style={{ marginBottom: "2rem" }}>
    <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#e8f7ff", marginBottom: ".6rem", paddingBottom: ".4rem", borderBottom: "1px solid rgba(0,198,255,.15)" }}>{title}</h2>
    <div style={{ fontSize: ".88rem", color: "rgba(255,255,255,.55)", lineHeight: 1.8 }}>{children}</div>
  </div>
);

const TermsAndConditions = () => {
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  return (
    <div style={{ minHeight: "100vh", background: "#040d12", fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Background orbs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,#00c6ff,#0072ff)", top: "-15%", left: "-10%", opacity: .07, filter: "blur(90px)" }}/>
        <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,#00e5a0,#00b4d8)", bottom: "-10%", right: "-8%", opacity: .05, filter: "blur(90px)" }}/>
      </div>

      {/* Header */}
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

      {/* Content */}
      <main style={{ position: "relative", zIndex: 1, flex: 1, maxWidth: 780, width: "100%", margin: "0 auto", padding: "3rem 1.5rem 4rem" }}>
        <div style={{ marginBottom: "2.5rem" }}>
          <div style={{ display: "inline-block", fontSize: ".7rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#00c6ff", background: "rgba(0,198,255,.1)", border: "1px solid rgba(0,198,255,.2)", borderRadius: 100, padding: "3px 12px", marginBottom: ".9rem" }}>Legal</div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(1.6rem,4vw,2.2rem)", fontWeight: 800, color: "#fff", letterSpacing: "-.025em", marginBottom: ".5rem" }}>Terms &amp; Conditions</h1>
          <p style={{ color: "rgba(255,255,255,.35)", fontSize: ".85rem" }}>Last updated: January {year} &nbsp;·&nbsp; Effective immediately upon registration</p>
        </div>

        <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, padding: "2rem 1.75rem" }}>

          <Section title="1. Acceptance of Terms">
            By registering on Nitro (operated by TeamSuccesso), you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the platform. We reserve the right to update these terms at any time, and continued use of the platform after changes constitutes acceptance.
          </Section>

          <Section title="2. Eligibility">
            You must be at least 18 years of age to register and participate on Nitro. By registering, you confirm that all information you provide is accurate, complete, and up to date. We reserve the right to terminate accounts found to be using false information.
          </Section>

          <Section title="3. Platform Purpose">
            Nitro is a product review and feedback platform. Participants receive products from brands in exchange for honest, genuine reviews. The platform facilitates allocation of products, collection of feedback, and processing of associated payouts. Any misuse — including submitting fake reviews, claiming products without genuine intent to review, or manipulating the payout process — is strictly prohibited.
          </Section>

          <Section title="4. KYC and Financial Information">
            You are required to provide valid PAN card details and bank account information for payout processing and tax compliance purposes. By submitting this information, you confirm it is accurate and authorize Nitro to use it solely for payout and tax-related processing. We do not share your financial details with third parties beyond what is required by law.
          </Section>

          <Section title="5. Product Allocation and Reviews">
            Product allocations are subject to availability and admin approval. Once allocated, you are expected to purchase the product using the provided link within the specified time window and submit a genuine review. Failure to do so may result in forfeiture of your payout and suspension of your account.
          </Section>

          <Section title="6. Payouts">
            Payouts are processed after your purchase proof and review have been verified and approved by our admin team. Payout amounts are as specified in the project details. We reserve the right to withhold payouts in cases of fraud, policy violation, or incomplete submissions.
          </Section>

          <Section title="7. Prohibited Conduct">
            You agree not to:
            <ul style={{ marginTop: ".5rem", paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: ".3rem" }}>
              <li>Submit false, misleading, or plagiarized reviews</li>
              <li>Create multiple accounts</li>
              <li>Share your account credentials with others</li>
              <li>Attempt to manipulate the allocation or payout process</li>
              <li>Use the platform for any unlawful purpose</li>
            </ul>
          </Section>

          <Section title="8. Termination">
            We reserve the right to suspend or permanently terminate your account at any time if we determine you have violated these terms, provided false information, or engaged in fraudulent activity. Pending payouts may be forfeited upon termination for cause.
          </Section>

          <Section title="9. Limitation of Liability">
            Nitro and TeamSuccesso shall not be liable for any indirect, incidental, or consequential damages arising from your use of the platform. Our total liability to you for any claim shall not exceed the total payout amount credited to your account in the three months prior to the claim.
          </Section>

          <Section title="10. Governing Law">
            These Terms are governed by the laws of India. Any disputes arising from use of the platform shall be subject to the exclusive jurisdiction of the courts in Bengaluru, Karnataka.
          </Section>

          <Section title="11. Contact Us">
            If you have questions about these Terms, please contact us at{" "}
            <a href="mailto:support@teamsuccesso.com" style={{ color: "#00c6ff", textDecoration: "none" }}>support@teamsuccesso.com</a>.
          </Section>
        </div>

        <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
          <Link to="/privacy-policy" style={{ color: "#00c6ff", fontSize: ".83rem", textDecoration: "none" }}>
            Read our Privacy Policy →
          </Link>
        </div>
      </main>

      <Footer variant="dark" />
    </div>
  );
};

export default TermsAndConditions;