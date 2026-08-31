# Database setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard, open **SQL Editor** and run the files in
   `migrations/` **in order** (`0001_...` through `0005_...`). Each is
   idempotent-ish but not re-runnable — run once.
3. (Optional) Run `seed.sql` for a handful of sample units to test the
   Units & Rates page against.
4. In **Project Settings → API**, copy the Project URL, `anon` public key,
   and `service_role` secret key into `.env.local` (copy from
   `.env.local.example` first).
5. In **Authentication → Users**, create a user (email + password) to sign
   in with. A matching `profiles` row is created automatically with role
   `front_desk`. To make yourself `owner_admin`, run in the SQL Editor:
   ```sql
   update profiles set role = 'owner_admin' where id = '<your-user-id>';
   ```

If you have the [Supabase CLI](https://supabase.com/docs/guides/cli)
installed and a linked project, you can instead run `supabase db push` from
the project root to apply everything in `migrations/` at once.
