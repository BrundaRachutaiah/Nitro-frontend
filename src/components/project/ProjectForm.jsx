import { useState } from "react";
import { createProject } from "../../api/project.api";

const blankProduct = { name: "", product_url: "", price: "" };

/* ─── Icons ── */
const Icon = ({ name, size = 16 }) => {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  const icons = {
    alert:   <svg {...p}><path d="m10.29 3.86-8.6 14.9A1 1 0 0 0 2.57 20h16.86a1 1 0 0 0 .88-1.24l-8.6-14.9a1 1 0 0 0-1.72 0z"/><path d="M12 9v4M12 17h.01"/></svg>,
    check:   <svg {...p}><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>,
    plus:    <svg {...p}><path d="M12 5v14M5 12h14"/></svg>,
    trash:   <svg {...p}><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
    save:    <svg {...p}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
    package: <svg {...p}><path d="m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>,
    tag:     <svg {...p}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
    calendar:<svg {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>,
    link:    <svg {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    info:    <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 12v4"/></svg>,
    dollar:  <svg {...p}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    image:   <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
    users:   <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  };
  return icons[name] || <svg {...p}><circle cx="12" cy="12" r="9"/></svg>;
};

/* ─── Field components ── */
const Field = ({ label, required, hint, icon, children }) => (
  <div className="cpf-field">
    {label && (
      <label className="cpf-label">
        {icon && <span className="cpf-label-icon"><Icon name={icon} size={12} /></span>}
        {label}
        {required && <span className="cpf-required">*</span>}
        {hint && <span className="cpf-hint">{hint}</span>}
      </label>
    )}
    {children}
  </div>
);

const Input = ({ icon, ...props }) => (
  <div className="cpf-input-wrap">
    {icon && <span className="cpf-input-icon"><Icon name={icon} size={14} /></span>}
    <input className={`cpf-input ${icon ? "cpf-input--icon" : ""}`} {...props} />
  </div>
);

const Textarea = (props) => <textarea className="cpf-textarea" {...props} />;

const Select = ({ children, ...props }) => (
  <select className="cpf-select" {...props}>{children}</select>
);

/* ════════════════════════════════════════════
   PROJECT FORM
════════════════════════════════════════════ */
const ProjectForm = ({ onSuccess }) => {
  const [form, setForm] = useState({
    name: "", title: "", description: "", category: "",
    reward: "", mode: "MARKETPLACE", total_units: "1",
    start_date: "", end_date: "", product_url: "",
    products: [{ ...blankProduct }],
  });
  const [error, setError]     = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy]       = useState(false);

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const updateProduct = (idx, key, val) => {
    const next = [...form.products];
    next[idx] = { ...next[idx], [key]: val };
    setForm(p => ({ ...p, products: next }));
  };
  const addProduct    = () => setForm(p => ({ ...p, products: [...p.products, { ...blankProduct }] }));
  const removeProduct = (idx) => {
    if (form.products.length <= 1) return;
    setForm(p => ({ ...p, products: p.products.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setMessage("");

    if (!form.title.trim() || !form.description.trim() || !form.category.trim() || !String(form.reward).trim() || !form.mode || !form.start_date || !form.end_date) {
      setError("Please fill all required fields marked with *."); return;
    }
    if (Number(form.reward) <= 0) { setError("Allocated budget must be greater than 0."); return; }

    const cleanedProducts = form.products
      .map(p => ({ name: p.name.trim(), product_url: p.product_url.trim(), price: Number(p.price || 0), product_value: Number(p.price || 0) }))
      .filter(p => p.name && p.product_url);

    if (!cleanedProducts.length) { setError("Please add at least one product with a name and URL."); return; }

    setBusy(true);
    try {
      await createProject({
        name: form.name.trim() || form.title.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        reward: Number(form.reward),
        mode: form.mode,
        total_units: Number(form.total_units || 1),
        start_date: form.start_date,
        end_date: form.end_date,
        product_url: form.product_url.trim() || cleanedProducts[0].product_url,
        products: cleanedProducts,
      });
      setMessage("Project created successfully!");
      setForm({ name: "", title: "", description: "", category: "", reward: "", mode: "MARKETPLACE", total_units: "1", start_date: "", end_date: "", product_url: "", products: [{ ...blankProduct }] });
      if (onSuccess) setTimeout(onSuccess, 1200);
    } catch (err) {
      setError(err.response?.data?.message || "Project creation failed. Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="cpf-form">

      {/* ── Alerts ── */}
      {error && (
        <div className="cpf-alert cpf-alert--error">
          <Icon name="alert" size={15} /> {error}
          <button type="button" onClick={() => setError("")}>✕</button>
        </div>
      )}
      {message && (
        <div className="cpf-alert cpf-alert--success">
          <Icon name="check" size={15} /> {message}
        </div>
      )}

      {/* ══ SECTION 1: Basic Info ══ */}
      <div className="sa-panel cpf-section">
        <div className="sa-panel-head" style={{ marginBottom: "1.25rem" }}>
          <div>
            <h2 className="sa-panel-title">Campaign Information</h2>
            <p className="sa-panel-sub">Basic details about this product campaign</p>
          </div>
          <span className="cpf-step-badge">Step 1</span>
        </div>

        <div className="cpf-grid-2">
          <Field label="Project Title" required icon="tag">
            <Input
              icon="tag"
              placeholder="e.g. Veda India Summer Campaign"
              value={form.title}
              onChange={e => set("title", e.target.value) || set("name", e.target.value)}
              onInput={e => setForm(p => ({ ...p, title: e.target.value, name: e.target.value }))}
            />
          </Field>

          <Field label="Category" required icon="info">
            <Input
              icon="info"
              placeholder="e.g. Home essentials, Skincare"
              value={form.category}
              onChange={e => set("category", e.target.value)}
            />
          </Field>
        </div>

        <Field label="Project Description" required>
          <Textarea
            placeholder="Describe the campaign, goals, and requirements for participants…"
            value={form.description}
            onChange={e => set("description", e.target.value)}
            rows={4}
          />
        </Field>
      </div>

      {/* ══ SECTION 2: Campaign Config ══ */}
      <div className="sa-panel cpf-section">
        <div className="sa-panel-head" style={{ marginBottom: "1.25rem" }}>
          <div>
            <h2 className="sa-panel-title">Campaign Configuration</h2>
            <p className="sa-panel-sub">Mode, budget, and timeline settings</p>
          </div>
          <span className="cpf-step-badge">Step 2</span>
        </div>

        <div className="cpf-grid-3">
          <Field label="Campaign Mode" required icon="users">
            <Select value={form.mode} onChange={e => set("mode", e.target.value)}>
              <option value="MARKETPLACE">Marketplace</option>
              <option value="D2C">D2C</option>
            </Select>
          </Field>

          <Field label="Allocated Budget (INR)" required icon="dollar">
            <Input
              icon="dollar"
              type="number"
              placeholder="e.g. 5000"
              min="1"
              value={form.reward}
              onChange={e => set("reward", e.target.value)}
            />
          </Field>

          <Field label="Total Units" hint="(optional)">
            <Input
              icon="users"
              type="number"
              placeholder="1"
              min="1"
              value={form.total_units}
              onChange={e => set("total_units", e.target.value)}
            />
          </Field>

          <Field label="Start Date" required icon="calendar">
            <div className="cpf-input-wrap">
              <span className="cpf-input-icon"><Icon name="calendar" size={14} /></span>
              <input
                type="date"
                className="cpf-input cpf-input--icon cpf-input--date"
                value={form.start_date}
                min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                onChange={e => set("start_date", e.target.value)}
              />
            </div>
          </Field>

          <Field label="End Date" required icon="calendar">
            <div className="cpf-input-wrap">
              <span className="cpf-input-icon"><Icon name="calendar" size={14} /></span>
              <input
                type="date"
                className="cpf-input cpf-input--icon cpf-input--date"
                value={form.end_date}
                min={
                  form.start_date
                    ? new Date(new Date(form.start_date).getTime() + 86400000).toISOString().slice(0, 10)
                    : new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
                }
                onChange={e => set("end_date", e.target.value)}
              />
            </div>
          </Field>

          <Field label="Primary Product URL" hint="(optional)" icon="link">
            <Input
              icon="link"
              type="url"
              placeholder="https://…"
              value={form.product_url}
              onChange={e => set("product_url", e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* ══ SECTION 3: Products ══ */}
      <div className="sa-panel cpf-section">
        <div className="sa-panel-head" style={{ marginBottom: "1.25rem" }}>
          <div>
            <h2 className="sa-panel-title">Products</h2>
            <p className="sa-panel-sub">Add all products participants will purchase and review</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="cpf-step-badge">Step 3</span>
            <button type="button" className="cpf-add-btn" onClick={addProduct}>
              <Icon name="plus" size={14} /> Add Product
            </button>
          </div>
        </div>

        <div className="cpf-product-cards">
          {form.products.map((product, idx) => (
            <div key={`product-${idx}`} className="cpf-product-card">

              {/* Card top — icon placeholder + remove button */}
              <div className="cpf-card-top">
                <div className="cpf-card-icon">
                  <Icon name="package" size={22} />
                </div>
                <div className="cpf-card-num">#{idx + 1}</div>
                <button
                  type="button"
                  className="cpf-remove-btn"
                  onClick={() => removeProduct(idx)}
                  disabled={form.products.length <= 1}
                  title="Remove product"
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>

              {/* Card fields */}
              <div className="cpf-card-fields">
                <Field label="Product Name" required>
                  <div className="cpf-input-wrap">
                    <span className="cpf-input-icon"><Icon name="package" size={13} /></span>
                    <input
                      className="cpf-input cpf-input--icon"
                      placeholder="e.g. Ghee Batti 500ml"
                      value={product.name}
                      onChange={e => updateProduct(idx, "name", e.target.value)}
                    />
                  </div>
                </Field>

                <Field label="Product URL" required>
                  <div className="cpf-input-wrap">
                    <span className="cpf-input-icon"><Icon name="link" size={13} /></span>
                    <input
                      className="cpf-input cpf-input--icon"
                      placeholder="Amazon / Flipkart / brand URL"
                      value={product.product_url}
                      onChange={e => updateProduct(idx, "product_url", e.target.value)}
                    />
                  </div>
                </Field>

                <Field label="Price (INR)">
                  <div className="cpf-input-wrap">
                    <span className="cpf-input-icon"><Icon name="dollar" size={13} /></span>
                    <input
                      type="number"
                      className="cpf-input cpf-input--icon"
                      placeholder="0"
                      min="0"
                      value={product.price}
                      onChange={e => updateProduct(idx, "price", e.target.value)}
                    />
                  </div>
                </Field>
              </div>

              {/* Card preview footer */}
              {(product.name || product.product_url) && (
                <div className="cpf-card-preview">
                  {product.name && (
                    <span className="cpf-card-preview-name">{product.name}</span>
                  )}
                  {product.price && (
                    <span className="cpf-card-preview-price">₹{Number(product.price).toLocaleString("en-IN")}</span>
                  )}
                  {product.product_url && (
                    <a
                      href={product.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cpf-card-preview-link"
                      onClick={e => e.stopPropagation()}
                    >
                      <Icon name="link" size={11} /> View URL
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Empty state */}
          {form.products.length === 0 && (
            <div className="cpf-products-empty">
              <Icon name="package" size={28} />
              <p>No products added yet. Click "Add Product" to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* ══ Submit ══ */}
      <div className="cpf-footer">
        <div className="cpf-footer-info">
          <Icon name="info" size={14} />
          <span>Project will be saved as <strong>Draft</strong> — publish it from the Projects page when ready.</span>
        </div>
        <button
          type="submit"
          className="cpf-submit-btn"
          disabled={busy}
        >
          {busy ? (
            <>
              <span className="cpf-spinner" />
              Creating…
            </>
          ) : (
            <>
              <Icon name="save" size={16} />
              Create Project
            </>
          )}
        </button>
      </div>

    </form>
  );
};

export default ProjectForm;