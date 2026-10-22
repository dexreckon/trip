import {
  db,
  currentUser,
  studentRow,
  sameOrigin,
  notifyEmergency,
  result,
} from "../../../lib/server";
import { emergencySchema } from "../../../lib/domain.mjs";
export async function POST(req) {
  if (!sameOrigin(req))
    return result({ error: "Invalid request origin." }, 403);
  try {
    const user = await currentUser(req);
    if (!user)
      return result(
        { error: "Please sign in again. Your alert has not been sent." },
        401,
      );
    const student = await studentRow(user);
    if (!student)
      return result(
        { error: "No trip registration found. Call the organizer directly." },
        403,
      );
    const parsed = emergencySchema.safeParse(await req.json());
    if (!parsed.success)
      return result(
        { error: "Check your message and location, then retry." },
        400,
      );
    const client = db();
    const { data: existing, error: readError } = await client
      .from("emergencies")
      .select("*")
      .eq("registration_id", student.id)
      .neq("status", "resolved")
      .maybeSingle();
    if (readError) throw readError;
    if (existing) {
      const emailSent = await notifyEmergency(existing, student);
      return result({ alert: existing, emailSent, existing: true });
    }
    const { data: alert, error } = await client
      .from("emergencies")
      .insert({ ...parsed.data, registration_id: student.id })
      .select()
      .single();
    if (error) {
      if (error.code === "23505")
        return result(
          {
            error:
              "An active request already exists. Refresh to see its status.",
          },
          409,
        );
      throw error;
    }
    const emailSent = await notifyEmergency(alert, student);
    return result({ alert, emailSent, existing: false }, 201);
  } catch {
    return result(
      {
        error:
          "We could not confirm delivery. Check your dashboard and call the organizer now if you need help.",
      },
      503,
    );
  }
}
