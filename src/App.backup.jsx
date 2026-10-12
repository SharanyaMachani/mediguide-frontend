
import { useEffect, useState } from "react";
import "./style.css";

const API = "http://localhost:8080/api";

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("DOCTOR");
  const [message, setMessage] = useState("");
  const [records, setRecords] = useState([]);
  const [patientRecords, setPatientRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    patientId: "1",
    doctorId: "1",
    originalInstructions: "",
  });

  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const text = await response.text();
    let data;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      throw new Error(
        typeof data === "string"
          ? data
          : data?.message || `Request failed (${response.status})`
      );
    }

    return data;
  }

  async function login(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const params = new URLSearchParams({
        email: email.trim(),
        password,
        role,
      });

      const data = await request(
        `/auth/login?${params.toString()}`,
        { method: "POST" }
      );

      const loggedInUser = data?.user || data;

      if (loggedInUser?.id == null) {
        throw new Error("Login response is missing the user ID.");
      }

      setUser(loggedInUser);
      setPassword("");

      const actualRole = String(loggedInUser.role || role).toUpperCase();
      setView(actualRole.includes("PATIENT") ? "patient" : "home");
      setMessage("Login successful.");
    } catch (error) {
      setMessage(`Login failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    window.speechSynthesis?.cancel();
    setUser(null);
    setView("login");
    setRecords([]);
    setPatientRecords([]);
    setSelectedRecord(null);
    setMessage("");
    setPassword("");
    setSearch("");
  }

  async function loadRecords() {
    setLoading(true);
    setMessage("");

    try {
      const data = await request("/discharge");
      setRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage(`Could not load records: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadPatientRecords() {
    if (user?.id == null) {
      setMessage("The login response does not contain a patient ID.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const data = await request("/discharge");
      const approved = (Array.isArray(data) ? data : []).filter(
        (record) =>
          record.approved === true &&
          Number(record.patientId) === Number(user.id)
      );

      setPatientRecords(approved);

      if (approved.length === 0) {
        setMessage("No approved instructions were found for this patient account.");
      }
    } catch (error) {
      setPatientRecords([]);
      setMessage(`Could not load patient instructions: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function createRecord(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const created = await request("/discharge", {
        method: "POST",
        body: JSON.stringify({
          patientId: Number(form.patientId),
          doctorId: Number(form.doctorId),
          originalInstructions: form.originalInstructions.trim(),
        }),
      });

      setForm({
        patientId: "1",
        doctorId: String(user?.id ?? "1"),
        originalInstructions: "",
      });

      const data = await request("/discharge");
      setRecords(Array.isArray(data) ? data : []);
      setMessage(`Record #${created.id} created successfully.`);
      setView("records");
    } catch (error) {
      setMessage(`Could not create record: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function runRecordAction(record, action) {
    setLoading(true);
    setMessage("");

    try {
      const updated =
        action === "approve"
          ? await request(`/discharge/${record.id}/approve`, {
              method: "PUT",
            })
          : await request(`/discharge/${record.id}/${action}`, {
              method: "POST",
            });

      if (updated?.id != null) {
        setSelectedRecord(updated);
      }

      const data = await request("/discharge");
      setRecords(Array.isArray(data) ? data : []);
      setMessage(`${action[0].toUpperCase()}${action.slice(1)} completed.`);
    } catch (error) {
      setMessage(`${action} failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function speakTelugu(text) {
    if (!text || !("speechSynthesis" in window)) {
      setMessage("Speech playback is unavailable in this browser.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "te-IN";
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    if (!user) return;

    if (view === "records") {
      loadRecords();
    } else if (view === "patient") {
      loadPatientRecords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, user]);

  const actualRole = String(user?.role || role).toUpperCase();
  const isPatient = actualRole.includes("PATIENT");

  const filteredRecords = records.filter((record) => {
    const query = search.trim().toLowerCase();

    return (
      !query ||
      String(record.id).includes(query) ||
      String(record.patientId).includes(query) ||
      String(record.doctorId).includes(query) ||
      String(record.originalInstructions || "").toLowerCase().includes(query)
    );
  });

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-card">
          <h1>MediSecure</h1>
          <p>Secure Medical Records &amp; Patient-Friendly Discharge Care</p>

          <form onSubmit={login}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your registered email"
              autoComplete="username"
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />

            <label htmlFor="role">Sign in as</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="DOCTOR">Doctor</option>
              <option value="PATIENT">Patient</option>
            </select>

            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {message && <p className="message" role="status">{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>MediSecure</h1>
          <p>Medical Records &amp; Patient Discharge Management</p>
        </div>

        <div>
          <span>{user.email} · {actualRole}</span>
          <button className="logout-button" onClick={logout}>Log out</button>
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
          <p className="sidebar-heading">WORKSPACE</p>

          {isPatient ? (
            <button
              className="nav-item"
              onClick={() => setView("patient")}
            >
              My instructions
            </button>
          ) : (
            <>
              <button className="nav-item" onClick={() => setView("home")}>
                Dashboard
              </button>
              <button className="nav-item" onClick={() => setView("records")}>
                Patient records
              </button>
              <button className="nav-item" onClick={() => setView("create")}>
                + Create record
              </button>
            </>
          )}

          <div className="sidebar-note">
            <strong>Patient-friendly care</strong>
            <p>Make discharge instructions easier to understand.</p>
          </div>
        </aside>

        <section className="main-content">
          {message && <p className="message" role="status">{message}</p>}

          {view === "home" && !isPatient && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">DOCTOR WORKSPACE</p>
                  <h2>Dashboard</h2>
                  <p>Manage discharge records and patient instructions.</p>
                </div>
                <button className="primary-button" onClick={() => setView("create")}>
                  + Create patient record
                </button>
              </div>

              <div className="stats-grid">
                <article className="stat-card">
                  <p>Total records</p>
                  <h3>{records.length}</h3>
                </article>
                <article className="stat-card">
                  <p>Approved records</p>
                  <h3>{records.filter((r) => r.approved).length}</h3>
                </article>
                <article className="stat-card">
                  <p>Pending approval</p>
                  <h3>{records.filter((r) => !r.approved).length}</h3>
                </article>
              </div>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Recent patient records</h3>
                    <p>Quickly check the status of discharge instructions.</p>
                  </div>
                  <button onClick={loadRecords} disabled={loading}>
                    {loading ? "Loading..." : "Refresh"}
                  </button>
                </div>

                {records.length === 0 ? (
                  <div className="empty-state">
                    <h3>No records loaded</h3>
                    <p>Load existing records or create your first discharge record.</p>
                    <button className="primary-button" onClick={loadRecords} disabled={loading}>
                      Load records
                    </button>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Record</th>
                          <th>Patient ID</th>
                          <th>Instructions</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.slice(0, 5).map((record) => (
                          <tr key={record.id}>
                            <td>#{record.id}</td>
                            <td>{record.patientId}</td>
                            <td>{record.originalInstructions || "—"}</td>
                            <td>{record.approved ? "Approved" : "Pending"}</td>
                            <td>
                              <button onClick={() => setView("records")}>View</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="panel">
                <h3>Discharge workflow</h3>
                <div className="workflow-grid">
                  <div><strong>01 · Create</strong><p>Enter original instructions.</p></div>
                  <div><strong>02 · Simplify</strong><p>Generate easier-to-read English.</p></div>
                  <div><strong>03 · Translate</strong><p>Prepare Telugu instructions.</p></div>
                  <div><strong>04 · Approve</strong><p>Review before sharing with the patient.</p></div>
                </div>
              </section>
            </>
          )}

          {view === "create" && !isPatient && (
            <section className="panel form-panel">
              <h2>Create discharge record</h2>
              <p>Enter patient details and the original instructions.</p>

              <form onSubmit={createRecord}>
                <div className="form-grid">
                  <div>
                    <label htmlFor="patientId">Patient ID</label>
                    <input
                      id="patientId"
                      type="number"
                      min="1"
                      value={form.patientId}
                      onChange={(e) => setForm({ ...form, patientId: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="doctorId">Doctor ID</label>
                    <input
                      id="doctorId"
                      type="number"
                      min="1"
                      value={form.doctorId}
                      onChange={(e) => setForm({ ...form, doctorId: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <label htmlFor="originalInstructions">Original discharge instructions</label>
                <textarea
                  id="originalInstructions"
                  rows={6}
                  value={form.originalInstructions}
                  onChange={(e) => setForm({ ...form, originalInstructions: e.target.value })}
                  placeholder="Enter the instructions provided by the doctor..."
                  required
                />

                <p className="form-hint">
                  AI-generated instructions must be reviewed by a qualified clinician.
                </p>

                <div className="form-actions">
                  <button type="button" onClick={() => setView("home")}>Cancel</button>
                  <button className="primary-button" type="submit" disabled={loading}>
                    {loading ? "Creating..." : "Create record"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {view === "records" && !isPatient && (
            <section className="panel">
              <div className="page-heading">
                <div>
                  <h2>Patient records</h2>
                  <p>Process instructions and review approval status.</p>
                </div>
                <button className="primary-button" onClick={() => setView("create")}>
                  + New record
                </button>
              </div>

              <div className="record-toolbar">
                <input
                  aria-label="Search records"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search record, patient ID, doctor ID..."
                />
                <button onClick={loadRecords} disabled={loading}>Refresh</button>
              </div>

              {filteredRecords.length === 0 && <p>No matching records found.</p>}

              {filteredRecords.map((record) => (
                <article className="record-card" key={record.id}>
                  <div className="record-card-heading">
                    <h3>Discharge record #{record.id}</h3>
                    <span className={`status ${record.approved ? "approved" : "pending"}`}>
                      {record.approved ? "Approved" : "Pending approval"}
                    </span>
                  </div>

                  <div className="record-meta">
                    <span>Patient ID: <strong>{record.patientId}</strong></span>
                    <span>Doctor ID: <strong>{record.doctorId}</strong></span>
                  </div>

                  <div className="instruction-block">
                    <h4>Original instructions</h4>
                    <p>{record.originalInstructions || "Not entered"}</p>
                  </div>

                  <div className="instruction-block">
                    <h4>AI simplification — English</h4>
                    <p>{record.simplifiedInstructions || "Not generated yet"}</p>
                  </div>

                  <div className="instruction-block telugu-block">
                    <h4>Telugu translation</h4>
                    <p>{record.teluguInstructions || "Not translated yet"}</p>
                    {record.teluguInstructions && (
                      <button onClick={() => speakTelugu(record.teluguInstructions)}>
                        Listen in Telugu
                      </button>
                    )}
                  </div>

                  <div className="record-actions">
                    <button onClick={() => setSelectedRecord(record)}>View details</button>
                    <button
                      onClick={() => runRecordAction(record, "simplify")}
                      disabled={loading || record.approved}
                    >
                      Simplify with AI
                    </button>
                    <button
                      onClick={() => runRecordAction(record, "translate")}
                      disabled={loading || record.approved || !record.simplifiedInstructions}
                    >
                      Translate to Telugu
                    </button>
                    <button
                      onClick={() => runRecordAction(record, "validate")}
                      disabled={loading || record.approved || !record.simplifiedInstructions}
                    >
                      Validate
                    </button>
                    <button
                      onClick={() => runRecordAction(record, "approve")}
                      disabled={
                        loading ||
                        record.approved ||
                        !record.simplifiedInstructions ||
                        !record.teluguInstructions
                      }
                    >
                      {record.approved ? "Already approved" : "Approve"}
                    </button>
                  </div>
                </article>
              ))}

              {selectedRecord && (
                <section className="detail-panel">
                  <div className="panel-heading">
                    <h3>Record #{selectedRecord.id}</h3>
                    <button onClick={() => setSelectedRecord(null)}>Close</button>
                  </div>
                  <p><strong>Original:</strong> {selectedRecord.originalInstructions}</p>
                  <p><strong>English:</strong> {selectedRecord.simplifiedInstructions || "Not generated"}</p>
                  <p><strong>Telugu:</strong> {selectedRecord.teluguInstructions || "Not translated"}</p>
                  <p><strong>Approved:</strong> {selectedRecord.approved ? "Yes" : "No"}</p>
                </section>
              )}
            </section>
          )}

          {view === "patient" && isPatient && (
            <section className="panel">
              <div className="page-heading">
                <div>
                  <h2>My discharge instructions</h2>
                  <p>Read or listen to instructions approved for you.</p>
                </div>
                <button onClick={loadPatientRecords} disabled={loading}>Refresh</button>
              </div>

              {patientRecords.length === 0 && (
                <div className="empty-state">
                  <h3>No approved instructions yet</h3>
                  <p>Approved instructions for your patient ID will appear here.</p>
                </div>
              )}

              {patientRecords.map((record) => (
                <article className="record-card" key={record.id}>
                  <h3>Discharge record #{record.id}</h3>
                  <div className="instruction-block">
                    <h4>Easy-to-read English</h4>
                    <p>{record.simplifiedInstructions || "Not available"}</p>
                  </div>
                  <div className="instruction-block telugu-block">
                    <h4>తెలుగు సూచనలు</h4>
                    <p>{record.teluguInstructions || "Not available"}</p>
                    <button
                      onClick={() => speakTelugu(record.teluguInstructions)}
                      disabled={!record.teluguInstructions}
                    >
                      Listen in Telugu
                    </button>
                  </div>
                  <p className="patient-note">
                    If anything is unclear, contact your healthcare team.
                  </p>
                </article>
              ))}
            </section>
          )}
        </section>
      </div>
    </main>
  );
}

export default App;