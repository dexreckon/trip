import { z } from "zod";
export const uuid = z.uuid();
export const settingsSchema = z
  .object({
    name: z.string().trim().min(3).max(100),
    description: z.string().trim().max(700),
    location: z.string().trim().min(2).max(150),
    departure_at: z.iso.datetime({ offset: true }).nullable(),
    fee_paisa: z.number().int().min(0).max(100000000),
    payment_details: z.string().trim().max(1500),
    organizer_phone: z
      .string()
      .trim()
      .regex(/^\+?[\d ()-]{10,20}$/),
    registrations_open: z.boolean(),
  })
  .refine(
    (v) =>
      !v.registrations_open ||
      (v.fee_paisa > 0 && v.payment_details.length >= 10 && v.departure_at),
    {
      message:
        "Set a departure date, fee and payment instructions before opening registration.",
    },
  );
export const emergencySchema = z
  .object({
    message: z.string().trim().min(2).max(1000),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    accuracy: z.number().min(0).max(1000000).nullable(),
    location_at: z.iso.datetime({ offset: true }).nullable(),
  })
  .refine((v) => (v.latitude === null) === (v.longitude === null), {
    message: "Incomplete location.",
  });
export function money(paisa) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 2,
  }).format(Number(paisa || 0) / 100);
}
export function daysRemaining(date, now = Date.now()) {
  if (!date) return null;
  const d = new Date(date).getTime();
  if (!Number.isFinite(d)) return null;
  return Math.max(0, Math.ceil((d - now) / 86400000));
}
export function readTicket(value, origin) {
  let token = String(value || "").trim();
  if (token.startsWith("http")) {
    const url = new URL(token);
    if (url.origin !== origin || url.pathname !== "/admin")
      throw Error("This QR code belongs to another site.");
    token = url.searchParams.get("ticket");
  }
  return uuid.parse(token);
}
export function rupeesToPaisa(value) {
  if (!/^\d+(\.\d{1,2})?$/.test(String(value)))
    throw Error("Enter a positive amount with at most two decimal places.");
  const [whole, fraction = ""] = String(value).split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100000000)
    throw Error("Amount must be between PKR 0.01 and PKR 1,000,000.");
  return amount;
}

// Next may normalize req.url to an internal hostname. The Host header retains
// the browser-visible host; trusted deployment proxies supply the protocol.
export function requestOrigin(req) {
  const url = new URL(req.url);
  const forwarded = req.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol =
    forwarded === "https"
      ? "https:"
      : forwarded === "http"
        ? "http:"
        : url.protocol;
  return new URL(protocol + "//" + (req.headers.get("host") || url.host))
    .origin;
}
export function sameOrigin(req) {
  try {
    return req.headers.get("origin") === requestOrigin(req);
  } catch {
    return false;
  }
}
