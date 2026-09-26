import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return Response.json({ error: 'Sign in required' }, { status: 401, headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceRoleKey) return Response.json({ error: 'Server configuration missing' }, { status: 500, headers: corsHeaders });

  const token = authorization.slice('Bearer '.length);
  const userClient = createClient(url, anonKey);
  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError || !user) return Response.json({ error: 'Invalid session' }, { status: 401, headers: corsHeaders });

  const adminClient = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) return Response.json({ error: deleteError.message }, { status: 500, headers: corsHeaders });

  return Response.json({ success: true }, { headers: corsHeaders });
});
