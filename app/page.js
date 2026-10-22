"use client";
import { useEffect, useState } from "react";
import { api, dateTime, useSession } from "../lib/client";
import { money } from "../lib/domain.mjs";
import Nav from "../components/Nav";
export default function Home() {
  const { session, loading } = useSession();
  const [trip, setTrip] = useState(null),
    [step, setStep] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState(null);
  useEffect(() => {
    fetch("/api/trip")
      .then((r) => r.json())
      .then((d) => {
        if (d.trip) setTrip(d.trip);
      })
      .catch(() => {});
  }, []);
  async function submit(e) {
    e.preventDefault();
    setError("");
    if (step === 1) {
      setStep(2);
      return;
    }
    setBusy(true);
    try {
      setResult(await api("/api/register", new FormData(e.currentTarget)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Nav />
      <main className="shell">
        <section className="hero">
          <div className="eyebrow">LEAVE THE ORDINARY BEHIND</div>
          <h1>
            {trip?.name || "Into the mountains"}
            <span>.</span>
          </h1>
          <p className="intro">
            {trip?.description ||
              "A little less screen time. A little more skyline. Join your university crew for a day on the trail."}
          </p>
          <div
            className="landscape"
            role="img"
            aria-label="Illustrated mountains under a golden sun"
          >
            <div className="sun" />
            <div className="mountain back" />
            <div className="mountain front" />
            <span className="trail-label">GOOD PEOPLE. GREAT HEIGHTS.</span>
          </div>
          <div className="facts">
            <div>
              <small>WHEN</small>
              {dateTime(trip?.departure_at)}
            </div>
            <div>
              <small>WHERE</small>
              {trip?.location || "To be announced"}
            </div>
            <div>
              <small>TRIP FEE</small>
              {trip?.fee_paisa ? money(trip.fee_paisa) : "To be announced"}
            </div>
          </div>
          <p className="footnote">Your next good story starts out here.</p>
        </section>
        <section className="card">
          {result ? (
            <div className="success">
              <span className="check">✓</span>
              <div className="eyebrow">YOU’RE ONE STEP CLOSER</div>
              <h2>Registration received.</h2>
              <p>
                Your payment is <strong>pending admin approval</strong>. Your
                place is confirmed only after the organizer approves your
                payment.
              </p>
              <p>
                {result.emailSent
                  ? "We’ve sent an acknowledgement to your email. Check your spam folder too."
                  : "Your registration is saved, but the acknowledgement email could not be sent. The organizer can retry it."}
              </p>
              <div className="reference">
                <small>REGISTRATION REFERENCE</small>
                {result.id}
              </div>
              <a className="button-link" href="/dashboard">
                Open my dashboard →
              </a>
            </div>
          ) : loading ? (
            <p>Loading your account…</p>
          ) : !session ? (
            <>
              <div className="eyebrow">THE TRAIL IS CALLING</div>
              <h2>Start your adventure</h2>
              <p className="muted">
                Create an account to register, keep your QR pass, receive trip
                updates and contact your organizers.
              </p>
              <a className="button-link" href="/login?mode=signup">
                Create your account →
              </a>
              <p className="muted">
                Already have an account?{" "}
                <a className="underlined" href="/login">
                  Sign in
                </a>
              </p>
            </>
          ) : !trip?.registrations_open ? (
            <>
              <h2>Registration opens soon</h2>
              <p className="muted">
                The organizer will publish trip and payment details here. If
                you’ve already registered, your dashboard is ready.
              </p>
              <a className="button-link" href="/dashboard">
                My dashboard →
              </a>
            </>
          ) : (
            <>
              <div className="eyebrow">THE TRAIL IS CALLING</div>
              <h2>Save your spot</h2>
              <p className="muted">
                Already registered?{" "}
                <a className="underlined" href="/dashboard">
                  Open your dashboard
                </a>
                .
              </p>
              <div className="steps">
                <span className={step === 1 ? "active" : ""}>
                  01 &nbsp; Your details
                </span>
                <span className={step === 2 ? "active" : ""}>
                  02 &nbsp; Payment
                </span>
              </div>
              <form onSubmit={submit}>
                <input
                  type="hidden"
                  name="expected_fee_paisa"
                  value={trip.fee_paisa}
                />
                <fieldset hidden={step !== 1}>
                  <div className="grid">
                    <label className="wide">
                      Full name
                      <input
                        name="full_name"
                        autoComplete="name"
                        required
                        minLength={3}
                        maxLength={100}
                        placeholder="As shown on your CNIC"
                      />
                    </label>
                    <label>
                      CNIC number
                      <input
                        name="cnic"
                        required
                        pattern="[0-9]{5}-?[0-9]{7}-?[0-9]"
                        placeholder="35202-1234567-1"
                        inputMode="numeric"
                      />
                    </label>
                    <label>
                      Roll number
                      <input
                        name="roll_number"
                        required
                        minLength={2}
                        maxLength={40}
                        placeholder="2024-CS-001"
                      />
                    </label>
                    <label className="wide">
                      Verified email
                      <input
                        type="email"
                        name="email"
                        value={session.user.email || ""}
                        readOnly
                        required
                      />
                    </label>
                    <label>
                      Your contact
                      <input
                        type="tel"
                        name="contact"
                        required
                        minLength={10}
                        maxLength={20}
                        placeholder="03XX XXXXXXX"
                      />
                    </label>
                    <label>
                      Emergency contact
                      <input
                        type="tel"
                        name="emergency_contact"
                        required
                        minLength={10}
                        maxLength={20}
                        placeholder="Parent or guardian’s number"
                      />
                    </label>
                  </div>
                </fieldset>
                <fieldset hidden={step !== 2} disabled={step !== 2}>
                  <div className="payment-box">
                    <small>PAYMENT INSTRUCTIONS</small>
                    <p>{trip.payment_details}</p>
                    <strong>{money(trip.fee_paisa)}</strong>
                  </div>
                  <label>
                    Transaction number
                    <input
                      name="transaction_number"
                      required
                      minLength={4}
                      maxLength={100}
                      placeholder="Reference from your payment"
                    />
                  </label>
                  <label className="upload">
                    Payment receipt
                    <span>Upload a clear screenshot or photo</span>
                    <input
                      name="proof"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      required
                      onChange={(e) => {
                        const f = e.target.files[0];
                        e.target.setCustomValidity(
                          f && f.size > 3145728
                            ? "Choose a file smaller than 3 MB."
                            : "",
                        );
                      }}
                    />
                    <small>JPG, PNG or WebP · Maximum 3 MB</small>
                  </label>
                  <label className="consent">
                    <input
                      type="checkbox"
                      name="consent"
                      value="yes"
                      required
                    />
                    <span>
                      I agree that the organizers may use my details and payment
                      proof to manage this trip and contact my emergency contact
                      if needed.
                    </span>
                  </label>
                </fieldset>
                {error && (
                  <p role="alert" className="error">
                    {error}
                  </p>
                )}
                <div className="actions">
                  {step === 2 && (
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() => setStep(1)}
                    >
                      Back
                    </button>
                  )}
                  <button disabled={busy} type="submit">
                    {busy
                      ? "Submitting…"
                      : step === 1
                        ? "Continue to payment →"
                        : "Submit registration →"}
                  </button>
                </div>
                <p className="form-note">
                  {step === 1
                    ? "Your details are only accessible to the trip organizers."
                    : "Payment is verified manually by the organizer."}
                </p>
              </form>
            </>
          )}
        </section>
      </main>
      <footer>
        TRAIL CLUB <span>A little adventure goes a long way.</span>
        <a href="/admin">Organizer desk ↗</a>
      </footer>
    </>
  );
}
