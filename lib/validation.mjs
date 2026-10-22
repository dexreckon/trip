import { z } from "zod";
export const registrationSchema = z.object({
  full_name: z.string().trim().min(3).max(100),
  cnic: z
    .string()
    .trim()
    .transform((v) => v.replace(/-/g, ""))
    .pipe(z.string().regex(/^\d{13}$/, "Enter a 13-digit CNIC")),
  roll_number: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .transform((v) => v.toUpperCase()),
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  contact: z
    .string()
    .trim()
    .regex(/^\+?[\d ()-]{10,20}$/, "Enter a valid phone number"),
  emergency_contact: z
    .string()
    .trim()
    .regex(/^\+?[\d ()-]{10,20}$/, "Enter a valid emergency phone number"),
  transaction_number: z
    .string()
    .trim()
    .min(4)
    .max(100)
    .transform((v) => v.toUpperCase()),
  consent: z.literal("yes"),
});
export function imageType(b) {
  if (
    b.length >= 8 &&
    b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "png";
  if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255)
    return "jpg";
  if (
    b.length >= 12 &&
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  return null;
}
