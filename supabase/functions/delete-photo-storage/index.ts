// @ts-nocheck
// Supabase Edge Function: delete-photo-storage
// Deletes photo both from Storage and Database

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  console.log("delete-photo-storage function started");

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Admin client with full access
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 🔑 Verify client JWT (user must be signed in)
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse body
    const { photoId, path } = await req.json();
    console.log("delete-photo-storage received:", { photoId, path });

    if (!photoId || !path) {
      return new Response(
        JSON.stringify({ error: "Missing photoId or file path" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 1️⃣ Delete from storage
    const { error: storageError } = await supabaseAdmin
      .storage
      .from("photos")
      .remove([path]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
      return new Response(
        JSON.stringify({ error: storageError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2️⃣ Delete from database
    const { error: dbError } = await supabaseAdmin
      .from("photos")
      .delete()
      .eq("id", photoId);

    if (dbError) {
      console.error("Database delete error:", dbError);
      return new Response(
        JSON.stringify({ error: dbError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("delete-photo-storage function error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
