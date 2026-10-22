"use client";
import { useState } from "react";
import { rupeesToPaisa } from "../lib/domain.mjs";
function localPakistan(iso) {
  if (!iso) return "";
  const date = new Date(new Date(iso).getTime() + 5 * 3600000);
  return date.toISOString().slice(0, 16);
}
export default function TripSettings({ trip, onSave, busy }) {
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await onSave({
        name: f.get("name"),
        description: f.get("description"),
        location: f.get("location"),
        departure_at: f.get("departure_at")
          ? new Date(`${f.get("departure_at")}:00+05:00`).toISOString()
          : null,
        fee_paisa: f.get("fee") === "0" ? 0 : rupeesToPaisa(f.get("fee")),
        payment_details: f.get("payment_details"),
        organizer_phone: f.get("organizer_phone"),
        registrations_open: f.get("registrations_open") === "on",
      });
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <section className="card">
      <h2>Trip settings</h2>
      <p className="muted">
        Departure times use Pakistan Standard Time (UTC+5). Existing
        registrations keep the fee recorded when they signed up.
      </p>
      <form onSubmit={submit}>
        <div className="grid">
          <label>
            Trip name
            <input
              name="name"
              required
              minLength={3}
              maxLength={100}
              defaultValue={trip.name}
            />
          </label>
          <label>
            Destination
            <input
              name="location"
              required
              minLength={2}
              maxLength={150}
              defaultValue={trip.location}
            />
          </label>
          <label className="wide">
            Description
            <textarea
              name="description"
              maxLength={700}
              defaultValue={trip.description}
            />
          </label>
          <label>
            Departure date and time (PKT)
            <input
              name="departure_at"
              type="datetime-local"
              defaultValue={localPakistan(trip.departure_at)}
            />
          </label>
          <label>
            Fee per student (PKR)
            <input
              name="fee"
              inputMode="decimal"
              required
              type="number"
              step="0.01"
              min="0"
              max="1000000"
              defaultValue={trip.fee_paisa / 100}
            />
          </label>
          <label className="wide">
            Payment instructions
            <textarea
              name="payment_details"
              maxLength={1500}
              defaultValue={trip.payment_details}
              placeholder="Bank/wallet, account title, number, and payment instructions"
            />
          </label>
          <label>
            Organizer phone
            <input
              type="tel"
              name="organizer_phone"
              minLength={10}
              maxLength={20}
              required
              defaultValue={trip.organizer_phone}
            />
          </label>
        </div>
        <label className="consent section-space">
          <input
            name="registrations_open"
            type="checkbox"
            defaultChecked={trip.registrations_open}
          />
          <span>
            Open student registration. Set the departure date, fee and payment
            instructions first.
          </span>
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button disabled={busy}>Save trip settings</button>
      </form>
    </section>
  );
}
