# Verification and launch checklist

## Completed in the build environment

- Production Next.js build compiled all pages and API routes.
- Production HTTP smoke checks passed for four page routes, camera/location response policies, private cache headers, anonymous API denial and cross-origin POST rejection.
- Ten automated tests passed. The PostgreSQL test uses an in-memory PGlite instance and executes the application's SQL unchanged, with small stand-ins for Supabase-owned `auth.users` and `storage.buckets` tables.
- Database checks covered rerunnable schema installation, closed-by-default registration, RLS on all seven application tables, denied browser-role access to student data/finance summaries, service-role access, conditional payment reviews, approved-only financial totals, duplicate attendance protection, one-active-emergency enforcement, and duplicate CNIC rejection.
- Validation checks covered countdown boundaries, pass/foreign-URL validation, exact integer currency conversion, settings prerequisites, GPS bounds/missing location, identifier normalization, consent, and receipt signatures.

The environment has no `/proc` memory statistics. The production build was verified with a test-only Node memory-statistics shim; that shim is not included in the app or required on Vercel.

Browser automation could not launch in this environment. No claim is made that camera, GPS, mobile layout, account emails, or live Supabase/Resend integration has been verified. Those require the acceptance checks below. A local production-server smoke test is available with `npm run test:http` while `npm start` is running; it checks pages, headers, anonymous API denial, and cross-origin POST denial without service credentials.

## Before opening registration

Use two student accounts and one allowlisted organizer account. Use test payments and clearly labeled test emergency requests.

1. **Accounts:** create an account, receive the verification email, confirm it, log in, log out and use password reset. An unconfirmed account must not register. Confirm a student cannot open admin data or perform any admin action.
2. **Registration:** fill all identity/contact fields; try malformed CNIC, missing consent, oversized files and non-images. Submit valid payment proof. Confirm the pending screen, stored record and receipt, acknowledgement email, and dashboard pass.
3. **Isolation:** use another student's account and verify it only receives its own registration, attendance and emergency history. Direct browser queries to application tables must be denied.
4. **Payments:** view the private proof as organizer, verify the transaction, then approve. Confirm status, collected-money total and approval email. Repeat with rejection. Try reviewing the same student twice; only the first review should change the record.
5. **Fees:** change the trip fee after a registration. Confirm the old registration keeps its original fee. A student with an outdated registration form must be told to refresh before submitting.
6. **QR:** test the QR on an actual phone. Verify name, roll number and payment status; record departure and two trail checkpoints. Scan twice at the same checkpoint and confirm no duplicate. Pending/rejected passes must not check in. Test pasting the pass code when the camera is unavailable.
7. **Expenses:** add and remove sample expenses and compare collected money minus expenses with the displayed balance. Pending/rejected payments must not increase collected money.
8. **Announcements:** publish a normal update and an important update; verify the student receives them within the next visible-page refresh. Remove one and verify it disappears after refresh.
9. **Emergency with GPS:** allow location, submit a labeled test request and verify coordinates/time/accuracy, dashboard alert, organizer email and student delivery status. Acknowledge and resolve from the organizer screen; verify the student sees each change.
10. **Emergency without GPS:** deny permission or disable location and verify the alert still saves without coordinates. Temporarily disconnect internet and verify the app does not falsely report successful delivery and retains the organizer call link.
11. **Email failure:** temporarily use an invalid notification key in a test environment. Confirm registration/review/emergency records remain saved, failed email is visible and a retry works after restoring the key.
12. **Mobile and accessibility:** inspect at 390px and desktop widths, check keyboard navigation, form labels, readable receipt images, modal close behavior, long names/messages and no horizontal scrolling. Test iOS Safari and Android Chrome camera/location permissions over HTTPS.
13. **Operations:** configure request rate limits, monitor email bounces, confirm organizer coverage during the trip and agree a phone/offline meeting plan. Set and follow the university's data-deletion schedule.
