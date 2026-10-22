import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Postgres schema enforces privacy, unique attendance/emergencies and correct financial totals", async () => {
  const pg = new PGlite();
  try {
    // Supabase-owned namespaces are stubbed; application SQL is executed unchanged.
    await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 grant usage on schema public to anon,authenticated,service_role;`);
    const schema = await readFile(
      new URL("../supabase/schema.sql", import.meta.url),
      "utf8",
    );
    await pg.exec(schema);
    await pg.exec(schema); // Migration is rerunnable.
    const [{ rows: trip }] = await pg.exec("select * from trip_settings");
    assert.equal(trip[0].registrations_open, false);
    const user = "8a683ca3-2cbb-41e4-a74b-c8bc060f777d";
    await pg.query("insert into auth.users(id) values($1)", [user]);
    const {
      rows: [student],
    } = await pg.query(
      `insert into registrations(full_name,cnic,roll_number,email,contact,emergency_contact,transaction_number,receipt_path,user_id,fee_paisa,receipt_ready) values('Test Student','3520212345671','CS-001','student@example.com','03001234567','03001234568','TX-001','test.png',$1,350000,true) returning *`,
      [user],
    );
    // Browser roles cannot read personal information or invoke the finance summary.
    for (const role of ["anon", "authenticated"]) {
      await pg.exec(`set role ${role}`);
      await assert.rejects(
        pg.query("select * from registrations"),
        /permission denied/,
      );
      await assert.rejects(
        pg.query("select trip_summary()"),
        /permission denied/,
      );
      await pg.exec("reset role");
    }
    const { rows: protectedTables } = await pg.query(
      "select relname,relrowsecurity from pg_class where relname in ('registrations','trip_settings','announcements','expenses','checkpoints','attendance','emergencies')",
    );
    assert.equal(protectedTables.length, 7);
    assert.ok(protectedTables.every((t) => t.relrowsecurity));
    await pg.exec("set role service_role");
    assert.equal(
      (await pg.query("select * from registrations")).rows.length,
      1,
    );
    assert.equal(
      (await pg.query("select trip_summary() summary")).rows[0].summary
        .collected_paisa,
      0,
    );
    // The same conditional update used by the API cannot overwrite a completed review.
    assert.equal(
      (
        await pg.query(
          "update registrations set status='approved' where id=$1 and status='pending' and receipt_ready=true returning id",
          [student.id],
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await pg.query(
          "update registrations set status='rejected' where id=$1 and status='pending' and receipt_ready=true returning id",
          [student.id],
        )
      ).rows.length,
      0,
    );
    await pg.query(
      "insert into expenses(description,amount_paisa,spent_on) values('Bus',100000,'2026-10-22')",
    );
    const summary = (await pg.query("select trip_summary() summary")).rows[0]
      .summary;
    assert.equal(summary.collected_paisa, 350000);
    assert.equal(summary.expenses_paisa, 100000);
    assert.equal(summary.approved, 1);
    const checkpoint = (await pg.query("select id from checkpoints limit 1"))
      .rows[0].id;
    await pg.query(
      "insert into attendance(registration_id,checkpoint_id) values($1,$2)",
      [student.id, checkpoint],
    );
    await assert.rejects(
      pg.query(
        "insert into attendance(registration_id,checkpoint_id) values($1,$2)",
        [student.id, checkpoint],
      ),
      /unique constraint/,
    );
    await pg.query(
      "insert into emergencies(registration_id,message) values($1,'Need assistance')",
      [student.id],
    );
    await assert.rejects(
      pg.query(
        "insert into emergencies(registration_id,message) values($1,'Duplicate')",
        [student.id],
      ),
      /unique constraint/,
    );
    await pg.query(
      "update emergencies set status='resolved' where registration_id=$1",
      [student.id],
    );
    await pg.query(
      "insert into emergencies(registration_id,message) values($1,'New request')",
      [student.id],
    );
    assert.equal(
      (await pg.query("select trip_summary() summary")).rows[0].summary
        .active_emergencies,
      1,
    );
    await assert.rejects(
      pg.query(
        "insert into registrations(full_name,cnic,roll_number,email,contact,emergency_contact,transaction_number,receipt_path) values('Duplicate','3520212345671','CS-002','x@example.com','03001234567','03001234568','TX-002','x.png')",
      ),
      /unique constraint/,
    );
  } finally {
    await pg.close();
  }
});
