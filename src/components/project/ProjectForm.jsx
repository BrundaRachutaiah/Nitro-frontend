import { useState } from "react";
import { createProject } from "../../api/project.api";

const blankProduct = { name: "", product_url: "", price: "" };

const ProjectForm = () => {
  const [form, setForm] = useState({
    name: "",
    title: "",
    description: "",
    category: "",
    reward: "",
    mode: "MARKETPLACE",
    total_units: "",
    start_date: "",
    end_date: "",
    product_url: "",
    products: [{ ...blankProduct }]
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const updateProduct = (index, key, value) => {
    const next = [...form.products];
    next[index] = { ...next[index], [key]: value };
    setForm({ ...form, products: next });
  };

  const addProduct = () => {
    setForm({ ...form, products: [...form.products, { ...blankProduct }] });
  };

  const removeProduct = (index) => {
    if (form.products.length <= 1) return;
    setForm({ ...form, products: form.products.filter((_, idx) => idx !== index) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const cleanedProducts = form.products
      .map((product) => ({
        name: product.name.trim(),
        product_url: product.product_url.trim(),
        price: Number(product.price || 0),
        product_value: Number(product.price || 0)
      }))
      .filter((product) => product.name && product.product_url);

    if (!cleanedProducts.length) {
      setError("Please add at least one product with URL.");
      return;
    }

    try {
      await createProject({
        name: form.name.trim() || form.title.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        reward: Number(form.reward),
        mode: form.mode,
        total_units: Number(form.total_units),
        start_date: form.start_date,
        end_date: form.end_date,
        product_url: form.product_url.trim() || cleanedProducts[0].product_url,
        products: cleanedProducts
      });
      setMessage("Project created successfully.");
      setForm({
        name: "",
        title: "",
        description: "",
        category: "",
        reward: "",
        mode: "MARKETPLACE",
        total_units: "",
        start_date: "",
        end_date: "",
        product_url: "",
        products: [{ ...blankProduct }]
      });
    } catch (err) {
      setError(err.response?.data?.message || "Project creation failed.");
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, maxWidth: 920 }}>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      {message ? <p style={{ color: "green" }}>{message}</p> : null}

      <input placeholder="Project Title" className="form-control" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, name: e.target.value })} />
      <textarea placeholder="Project Description" className="form-control" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <input placeholder="Category" className="form-control" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
      <input placeholder="Reward Amount (INR)" type="number" className="form-control" value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })} />

      <select className="form-select" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
        <option value="MARKETPLACE">Marketplace</option>
        <option value="D2C">D2C</option>
      </select>

      <input placeholder="Total Units" type="number" className="form-control" value={form.total_units} onChange={(e) => setForm({ ...form, total_units: e.target.value })} />
      <input type="date" className="form-control" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
      <input type="date" className="form-control" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
      <input placeholder="Primary Product URL (optional)" className="form-control" value={form.product_url} onChange={(e) => setForm({ ...form, product_url: e.target.value })} />

      <h4 style={{ marginBottom: 0 }}>Products</h4>
      {form.products.map((product, idx) => (
        <div key={`product-${idx}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 180px 120px", gap: 8 }}>
          <input placeholder="Product Name" className="form-control" value={product.name} onChange={(e) => updateProduct(idx, "name", e.target.value)} />
          <input placeholder="Product URL" className="form-control" value={product.product_url} onChange={(e) => updateProduct(idx, "product_url", e.target.value)} />
          <input placeholder="Price (INR)" type="number" className="form-control" value={product.price} onChange={(e) => updateProduct(idx, "price", e.target.value)} />
          <button type="button" className="admin-btn" onClick={() => removeProduct(idx)}>Remove</button>
        </div>
      ))}
      <button type="button" className="admin-btn" onClick={addProduct} style={{ width: "fit-content" }}>+ Add Product</button>

      <button className="admin-btn primary" style={{ width: "fit-content" }}>Create</button>
    </form>
  );
};

export default ProjectForm;
