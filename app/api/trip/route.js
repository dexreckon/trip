import { db, result } from "../../../lib/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { data, error } = await db()
      .from("trip_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (error) throw error;
    return result({ trip: data });
  } catch {
    return result({ error: "Trip details are not available yet." }, 503);
  }
}
