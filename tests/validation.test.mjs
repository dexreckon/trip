import { test } from "node:test";
import assert from "node:assert/strict";
import { registrationSchema, imageType } from "../lib/validation.mjs";
const sample = {
  full_name: "Ayesha Khan",
  cnic: "35202-1234567-1",
  roll_number: "cs-001",
  email: "student@example.com",
  contact: "03001234567",
  emergency_contact: "+923001234568",
  transaction_number: "tx12345",
  consent: "yes",
};
test("normalizes identity and transaction identifiers", () => {
  const r = registrationSchema.parse(sample);
  assert.equal(r.cnic, "3520212345671");
  assert.equal(r.roll_number, "CS-001");
  assert.equal(r.transaction_number, "TX12345");
});
test("rejects invalid registration data", () => {
  for (const update of [
    { cnic: "123" },
    { email: "bad" },
    { consent: "no" },
    { contact: "abc" },
    { transaction_number: "" },
    { emergency_contact: "" },
  ])
    assert.equal(
      registrationSchema.safeParse({ ...sample, ...update }).success,
      false,
    );
});
test("requires image signatures instead of trusting file extension", () => {
  assert.equal(imageType(Buffer.from("<script>alert(1)</script>")), null);
  assert.equal(
    imageType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "png",
  );
  assert.equal(imageType(Buffer.from([255, 216, 255])), "jpg");
  assert.equal(imageType(Buffer.from("RIFF0000WEBP")), "webp");
});
