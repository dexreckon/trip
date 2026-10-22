import { z } from "zod";
import {
  db,
  currentUser,
  adminUser,
  sameOrigin,
  requestOrigin,
  notify,
  notifyEmergency,
  result,
} from "../../../lib/server";
import { uuid, settingsSchema, readTicket } from "../../../lib/domain.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function emergencies(client) {
  const [active, recent] = await Promise.all([
    client
      .from("emergencies")
      .select(
        "*,registrations(full_name,roll_number,contact,emergency_contact)",
      )
      .neq("status", "resolved")
      .order("created_at", { ascending: false })
      .limit(1000),
    client
      .from("emergencies")
      .select(
        "*,registrations(full_name,roll_number,contact,emergency_contact)",
      )
      .eq("status", "resolved")
      .order("updated_at", { ascending: false })
      .limit(30),
  ]);
  if (active.error || recent.error) throw active.error || recent.error;
  return [...active.data, ...recent.data];
}
export async function GET(req) {
  try {
    const user = await currentUser(req);
    if (!adminUser(user))
      return result({ error: "Organizer access required." }, 403);
    const client = db(),
      url = new URL(req.url);
    if (url.searchParams.get("view") === "alerts")
      return result({ emergencies: await emergencies(client) });
    const page = Math.max(
      0,
      Math.min(100000, parseInt(url.searchParams.get("page") || "0", 10) || 0),
    );
    const status = url.searchParams.get("status"),
      search = (url.searchParams.get("search") || "").slice(0, 100);
    let list = client
      .from("registrations")
      .select(
        "id,created_at,full_name,cnic,roll_number,email,contact,emergency_contact,transaction_number,status,email_status,fee_paisa,receipt_ready,reviewed_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(page * 50, page * 50 + 49);
    if (["pending", "approved", "rejected"].includes(status))
      list = list.eq("status", status);
    if (search)
      list = list.ilike("full_name", `%${search.replace(/[%_]/g, "")}%`);
    const queries = await Promise.all([
      list,
      client.rpc("trip_summary"),
      client.from("trip_settings").select("*").eq("id", 1).single(),
      client
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      client
        .from("expenses")
        .select("*")
        .order("spent_on", { ascending: false })
        .limit(100),
      client.from("checkpoints").select("*").order("created_at"),
      client
        .from("attendance")
        .select(
          "id,checked_in_at,registrations(full_name,roll_number),checkpoints(name)",
        )
        .order("checked_in_at", { ascending: false })
        .limit(200),
    ]);
    for (const q of queries) if (q.error) throw q.error;
    return result({
      rows: queries[0].data,
      total: queries[0].count,
      page,
      summary: queries[1].data,
      trip: queries[2].data,
      announcements: queries[3].data,
      expenses: queries[4].data,
      checkpoints: queries[5].data,
      attendance: queries[6].data,
      emergencies: await emergencies(client),
    });
  } catch {
    return result(
      {
        error: "Could not load organizer data. Check configuration and retry.",
      },
      503,
    );
  }
}
export async function POST(req) {
  if (!sameOrigin(req)) return result({ error: "Invalid origin." }, 403);
  try {
    const user = await currentUser(req);
    if (!adminUser(user))
      return result({ error: "Organizer access required." }, 403);
    const body = await req.json(),
      client = db();
    let response = { ok: true };
    switch (body.action) {
      case "review": {
        const { id, status } = z
          .object({ id: uuid, status: z.enum(["approved", "rejected"]) })
          .parse(body);
        // A receipt must finish uploading before any final review.
        const { data, error } = await client
          .from("registrations")
          .update({
            status,
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.id,
          })
          .eq("id", id)
          .eq("status", "pending")
          .eq("receipt_ready", true)
          .select()
          .maybeSingle();
        if (error) throw error;
        if (!data)
          return result(
            {
              error:
                "Already reviewed or receipt processing is incomplete. Refresh the list.",
            },
            409,
          );
        response = { ok: true, emailSent: await notify(data) };
        break;
      }
      case "retry-email": {
        const { data, error } = await client
          .from("registrations")
          .select("*")
          .eq("id", uuid.parse(body.id))
          .single();
        if (error) throw error;
        response = { ok: true, emailSent: await notify(data) };
        break;
      }
      case "receipt": {
        const { data: row, error } = await client
          .from("registrations")
          .select("receipt_path,receipt_ready")
          .eq("id", uuid.parse(body.id))
          .single();
        if (error) throw error;
        if (!row.receipt_ready)
          return result(
            {
              error:
                "Receipt is not ready. Contact the student before approving.",
            },
            409,
          );
        const { data, error: signError } = await client.storage
          .from("payment-proofs")
          .createSignedUrl(row.receipt_path, 300);
        if (signError) throw signError;
        response = { url: data.signedUrl };
        break;
      }
      case "announcement": {
        const fields = z
          .object({
            title: z.string().trim().min(2).max(120),
            message: z.string().trim().min(2).max(3000),
            priority: z.enum(["normal", "important"]),
          })
          .parse(body);
        const { error } = await client
          .from("announcements")
          .insert({ ...fields, created_by: user.id });
        if (error) throw error;
        break;
      }
      case "delete-announcement": {
        const { error } = await client
          .from("announcements")
          .delete()
          .eq("id", uuid.parse(body.id));
        if (error) throw error;
        break;
      }
      case "expense": {
        const fields = z
          .object({
            description: z.string().trim().min(2).max(200),
            amount_paisa: z.number().int().positive().max(100000000),
            spent_on: z.iso.date(),
          })
          .parse(body);
        const { error } = await client
          .from("expenses")
          .insert({ ...fields, created_by: user.id });
        if (error) throw error;
        break;
      }
      case "delete-expense": {
        const { error } = await client
          .from("expenses")
          .delete()
          .eq("id", uuid.parse(body.id));
        if (error) throw error;
        break;
      }
      case "settings": {
        const fields = settingsSchema.parse(body.trip);
        const { error } = await client
          .from("trip_settings")
          .update(fields)
          .eq("id", 1);
        if (error) throw error;
        break;
      }
      case "checkpoint": {
        const name = z.string().trim().min(2).max(100).parse(body.name);
        const { error } = await client.from("checkpoints").insert({ name });
        if (error) {
          if (error.code === "23505")
            return result(
              { error: "A checkpoint already has that name." },
              409,
            );
          throw error;
        }
        break;
      }
      case "verify-ticket": {
        const token = readTicket(body.ticket, requestOrigin(req));
        const { data, error } = await client
          .from("registrations")
          .select("id,full_name,roll_number,status,fee_paisa,receipt_ready")
          .eq("ticket_token", token)
          .maybeSingle();
        if (error) throw error;
        if (!data) return result({ error: "QR pass not found." }, 404);
        const { data: attendance, error: attError } = await client
          .from("attendance")
          .select("id,checked_in_at,checkpoints(name)")
          .eq("registration_id", data.id);
        if (attError) throw attError;
        response = { student: data, attendance };
        break;
      }
      case "check-in": {
        const token = readTicket(body.ticket, requestOrigin(req)),
          checkpoint = uuid.parse(body.checkpoint_id);
        const { data: row, error } = await client
          .from("registrations")
          .select("id,status,receipt_ready")
          .eq("ticket_token", token)
          .maybeSingle();
        if (error) throw error;
        if (!row || row.status !== "approved" || !row.receipt_ready)
          return result(
            { error: "Only an approved registration can be checked in." },
            409,
          );
        const { error: insertError } = await client.from("attendance").insert({
          registration_id: row.id,
          checkpoint_id: checkpoint,
          checked_in_by: user.id,
        });
        if (insertError) {
          if (insertError.code === "23505")
            return result({ ok: true, already: true });
          throw insertError;
        }
        response = { ok: true, already: false };
        break;
      }
      case "emergency-status": {
        const { id, status } = z
          .object({ id: uuid, status: z.enum(["acknowledged", "resolved"]) })
          .parse(body);
        let update = client
          .from("emergencies")
          .update({
            status,
            updated_at: new Date().toISOString(),
            handled_by: user.id,
          })
          .eq("id", id);
        update =
          status === "acknowledged"
            ? update.eq("status", "open")
            : update.neq("status", "resolved");
        const { data, error } = await update.select("id").maybeSingle();
        if (error) throw error;
        if (!data)
          return result(
            {
              error:
                "This alert was already updated. Refresh to see its status.",
            },
            409,
          );
        break;
      }
      case "retry-emergency-email": {
        const { data, error } = await client
          .from("emergencies")
          .select(
            "*,registrations(full_name,roll_number,contact,emergency_contact)",
          )
          .eq("id", uuid.parse(body.id))
          .single();
        if (error) throw error;
        response = {
          ok: true,
          emailSent: await notifyEmergency(data, data.registrations),
        };
        break;
      }
      default:
        return result({ error: "Unknown action." }, 400);
    }
    return result(response);
  } catch (error) {
    if (error?.message === "This QR code belongs to another site.")
      return result({ error: error.message }, 400);
    if (error instanceof z.ZodError)
      return result({ error: error.issues[0].message }, 400);
    return result(
      { error: "Could not complete this action. Refresh and try again." },
      503,
    );
  }
}
