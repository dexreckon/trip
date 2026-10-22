import { randomUUID } from "node:crypto";
import { db, sameOrigin, notify, currentUser } from "../../../lib/server";
import { registrationSchema, imageType } from "../../../lib/validation.mjs";
export const runtime = "nodejs";
export async function POST(req) {
  if (!sameOrigin(req))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  if (Number(req.headers.get("content-length") || 0) > 3_700_000)
    return Response.json(
      { error: "Upload must be 3 MB or smaller." },
      { status: 413 },
    );
  try {
    const user = await currentUser(req);
    if (!user)
      return Response.json(
        { error: "Sign in with a verified email before registering." },
        { status: 401 },
      );
    const { data: trip, error: tripError } = await db()
      .from("trip_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (tripError || !trip?.registrations_open)
      return Response.json(
        { error: "Registration is currently closed." },
        { status: 403 },
      );
    const form = await req.formData();
    form.set("email", user.email);
    if (Number(form.get("expected_fee_paisa")) !== trip.fee_paisa)
      return Response.json(
        {
          error:
            "The trip fee has changed. Refresh the page and confirm the amount with the organizer before submitting.",
        },
        { status: 409 },
      );
    const parsed = registrationSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success)
      return Response.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    const proof = form.get("proof");
    if (
      !(proof instanceof File) ||
      proof.size === 0 ||
      proof.size > 3 * 1024 * 1024
    )
      return Response.json(
        { error: "Choose a JPG, PNG or WebP receipt up to 3 MB." },
        { status: 400 },
      );
    const bytes = Buffer.from(await proof.arrayBuffer());
    const ext = imageType(bytes);
    if (!ext)
      return Response.json(
        { error: "Receipt must be a JPG, PNG or WebP image." },
        { status: 400 },
      );
    const client = db();
    const id = randomUUID();
    const path = `${id}.${ext}`;
    const { consent, ...details } = parsed.data;
    // Reserve unique identifiers before writing a private receipt.
    const { error: insertError } = await client
      .from("registrations")
      .insert({
        ...details,
        id,
        user_id: user.id,
        fee_paisa: trip.fee_paisa,
        receipt_path: path,
      });
    if (insertError)
      return Response.json(
        {
          error:
            insertError.code === "23505"
              ? "A registration already uses these details or transaction number. Contact the organizer if you need a correction."
              : "Registration could not be saved. Please try again.",
        },
        { status: insertError.code === "23505" ? 409 : 503 },
      );
    const { error: uploadError } = await client.storage
      .from("payment-proofs")
      .upload(path, bytes, {
        contentType: ext === "jpg" ? "image/jpeg" : `image/${ext}`,
        upsert: false,
      });
    if (uploadError) {
      await client.from("registrations").delete().eq("id", id);
      return Response.json(
        { error: "Receipt upload failed. Please try again." },
        { status: 503 },
      );
    }
    const { error: readyError } = await client
      .from("registrations")
      .update({ receipt_ready: true })
      .eq("id", id);
    if (readyError)
      return Response.json(
        {
          error:
            "Your registration was saved, but receipt processing needs organizer help. Open your dashboard; do not pay again.",
        },
        { status: 503 },
      );
    const emailSent = await notify({ ...details, id, status: "pending" });
    return Response.json({ id, emailSent }, { status: 201 });
  } catch {
    return Response.json(
      {
        error:
          "Registration is temporarily unavailable. Please try again later.",
      },
      { status: 503 },
    );
  }
}
