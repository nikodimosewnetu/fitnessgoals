// We need to add the CORS headers to allow our browser-based client to call our function.
// Don't worry, these headers are already set by default for Edge Functions,
// but we need to define them here to handle the OPTIONS preflight request.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
