// Import Supabase client and base64 module
import { decode } from "https://deno.land/std@0.208.0/encoding/base64.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"


// --- CORS HEADERS ---
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// --- SUPABASE CLIENT SETUP ---
const supabaseUrl = Deno.env.get("SUPABASE_URL")
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

if (!supabaseUrl || !serviceRoleKey) {
  console.error("FATAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
}

const supabase = createClient(supabaseUrl!, serviceRoleKey!)

// --- MAIN SERVER LOGIC ---
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { userId, fileName, fileBase64, contentType } = await req.json()

    if (!userId || !fileName || !fileBase64 || !contentType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, fileName, fileBase64, contentType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const fileBuffer = decode(fileBase64)

    // Upload to storage
    const { error: uploadError } = await supabase.storage.from("photos").upload(`${userId}/${fileName}`, fileBuffer, {
      contentType,
      upsert: true,
    })

    if (uploadError) {
      console.error("Supabase Storage Error:", uploadError)
      return new Response(JSON.stringify({ error: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from("photos").getPublicUrl(`${userId}/${fileName}`)

    const publicUrl = urlData?.publicUrl
    if (!publicUrl) {
      return new Response(JSON.stringify({ error: "File uploaded but failed to get public URL." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // --- Insert into photos table ---
    const { error: dbError } = await supabase.from("photos").insert({
      id: crypto.randomUUID(), // ensure unique id
      url: publicUrl,
      user_id: userId,
      timestamp: new Date().toISOString(),
    })

    if (dbError) {
      console.error("Database insert error:", dbError)
      return new Response(JSON.stringify({ error: dbError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ publicUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("Unhandled Server Error:", err)
    return new Response(JSON.stringify({ error: (err as Error).message || "An unexpected error occurred." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
