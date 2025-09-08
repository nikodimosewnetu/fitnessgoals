Run the SQL to create `profiles` table and RLS policies

The file `create_profiles.sql` contains SQL to create the `public.profiles` table, enable RLS, add policies and an auth trigger.

Options to run:

1) Supabase Dashboard (recommended)
   - Go to https://app.supabase.com -> select your project.
   - Database -> SQL Editor -> New query.
   - Paste the contents of `sql/create_profiles.sql` and Run.

2) psql (CLI)
   - Get the DB connection string from Supabase Dashboard -> Settings -> Database -> Connection string.
   - Run in PowerShell:

```powershell
# replace the connection string below with your project's connection string
psql "postgresql://<db_user>:<db_pass>@<host>:<port>/<db_name>" -f sql/create_profiles.sql
```

3) Supabase CLI (migrations)
   - You can add the SQL file to a migrations folder and run via the supabase CLI if you have a migrations setup. For a quick run, use the Dashboard.

Notes:
- The trigger reads `new.raw_user_meta_data ->> 'fullName'` for the user's name. If you store the user's name under another metadata key, update the SQL accordingly.
- Do not expose the service_role key in the client.
