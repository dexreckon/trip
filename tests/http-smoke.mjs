// Run against `npm start` with BASE_URL=http://localhost:3000 npm run test:http.
// Does not need service credentials and does not submit real registrations.
import assert from "node:assert/strict";
const base = process.env.BASE_URL || "http://localhost:3000";
for (const path of ["/", "/login", "/dashboard", "/admin"]) {
  const r = await fetch(base + path);
  assert.equal(r.status, 200, path);
  assert.match(await r.text(), /TRAIL CLUB/);
  assert.match(r.headers.get("permissions-policy"), /geolocation=\(self\)/);
  assert.match(r.headers.get("permissions-policy"), /camera=\(self\)/);
}
for (const [path, status] of [
  ["/api/student", 401],
  ["/api/admin", 403],
]) {
  const r = await fetch(base + path);
  assert.equal(r.status, status, path);
  assert.equal(r.headers.get("cache-control"), "no-store");
}
for (const path of ["/api/register", "/api/emergency", "/api/admin"]) {
  const foreign = await fetch(base + path, {
    method: "POST",
    headers: { origin: "https://untrusted.example" },
  });
  assert.equal(foreign.status, 403, path + " rejects foreign origin");
  const anonymous = await fetch(base + path, {
    method: "POST",
    headers: { origin: base, "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(
    anonymous.status,
    path === "/api/admin" ? 403 : 401,
    path + " rejects anonymous submission",
  );
}
console.log(
  "PASS: four pages render; camera/location permissions; private cache headers; anonymous and cross-origin API rejection.",
);
