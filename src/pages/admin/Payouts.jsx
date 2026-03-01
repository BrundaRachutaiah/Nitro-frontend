import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  API_BASE_URL,
  clearStoredTokens,
  getStoredToken,
  signOutFromSupabase,
  verifyBackendUser,
} from "../../lib/auth";
import "../superAdmin/AdminPages.css";

/* ─── fetch helper ─────────────────────────────────────────────────────────── */
const api = async (method, path, token, body, signal) => {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
  return data;
};

/* ─── formatters ────────────────────────────────────────────────────────────── */
const fmt = (v) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(v || 0));

const fmtDate = (v) => {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const shortId = (id) => String(id || "").slice(0, 8).toUpperCase();

/* ─── icons ─────────────────────────────────────────────────────────────────── */
const Ico = {
  dashboard:  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  create:     <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>,
  projects:   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 7h18M3 12h18M3 17h18"/></svg>,
  approvals:  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4"/><rect x="3" y="3" width="18" height="18" rx="3"/></svg>,
  budgets:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 6v2m0 8v2m-3-5h6"/></svg>,
  payouts:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 2H8M12 11v4m-2-2h4"/></svg>,
  history:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
  search:     <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  plus:       <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
  refresh:    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>,
  download:   <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  check:      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>,
  chevron:    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>,
  chevronD:   <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>,
  bank:       <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 10v11M12 10v11M16 10v11"/></svg>,
  user:       <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"/><path d="M5.2 20a7 7 0 0 1 13.6 0"/></svg>,
  package:    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.27 6.96 8.73 5.05 8.73-5.05M12 22.08V12"/></svg>,
  alert:      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>,
  menu:       <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></svg>,
};

/* ─── nav ────────────────────────────────────────────────────────────────────── */
const NAV = [
  { key: "dashboard",        label: "Dashboard",             icon: Ico.dashboard },
  { key: "create",           label: "Create Project",        icon: Ico.create    },
  { key: "manage",           label: "View All Projects",     icon: Ico.projects  },
  { key: "applications",     label: "Application Approvals", icon: Ico.approvals },
  { key: "client-budgets",   label: "Client Budgets",        icon: Ico.budgets   },
  { key: "payouts",          label: "Payouts",               icon: Ico.payouts, active: true },
  { key: "payout-history",   label: "Payout History",        icon: Ico.history   },
];

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════════ */
export default function AdminPayouts() {
  const navigate = useNavigate();

  const [user, setUser]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [sidebarOpen, setSidebar] = useState(false);

  /* eligible payouts */
  const [eligible, setEligible]         = useState([]);
  const [eligibleLoading, setEligLoad]  = useState(false);
  const [eligibleError, setEligErr]     = useState("");

  /* batches */
  const [batches, setBatches]           = useState([]);
  const [batchesLoading, setBatchLoad]  = useState(false);
  const [batchesError, setBatchErr]     = useState("");

  /* UI state */
  const [creatingBatch, setCreating]    = useState(false);
  const [toast, setToast]               = useState(null); // {msg, type}
  const [expandedBatch, setExpanded]    = useState(null);
  const [markingPaid, setMarkingPaid]   = useState(null);
  const [exportingBatch, setExporting]  = useState(null);

  /* ── show toast ── */
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── auth ── */
  useEffect(() => {
    const token = getStoredToken();
    if (!token) { navigate("/login", { replace: true }); return; }
    (async () => {
      try {
        const me = await verifyBackendUser(token);
        const role = String(me?.role || "").toUpperCase();
        if (role !== "ADMIN" && role !== "SUPER_ADMIN") { navigate("/dashboard", { replace: true }); return; }
        setUser(me);
      } catch {
        clearStoredTokens(); navigate("/login", { replace: true });
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  /* ── load eligible payouts ── */
  const loadEligible = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    setEligLoad(true); setEligErr("");
    try {
      const res = await api("GET", "/admin/payouts/eligible", token);
      setEligible(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setEligErr(e.message);
    } finally {
      setEligLoad(false);
    }
  }, []);

  /* ── load batches ── */
  const loadBatches = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    setBatchLoad(true); setBatchErr("");
    try {
      const res = await api("GET", "/admin/payout-batches", token);
      setBatches(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setBatchErr(e.message);
    } finally {
      setBatchLoad(false);
    }
  }, []);

  useEffect(() => {
    if (user) { loadEligible(); loadBatches(); }
  }, [user, loadEligible, loadBatches]);

  /* ── create batch ── */
  const handleCreateBatch = async () => {
    if (!eligible.length) return showToast("No eligible payouts to batch.", "error");
    if (!window.confirm(`Create a payout batch for ${eligible.length} participant(s)? This will move all eligible payouts into a batch.`)) return;
    const token = getStoredToken();
    setCreating(true);
    try {
      const res = await api("POST", "/admin/payout-batches", token);
      showToast(`Batch created! ${res.data?.payout_count || ""} payouts — ${fmt(res.data?.total_amount)}`);
      // Immediately clear eligible — they've all moved to IN_BATCH
      setEligible([]);
      await loadBatches();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setCreating(false);
    }
  };

  /* ── mark batch paid ── */
  const handleMarkBatchPaid = async (batchId) => {
    if (!window.confirm("Mark this entire batch as PAID? This will update all participant payouts and move applications to COMPLETED.")) return;
    const token = getStoredToken();
    setMarkingPaid(batchId);
    try {
      await api("PATCH", `/admin/payout-batches/${batchId}/mark-paid`, token);
      showToast("Batch marked as PAID successfully.");
      await loadBatches();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setMarkingPaid(null);
    }
  };

  /* ── export batch CSV ── */
  const handleExportBatch = async (batchId) => {
    const token = getStoredToken();
    setExporting(batchId);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/payout-batches/${batchId}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `payout_batch_${batchId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("CSV exported successfully.");
      await loadBatches(); // status may change to EXPORTED
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(null);
    }
  };

  /* ── nav ── */
  const navTo = (key) => {
    setSidebar(false);
    const map = {
      dashboard:        `/admin/${user?.id}/dashboard`,
      create:           "/projects/create",
      manage:           "/projects/manage",
      applications:     "/admin/applications",
      "client-budgets": "/admin/client-budgets",
      payouts:          "/admin/payouts",
      "payout-history": "/admin/payout-history",
    };
    navigate(map[key] || "/");
  };

  const handleLogout = async () => {
    await signOutFromSupabase(getStoredToken());
    clearStoredTokens();
    navigate("/login", { replace: true });
  };

  /* ── derived stats for eligible section ── */
  const eligStats = useMemo(() => {
    const participants = [...new Set(eligible.map((r) => r.participant_id))].length;
    const products     = eligible.length;
    // Only product_amount — we pay only the product purchase cost, no reward
    const total = eligible.reduce((s, r) => s + Number(r.product_amount || r.amount || 0), 0);
    return { participants, products, total };
  }, [eligible]);

  /* ── group eligible by participant ── */
  const eligByParticipant = useMemo(() => {
    const map = new Map();
    for (const row of eligible) {
      const pid = row.participant_id;
      if (!map.has(pid)) {
        map.set(pid, {
          participant_id: pid,
          full_name: row.profiles?.full_name || row.full_name || "—",
          email:     row.profiles?.email     || row.email     || "—",
          rows: [],
          total: 0,
        });
      }
      const entry = map.get(pid);
      entry.rows.push(row);
      // product_amount only — no reward, just the product purchase reimbursement
      entry.total += Number(row.product_amount || row.amount || 0);
    }
    return [...map.values()];
  }, [eligible]);

  /* ── batch status badge ── */
  const batchStatusBadge = (status) => {
    const s = String(status || "").toUpperCase();
    if (s === "PAID")     return "sa-status-badge sa-status-badge--published";
    if (s === "EXPORTED") return "sa-status-badge sa-mode-badge--d2c";
    return "sa-status-badge sa-status-badge--draft";
  };

  const initials = (name) =>
    String(name || "A").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  /* ── loading screen ── */
  if (loading) return (
    <div className="sa-loading">
      <div className="sa-loading-logo">NITRO</div>
      <div className="sa-spinner" />
      <span>Loading payouts…</span>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */
  return (
    <>
      <style>{`
        /* ── payout-specific additions that layer on top of AdminPages.css ── */
        .pay-stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1rem}
        .pay-stat-mini{background:var(--bg-3);border:1px solid var(--border);border-radius:var(--radius-md);padding:1rem 1.25rem}
        .pay-stat-mini-label{font-size:0.72rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
        .pay-stat-mini-val{font-family:'Plus Jakarta Sans',sans-serif;font-size:1.6rem;font-weight:800;color:var(--text);line-height:1}
        .pay-stat-mini-sub{font-size:0.72rem;color:var(--text-3);margin-top:4px}

        .pay-participant-block{border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;margin-bottom:12px}
        .pay-participant-head{
          display:grid;grid-template-columns:1fr auto;gap:1rem;align-items:center;
          padding:12px 16px;background:var(--bg-3);
          border-bottom:1px solid var(--border);
        }
        .pay-participant-name{font-size:0.92rem;font-weight:700;color:var(--text);margin-bottom:2px}
        .pay-participant-email{font-size:0.78rem;color:var(--text-3)}
        .pay-participant-total{font-family:'Plus Jakarta Sans',sans-serif;font-size:1.1rem;font-weight:800;color:var(--cyan);white-space:nowrap}

        .pay-product-row{
          display:grid;
          grid-template-columns:1fr 160px 120px;
          gap:1rem;align-items:center;
          padding:10px 16px;border-bottom:1px solid var(--border);
          font-size:0.84rem;
        }
        .pay-product-row:last-child{border-bottom:none}
        .pay-product-name{color:var(--text);font-weight:500;display:flex;align-items:center;gap:7px}
        .pay-product-val{color:var(--amber);font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;text-align:right}
        .pay-product-status{text-align:right}

        .pay-batch-card{border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;margin-bottom:14px;transition:border-color .2s}
        .pay-batch-card:hover{border-color:var(--border-light)}
        .pay-batch-head{
          display:grid;grid-template-columns:auto 1fr auto auto auto;
          gap:1rem;align-items:center;
          padding:14px 18px;background:var(--bg-3);cursor:pointer;
          transition:background .15s;
        }
        .pay-batch-head:hover{background:var(--bg-4)}
        .pay-batch-id{font-family:'Plus Jakarta Sans',sans-serif;font-size:0.78rem;font-weight:700;color:var(--text-3);letter-spacing:.06em}
        .pay-batch-meta{display:flex;flex-direction:column;gap:2px}
        .pay-batch-date{font-size:0.78rem;color:var(--text-3)}
        .pay-batch-count{font-size:0.78rem;color:var(--text-2);font-weight:500}
        .pay-batch-amount{font-family:'Plus Jakarta Sans',sans-serif;font-size:1.05rem;font-weight:800;color:var(--text)}
        .pay-batch-actions{display:flex;gap:8px;align-items:center}

        .pay-batch-body{border-top:1px solid var(--border);background:var(--bg)}

        .pay-participant-in-batch{padding:12px 18px;border-bottom:1px solid var(--border)}
        .pay-participant-in-batch:last-child{border-bottom:none}
        .pay-pib-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:10px}
        .pay-pib-name{font-size:0.88rem;font-weight:700;color:var(--text);margin-bottom:2px}
        .pay-pib-email{font-size:0.75rem;color:var(--text-3)}
        .pay-pib-total{font-family:'Plus Jakarta Sans',sans-serif;font-size:1rem;font-weight:800;color:var(--green);white-space:nowrap}
        .pay-pib-bank{display:flex;gap:1.5rem;flex-wrap:wrap;padding:8px 12px;background:var(--bg-3);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:8px}
        .pay-pib-bank-item{display:flex;flex-direction:column;gap:2px}
        .pay-pib-bank-label{font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)}
        .pay-pib-bank-val{font-size:0.82rem;color:var(--text);font-weight:600}
        .pay-pib-products{display:flex;flex-direction:column;gap:6px}
        .pay-pib-product{
          display:grid;grid-template-columns:1fr 140px;gap:1rem;align-items:center;
          padding:6px 10px;background:var(--bg-2);border-radius:6px;border:1px solid var(--border);
        }
        .pay-pib-pname{font-size:0.82rem;color:var(--text-2);display:flex;align-items:center;gap:6px}
        .pay-pib-pval{font-size:0.88rem;font-weight:700;color:var(--amber);text-align:right;font-family:'Plus Jakarta Sans',sans-serif}
        .pay-no-bank{font-size:0.78rem;color:var(--danger);font-style:italic;margin-bottom:8px}

        .pay-section-title{font-family:'Plus Jakarta Sans',sans-serif;font-size:1rem;font-weight:700;color:var(--text);margin-bottom:4px}
        .pay-section-sub{font-size:0.8rem;color:var(--text-3);margin-bottom:1rem}

        .pay-empty{text-align:center;padding:48px 20px;color:var(--text-3)}
        .pay-empty-icon{font-size:2.5rem;margin-bottom:12px;opacity:.4}

        .pay-action-btn{
          display:inline-flex;align-items:center;gap:6px;
          height:32px;padding:0 12px;border-radius:var(--radius-sm);
          font-family:'Outfit',sans-serif;font-size:0.8rem;font-weight:600;
          cursor:pointer;transition:all .15s;border:none;
        }
        .pay-action-btn:disabled{opacity:.5;cursor:not-allowed}
        .pay-btn-export{background:var(--bg-4);color:var(--text-2);border:1px solid var(--border-light)}
        .pay-btn-export:hover:not(:disabled){background:var(--bg-3);color:var(--text)}
        .pay-btn-paid{background:var(--green-dim);color:#6ee7b7;border:1px solid rgba(16,185,129,.3)}
        .pay-btn-paid:hover:not(:disabled){background:rgba(16,185,129,.2)}
        .pay-btn-paid-done{background:rgba(16,185,129,.08);color:var(--text-3);border:1px solid var(--border);cursor:default}
        .pay-btn-create{
          display:inline-flex;align-items:center;gap:8px;
          height:40px;padding:0 20px;border-radius:var(--radius-sm);
          background:var(--accent);border:none;color:#fff;
          font-family:'Outfit',sans-serif;font-size:0.88rem;font-weight:700;
          cursor:pointer;transition:filter .15s;
        }
        .pay-btn-create:hover:not(:disabled){filter:brightness(1.1)}
        .pay-btn-create:disabled{opacity:.5;cursor:not-allowed}

        .pay-toast{
          position:fixed;bottom:24px;right:24px;
          padding:12px 18px;border-radius:var(--radius-md);
          font-size:0.875rem;font-weight:500;
          box-shadow:var(--shadow-lg);z-index:999;
          display:flex;align-items:center;gap:10px;
          animation:toastIn .25s ease both;
        }
        .pay-toast--success{background:#0d3025;border:1px solid rgba(16,185,129,.4);color:#6ee7b7}
        .pay-toast--error{background:#2d0a0a;border:1px solid rgba(239,68,68,.4);color:#fca5a5}
        @keyframes toastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}

        .pay-divider{border:none;border-top:1px solid var(--border);margin:0 0 1.25rem}
        .pay-chevron{transition:transform .2s}
        .pay-chevron--open{transform:rotate(90deg)}

        @media(max-width:640px){
          .pay-stat-row{grid-template-columns:1fr}
          .pay-product-row{grid-template-columns:1fr 100px}
          .pay-batch-head{grid-template-columns:auto 1fr auto}
          .pay-pib-bank{gap:1rem}
          .pay-batch-actions{flex-wrap:wrap}
        }
      `}</style>

      <div className="sa-dashboard">

        {/* ── TOPBAR ── */}
        <header className="sa-topbar">
          <button className="sa-menu-btn" onClick={() => setSidebar((o) => !o)}>
            {Ico.menu}
          </button>
          <div className="sa-brand"><span className="sa-brand-n">N</span>ITRO</div>
          <div className="sa-search-wrap" style={{ flex: 1 }}>
            <span className="sa-search-icon">{Ico.search}</span>
            <input className="sa-search" placeholder="Search payouts…" readOnly />
          </div>
          <div className="sa-topbar-right">
            <div className="sa-user-pill">
              <div className="sa-user-avatar">{initials(user?.full_name)}</div>
              <div className="sa-user-info">
                <span className="sa-user-name">{user?.full_name || "Admin"}</span>
                <span className="sa-user-role">{user?.role || "Admin"}</span>
              </div>
            </div>
            <button className="sa-logout" onClick={handleLogout}>Logout</button>
          </div>
        </header>

        <div className="sa-layout">
          {sidebarOpen && <button className="sa-backdrop" onClick={() => setSidebar(false)} />}

          {/* ── SIDEBAR ── */}
          <aside className={`sa-sidebar${sidebarOpen ? " sa-sidebar--open" : ""}`}>
            <nav className="sa-nav">
              {NAV.map(({ key, label, icon, active }) => (
                <button key={key} className={`sa-nav-item${active ? " sa-nav-item--active" : ""}`} onClick={() => navTo(key)}>
                  <span className="sa-nav-icon">{icon}</span>
                  <span className="sa-nav-label">{label}</span>
                </button>
              ))}
            </nav>
            <button className="sa-new-project-btn" onClick={() => navTo("create")}>
              {Ico.plus} New Project
            </button>
          </aside>

          {/* ── MAIN ── */}
          <main className="sa-main">

            {/* page header */}
            <div className="sa-page-head">
              <div>
                <h1 className="sa-page-title">Payout <span className="sa-highlight">Batches</span></h1>
                <p className="sa-page-sub">Review eligible payouts, create batches, export CSV and mark paid.</p>
              </div>
              <div className="sa-page-actions">
                <button className="sa-export-btn" onClick={() => { loadEligible(); loadBatches(); }}>
                  {Ico.refresh} &nbsp;Refresh
                </button>
                <button className="sa-export-btn" onClick={() => navigate("/admin/payout-history")}>
                  Payout History
                </button>
                <button
                  className="pay-btn-create"
                  onClick={handleCreateBatch}
                  disabled={creatingBatch || eligible.length === 0}
                >
                  {creatingBatch ? "Creating…" : <>{Ico.plus} Create Batch</>}
                </button>
              </div>
            </div>

            {/* ══════════════════════════════════════════════
                SECTION 1 — ELIGIBLE PAYOUTS
            ══════════════════════════════════════════════ */}
            <div className="sa-panel">
              <div className="sa-panel-head">
                <div>
                  <div className="sa-panel-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: eligible.length ? "var(--green)" : "var(--text-3)",
                      boxShadow: eligible.length ? "0 0 6px var(--green)" : "none",
                      display: "inline-block", flexShrink: 0,
                    }} />
                    Eligible Payouts
                    <span style={{
                      fontSize: "0.75rem", color: "var(--text-3)",
                      background: "var(--bg-3)", padding: "2px 9px",
                      borderRadius: 999, border: "1px solid var(--border)"
                    }}>
                      {eligible.length} payout{eligible.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="sa-panel-sub">
                    Payouts ready to be batched. Once you click "Create Batch", these will move to a batch.
                  </div>
                </div>
                {eligible.length > 0 && (
                  <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--cyan)", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                    {fmt(eligStats.total)} total
                  </div>
                )}
              </div>

              {eligibleError && (
                <div className="sa-error" style={{ margin: "0 0 1rem" }}>
                  {Ico.alert} {eligibleError}
                  <button onClick={() => setEligErr("")}>✕</button>
                </div>
              )}

              {eligibleLoading ? (
                <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-3)" }}>
                  <div className="sa-spinner" style={{ margin: "0 auto 10px" }} />
                  Loading eligible payouts…
                </div>
              ) : eligible.length === 0 ? (
                <div className="pay-empty">
                  <div className="pay-empty-icon">✅</div>
                  <div style={{ fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>No eligible payouts</div>
                  <div style={{ fontSize: "0.84rem" }}>All eligible payouts have already been batched.</div>
                </div>
              ) : (
                <>
                  {/* summary strip */}
                  <div className="pay-stat-row">
                    <div className="pay-stat-mini">
                      <div className="pay-stat-mini-label">Participants</div>
                      <div className="pay-stat-mini-val">{eligStats.participants}</div>
                      <div className="pay-stat-mini-sub">Awaiting payout</div>
                    </div>
                    <div className="pay-stat-mini">
                      <div className="pay-stat-mini-label">Products</div>
                      <div className="pay-stat-mini-val">{eligStats.products}</div>
                      <div className="pay-stat-mini-sub">Products purchased</div>
                    </div>
                    <div className="pay-stat-mini">
                      <div className="pay-stat-mini-label">Total Pending</div>
                      <div className="pay-stat-mini-val" style={{ color: "var(--cyan)", fontSize: "1.4rem" }}>
                        {fmt(eligStats.total)}
                      </div>
                      <div className="pay-stat-mini-sub">To be disbursed</div>
                    </div>
                  </div>

                  {/* per-participant breakdown */}
                  {eligByParticipant.map((p) => (
                    <div key={p.participant_id} className="pay-participant-block">
                      <div className="pay-participant-head">
                        <div>
                          <div className="pay-participant-name">{p.full_name}</div>
                          <div className="pay-participant-email">{p.email}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: "0.68rem", color: "var(--text-3)", textAlign: "right", marginBottom: 3 }}>Total</div>
                          <div className="pay-participant-total">{fmt(p.total)}</div>
                        </div>
                      </div>

                      {/* product rows */}
                        {p.rows.map((row, ri) => {
                        // Best available product name — backend returns product_name directly
                        const productName =
                          row.product_name ||
                          row.projects?.product_name ||
                          null;
                        const projectTitle = row.projects?.title || row.projects?.name || null;
                        const productVal = Number(row.product_amount || row.amount || 0);

                        return (
                          <div key={row.id || ri} className="pay-product-row">
                            <div className="pay-product-name">
                              {Ico.package}
                              <div>
                                <div style={{ fontWeight: 500 }}>
                                  {productName || <em style={{ color: "var(--text-3)" }}>Unknown product</em>}
                                </div>
                                {projectTitle && (
                                  <div style={{ color: "var(--text-3)", fontSize: "0.72rem", marginTop: 2 }}>
                                    {projectTitle}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="pay-product-val">{fmt(productVal)}</div>
                            <div className="pay-product-status">
                              <span className="sa-status-badge sa-mode-badge--d2c" style={{ fontSize: "0.68rem" }}>
                                {row.status || "ELIGIBLE"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* create batch CTA */}
                  <div style={{
                    marginTop: 16, padding: "14px 16px",
                    background: "var(--accent-dim)", border: "1px solid var(--accent-glow)",
                    borderRadius: "var(--radius-md)", display: "flex",
                    alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10
                  }}>
                    <div>
                      <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text)" }}>
                        Ready to batch {eligible.length} payout{eligible.length !== 1 ? "s" : ""}?
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: 2 }}>
                        This will group all eligible payouts into a single disbursement batch.
                      </div>
                    </div>
                    <button className="pay-btn-create" onClick={handleCreateBatch} disabled={creatingBatch}>
                      {creatingBatch ? "Creating…" : <>{Ico.plus} Create Batch — {fmt(eligStats.total)}</>}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* ══════════════════════════════════════════════
                SECTION 2 — PAYOUT BATCHES
            ══════════════════════════════════════════════ */}
            <div className="sa-panel">
              <div className="sa-panel-head">
                <div>
                  <div className="sa-panel-title">Payout Batches</div>
                  <div className="sa-panel-sub">
                    {batches.length} batch{batches.length !== 1 ? "es" : ""} · Click a batch to view participant details
                  </div>
                </div>
                <button className="sa-export-btn" onClick={loadBatches} disabled={batchesLoading}>
                  {Ico.refresh} &nbsp;{batchesLoading ? "Loading…" : "Refresh"}
                </button>
              </div>

              {batchesError && (
                <div className="sa-error" style={{ marginBottom: "1rem" }}>
                  {Ico.alert} {batchesError}
                  <button onClick={() => setBatchErr("")}>✕</button>
                </div>
              )}

              {batchesLoading ? (
                <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-3)" }}>
                  <div className="sa-spinner" style={{ margin: "0 auto 10px" }} />
                  Loading batches…
                </div>
              ) : batches.length === 0 ? (
                <div className="pay-empty">
                  <div className="pay-empty-icon">📦</div>
                  <div style={{ fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>No batches yet</div>
                  <div style={{ fontSize: "0.84rem" }}>Create your first batch from the eligible payouts above.</div>
                </div>
              ) : (
                batches.map((batch) => {
                  const isPaid      = String(batch.status || "").toUpperCase() === "PAID";
                  const isExpanded  = expandedBatch === batch.id;
                  const participants = batch.participants || [];

                  return (
                    <div key={batch.id} className="pay-batch-card">
                      {/* batch header row */}
                      <div className="pay-batch-head" onClick={() => setExpanded(isExpanded ? null : batch.id)}>
                        {/* expand arrow */}
                        <span className={`pay-chevron${isExpanded ? " pay-chevron--open" : ""}`} style={{ color: "var(--text-3)" }}>
                          {Ico.chevron}
                        </span>

                        {/* id + date */}
                        <div className="pay-batch-meta">
                          <span className="pay-batch-id">BATCH #{shortId(batch.id)}</span>
                          <span className="pay-batch-date">{fmtDate(batch.created_at)}</span>
                          <span className="pay-batch-count">
                            {participants.length} participant{participants.length !== 1 ? "s" : ""}
                          </span>
                        </div>

                        {/* status */}
                        <span className={batchStatusBadge(batch.status)} style={{ alignSelf: "center" }}>
                          {batch.status || "IN_BATCH"}
                        </span>

                        {/* total amount */}
                        <div className="pay-batch-amount" onClick={(e) => e.stopPropagation()}>
                          {fmt(batch.total_amount)}
                        </div>

                        {/* action buttons */}
                        <div className="pay-batch-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="pay-action-btn pay-btn-export"
                            onClick={() => handleExportBatch(batch.id)}
                            disabled={exportingBatch === batch.id}
                            title="Download CSV"
                          >
                            {exportingBatch === batch.id ? "…" : <>{Ico.download} Export CSV</>}
                          </button>

                          {isPaid ? (
                            <button className="pay-action-btn pay-btn-paid-done" disabled>
                              {Ico.check} Paid
                            </button>
                          ) : (
                            <button
                              className="pay-action-btn pay-btn-paid"
                              onClick={() => handleMarkBatchPaid(batch.id)}
                              disabled={markingPaid === batch.id}
                              title="Mark entire batch as paid"
                            >
                              {markingPaid === batch.id ? "Marking…" : <>{Ico.check} Mark Paid</>}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* expanded batch body */}
                      {isExpanded && (
                        <div className="pay-batch-body">
                          {participants.length === 0 ? (
                            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-3)", fontSize: "0.875rem" }}>
                              No participant data available for this batch.
                            </div>
                          ) : (
                            participants.map((p, pi) => (
                              <div key={p.payout_id || pi} className="pay-participant-in-batch">
                                {/* participant name + total */}
                                <div className="pay-pib-head">
                                  <div>
                                    <div className="pay-pib-name">{p.full_name || "Unknown"}</div>
                                    <div className="pay-pib-email">{p.email || "—"}</div>
                                  </div>
                                  <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-3)", marginBottom: 3 }}>Product Amount</div>
                                    <div className="pay-pib-total">{fmt(p.product_amount)}</div>
                                    <span className={batchStatusBadge(p.payout_status)} style={{ fontSize: "0.65rem", marginTop: 4, display: "inline-block" }}>
                                      {p.payout_status || "IN_BATCH"}
                                    </span>
                                  </div>
                                </div>

                                {/* bank details */}
                                {p.bank_account_number ? (
                                  <div className="pay-pib-bank">
                                    <div className="pay-pib-bank-item">
                                      <span className="pay-pib-bank-label">{Ico.user} Name</span>
                                      <span className="pay-pib-bank-val">{p.bank_account_name || p.full_name || "—"}</span>
                                    </div>
                                    <div className="pay-pib-bank-item">
                                      <span className="pay-pib-bank-label">{Ico.bank} Account No.</span>
                                      <span className="pay-pib-bank-val" style={{ fontFamily: "monospace", letterSpacing: ".05em" }}>
                                        {p.bank_account_number}
                                      </span>
                                    </div>
                                    <div className="pay-pib-bank-item">
                                      <span className="pay-pib-bank-label">IFSC</span>
                                      <span className="pay-pib-bank-val" style={{ fontFamily: "monospace", letterSpacing: ".05em" }}>
                                        {p.bank_ifsc || "—"}
                                      </span>
                                    </div>
                                    {p.bank_name && (
                                      <div className="pay-pib-bank-item">
                                        <span className="pay-pib-bank-label">Bank</span>
                                        <span className="pay-pib-bank-val">{p.bank_name}</span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="pay-no-bank">⚠ Bank details not available for this participant.</div>
                                )}

                                {/* product purchased + amount — no reward, product cost only */}
                                <div className="pay-pib-products">
                                  <div className="pay-pib-product">
                                    <div className="pay-pib-pname">
                                      {Ico.package}
                                      {p.product_name
                                        ? <span>{p.product_name}</span>
                                        : <em style={{ color: "var(--text-3)", fontStyle: "italic" }}>Product name unavailable</em>
                                      }
                                    </div>
                                    <div className="pay-pib-pval">{fmt(p.product_amount)}</div>
                                  </div>

                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </main>
        </div>
      </div>

      {/* ── toast ── */}
      {toast && (
        <div className={`pay-toast pay-toast--${toast.type}`}>
          {toast.type === "success" ? Ico.check : Ico.alert}
          {toast.msg}
        </div>
      )}
    </>
  );
}