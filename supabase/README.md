# Database setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard, open **SQL Editor** and run the files in
   `migrations/` **in order** (`0001_...` through `0011_...`). Each is
   idempotent-ish but not re-runnable — run once.
3. (Optional) Run `seed.sql` for a handful of sample units to test the
   Units & Rates page against.
4. In **Project Settings → API**, copy the Project URL, `anon` public key,
   and `service_role` secret key into `.env.local` (copy from
   `.env.local.example` first).
5. In **Authentication → Users**, create a user (email + password) to sign
   in with. A matching `profiles` row is created automatically with role
   `analytics_only` (no PMS access — see "Portfolio Analytics" below). To make
   yourself `owner_admin`, run in the SQL Editor:
   ```sql
   update profiles set role = 'owner_admin' where id = '<your-user-id>';
   ```
   PMS staff accounts are promoted the same way (`manager`, `front_desk`,
   `housekeeping`, `maintenance`).

## Portfolio Analytics (sold to outside hosts)

`0009`–`0010` add a multi-tenant analytics module at `/analytics`. Customers
sign up themselves at `/signup`, get a 14-day trial workspace, and only ever
see their own workspace's data (RLS on every table and storage bucket).
Because anyone can sign up, **new accounts default to `analytics_only`**, a
role no PMS policy grants anything to.

- **Make yourself the platform admin** (to see all customers and record
  licence payments at `/analytics/admin`):
  ```sql
  insert into an_platform_admins (user_id) values ('<your-user-id>');
  ```
- **Licences**: a one-time fee buys a year. Record each payment on
  `/analytics/admin` (Activate / Renew / Extend trial). When access lapses the
  workspace turns read-only — data is kept, uploads and edits are blocked.
- **Storage**: the migration creates two buckets — `an-receipts` (private,
  expense receipts) and `an-branding` (public, customer logos).
- **Auth settings**: in Authentication → URL Configuration, set the Site URL
  to the deployed app so confirmation e-mails link back correctly.
- Optional env vars: `NEXT_PUBLIC_ANALYTICS_PRODUCT_NAME` (name on the
  sign-up page, default "Rental Portfolio Analytics") and
  `NEXT_PUBLIC_ANALYTICS_SALES_CONTACT` (how customers reach you to pay or
  renew, shown in licence banners).

If you have the [Supabase CLI](https://supabase.com/docs/guides/cli)
installed and a linked project, you can instead run `supabase db push` from
the project root to apply everything in `migrations/` at once.
