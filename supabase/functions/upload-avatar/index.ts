import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  const user = userData?.user;
  if (!user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // File
  const formData = await req.formData();
  const file = formData.get("avatar") as File;
  if (!file) {
    return new Response(JSON.stringify({ error: "No file uploaded" }), { status: 400 });
  }

  const fileExt = file.name.split(".").pop();
  const fileName = `photo_${user.id}_${Date.now()}.${fileExt}`;

  // Upload to photos bucket
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("photos")
    .upload(fileName, new Uint8Array(arrayBuffer), {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return new Response(JSON.stringify({ error: uploadError.message }), { status: 500 });
  }

  // Public URL
  const { data: urlData } = supabase.storage.from("photos").getPublicUrl(fileName);
  const photoUrl = urlData.publicUrl;

  // Insert into photos table
  const timestamp = new Date().toISOString();
  const analysis = null; // Placeholder for analysis
  const { error: photoError } = await supabase
    .from("photos")
    .insert({
      user_id: user.id,
      url: photoUrl,
      timestamp,
      analysis,
      created_at: timestamp,
    });
  if (photoError) {
    return new Response(JSON.stringify({ error: photoError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ photoUrl }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
