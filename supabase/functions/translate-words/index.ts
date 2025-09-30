import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
console.log('Hello from the translate-words Edge Function!');
// Helper function to handle CORS preflight requests
function handleCors(req) {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: headers,
      status: 204
    });
  }
  return null;
}
serve(async (req)=>{
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }
  try {
    const { words } = await req.json();
    // Use standard fetch API to call the internal function
    const INTERNAL_FUNCTION_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/translate-words-internal`;
    const response = await fetch(INTERNAL_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        words
      })
    });
    if (!response.ok) {
      const errorDetails = await response.text();
      console.error('Error invoking internal function:', errorDetails);
      return new Response(JSON.stringify({
        error: 'Failed to translate words from internal service.'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        status: response.status
      });
    }
    const data = await response.json();
    const translatedWords = data.translatedWords;
    return new Response(JSON.stringify({
      translatedWords
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      status: 200
    });
  } catch (error) {
    console.error('Request processing error:', error.message);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      status: 400
    });
  }
});
