import "server-only";
import { createClient } from "@supabase/supabase-js";
export function db() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    throw new Error("Database is not configured");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function currentUser(req) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const { data, error } = await db().auth.getUser(header.slice(7));
  return !error && data.user?.email_confirmed_at ? data.user : null;
}
export function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
export function adminUser(user) {
  return !!user && adminEmails().includes(user.email?.toLowerCase());
}
export async function isAdmin(req) {
  return adminUser(await currentUser(req));
}
export { requestOrigin, sameOrigin } from "./domain.mjs";
export function result(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function sendEmail(to, subject, text, key) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !to.length)
    return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
      signal: AbortSignal.timeout(10000),
    });
    return r.ok;
  } catch {
    return false;
  }
}
export async function notify(row) {
  const message =
    row.status === "pending"
      ? "We received your registration and payment proof. Your payment is pending admin approval. This email does not confirm your place."
      : row.status === "approved"
        ? "Your payment has been approved and your registration is confirmed. Your QR pass and trip updates are available in your student dashboard."
        : "Your payment was not approved. Please contact the trip organizer for help.";
  const sent = await sendEmail(
    [row.email],
    `Hiking trip: ${row.status === "pending" ? "registration received" : row.status}`,
    `Hello ${row.full_name},\n\n${message}\n\nRegistration reference: ${row.id}\n\nUniversity Hiking Club`,
    `${row.id}/${row.status}`,
  );
  if (!sent) return false;
  const { error } = await db()
    .from("registrations")
    .update({ email_status: row.status })
    .eq("id", row.id)
    .eq("status", row.status);
  return !error;
}
export async function notifyEmergency(alert, student) {
  if (alert.email_sent) return true;
  const location =
    alert.latitude !== null && alert.longitude !== null
      ? `Location (captured ${alert.location_at || "at request time"}; accuracy approximately ${Math.round(alert.accuracy || 0)}m): https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`
      : "Location was not available. Contact the student directly.";
  const sent = await sendEmail(
    adminEmails(),
    "URGENT: hiking trip assistance requested",
    `A student has requested assistance.\n\nName: ${student.full_name}\nRoll number: ${student.roll_number}\nPhone: ${student.contact}\nEmergency contact: ${student.emergency_contact}\nMessage: ${alert.message}\n${location}\n\nAlert reference: ${alert.id}\nOpen the organizer dashboard to acknowledge and manage this request.`,
    `emergency/${alert.id}`,
  );
  if (!sent) return false;
  const { error } = await db()
    .from("emergencies")
    .update({ email_sent: true })
    .eq("id", alert.id);
  return !error;
}
export async function studentRow(user) {
  const { data, error } = await db()
    .from("registrations")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
