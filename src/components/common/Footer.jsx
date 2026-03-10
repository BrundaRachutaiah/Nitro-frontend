import { Link } from "react-router-dom";

/**
 * Footer variants:
 *  "dark"    — for auth pages (Login, Register, RoleSelection) — #040d12 bg
 *  "teal"    — for participant pages — dark teal bg
 *  "admin"   — for admin/superadmin pages — dark navy bg
 */
const Footer = ({ variant = "dark" }) => {
  const year = new Date().getFullYear();

  const styles = {
    dark: {
      wrapper: { background: "transparent", borderTop: "1px solid rgba(255,255,255,0.07)", padding: "2rem 1.5rem 1.5rem", fontFamily: "'DM Sans', sans-serif" },
      inner:   { maxWidth: 900, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem" },
      brand:   { fontWeight: 800, fontSize: "1.05rem", color: "#00c6ff", letterSpacing: "-.01em" },
      tagline: { fontSize: ".75rem", color: "rgba(255,255,255,.25)", marginTop: 2 },
      links:   { display: "flex", gap: "1.5rem", flexWrap: "wrap" },
      link:    { color: "rgba(255,255,255,.35)", fontSize: ".8rem", textDecoration: "none", transition: "color .2s" },
      copy:    { width: "100%", textAlign: "center", fontSize: ".72rem", color: "rgba(255,255,255,.18)", marginTop: ".75rem", paddingTop: ".75rem", borderTop: "1px solid rgba(255,255,255,.05)" },
    },
    teal: {
      wrapper: { background: "rgba(4,25,32,0.6)", borderTop: "1px solid rgba(32,154,189,0.18)", padding: "2rem 1.5rem 1.5rem", fontFamily: "'DM Sans', sans-serif" },
      inner:   { maxWidth: 1100, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem" },
      brand:   { fontWeight: 800, fontSize: "1.05rem", color: "#4dd8f0", letterSpacing: "-.01em" },
      tagline: { fontSize: ".75rem", color: "rgba(160,220,235,.35)", marginTop: 2 },
      links:   { display: "flex", gap: "1.5rem", flexWrap: "wrap" },
      link:    { color: "rgba(160,220,235,.45)", fontSize: ".8rem", textDecoration: "none", transition: "color .2s" },
      copy:    { width: "100%", textAlign: "center", fontSize: ".72rem", color: "rgba(160,220,235,.25)", marginTop: ".75rem", paddingTop: ".75rem", borderTop: "1px solid rgba(32,154,189,.1)" },
    },
    admin: {
      wrapper: { background: "rgba(10,20,35,0.7)", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "1.5rem 1.5rem 1.25rem", fontFamily: "'DM Sans', sans-serif" },
      inner:   { maxWidth: 1200, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: ".75rem" },
      brand:   { fontWeight: 700, fontSize: ".95rem", color: "rgba(255,255,255,.55)", letterSpacing: "-.01em" },
      tagline: { fontSize: ".7rem", color: "rgba(255,255,255,.2)", marginTop: 2 },
      links:   { display: "flex", gap: "1.25rem", flexWrap: "wrap" },
      link:    { color: "rgba(255,255,255,.28)", fontSize: ".75rem", textDecoration: "none", transition: "color .2s" },
      copy:    { width: "100%", textAlign: "center", fontSize: ".7rem", color: "rgba(255,255,255,.15)", marginTop: ".6rem", paddingTop: ".6rem", borderTop: "1px solid rgba(255,255,255,.05)" },
    },
  };

  const s = styles[variant] || styles.dark;

  return (
    <footer style={s.wrapper}>
      <div style={s.inner}>
        <div>
          <div style={s.brand}>Nitro</div>
          <div style={s.tagline}>By TeamSuccesso</div>
        </div>
        <nav style={s.links}>
          <Link to="/terms-and-conditions" style={s.link}
            onMouseEnter={e => e.target.style.opacity = "1"}
            onMouseLeave={e => e.target.style.opacity = ""}>
            Terms &amp; Conditions
          </Link>
          <Link to="/privacy-policy" style={s.link}
            onMouseEnter={e => e.target.style.opacity = "1"}
            onMouseLeave={e => e.target.style.opacity = ""}>
            Privacy Policy
          </Link>
          <a href="mailto:support@teamsuccesso.com" style={s.link}
            onMouseEnter={e => e.target.style.opacity = "1"}
            onMouseLeave={e => e.target.style.opacity = ""}>
            Contact Support
          </a>
        </nav>
        <div style={s.copy}>
          © {year} Nitro by TeamSuccesso. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;