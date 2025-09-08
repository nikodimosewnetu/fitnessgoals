// supabase/functions/aicoach/index.ts

interface RequestPayload {
  text: string
  goal?: string
  userProfile?: {
    fitnessLevel: string
    age?: number
    injuries?: string[]
  }
  analysisData?: any
  streaming?: boolean
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

const OPENAI_URL = "https://api.openai.com/v1/chat/completions"
const MODEL = "gpt-4o-mini"
const TIMEOUT_MS = 20000 // abort OpenAI call after 20s to avoid hangs
const DEFAULT_STREAM = true // Enable streaming by default for faster perceived response

// Pre-build base system message for speed
const BASE_SYSTEM_MESSAGE =
    "You are an expert AI fitness coach with deep knowledge in exercise science, nutrition, and body composition analysis. You provide:\n" +
    "🏋️‍♂️ Workout Programming: Create personalized routines based on goals, experience, and equipment\n" +
    "🥗 Nutrition Guidance: Macro calculations, meal planning, and dietary recommendations\n" +
    "📊 Progress Analysis: Interpret body composition changes and photo analysis data with specific insights\n" +
    "💪 Form & Technique: Detailed exercise instruction and safety tips\n" +
    "🎯 Goal Setting: SMART fitness goals and milestone tracking\n" +
    "🧠 Motivation: Encouraging, science-based advice that builds confidence\n" +
    "📈 Progress Tracking: Analyze trends, celebrate wins, and adjust strategies\n\n" +
    "When analyzing progress photos:\n" +
    "Focus on specific metrics like muscle definition scores and regional changes\n" +
    "Provide actionable recommendations based on the data\n" +
    "Celebrate improvements and address areas needing attention\n" +
    "Suggest specific exercises for lagging body parts\n" +
    "Consider lighting and photo quality in your assessment\n\n" +
    "Always be:\n" +
    "Encouraging and supportive while being realistic\n" +
    "Specific with sets, reps, weights, and progressions when relevant\n" +
    "Safety-conscious, especially with injuries or limitations\n" +
    "Evidence-based in your recommendations\n" +
    "Concise but comprehensive in your responses\n\n" +
    "Use emojis to make responses engaging and easy to scan."

Deno.serve(async (req) => {
  const url = new URL(req.url)

  // CORS / preflight
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  // Cheap health endpoint (no OpenAI call)
  if (req.method === "GET" && url.pathname === "/health") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders })
  }

  // Safer JSON parsing
  let body: RequestPayload
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const { text, goal, userProfile, analysisData, streaming = DEFAULT_STREAM } = body
  if (!text || !text.trim()) {
    return new Response(JSON.stringify({ error: "Message text is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const openaiApiKey = Deno.env.get("OPENAI_API_KEY")
  if (!openaiApiKey) {
    return new Response(JSON.stringify({ error: "Server is misconfigured (missing API key)" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  // Construct system message (using pre-built base for speed)
  let systemMessage = BASE_SYSTEM_MESSAGE

  const greetings = ["hi", "hello", "hey", "yo", "hai", "halo", "greetings", "good morning", "good afternoon", "good evening"]
  const isGreeting = greetings.includes(text.trim().toLowerCase())
  if (isGreeting) {
    // Short-circuit: instant local reply for a plain greeting (no LLM call)
    const reply =
        "👋 Hey! I'm your AI fitness coach. I can design workouts, dial in macros, analyze progress pics, and tweak form. Ask me anything to get started! 💪"
    return new Response(JSON.stringify({ response: reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  // YouTube hint
  const youtubeRegex = /(https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11}))/i
  const youtubeMatch = text.match(youtubeRegex)
  if (youtubeMatch) {
    systemMessage +=
        `\n\nYouTube Video Link Detected: The user has sent a YouTube video link (${youtubeMatch[1]}).` +
        "\n- If the video is a workout, form check, or fitness advice, analyze and summarize the key points." +
        "\n- Give feedback, tips, or a summary based on the video content." +
        "\n- If possible, provide timestamped advice or highlight important sections." +
        "\n- If you cannot access the video, let the user know and suggest what info you need."
  }

  if (userProfile) {
    systemMessage += `\n\n👤 User Profile:`
    systemMessage += `\n- Fitness Level: ${userProfile.fitnessLevel}`
    if (userProfile.age) systemMessage += `\n- Age: ${userProfile.age}`
    if (userProfile.injuries?.length) systemMessage += `\n- Injuries/Limitations: ${userProfile.injuries.join(", ")}`
  }
  if (goal) systemMessage += `\n- Primary Goal: ${goal}`
  if (analysisData) systemMessage += `\n\n📊 Latest Analysis Data Available - Use this to provide specific, data-driven coaching advice.`

  // OpenAI call with hard timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(OPENAI_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: text },
        ],
        max_tokens: 400, // Reduced from 800 for faster responses
        temperature: 0.7,
        stream: streaming,
      }),
    })
  } catch (err) {
    clearTimeout(timeoutId)
    const timedOut = err && (err as any).name === "AbortError"
    const msg = timedOut
        ? "Upstream model took too long. Please try again in a moment. ⏳"
        : "Couldn't reach the AI service. Please try again. 🔄"
    return new Response(JSON.stringify({ error: msg }), {
      status: timedOut ? 504 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "")
    console.error("OpenAI API error:", response.status, errText)
    return new Response(JSON.stringify({ error: "AI service error", status: response.status }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (streaming) {
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  }

  const data = await response.json()
  const aiResponse =
      data.choices?.[0]?.message?.content ||
      "I'm having trouble generating a response right now. Let me try again! 🤔💪"

  return new Response(JSON.stringify({ response: aiResponse }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})