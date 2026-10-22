# Trail Club — university hiking trip management

A complete source project for one university hiking trip. Built with Next.js, Supabase Auth/Postgres/private Storage, and Resend. Deploy it to your own Vercel account.

## What is included

**Students**
- Email/password account creation, email verification, login and password reset.
- Full name, CNIC, roll number, contact, emergency contact and verified email.
- Transaction reference and JPG/PNG/WebP payment proof (maximum 3 MB).
- Pending-payment screen and acknowledgement email; approval/rejection notifications.
- Dashboard with departure date and days remaining, payment status and downloadable personal QR pass.
- Departure/checkpoint attendance history and announcements from organizers.
- Emergency request with optional, permission-based GPS capture. Dashboard alert plus email to organizers, acknowledgment status, and organizer call link.

**Organizers**
- Allowlisted organizer accounts using the same login system.
- Paginated student list, name search, payment filters, private receipt viewer and manual approval/rejection.
- Whole-trip registration counts, approved-payment total, expenses and balance.
- Expense entry/removal and announcement publishing/removal.
- QR camera scanner or manual pass entry; identity/payment verification and separate check-in at each checkpoint. Repeated scans do not duplicate attendance.
- Emergency queue, one-time location map links, contact numbers, acknowledge/resolve controls and email retries.
- Editable trip details, departure time, fee, payment instructions, organizer phone and checkpoints.

## Technology and assumptions

One trip per installation; fixed fee per registration; amounts in PKR using integer paisa; displayed departure times use Pakistan Standard Time (UTC+5). Changing the fee affects new registrations only. All verified student accounts may register; this does not verify university enrollment. Organizers should compare the QR pass name and roll number against student ID.

The app does not collect payments itself. Students pay using your bank/wallet instructions. Verify the actual full payment against your bank/wallet statement before approving. Pending and rejected payments do not count as collected money. Partial payments, refunds, multiple trips and automatic bank reconciliation are not included.

## 1. Run locally

Use Node.js 22 or 24.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The public interface can be viewed before setup; accounts and saved data require the services below. No demo registrations are stored silently.

## 2. Configure Supabase

1. Create a Supabase project and run **supabase/schema.sql** in its SQL editor. This creates tables, an initial closed trip, a departure checkpoint, security rules and a private `payment-proofs` bucket.
2. In `.env.local`, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the project URL and anon/publishable client key. Set `SUPABASE_SERVICE_ROLE_KEY` to the server service-role key. Never expose this key in a NEXT_PUBLIC variable or commit it to Git.
3. Enable email/password authentication and public account signup. **Keep email confirmation enabled.** Student accounts must have a verified email to call protected APIs.
4. Under Authentication → URL Configuration, set Site URL to your deployed Vercel origin. Add your exact `https://YOUR-SITE/login`, `https://YOUR-SITE/login?mode=reset`, and local equivalents to Redirect URLs. Add any intended preview deployment URLs explicitly. Keep Supabase's standard confirmation/recovery URL templates, which supply the session to the client on redirect.
5. Configure **custom SMTP** for Supabase Auth. This sends verification and password-reset emails; it is separate from the Resend API used by application notifications. A Resend SMTP connection can use your verified sending domain. Do not rely on the default development mail sender for student rollout.
6. Create your organizer account through signup (or Supabase Authentication → Users), verify its email, and set the same email in `ADMIN_EMAILS`. Multiple organizers use comma-separated emails. Set this server environment variable yourself; students cannot grant themselves organizer access.
7. Keep storage private and do not add anonymous or authenticated table/storage policies. All data access goes through server APIs that verify the account and role. The browser client is used for Auth, not direct data access.

## 3. Configure notification email

Create a Resend account, verify your domain, and set:

```text
RESEND_API_KEY=your-server-api-key
EMAIL_FROM=University Hiking Club <trips@your-verified-domain.com>
ADMIN_EMAILS=organizer1@example.com,organizer2@example.com
```

- Acknowledgement, approval and rejection emails go to the student's verified account email.
- Emergency emails go to the addresses in `ADMIN_EMAILS`, and include the student's contact details, request, and GPS map link if supplied with permission.
- Announcements appear in dashboards; they are not bulk emails or SMS.
- Email failures never discard a saved registration, review or emergency request. Organizers can retry failed notifications. Resend idempotency keys limit duplicate sends within the provider's retention window.
- “Accepted for delivery” means the email provider accepted the request, not that the recipient read it. Monitor bounces in Resend. There is no background notification worker; failed sends require retry from the admin dashboard.

## 4. Configure the trip

Sign in and open `/admin` → **Trip settings**. Set:

- Trip name, destination, description and departure date/time (Pakistan time).
- Fixed per-student fee in PKR.
- Bank/wallet name, account title/number, and payment instructions.
- Organizer phone number, including country code where possible.
- Registration open/closed switch.

