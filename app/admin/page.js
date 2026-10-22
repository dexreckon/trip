"use client";
import { useEffect, useState } from "react";
import { api, dateTime, useSession } from "../../lib/client";
import { money, rupeesToPaisa } from "../../lib/domain.mjs";
import Nav from "../../components/Nav";
import Scanner from "../../components/Scanner";
import TripSettings from "../../components/TripSettings";
const tabs = [
  ["overview", "Overview"],
  ["students", "Students"],
  ["attendance", "Attendance"],
  ["alerts", "Emergency alerts"],
  ["updates", "Announcements"],
  ["finances", "Finances"],
  ["settings", "Trip settings"],
];
export default function Admin() {
  const { session, loading, error: authError } = useSession();
  const [data, setData] = useState(null),
    [tab, setTab] = useState("overview"),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [ticket, setTicket] = useState(""),
    [verified, setVerified] = useState(null),
    [checkpoint, setCheckpoint] = useState(""),
    [synced, setSynced] = useState(null),
    [receipt, setReceipt] = useState(null);
  async function load() {
    const d = await api(
      `/api/admin?page=${page}&status=${filter}&search=${encodeURIComponent(search)}`,
    );
    setData(d);
    setSynced(new Date());
    setError("");
    return d;
  }
  useEffect(() => {
    const code = new URLSearchParams(location.search).get("ticket");
    if (code) {
      setTicket(code);
      setTab("attendance");
    }
  }, []);
  useEffect(() => {
    if (!session) return;
    let alive = true;
    const timer = setTimeout(() => {
      api(
        `/api/admin?page=${page}&status=${filter}&search=${encodeURIComponent(search)}`,
      )
        .then((d) => {
          if (alive) {
            setData(d);
            setSynced(new Date());
            setError("");
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [session?.user.id, page, filter, search]);
  useEffect(() => {
    if (!session) return;
    let alive = true;
    const timer = setInterval(async () => {
      if (document.hidden) return;
      try {
        const d = await api("/api/admin?view=alerts");
        if (alive) {
          setData((old) =>
            old ? { ...old, emergencies: d.emergencies } : old,
          );
          setSynced(new Date());
          setError("");
        }
      } catch (e) {
        if (alive) setError("Alert refresh failed: " + e.message);
      }
    }, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [session?.user.id]);
  async function action(payload, success = "Saved.") {
    setBusy(true);
    setMessage("");
    try {
      const r = await api("/api/admin", payload);
      setMessage(
        "emailSent" in r
          ? r.emailSent
            ? `${success} Email accepted for delivery.`
            : `${success} Email needs retry.`
          : success,
      );
      await load();
      return r;
    } catch (e) {
      setMessage(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const run = (p, m) => action(p, m).catch(() => {});
  async function verify(value = ticket) {
    setBusy(true);
    setVerified(null);
    setMessage("");
    setTicket(value);
    try {
      const r = await api("/api/admin", {
        action: "verify-ticket",
        ticket: value,
      });
      setVerified(r);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function openReceipt(row) {
    setBusy(true);
    try {
      const r = await api("/api/admin", { action: "receipt", id: row.id });
      setReceipt({ url: r.url, name: row.full_name });
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  const active = data?.emergencies.filter((e) => e.status !== "resolved") || [],
    summary = data?.summary;
  async function submitAnnouncement(e) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    try {
      await action(
        {
          action: "announcement",
          title: f.get("title"),
          message: f.get("message"),
          priority: f.get("priority"),
        },
        "Announcement published to student dashboards.",
      );
      form.reset();
    } catch {}
  }
  async function submitExpense(e) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    try {
      const amount = rupeesToPaisa(f.get("amount"));
      await action(
        {
          action: "expense",
          description: f.get("description"),
          amount_paisa: amount,
          spent_on: f.get("spent_on"),
        },
        "Expense recorded.",
      );
      form.reset();
    } catch (e) {
      setMessage(e.message);
    }
  }
  return (
    <>
      <Nav admin />
      <main className="portal admin-portal">
        <div className="page-heading">
          <div>
            <div className="eyebrow">ORGANIZER DESK</div>
            <h1>
              Good trips.
              <br />
              Well organized<span>.</span>
            </h1>
          </div>
          {session && (
            <button
              disabled={busy}
              className="secondary"
              onClick={() => load().catch((e) => setError(e.message))}
            >
              Refresh all data ↻
            </button>
          )}
        </div>
        {loading ? (
          <p>Loading your account…</p>
        ) : !session ? (
          <section className="card login">
            <h2>Organizer sign in</h2>
            <p className="muted">
              Sign in with your authorized organizer account.
            </p>
            <a
              className="button-link"
              href={`/login?next=admin${ticket ? "&ticket=" + encodeURIComponent(ticket) : ""}`}
            >
              Sign in →
            </a>
            {authError && <p className="error">{authError}</p>}
          </section>
        ) : (
          <>
            {error && (
              <p className="notice-inline error" role="alert">
                {error}
              </p>
            )}
            {!data && !error && <p>Loading organizer dashboard…</p>}
            {data && (
              <>
                {active.length > 0 && (
                  <button
                    className="alert-banner"
                    onClick={() => setTab("alerts")}
                  >
                    <strong>
                      {active.length} active assistance request
                      {active.length > 1 ? "s" : ""}
                    </strong>
                    <span>Review emergency alerts →</span>
                  </button>
                )}
                <div
                  className="tabbar"
                  role="tablist"
                  aria-label="Organizer sections"
                >
                  {tabs.map(([id, label]) => (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={tab === id}
                      className={tab === id ? "selected" : ""}
                      onClick={() => {
                        setTab(id);
                        setMessage("");
                      }}
                    >
                      {label}
                      {id === "alerts" &&
                        active.length > 0 &&
                        ` (${active.length})`}
                    </button>
                  ))}
                </div>
                <p className="sync">
                  Emergency alerts refresh every 10 seconds while this page is
                  open. Last update: {synced?.toLocaleTimeString() || "—"}.{" "}
                  <span>Use Refresh all data for other sections.</span>
                </p>
                {tab === "overview" && (
                  <>
                    <div className="metric-grid">
                      <Metric
                        value={summary.registered}
                        label="Registered students"
                      />
                      <Metric
                        value={summary.pending}
                        label="Payments to review"
                      />
                      <Metric
                        value={summary.approved}
                        label="Approved students"
                      />
                      <Metric
                        value={money(summary.collected_paisa)}
                        label="Approved payments"
                      />
                      <Metric
                        value={money(summary.expenses_paisa)}
                        label="Total expenses"
                      />
                      <Metric
                        value={money(
                          summary.collected_paisa - summary.expenses_paisa,
                        )}
                        label="Remaining balance"
                      />
                    </div>
                    <section className="trip-banner">
                      <div>
                        <div className="eyebrow">THE NEXT ADVENTURE</div>
                        <h2>{data.trip.name}</h2>
                        <p>{data.trip.location}</p>
                        <span>{dateTime(data.trip.departure_at)}</span>
                      </div>
                      <div>
                        <span className="badge approved">
                          {data.trip.registrations_open
                            ? "Registration open"
                            : "Registration closed"}
                        </span>
                        <p>{money(data.trip.fee_paisa)} / student</p>
                      </div>
                    </section>
                    <div className="dashboard-grid">
                      <section className="card">
                        <h2>Before you share the link</h2>
                        <p className="muted">
                          Set your trip details and payment account, add hiking
                          checkpoints, and test a registration and its emails.
                        </p>
                        <button onClick={() => setTab("settings")}>
                          Edit trip settings →
                        </button>
                      </section>
                      <section className="card">
                        <h2>Keep everyone together</h2>
                        <p className="muted">
                          Verify each student’s pass and record arrival at
                          departure and every hiking checkpoint.
                        </p>
                        <button
                          className="secondary"
                          onClick={() => setTab("attendance")}
                        >
                          Open attendance →
                        </button>
                      </section>
                    </div>
                  </>
                )}
                {tab === "students" && (
                  <>
                    <div className="toolbar">
                      <input
                        aria-label="Search students by name"
                        placeholder="Search student name…"
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(0);
                        }}
                      />
                      <select
                        aria-label="Filter payment status"
                        value={filter}
                        onChange={(e) => {
                          setFilter(e.target.value);
                          setPage(0);
                        }}
                      >
                        {["all", "pending", "approved", "rejected"].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      <span className="muted">{data.total} matching</span>
                    </div>
                    <div className="registrations">
                      {data.rows.length ? (
                        data.rows.map((r) => (
                          <article className="registration" key={r.id}>
                            <div className="record-head">
                              <h2>{r.full_name}</h2>
                              <span className={`badge ${r.status}`}>
                                {r.status}
                              </span>
                            </div>
                            <p className="muted">
                              {r.roll_number} · {dateTime(r.created_at)} ·{" "}
                              {money(r.fee_paisa)}
                            </p>
                            <dl>
                              <div>
                                <dt>Email</dt>
                                <dd>{r.email}</dd>
                              </div>
                              <div>
                                <dt>Contact</dt>
                                <dd>{r.contact}</dd>
                              </div>
                              <div>
                                <dt>Emergency contact</dt>
                                <dd>{r.emergency_contact}</dd>
                              </div>
                              <div>
                                <dt>CNIC</dt>
                                <dd>{r.cnic}</dd>
                              </div>
                              <div>
                                <dt>Transaction</dt>
                                <dd>{r.transaction_number}</dd>
                              </div>
                              <div>
                                <dt>Reference</dt>
                                <dd>{r.id}</dd>
                              </div>
                            </dl>
                            <div className="record-actions">
                              <button
                                className="secondary"
                                disabled={busy || !r.receipt_ready}
                                onClick={() => openReceipt(r)}
                              >
                                View receipt ↗
                              </button>
                              {r.status === "pending" && (
                                <>
                                  <button
                                    disabled={busy || !r.receipt_ready}
                                    onClick={() =>
                                      run(
                                        {
                                          action: "review",
                                          id: r.id,
                                          status: "approved",
                                        },
                                        "Payment approved.",
                                      )
                                    }
                                  >
                                    Approve payment
                                  </button>
                                  <button
                                    className="secondary"
                                    disabled={busy || !r.receipt_ready}
                                    onClick={() =>
                                      run(
                                        {
                                          action: "review",
                                          id: r.id,
                                          status: "rejected",
                                        },
                                        "Payment rejected.",
                                      )
                                    }
                                  >
                                    Reject payment
                                  </button>
                                </>
                              )}
                              {r.email_status !== r.status &&
                                r.receipt_ready && (
                                  <button
                                    className="secondary"
                                    disabled={busy}
                                    onClick={() =>
                                      run(
                                        { action: "retry-email", id: r.id },
                                        "Notification processed.",
                                      )
                                    }
                                  >
                                    Retry email
                                  </button>
                                )}
                            </div>
                            {!r.receipt_ready && (
                              <p className="error">
                                Receipt processing incomplete. Contact the
                                student before review.
                              </p>
                            )}
                            <small className="muted">
                              Email:{" "}
                              {r.email_status === r.status
                                ? "accepted for delivery"
                                : "needs retry"}
                            </small>
                          </article>
                        ))
                      ) : (
                        <section className="card">
                          <p>No matching students.</p>
                        </section>
                      )}
                    </div>
                    <div className="pagination">
                      <button
                        className="secondary"
                        disabled={page === 0 || busy}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        Previous
                      </button>
                      <span>
                        Page {page + 1} of{" "}
                        {Math.max(1, Math.ceil(data.total / 50))}
                      </span>
                      <button
                        className="secondary"
                        disabled={(page + 1) * 50 >= data.total || busy}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </>
                )}
                {tab === "attendance" && (
                  <>
                    <div className="dashboard-grid">
                      <section className="card">
                        <h2>Scan a student’s pass</h2>
                        <p className="muted">
                          Verify the name and roll number against their student
                          ID before recording attendance.
                        </p>
                        <Scanner onDetected={verify} />
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            verify();
                          }}
                        >
                          <label className="section-space">
                            QR link or pass code
                            <input
                              value={ticket}
                              required
                              onChange={(e) => {
                                setTicket(e.target.value);
                                setVerified(null);
                              }}
                              placeholder="Scan a QR code or paste its pass code"
                            />
                          </label>
                          <button disabled={busy}>Verify pass</button>
                        </form>
                        {verified && (
                          <div className="verified-pass">
                            <span
                              className={`badge ${verified.student.status}`}
                            >
                              {verified.student.status}
                            </span>
                            <h3>{verified.student.full_name}</h3>
                            <p>
                              {verified.student.roll_number} ·{" "}
                              {money(verified.student.fee_paisa)}
                            </p>
                            <label>
                              Check-in location
                              <select
                                value={checkpoint}
                                onChange={(e) => setCheckpoint(e.target.value)}
                              >
                                <option value="">Choose a checkpoint</option>
                                {data.checkpoints.map((c) => (
                                  <option value={c.id} key={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              disabled={
                                busy ||
                                !checkpoint ||
                                verified.student.status !== "approved" ||
                                !verified.student.receipt_ready
                              }
                              onClick={async () => {
                                try {
                                  const r = await action(
                                    {
                                      action: "check-in",
                                      ticket,
                                      checkpoint_id: checkpoint,
                                    },
                                    "Attendance processed.",
                                  );
                                  setMessage(
                                    r.already
                                      ? "Already checked in here; no duplicate was recorded."
                                      : "Attendance recorded.",
                                  );
                                  const fresh = await api("/api/admin", {
                                    action: "verify-ticket",
                                    ticket,
                                  });
                                  setVerified(fresh);
                                } catch {}
                              }}
                            >
                              Record attendance
                            </button>
                            {verified.student.status !== "approved" && (
                              <p className="error">
                                Payment must be approved before check-in.
                              </p>
                            )}
                            {verified.attendance.map((a) => (
                              <p className="small muted" key={a.id}>
                                ✓ {a.checkpoints?.name} ·{" "}
                                {dateTime(a.checked_in_at)}
                              </p>
                            ))}
                          </div>
                        )}
                      </section>
                      <section className="card">
                        <h2>Checkpoints</h2>
                        {data.checkpoints.map((c) => (
                          <div className="activity-row" key={c.id}>
                            <span className="tiny-check">⌖</span>
                            <strong>{c.name}</strong>
                          </div>
                        ))}
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const f = e.currentTarget;
                            try {
                              await action(
                                {
                                  action: "checkpoint",
                                  name: new FormData(f).get("name"),
                                },
                                "Checkpoint added.",
                              );
                              f.reset();
                            } catch {}
                          }}
                        >
                          <label className="section-space">
                            New checkpoint
                            <input
                              name="name"
                              required
                              minLength={2}
                              maxLength={100}
                              placeholder="e.g. Trail summit"
                            />
                          </label>
                          <button className="secondary" disabled={busy}>
                            Add checkpoint
                          </button>
                        </form>
                      </section>
                    </div>
                    <section className="card section-space">
                      <h2>Recent check-ins</h2>
                      <p className="muted small">
                        Latest 200 attendance records. Refresh all data to see
                        other organizers’ check-ins.
                      </p>
                      {data.attendance.length ? (
                        data.attendance.map((a) => (
                          <div className="activity-row" key={a.id}>
                            <span className="tiny-check">✓</span>
                            <div>
                              <strong>{a.registrations?.full_name}</strong>
                              <p className="muted">
                                {a.registrations?.roll_number} ·{" "}
                                {a.checkpoints?.name} ·{" "}
                                {dateTime(a.checked_in_at)}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="muted">No attendance recorded yet.</p>
                      )}
                    </section>
                  </>
                )}
                {tab === "alerts" && (
                  <>
                    <section className="section-intro">
                      <h2>Emergency requests</h2>
                      <p className="muted">
                        Acknowledge a request when someone is responding.
                        Resolve it only after checking on the student. Location
                        is a one-time snapshot, not live tracking.
                      </p>
                    </section>
                    {data.emergencies.length ? (
                      data.emergencies.map((a) => (
                        <section
                          className={`card section-space ${a.status === "open" ? "emergency-card" : ""}`}
                          key={a.id}
                        >
                          <div className="record-head">
                            <h2>{a.registrations?.full_name}</h2>
                            <span
                              className={`badge ${a.status === "resolved" ? "approved" : "pending"}`}
                            >
                              {a.status}
                            </span>
                          </div>
                          <p className="muted">
                            {a.registrations?.roll_number} ·{" "}
                            {dateTime(a.created_at)}
                          </p>
                          <p className="preserve-lines">{a.message}</p>
                          <div className="contact-actions">
                            <a
                              href={`tel:${(a.registrations?.contact || "").replace(/[^+\d]/g, "")}`}
                            >
                              Call student · {a.registrations?.contact}
                            </a>
                            <a
                              href={`tel:${(a.registrations?.emergency_contact || "").replace(/[^+\d]/g, "")}`}
                            >
                              Emergency contact ·{" "}
                              {a.registrations?.emergency_contact}
                            </a>
                          </div>
                          {a.latitude !== null ? (
                            <p>
                              <a
                                className="underlined"
                                target="_blank"
                                rel="noreferrer"
                                href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`}
                              >
                                Open reported location ↗
                              </a>
                              <br />
                              <small className="muted">
                                Captured {dateTime(a.location_at)} · accuracy
                                approximately {Math.round(a.accuracy || 0)} m
                              </small>
                            </p>
                          ) : (
                            <p className="error">
                              No GPS location supplied. Call the student for
                              their location.
                            </p>
                          )}
                          <div className="record-actions">
                            {a.status === "open" && (
                              <button
                                disabled={busy}
                                onClick={() =>
                                  run(
                                    {
                                      action: "emergency-status",
                                      id: a.id,
                                      status: "acknowledged",
                                    },
                                    "Request acknowledged.",
                                  )
                                }
                              >
                                Acknowledge request
                              </button>
                            )}
                            {a.status !== "resolved" && (
                              <button
                                disabled={busy}
                                className="secondary"
                                onClick={() =>
                                  run(
                                    {
                                      action: "emergency-status",
                                      id: a.id,
                                      status: "resolved",
                                    },
                                    "Request marked resolved.",
                                  )
                                }
                              >
                                Mark resolved
                              </button>
                            )}
                            {!a.email_sent && (
                              <button
                                disabled={busy}
                                className="secondary"
                                onClick={() =>
                                  run(
                                    {
                                      action: "retry-emergency-email",
                                      id: a.id,
                                    },
                                    "Emergency notification processed.",
                                  )
                                }
                              >
                                Retry organizer email
                              </button>
                            )}
                          </div>
                          <small className="muted">
                            Organizer email:{" "}
                            {a.email_sent
                              ? "accepted for delivery"
                              : "needs retry"}
                          </small>
                        </section>
                      ))
                    ) : (
                      <section className="card">
                        <h2>All quiet on the trail</h2>
                        <p className="muted">
                          Assistance requests will appear here.
                        </p>
                      </section>
                    )}
                    <p className="muted small">
                      Showing active requests and the latest 30 resolved
                      requests.
                    </p>
                  </>
                )}
                {tab === "updates" && (
                  <div className="dashboard-grid">
                    <section className="card">
                      <h2>Send a trip update</h2>
                      <p className="muted">
                        Published messages appear on every registered student’s
                        dashboard on its next refresh.
                      </p>
                      <form onSubmit={submitAnnouncement}>
                        <label>
                          Title
                          <input
                            name="title"
                            required
                            minLength={2}
                            maxLength={120}
                            placeholder="Departure delayed by 30 minutes"
                          />
                        </label>
                        <label>
                          Message
                          <textarea
                            name="message"
                            required
                            minLength={2}
                            maxLength={3000}
                            rows={5}
                          />
                        </label>
                        <label>
                          Priority
                          <select name="priority">
                            <option value="normal">Normal</option>
                            <option value="important">Important</option>
                          </select>
                        </label>
                        <button disabled={busy}>Publish announcement</button>
                      </form>
                    </section>
                    <section className="card">
                      <h2>Published updates</h2>
                      {data.announcements.length ? (
                        data.announcements.map((a) => (
                          <article className="announcement" key={a.id}>
                            <h3>{a.title}</h3>
                            <p className="preserve-lines">{a.message}</p>
                            <small className="muted">
                              {dateTime(a.created_at)} · {a.priority}
                            </small>
                            <p>
                              <button
                                className="text-button"
                                disabled={busy}
                                onClick={() => {
                                  if (
                                    confirm(
                                      "Remove this announcement from student dashboards?",
                                    )
                                  )
                                    run(
                                      {
                                        action: "delete-announcement",
                                        id: a.id,
                                      },
                                      "Announcement removed.",
                                    );
                                }}
                              >
                                Remove announcement
                              </button>
                            </p>
                          </article>
                        ))
                      ) : (
                        <p className="muted">No announcements yet.</p>
                      )}
                    </section>
                  </div>
                )}
                {tab === "finances" && (
                  <>
                    <div className="metric-grid three">
                      <Metric
                        label="Approved payments"
                        value={money(summary.collected_paisa)}
                      />
                      <Metric
                        label="Expenses"
                        value={money(summary.expenses_paisa)}
                      />
                      <Metric
                        label="Balance"
                        value={money(
                          summary.collected_paisa - summary.expenses_paisa,
                        )}
                      />
                    </div>
                    <p className="muted">
                      Collected money is the sum of the fixed fees on approved
                      registrations. Pending and rejected payments are excluded.
                      Verify the full fee against the bank or wallet statement
                      before approval.
                    </p>
                    <div className="dashboard-grid">
                      <section className="card">
                        <h2>Record an expense</h2>
                        <form onSubmit={submitExpense}>
                          <label>
                            Description
                            <input
                              name="description"
                              required
                              minLength={2}
                              maxLength={200}
                              placeholder="Bus rental, lunch, first-aid supplies…"
                            />
                          </label>
                          <label>
                            Amount (PKR)
                            <input
                              name="amount"
                              type="number"
                              required
                              min="0.01"
                              max="1000000"
                              step="0.01"
                            />
                          </label>
                          <label>
                            Date paid
                            <input
                              name="spent_on"
                              type="date"
                              required
                              defaultValue={new Date().toLocaleDateString(
                                "en-CA",
                                { timeZone: "Asia/Karachi" },
                              )}
                            />
                          </label>
                          <button disabled={busy}>Add expense</button>
                        </form>
                      </section>
                      <section className="card">
                        <h2>Expense history</h2>
                        <p className="muted small">
                          Latest 100 expenses. Totals include all records.
                        </p>
                        {data.expenses.length ? (
                          data.expenses.map((e) => (
                            <article className="expense-row" key={e.id}>
                              <div>
                                <strong>{e.description}</strong>
                                <p className="muted">{e.spent_on}</p>
                              </div>
                              <div>
                                <strong>{money(e.amount_paisa)}</strong>
                                <p>
                                  <button
                                    disabled={busy}
                                    className="text-button"
                                    onClick={() => {
                                      if (
                                        confirm(
                                          "Delete this expense? This will update the balance.",
                                        )
                                      )
                                        run(
                                          {
                                            action: "delete-expense",
                                            id: e.id,
                                          },
                                          "Expense removed.",
                                        );
                                    }}
                                  >
                                    Delete
                                  </button>
                                </p>
                              </div>
                            </article>
                          ))
                        ) : (
                          <p className="muted">No expenses recorded.</p>
                        )}
                      </section>
                    </div>
                  </>
                )}
                {tab === "settings" && (
                  <TripSettings
                    trip={data.trip}
                    busy={busy}
                    onSave={(trip) =>
                      action(
                        { action: "settings", trip },
                        "Trip settings saved.",
                      )
                    }
                  />
                )}
              </>
            )}
          </>
        )}
        {message && (
          <p role="status" className="notice">
            {message}
            <button
              className="dismiss"
              aria-label="Dismiss notification"
              onClick={() => setMessage("")}
            >
              ×
            </button>
          </p>
        )}
        {receipt && (
          <div className="modal-backdrop" onClick={() => setReceipt(null)}>
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Payment receipt"
              className="receipt-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="record-head">
                <h2>{receipt.name}’s receipt</h2>
                <button
                  autoFocus
                  className="secondary"
                  onClick={() => setReceipt(null)}
                >
                  Close
                </button>
              </div>
              <p className="muted">
                Compare the transaction and full fee against your bank/wallet
                statement.
              </p>
              <img
                src={receipt.url}
                alt={`Payment receipt for ${receipt.name}`}
              />
              <a
                href={receipt.url}
                target="_blank"
                rel="noreferrer"
                className="underlined"
              >
                Open full size ↗
              </a>
            </section>
          </div>
        )}
      </main>
    </>
  );
}
function Metric({ value, label }) {
  return (
    <div className="metric">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
