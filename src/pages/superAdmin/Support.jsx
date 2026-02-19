import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../../api/axiosInstance";
import "./AdminPages.css";

const Support = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formStatus, setFormStatus] = useState("");

  const loadTickets = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await axios.get("/admin/support/tickets");
      setTickets(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load support tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const submitTicket = async (event) => {
    event.preventDefault();
    setFormStatus("");
    setError("");

    if (!subject.trim() || !message.trim()) {
      setFormStatus("Subject and message are required.");
      return;
    }

    setSubmitting(true);
    try {
      await axios.post("/users/support/tickets", {
        subject: subject.trim(),
        message: message.trim()
      });
      setFormStatus("Ticket submitted successfully.");
      setSubject("");
      setMessage("");
      await loadTickets();
    } catch (err) {
      setFormStatus(err.response?.data?.message || "Failed to submit support ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Support Tickets</h1>
          <p>Review and manage user support issues</p>
        </div>
        <div className="admin-head-actions">
          <button type="button" className="admin-btn" onClick={() => navigate("/dashboard")}>Back</button>
          <button type="button" className="admin-btn" onClick={loadTickets}>Refresh</button>
        </div>
      </div>

      <section className="admin-panel support-form-card">
        <h3 className="support-form-title">Raise Support Ticket</h3>
        <form onSubmit={submitTicket} className="support-form-grid">
          <input
            className="form-control support-input"
            placeholder="Subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
          <textarea
            className="form-control support-input"
            rows={4}
            placeholder="Describe your issue"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <button className="admin-btn primary support-submit" type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Ticket"}
          </button>
        </form>
        {formStatus ? (
          <p className={`support-form-status ${formStatus.includes("success") ? "ok" : "err"}`}>
            {formStatus}
          </p>
        ) : null}
      </section>

      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-panel admin-table-wrap support-table-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Status</th>
              <th>User</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4}>Loading tickets...</td></tr>
            ) : tickets.length ? (
              tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>{ticket.subject || "-"}</td>
                  <td>
                    <span className={`admin-badge ${String(ticket.status || "").toLowerCase()}`}>
                      {ticket.status || "UNKNOWN"}
                    </span>
                  </td>
                  <td>{ticket.profiles?.email || ticket.profiles?.full_name || "-"}</td>
                  <td>{ticket.created_at ? new Date(ticket.created_at).toLocaleString() : "-"}</td>
                </tr>
              ))
            ) : (
              <tr><td className="admin-empty" colSpan={4}>No support tickets found.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default Support;