Add trail checkpoints under **Attendance**. A Departure checkpoint is created for you. All organizers can record check-ins at any checkpoint.

## 5. Deploy on Vercel

1. Extract this project and push it to a private GitHub repository. `.env.local` is ignored by Git.
2. Import the repository into Vercel and use the Next.js framework preset.
3. Add all six variables in `.env.example` to Vercel's environment settings, with real values. Add appropriate variables to Preview only if those deployments should use the same services.
4. Deploy, then finish the Supabase Site URL and allowed redirect configuration with the deployed URL.
5. Configure the trip and verify the end-to-end checklist below before opening registration and sharing the link.

Database and receipts persist in Supabase, not the Vercel filesystem. The 3 MB upload cap is intentionally below serverless request body limits. Camera access and geolocation require HTTPS (localhost works for development). Response policies permit these capabilities only on this site's own origin.

## Emergency behavior — read before using on a trip

The student presses Request assistance, describes the issue, and chooses whether to include current GPS. The browser asks for location permission. GPS is sampled once with an eight-second timeout; unavailable/denied location does not block sending an alert. No background or continuous tracking is performed.

The server saves the request before trying email. The student sees whether it was saved and whether email was accepted. A saved request is **not an acknowledgment from an organizer**. Organizers mark it acknowledged when responding, and resolved after checking on the student. Each student can have one active request; repeated submissions reuse it instead of flooding the queue.

Both dashboards poll every 10 seconds while the page is open and visible. There are no native push notifications, SMS alerts, automatic calls, or reliable background-browser delivery. Designate an organizer to keep the dashboard open and monitor the email inbox. Without internet an alert cannot reach the server; the UI never reports delivery when the request fails. Save the organizer phone number and agree an offline contact/meeting plan before departure. A phone call also requires phone service.

## Security and operational scope

- Server-side authentication and role checks protect every student/admin API. Student records are scoped by verified auth user ID, not user-supplied IDs/emails.
- CNICs, phones and receipts are not public. RLS blocks direct browser table access; receipt links are issued only for admins and expire after five minutes.
- QR codes contain a random pass identifier, not CNIC, phone number or a login token. Only admins can resolve them. Treat pass copies as private; the scanner is not biometric identity verification.
- Unique CNIC, roll number, transaction reference and account constraints prevent duplicate registrations. Payment reviews are conditional so simultaneous organizers cannot overwrite a final decision. Attendance has a database uniqueness constraint per student/checkpoint.
- The server validates identifiers, amount bounds, coordinates, image signatures and file size. It does not perform antivirus scanning or re-encode uploaded images.
- Configure Vercel firewall/rate limiting for `/api/register`, `/api/emergency` and auth traffic before broadly sharing the link. Supabase Auth has its own rate limits; CAPTCHA and an application-wide shared limiter are not included.
- Use strong organizer passwords. Retain student identity data only as long as your university needs it, then delete both records and receipt objects. No retention job is included.
- The organizer list is paginated at 50 students. Summaries span all records. Recent displays are capped: 100 announcements, 100 expenses, 200 check-ins, 1,000 active emergency requests and 30 resolved requests. Older data remains in Supabase.
- Registration/receipt writes cross two services. Failed uploads attempt to remove the reserved registration; abrupt server termination can leave an incomplete record. `receipt_ready` blocks approval until processing is complete. Check Storage and repair/delete the incomplete row in Supabase after verifying it with the student. Never request a second payment just because upload failed.
- Final approval/rejection is immutable in the app. Corrections or rejected-payment resubmissions are handled by the organizer in Supabase after verification. Changing a student's Auth email does not update the email captured on an existing registration.
- All allowlisted organizers have the same permissions. Expense removal permanently removes the entry; export records separately if your university requires an audit ledger.

## Upgrading the earlier registration-only version

`schema.sql` adds the portal columns if the original table exists. Existing records have no account link, a zero fee snapshot and `receipt_ready=false`. After verifying each original record, manually link its correct verified `auth.users.id` in `user_id`, set its original fee in paisa, and mark its receipt ready only if the uploaded proof is present. New records created by this app are linked automatically. Do not automatically claim old registrations by an unverified email.

## Checks

```sh
npm test
npm run build
```

See **TESTING.md** for the checks performed and the live-account acceptance checklist. API and database integration with your own services must be validated before rollout.

## Official service documentation

- Next.js deployment: https://nextjs.org/docs/app/getting-started/deploying
- Supabase password authentication: https://supabase.com/docs/guides/auth/passwords
- Supabase redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase private storage: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Resend email API: https://resend.com/docs/api-reference/emails/send-email
- Camera scanner: https://github.com/zxing-js/browser
