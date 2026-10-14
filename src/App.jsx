import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_BASE_URL || "https://mediguide-backend-1sn3.onrender.com/api";

const authHeaders = (token, extra = {}) => ({
  ...extra,
  Authorization: `Bearer ${token}`,
});

function App() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");

  const [user, setUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem("medisecure_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [loggedIn, setLoggedIn] = useState(() => {
    try {
      return !!sessionStorage.getItem("medisecure_user");
    } catch {
      return false;
    }
  });

  const [demoRole, setDemoRole] = useState(null);

  const [view, setView] = useState(() => {
    try {
      const savedUser = sessionStorage.getItem("medisecure_user");
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        const savedView = sessionStorage.getItem("medisecure_view");
        if (savedView) return savedView;
        return parsed.role === "PATIENT" ? "patient" : "home";
      }
    } catch {}
    return "home";
  });

  const changeView = (newView) => {
    setView(newView);
    try {
      sessionStorage.setItem("medisecure_view", newView);
    } catch {}
  };


  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordsMessage, setRecordsMessage] = useState("");

  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientsMessage, setPatientsMessage] = useState("");

  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dischargeMessage, setDischargeMessage] = useState("");

  const [record, setRecord] = useState(null);
  const [processingMessage, setProcessingMessage] = useState("");

  const [patientRecords, setPatientRecords] = useState([]);
  const [patientMessage, setPatientMessage] = useState("");

  // Load discharge records for the doctor
  const loadRecords = async () => {
    if (!user?.token) {
      setRecordsMessage("Please log in again.");
      return;
    }

    setLoadingRecords(true);
    setRecordsMessage("");

    try {
      const response = await fetch(`${API}/discharge`, {
        headers: authHeaders(user.token),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      setRecords(data);

      if (data.length === 0) {
        setRecordsMessage("No discharge records found.");
      }
    } catch (error) {
      setRecordsMessage(`Could not load records: ${error.message}`);
    } finally {
      setLoadingRecords(false);
    }
  };

  // Refresh records when the records page opens
  useEffect(() => {
    if (loggedIn && user?.role === "DOCTOR" && view === "records") {
      loadRecords();
    }
  }, [loggedIn, user, view]);

  
  // Load registered patients
  const loadPatients = async () => {
    if (!user?.token) {
      setPatientsMessage("Please log in again.");
      return;
    }

    setLoadingPatients(true);
    setPatientsMessage("");

    try {
      const response = await fetch(`${API}/patients`, {
        headers: authHeaders(user.token),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      setPatients(Array.isArray(data) ? data : []);

      if (!Array.isArray(data) || data.length === 0) {
        setPatientsMessage("No registered patients found.");
      }
    } catch (error) {
      setPatientsMessage(`Could not load patients: ${error.message}`);
    } finally {
      setLoadingPatients(false);
    }
  };

  // Load patients when the Patients page opens
  useEffect(() => {
    if (loggedIn && user?.role === "DOCTOR" && view === "patients") {
      loadPatients();
    }
  }, [loggedIn, user, view]);

  // Load instructions automatically for the logged-in patient
  useEffect(() => {
    if (loggedIn && user?.role === "PATIENT" && view === "patient") {
      loadPatientRecords();
    }
  }, [loggedIn, user, view]);
  
  // Load discharge records for the logged-in patient
  const loadPatientRecords = async () => {
    if (!user?.token || !user?.id) {
      setPatientMessage("Please log in again.");
      return;
    }

    setPatientMessage("Loading instructions...");

    try {
      const response = await fetch(
        `${API}/discharge/patient/${user.id}`,
        {
          headers: authHeaders(user.token),
        }
      );

      const resultText = await response.text();

      if (!response.ok) {
        throw new Error(
          `Server returned ${response.status}: ${resultText}`
        );
      }

      const data = JSON.parse(resultText);

      console.log("Logged-in patient:", user.id);
      console.log("Discharge records returned by API:", data);

      if (!Array.isArray(data)) {
        throw new Error("Expected a list of discharge records.");
      }

      const approved = data.filter(
        (item) => item.approved === true
      );

      setPatientRecords(approved);

      setPatientMessage(
        approved.length === 0
          ? `No approved instructions found for patient ID ${user.id}. API returned ${data.length} record(s).`
          : ""
      );
    } catch (error) {
      setPatientRecords([]);
      setPatientMessage(
        `Could not load instructions: ${error.message}`
      );
    }
  };
  // Login and registration
  const handleSubmit = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password || !role) {
      setMessage("Please fill all fields.");
      return;
    }

    if (isRegister) {
      if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
        setMessage("Please enter a valid email address.");
        return;
      }
      if (password.length < 8) {
        setMessage("Password must be at least 8 characters long.");
        return;
      }
    }

    const endpoint = isRegister ? "register" : "login";

    try {
      const response = await fetch(
        `${API}/auth/${endpoint}?email=${encodeURIComponent(
          cleanEmail
        )}&password=${encodeURIComponent(password)}&role=${encodeURIComponent(
          role
        )}`,
        { method: "POST" }
      );

      const resultText = await response.text();
      let responseData = null;
      try {
        responseData = JSON.parse(resultText);
      } catch {}

      if (!response.ok) {
        const errorMsg =
          (responseData && (responseData.message || responseData.error)) ||
          resultText ||
          (isRegister
            ? "Registration failed. Email may already exist."
            : "Invalid email, password, or role.");
        setMessage(errorMsg);
        return;
      }

      if (isRegister) {
        setMessage("Registration successful! You can now log in.");
        setIsRegister(false);
        setPassword("");
        setRole("");
      } else {
        const userData = responseData;
        setUser(userData);
        setLoggedIn(true);
        const targetView = userData.role === "PATIENT" ? "patient" : "home";
        changeView(targetView);
        try {
          sessionStorage.setItem("medisecure_user", JSON.stringify(userData));
          sessionStorage.setItem("medisecure_view", targetView);
        } catch {}
        setMessage("");
      }
    } catch {
      setMessage("Cannot connect to backend. Check network or backend server.");
    }
  };


  // Create a discharge record
  const createDischarge = async () => {
    const finalDoctorId = doctorId || (user?.id ? String(user.id) : "1");
    if (!patientId || !finalDoctorId || !instructions.trim()) {
      setDischargeMessage("Please fill all fields.");
      return;
    }

    if (!user?.token) {
      setDischargeMessage("Please log in again.");
      return;
    }

    try {
      const response = await fetch(`${API}/discharge`, {
        method: "POST",
        headers: authHeaders(user.token, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          patientId: Number(patientId),
          doctorId: Number(finalDoctorId),
          originalInstructions: instructions.trim(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Server returned ${response.status}: ${errorText}`
        );
      }

      const data = await response.json();

      setRecord(data);
      setProcessingMessage("");
      setDischargeMessage(`Record #${data.id} created.`);
      setPatientId("");
      setDoctorId("");
      setInstructions("");
      changeView("detail");
    } catch (error) {
      setDischargeMessage(
        `Could not create record: ${error.message}`
      );
    }
  };

  // Open a selected record
  const openRecord = (selectedRecord) => {
    setRecord(selectedRecord);
    setProcessingMessage("");
    changeView("detail");
  };


  // Simplify, translate, validate, or approve a record
  const runRecordAction = async (action, method = "POST") => {
    if (!record?.id) {
      setProcessingMessage("Select a discharge record first.");
      return;
    }

    if (!user?.token) {
      setProcessingMessage("Please log in again.");
      return;
    }

    const messages = {
      simplify: "Simplifying instructions with AI...",
      translate: "Translating instructions to Telugu...",
      validate: "Validating instructions...",
      approve: "Approving discharge instructions...",
    };

    if (
      action === "translate" &&
      !record.simplifiedInstructions?.trim()
    ) {
      setProcessingMessage("Please simplify the instructions first.");
      return;
    }

    if (
      action === "approve" &&
      (!record.simplifiedInstructions?.trim() ||
        !record.teluguInstructions?.trim())
    ) {
      setProcessingMessage(
        "Generate the simplified and Telugu instructions before approval."
      );
      return;
    }

    setProcessingMessage(messages[action] || "Processing...");

    try {
      const response = await fetch(
        `${API}/discharge/${record.id}/${action}`,
        {
          method,
          headers: authHeaders(user.token),
        }
      );

      const resultText = await response.text();

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${resultText}`
        );
      }

      // Validation currently returns plain text
      if (action === "validate") {
        setProcessingMessage(resultText);
        return;
      }

      const updatedRecord = JSON.parse(resultText);

      setRecord(updatedRecord);

      setRecords((previous) =>
        previous.map((item) =>
          item.id === updatedRecord.id ? updatedRecord : item
        )
      );

      setPatientMessage("");

      setProcessingMessage(
        action === "simplify"
          ? "AI simplification completed."
          : action === "translate"
          ? "Telugu translation completed."
          : "Discharge instructions approved successfully."
      );

      // Refresh doctor records after approval
      if (action === "approve") {
        await loadRecords();
        setRecord(updatedRecord);
      }
    } catch (error) {
      setProcessingMessage(`Action failed: ${error.message}`);
    }
  };

  // Telugu speech output
  const speakTelugu = (textToSpeak, approved = true) => {
    if (!approved) {
      setProcessingMessage(
        "Only approved instructions can be played."
      );
      return;
    }

    if (!textToSpeak?.trim()) {
      setProcessingMessage(
        "Telugu instructions are not available."
      );
      return;
    }

    if (!("speechSynthesis" in window)) {
      setProcessingMessage(
        "Speech output is not supported by this browser."
      );
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = "te-IN";
    window.speechSynthesis.speak(utterance);

    setProcessingMessage("Playing Telugu instructions.");
  };

  // Logout
  const logout = () => {
    window.speechSynthesis?.cancel();

    try {
      sessionStorage.removeItem("medisecure_user");
      sessionStorage.removeItem("medisecure_view");
    } catch {}

    setLoggedIn(false);
    setUser(null);
    changeView("home");
    setRecords([]);
    setPatients([]);
    setRecord(null);
    setPatientRecords([]);
    setProcessingMessage("");
    setRecordsMessage("");
    setPatientsMessage("");
    setPatientMessage("");
    setDischargeMessage("");
    setMessage("");
    setEmail("");
    setPassword("");
    setRole("");
  };

  // Switch between login and registration
  const switchMode = () => {
    setIsRegister((previous) => !previous);
    setMessage("");
    setEmail("");
    setPassword("");
    setRole("");
  };

  // Doctor dashboard
  if (loggedIn && user?.role === "DOCTOR") {
    return (
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>MediSecure</h1>
            <p>Doctor Dashboard</p>
          </div>

          <button className="logout-button" onClick={logout}>
            Logout
          </button>
        </header>

        <main className="dashboard-content">
          <section className="welcome-card">
            <h2>Welcome, Doctor 👨‍⚕️</h2>
            <p>{user.email}</p>
          </section>

          {view === "home" && (
            <>
              <section className="feature-card">
                <h2>Patient-Friendly Discharge Instructions</h2>
                <p>
                  Create simple, understandable discharge
                  instructions for your patients.
                </p>

                <button
                  className="primary-button"
                  onClick={() => {
                    setDischargeMessage("");
                    setDoctorId(user?.id ? String(user.id) : "1");
                    loadPatients();
                    changeView("create");
                  }}
                >
                  Create Discharge Instructions
                </button>
              </section>

              <div className="feature-grid">
                <div
                  className="small-card"
                  role="button"
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                  onClick={() => changeView("patients")}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" ||
                      event.key === " "
                    ) {
                      event.preventDefault();
                      changeView("patients");
                    }
                  }}
                >
                  <h3>👤 Patients</h3>
                  <p>View registered patients and their IDs.</p>
                </div>

                <div
                  className="small-card"
                  role="button"
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                  onClick={() => changeView("records")}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" ||
                      event.key === " "
                    ) {
                      event.preventDefault();
                      changeView("records");
                    }
                  }}
                >
                  <h3>📋 Discharge Records</h3>
                  <p>View and select saved discharge instructions.</p>
                </div>
              </div>
            </>
          )}


          {view === "patients" && (
            <section className="feature-card">
              <h2>Registered Patients</h2>
              <p>View patient details and use their IDs to link discharge records.</p>

              <button
                className="primary-button"
                onClick={loadPatients}
                disabled={loadingPatients}
              >
                {loadingPatients ? "Loading..." : "Refresh Patients"}
              </button>

              {patientsMessage && (
                <p className="message">{patientsMessage}</p>
              )}

              {patients.map((patient) => (
                <div
                  className="small-card"
                  key={patient.id ?? patient.patientId}
                  style={{ marginTop: "16px" }}
                >
                  <h3>{patient.fullName || patient.name || "Unnamed Patient"}</h3>
                  <p>
                    <strong>Patient ID:</strong>{" "}
                    {patient.id ?? patient.patientId ?? "Not available"}
                  </p>
                  <p>
                    <strong>Email:</strong>{" "}
                    {patient.email || "Not available"}
                  </p>
                  <p>
                    <strong>Phone:</strong>{" "}
                    {patient.phone || patient.phoneNumber || "Not available"}
                  </p>
                  <p>
                    <strong>Date of Birth:</strong>{" "}
                    {patient.dateOfBirth || "Not available"}
                  </p>
                </div>
              ))}

              <button
                className="logout-button"
                style={{ marginTop: "20px" }}
                onClick={() => changeView("home")}
              >
                Back to Dashboard
              </button>

            </section>
          )}

          {view === "records" && (
            <section className="feature-card">
              <h2>Discharge Records</h2>

              <button
                className="primary-button"
                onClick={loadRecords}
                disabled={loadingRecords}
              >
                {loadingRecords ? "Loading..." : "Refresh Records"}
              </button>

              {recordsMessage && (
                <p className="message">{recordsMessage}</p>
              )}

              {records.map((item) => (
                <div
                  className="small-card"
                  key={item.id}
                  style={{ marginTop: "16px" }}
                >
                  <h3>Record #{item.id}</h3>
                  <p>Patient ID: {item.patientId}</p>
                  <p>Doctor ID: {item.doctorId}</p>
                  <p>
                    Status: {item.approved ? "Approved" : "Pending"}
                  </p>

                  <p style={{ whiteSpace: "pre-wrap" }}>
                    {item.originalInstructions}
                  </p>

                  <button
                    className="primary-button"
                    style={{ marginTop: "12px" }}
                    onClick={() => openRecord(item)}
                  >
                    Open Record #{item.id}
                  </button>
                </div>
              ))}

              <button
                className="logout-button"
                style={{ marginTop: "20px" }}
                onClick={() => changeView("home")}
              >
                Back to Dashboard
              </button>
            </section>
          )}

          {view === "create" && (
            <section className="feature-card">
              <h2>Create Discharge Instructions</h2>

              
<select
  className="input-box"
  value={patientId}
  onChange={(event) => setPatientId(event.target.value)}
>
  <option value="">Select Patient</option>
  {patients.map((patient) => (
    <option key={patient.id} value={patient.id}>
      {patient.email} (ID: {patient.id})
    </option>
  ))}
</select>
              <input
                className="input-box"
                type="number"
                placeholder="Doctor ID"
                value={doctorId || (user?.id ? String(user.id) : "")}
                onChange={(event) => setDoctorId(event.target.value)}
              />

              <textarea
                className="input-box"
                rows={7}
                placeholder="Enter doctor's discharge instructions"
                value={instructions}
                onChange={(event) =>
                  setInstructions(event.target.value)
                }
              />

              <button
                className="primary-button"
                onClick={createDischarge}
              >
                Save Discharge Instructions
              </button>

              <button
                className="logout-button"
                style={{ marginLeft: "10px" }}
                onClick={() => changeView("home")}
              >
                Cancel
              </button>


              {dischargeMessage && (
                <p className="message">{dischargeMessage}</p>
              )}
            </section>
          )}

          {view === "detail" && record && (
            <section className="feature-card">
              <h2>Discharge Record #{record.id}</h2>
              <p>Patient ID: {record.patientId}</p>
              <p>Doctor ID: {record.doctorId}</p>
              <p>
                Status: {record.approved ? "Approved" : "Pending"}
              </p>

              <hr />

              <h3>Original Instructions</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>
                {record.originalInstructions}
              </p>

              <hr />

              <h3>AI Simplified Instructions</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>
                {record.simplifiedInstructions || "Not generated yet."}
              </p>

              <button
                className="primary-button"
                onClick={() => runRecordAction("simplify")}
              >
                🤖 AI Simplify
              </button>

              <hr />

              <h3>Telugu Instructions</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>
                {record.teluguInstructions || "Not translated yet."}
              </p>

              <button
                className="primary-button"
                onClick={() => runRecordAction("translate")}
              >
                🌐 Translate to Telugu
              </button>

              <hr />

              <button
                className="primary-button"
                onClick={() => runRecordAction("validate")}
              >
                ✓ Validate
              </button>

              <button
                className="primary-button"
                style={{ marginLeft: "10px" }}
                disabled={record.approved}
                onClick={() => runRecordAction("approve", "PUT")}
              >
                ✓ {record.approved ? "Approved" : "Approve"}
              </button>

              {record.approved && (
                <button
                  className="primary-button"
                  style={{ marginLeft: "10px" }}
                  onClick={() =>
                    speakTelugu(
                      record.teluguInstructions,
                      record.approved
                    )
                  }
                >
                  🔊 Listen to Telugu
                </button>
              )}

              {processingMessage && (
                <p className="message">{processingMessage}</p>
              )}

              <button
                className="logout-button"
                style={{ marginTop: "20px" }}
                onClick={() => {
                  setRecord(null);
                  changeView("records");
                }}
              >
                Back to Records
              </button>

            </section>
          )}
        </main>
      </div>
    );
  }

  // Patient dashboard
  if (loggedIn && user?.role === "PATIENT") {
    return (
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>MediSecure</h1>
            <p>Patient Dashboard</p>
          </div>

          <button className="logout-button" onClick={logout}>
            Logout
          </button>
        </header>

        <main className="dashboard-content">
          <section className="welcome-card">
            <h2>Welcome 👋</h2>
            <p>{user.email}</p>
          </section>

          <section className="feature-card">
            <h2>My Approved Discharge Instructions</h2>

            <button
              className="primary-button"
              onClick={loadPatientRecords}
            >
              Refresh Instructions
            </button>

            {patientMessage && (
              <p className="message">{patientMessage}</p>
            )}

            {patientRecords.map((item) => (
              <div
                className="small-card"
                key={item.id}
                style={{ marginTop: "16px" }}
              >
                <h3>Discharge Record #{item.id}</h3>

                <p style={{ whiteSpace: "pre-wrap" }}>
                  {item.simplifiedInstructions ||
                    item.originalInstructions}
                </p>

                {item.teluguInstructions && (
                  <>
                    <h3 style={{ marginTop: "16px" }}>
                      తెలుగు సూచనలు
                    </h3>

                    <p style={{ whiteSpace: "pre-wrap" }}>
                      {item.teluguInstructions}
                    </p>

                    <button
                      className="primary-button"
                      style={{ marginTop: "12px" }}
                      onClick={() =>
                        speakTelugu(
                          item.teluguInstructions,
                          item.approved
                        )
                      }
                    >
                      🔊 Listen
                    </button>
                  </>
                )}
              </div>
            ))}
          </section>
        </main>
      </div>
    );
  }

  // Login / registration page
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="logo">MediSecure</div>

        <div className="subtitle">
          Secure Medical Records &amp; Patient-Friendly Care
        </div>

        <h2 className="login-title">
          {isRegister ? "Create Account" : "Login"}
        </h2>

        <input
          className="input-box"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <input
          className="input-box"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <select
          className="role-select"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        >
          <option value="">Select Role</option>
          <option value="PATIENT">Patient</option>
          <option value="DOCTOR">Doctor</option>
        </select>

        <button
  type="button"
  className="login-button"
  onClick={() => {
    console.log("Login button clicked");
    handleSubmit();
  }}
>
          {isRegister ? "Register" : "Login"}
        </button>

        {message && <p className="message">{message}</p>}

        <div className="register-text">
          {isRegister
            ? "Already have an account?"
            : "Don't have an account?"}

          <span className="register-link" onClick={switchMode}>
            {isRegister ? " Login" : " Register"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;