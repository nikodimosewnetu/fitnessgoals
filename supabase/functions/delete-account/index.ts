// @ts-nocheck
// Supabase Edge Function: delete-account
// Expects SUPABASE_SERVICE_ROLE_KEY in function secrets

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const serve: (handler: (req: Request) => Response | Promise<Response>) => void =
  (globalThis as any).serve ?? function (_handler) {};

serve(async (req: Request) => {
  console.log('delete-account function invoked');

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Service not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create service role client
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Check auth header
    const authHeader =
      req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = authHeader.split(' ')[1];

    // Verify user from provided token
    const { data: user, error: userError } = await supabaseAdmin.auth.getUser(
      accessToken
    );

    if (userError || !user?.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid session', details: userError?.message }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.user.id;

    // Delete user with service role
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      userId
    );

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete user', details: deleteError.message }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('delete-account function error', err);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
