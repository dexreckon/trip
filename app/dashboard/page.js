"use client";
import { useEffect, useState } from "react";
import { api, dateTime, useSession } from "../../lib/client";
import { daysRemaining, money } from "../../lib/domain.mjs";
import Nav from "../../components/Nav";
export default function Dashboard() {
  const { session, loading, error: authError } = useSession();
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [updated, setUpdated] = useState(null),
    [qr, setQr] = useState(""),
    [now, setNow] = useState(Date.now()),
    [busy, setBusy] = useState(false),
    [emergencyForm, setEmergencyForm] = useState(false),
    [message, setMessage] = useState(""),
    [shareLocation, setShareLocation] = useState(true),
    [delivery, setDelivery] = useState("");
  async function refresh() {
    try {
      const d = await api("/api/student");
      setData(d);
      setUpdated(new Date());
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    if (!session) return;
    let alive = true;
    async function poll() {
      try {
        const d = await api("/api/student");
        if (alive) {
          setData(d);
          setUpdated(new Date());
          setError("");
        }
      } catch (e) {
        if (alive) setError(e.message);
      }
    }
    poll();
    const t = setInterval(() => {
      setNow(Date.now());
      if (!document.hidden) poll();
    }, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [session?.user.id]);
  useEffect(() => {
    let alive = true;
    if (data?.registration?.ticket_token) {
      import("qrcode")
        .then((m) =>
          (m.default || m).toDataURL(
            `${location.origin}/admin?ticket=${data.registration.ticket_token}`,
            {
              width: 280,
              margin: 3,
              errorCorrectionLevel: "M",
              color: { dark: "#203c32", light: "#ffffff" },
            },
          ),
        )
        .then((url) => {
          if (alive) setQr(url);
        })
        .catch(() => {
          if (alive)
            setError(
              "Your QR image could not load. Refresh or use the pass code below.",
            );
        });
    }
    return () => {
      alive = false;
    };
  }, [data?.registration?.ticket_token]);
  async function emergency(e) {
    e.preventDefault();
    setBusy(true);
    setDelivery("");
    let coordinates = {
      latitude: null,
      longitude: null,
      accuracy: null,
      location_at: null,
    };
    if (shareLocation && navigator.geolocation) {
      setDelivery("Requesting your current location…");
      try {
        const p = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0,
          }),
        );
        coordinates = {
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
          location_at: new Date(p.timestamp).toISOString(),
        };
      } catch {}
    }
    setDelivery("Sending your request…");
    try {
      const r = await api("/api/emergency", {
        message: message || "I need assistance on the hiking trip.",
        ...coordinates,
      });
      setDelivery(
        `${r.existing ? "Your existing request is active." : "Your request is saved in the admin dashboard."} ${r.emailSent ? "Organizer email accepted for delivery." : "Organizer email could not be sent; the dashboard alert is saved."} ${r.alert.latitude === null ? "No GPS location was included." : ""} This does not mean an organizer has seen it yet. Call if you need immediate help.`,
      );
      setEmergencyForm(false);
      await refresh();
    } catch (e) {
      setDelivery(
        e.message +
          " If the connection is unavailable, use the organizer phone number below.",
      );
    } finally {
      setBusy(false);
    }
  }
  const r = data?.registration,
    trip = data?.trip,
    active = data?.emergencies?.find((a) => a.status !== "resolved"),
    days = daysRemaining(trip?.departure_at, now);
  return (
    <>
      <Nav admin={data?.isAdmin} />
      <main className="portal">
        <div className="page-heading">
          <div>
            <div className="eyebrow">YOUR TRAIL COMPANION</div>
            <h1>
              {r ? `Hey, ${r.full_name.split(" ")[0]}` : "My trip"}
              <span>.</span>
            </h1>
            <p className="muted">Everything you need before the first step.</p>
          </div>
          {updated && (
            <small className="sync">
              Updated {updated.toLocaleTimeString()}
              <br />
              Refreshes every 10 seconds while open
            </small>
          )}
        </div>
        {loading ? (
          <p>Loading your account…</p>
        ) : !session ? (
          <section className="card">
            <h2>Your adventure awaits</h2>
            <p className="muted">
              Sign in to see your registration, QR pass and trip updates.
            </p>
            <a className="button-link" href="/login">
              Sign in →
            </a>
            {authError && <p className="error">{authError}</p>}
          </section>
        ) : (
          <>
            {error && (
              <p role="alert" className="notice-inline error">
                {error}{" "}
                <button className="text-button" onClick={refresh}>
                  Retry
                </button>
              </p>
            )}
            {data && (
              <>
                <section className="trip-banner">
                  <div>
                    <div className="eyebrow">UP NEXT</div>
                    <h2>{trip.name}</h2>
                    <p>{trip.location}</p>
                    <span>{dateTime(trip.departure_at)}</span>
                  </div>
                  <div className="countdown">
                    <strong>{days === null ? "—" : days}</strong>
                    <span>
                      {days === 0 ? "Departure day or underway" : "days to go"}
                    </span>
                  </div>
                </section>
                {!r ? (
                  <section className="card">
                    <h2>
                      {data.isAdmin
                        ? "Welcome, organizer"
                        : "You haven’t registered yet"}
                    </h2>
                    <p className="muted">
                      {data.isAdmin
                        ? "Open the organizer desk to configure the trip and manage registrations."
                        : "Complete your details and upload your payment proof to join this trip."}
                    </p>
                    <a
                      className="button-link"
                      href={data.isAdmin ? "/admin" : "/"}
                    >
                      {data.isAdmin
                        ? "Open organizer desk →"
                        : "Register for the trip →"}
                    </a>
                  </section>
                ) : (
                  <div className="dashboard-grid">
                    <div>
                      <section className="card pass-card">
                        <div className="record-head">
                          <h2>Your trail pass</h2>
                          <span className={`badge ${r.status}`}>
                            {r.status}
                          </span>
                        </div>
                        <p className="muted">
                          {r.status === "approved"
                            ? "Payment approved. Show your QR code at departure and at each checkpoint."
                            : r.status === "pending"
                              ? "Your payment is pending admin approval. Attendance becomes available once approved."
                              : "Your payment was not approved. Contact the organizer to resolve it."}
                        </p>
                        {!r.receipt_ready && (
                          <p className="error">
                            Receipt processing is incomplete. Contact your
                            organizer; do not pay again.
                          </p>
                        )}
                        <div className="pass-content">
                          {qr ? (
                            <img
                              src={qr}
                              width="224"
                              height="224"
                              alt="Your personal trip QR pass"
                            />
                          ) : (
                            <div className="qr-placeholder">
                              Generating your QR pass…
                            </div>
                          )}
                          <div>
                            <h3>{r.full_name}</h3>
                            <p>{r.roll_number}</p>
                            <p className="muted">
                              Trip fee: {money(r.fee_paisa)}
                            </p>
                            {qr && (
                              <a
                                className="underlined"
                                download="my-trail-pass.png"
                                href={qr}
                              >
                                Download QR pass ↓
                              </a>
                            )}
                          </div>
                        </div>
                        <details>
                          <summary>
                            Pass code and registration reference
                          </summary>
                          <p className="code-text">Pass: {r.ticket_token}</p>
                          <p className="code-text">Reference: {r.id}</p>
                        </details>
                        <p className="form-note">
                          Only signed-in organizers can verify this pass. Keep
                          it private.
                        </p>
                      </section>
                      <section className="card section-space">
                        <h2>Your attendance</h2>
                        {data.attendance.length ? (
                          data.attendance.map((a) => (
                            <div className="activity-row" key={a.id}>
                              <span className="tiny-check">✓</span>
                              <div>
                                <strong>{a.checkpoints?.name}</strong>
                                <p className="muted">
                                  {dateTime(a.checked_in_at)}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="muted">
                            Your departure and checkpoint check-ins will appear
                            here.
                          </p>
                        )}
                      </section>
                    </div>
                    <div>
                      <section className="card emergency-card">
                        <div className="eyebrow">WE’RE HERE TO HELP</div>
                        <h2>Need assistance?</h2>
                        <p className="muted">
                          Lost, separated from the group, or having an issue?
                          Send your organizers a request.
                        </p>
                        {active && (
                          <div className="emergency-status">
                            <strong>
                              {active.status === "acknowledged"
                                ? "Organizer acknowledged your request"
                                : "Your request is waiting for acknowledgment"}
                            </strong>
                            <p>{active.message}</p>
                            <small>{dateTime(active.created_at)}</small>
                          </div>
                        )}
                        {!active && !emergencyForm && (
                          <button
                            className="danger full"
                            onClick={() => {
                              setEmergencyForm(true);
                              setDelivery("");
                            }}
                          >
                            Request emergency assistance
                          </button>
                        )}
                        {emergencyForm && (
                          <form onSubmit={emergency}>
                            <label>
                              What’s happening?
                              <textarea
                                required
                                minLength={2}
                                maxLength={1000}
                                placeholder="Tell us what happened or describe a nearby landmark…"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                              />
                            </label>
                            <label className="consent">
                              <input
                                type="checkbox"
                                checked={shareLocation}
                                onChange={(e) =>
                                  setShareLocation(e.target.checked)
                                }
                              />
                              <span>
                                Share my current GPS location with organizers in
                                the dashboard and email. If location is
                                unavailable, send the request without it.
                              </span>
                            </label>
                            <div className="actions">
                              <button className="danger" disabled={busy}>
                                {busy ? "Sending…" : "Send emergency alert"}
                              </button>
                              <button
                                type="button"
                                className="secondary"
                                disabled={busy}
                                onClick={() => setEmergencyForm(false)}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}
                        {delivery && (
                          <p role="status" className="notice-inline">
                            {delivery}
                          </p>
                        )}
                        <p className="muted small">
                          This alert needs internet and an organizer response.
                          GPS is captured once, only when you request it. If you
                          cannot send an alert, call the organizer.
                        </p>
                        {trip.organizer_phone ? (
                          <a
                            className="call-link"
                            href={`tel:${trip.organizer_phone.replace(/[^+\d]/g, "")}`}
                          >
                            Call organizer · {trip.organizer_phone}
                          </a>
                        ) : (
                          <p className="error">
                            Organizer phone number has not been configured.
                          </p>
                        )}
                      </section>
                      <section className="card section-space">
                        <div className="eyebrow">FROM YOUR ORGANIZERS</div>
                        <h2>Trip updates</h2>
                        {data.announcements.length ? (
                          data.announcements.map((a) => (
                            <article className="announcement" key={a.id}>
                              {a.priority === "important" && (
                                <span className="badge pending">Important</span>
                              )}
                              <h3>{a.title}</h3>
                              <p className="preserve-lines">{a.message}</p>
                              <small className="muted">
                                {dateTime(a.created_at)}
                              </small>
                            </article>
                          ))
                        ) : (
                          <p className="muted">
                            No announcements yet. Updates and changes to the
                            plan will appear here.
                          </p>
                        )}
                      </section>
                    </div>
                  </div>
                )}
              </>
            )}
            {!data && !error && <p>Loading your trip…</p>}
          </>
        )}
      </main>
    </>
  );
}
