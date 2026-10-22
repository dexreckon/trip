import { test } from "node:test";
import assert from "node:assert/strict";
import {
  daysRemaining,
  readTicket,
  rupeesToPaisa,
  settingsSchema,
  emergencySchema,
} from "../lib/domain.mjs";
test("countdown covers missing dates, partial days and past departures", () => {
  assert.equal(daysRemaining(null), null);
  assert.equal(
    daysRemaining("2026-10-24T00:00:00Z", Date.parse("2026-10-22T12:00:00Z")),
    2,
  );
  assert.equal(
    daysRemaining("2026-10-21T00:00:00Z", Date.parse("2026-10-22T00:00:00Z")),
    0,
  );
});
test("QR parsing rejects foreign sites and invalid passes", () => {
  const id = "0c6c53e3-59ce-4dba-bcaa-cb0dc2025887";
  assert.equal(readTicket(id, "https://trip.example"), id);
  assert.equal(
    readTicket(
      `https://trip.example/admin?ticket=${id}`,
      "https://trip.example",
    ),
    id,
  );
  assert.throws(() =>
    readTicket(
      `https://evil.example/admin?ticket=${id}`,
      "https://trip.example",
    ),
  );
  assert.throws(() => readTicket("anything", "https://trip.example"));
});
test("money uses integer paisa and rejects ambiguous/invalid values", () => {
  assert.equal(rupeesToPaisa("1250.05"), 125005);
  assert.equal(rupeesToPaisa("1.1"), 110);
  for (const v of ["0", "-1", "1.001", "1e3", "abc", "1000001"])
    assert.throws(() => rupeesToPaisa(v));
});
test("registration cannot open without configured trip and payment details", () => {
  const settings = {
    name: "University Hike",
    description: "A trip",
    location: "Trail",
    departure_at: null,
    fee_paisa: 0,
    payment_details: "",
    organizer_phone: "03001234567",
    registrations_open: false,
  };
  assert.equal(settingsSchema.safeParse(settings).success, true);
  assert.equal(
    settingsSchema.safeParse({ ...settings, registrations_open: true }).success,
    false,
  );
  assert.equal(
    settingsSchema.safeParse({
      ...settings,
      registrations_open: true,
      fee_paisa: 200000,
      departure_at: "2026-11-01T03:00:00Z",
      payment_details: "Bank account details",
    }).success,
    true,
  );
});
test("emergency accepts no GPS but rejects partial or impossible coordinates", () => {
  const request = {
    message: "I need help",
    latitude: null,
    longitude: null,
    accuracy: null,
    location_at: null,
  };
  assert.equal(emergencySchema.safeParse(request).success, true);
  assert.equal(
    emergencySchema.safeParse({ ...request, latitude: 35 }).success,
    false,
  );
  assert.equal(
    emergencySchema.safeParse({ ...request, latitude: 91, longitude: 73 })
      .success,
    false,
  );
  assert.equal(
    emergencySchema.safeParse({
      ...request,
      latitude: 35,
      longitude: 73,
      accuracy: 10,
      location_at: "2026-10-22T12:00:00Z",
    }).success,
    true,
  );
});

test("origin checks use the public host behind Next normalization and still reject other origins", async () => {
  const { sameOrigin, requestOrigin } = await import("../lib/domain.mjs");
  const req = new Request("http://localhost:3030/api/register", {
    headers: { host: "127.0.0.1:3030", origin: "http://127.0.0.1:3030" },
  });
  assert.equal(sameOrigin(req), true);
  const deployment = new Request("http://internal/api/register", {
    headers: {
      host: "trip.example",
      "x-forwarded-proto": "https",
      origin: "https://trip.example",
    },
  });
  assert.equal(sameOrigin(deployment), true);
  assert.equal(requestOrigin(deployment), "https://trip.example");
  assert.equal(
    sameOrigin(
      new Request("http://localhost:3030/api/register", {
        headers: { host: "127.0.0.1:3030", origin: "https://other.example" },
      }),
    ),
    false,
  );
  assert.equal(
    sameOrigin(new Request("https://trip.example/api/register")),
    false,
  );
});
