import {
  db,
  currentUser,
  studentRow,
  adminUser,
  result,
} from "../../../lib/server";
export const dynamic = "force-dynamic";
export async function GET(req) {
  try {
    const user = await currentUser(req);
    if (!user)
      return result({ error: "Please sign in with a verified email." }, 401);
    const registration = await studentRow(user);
    const client = db();
    const queries = await Promise.all([
      client.from("trip_settings").select("*").eq("id", 1).single(),
      client
        .from("announcements")
        .select("id,title,message,priority,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      registration
        ? client
            .from("emergencies")
            .select(
              "id,message,status,latitude,longitude,accuracy,location_at,email_sent,created_at,updated_at",
            )
            .eq("registration_id", registration.id)
            .order("created_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] }),
      registration
        ? client
            .from("attendance")
            .select("id,checked_in_at,checkpoints(name,kind)")
            .eq("registration_id", registration.id)
            .order("checked_in_at", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] }),
    ]);
    for (const q of queries) if (q.error) throw q.error;
    const safe = registration
      ? {
          id: registration.id,
          full_name: registration.full_name,
          roll_number: registration.roll_number,
          status: registration.status,
          fee_paisa: registration.fee_paisa,
          ticket_token: registration.ticket_token,
          receipt_ready: registration.receipt_ready,
        }
      : null;
    return result({
      registration: safe,
      trip: queries[0].data,
      announcements: queries[1].data,
      emergencies: queries[2].data,
      attendance: queries[3].data,
      isAdmin: adminUser(user),
    });
  } catch {
    return result(
      { error: "Could not load your dashboard. Please retry." },
      503,
    );
  }
}
