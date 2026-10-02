const allowedHeaders = 'authorization, apikey, content-type, x-client-info';

function getCorsHeaders(origin: string | null) {
  const allowedOrigins = (Deno.env.get('HACKMATE_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!origin || !allowedOrigins.includes(origin)) return null;

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': allowedHeaders,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResponse(body: unknown, status: number, corsHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  });
}

function getCometChatConfig() {
  const appId = Deno.env.get('COMETCHAT_APP_ID')?.trim();
  const region = Deno.env.get('COMETCHAT_REGION')?.trim().toLowerCase();
  const apiKey = Deno.env.get('COMETCHAT_REST_API_KEY')?.trim();

  if (!appId || !apiKey || !['us', 'eu', 'in'].includes(region ?? '')) {
    throw new Error('CometChat server configuration is incomplete.');
  }

  return {
    apiKey,
    baseUrl: `https://${appId}.api-${region}.cometchat.io/v3`,
  };
}

async function requestCometChat(
  baseUrl: string,
  apiKey: string,
  path: string,
  method: 'POST' | 'PUT',
  body: Record<string, unknown>,
) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

Deno.serve(async (request) => {
  const corsHeaders = getCorsHeaders(request.headers.get('origin'));
  if (!corsHeaders) {
    return jsonResponse({ error: 'Origin is not allowed.' }, 403);
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405, corsHeaders);
  }

  const authorization = request.headers.get('authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!authorization?.startsWith('Bearer ') || !supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: 'Authentication is required.' }, 401, corsHeaders);
  }

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        authorization,
      },
    });
    if (!authResponse.ok) {
      return jsonResponse({ error: 'Authentication is required.' }, 401, corsHeaders);
    }

    const authUser = await authResponse.json();
    const uid = typeof authUser.id === 'string' ? authUser.id.toLowerCase() : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uid)) {
      return jsonResponse({ error: 'Authenticated user ID is invalid.' }, 403, corsHeaders);
    }

    const requestBody = await request.json().catch(() => ({}));
    const requestedName = typeof requestBody?.name === 'string'
      ? requestBody.name.trim()
      : '';
    const metadataName = typeof authUser.user_metadata?.full_name === 'string'
      ? authUser.user_metadata.full_name.trim()
      : '';
    const name = Array.from(requestedName || metadataName || 'HackMate member')
      .slice(0, 100)
      .join('');
    const { apiKey, baseUrl } = getCometChatConfig();
    const userPath = `/users/${encodeURIComponent(uid)}`;

    if (requestBody?.synchronizeOnly === true) {
      const updateResponse = await requestCometChat(
        baseUrl,
        apiKey,
        userPath,
        'PUT',
        { name },
      );
      if (!updateResponse.ok) {
        console.error('CometChat profile synchronization failed.', { status: updateResponse.status });
        return jsonResponse({ error: 'Unable to synchronize the CometChat profile.' }, 502, corsHeaders);
      }
      return jsonResponse({ synchronized: true }, 200, corsHeaders);
    }

    const tokenResponse = await requestCometChat(
      baseUrl,
      apiKey,
      `${userPath}/auth_tokens`,
      'POST',
      {},
    );

    let tokenBody = await tokenResponse.json().catch(() => ({}));
    if (tokenResponse.status === 404) {
      const createResponse = await requestCometChat(
        baseUrl,
        apiKey,
        '/users',
        'POST',
        {
          uid,
          name,
          withAuthToken: true,
        },
      );
      tokenBody = await createResponse.json().catch(() => ({}));

      if (!createResponse.ok || typeof tokenBody?.data?.authToken !== 'string') {
        const retryTokenResponse = await requestCometChat(
          baseUrl,
          apiKey,
          `${userPath}/auth_tokens`,
          'POST',
          {},
        );
        tokenBody = await retryTokenResponse.json().catch(() => ({}));
        if (!retryTokenResponse.ok) {
          console.error('CometChat user provisioning/token request failed.', {
            createStatus: createResponse.status,
            tokenStatus: retryTokenResponse.status,
          });
          return jsonResponse({ error: 'Unable to authenticate with CometChat.' }, 502, corsHeaders);
        }
      }
    } else if (!tokenResponse.ok) {
      console.error('CometChat auth-token request failed.', { status: tokenResponse.status });
      return jsonResponse({ error: 'Unable to authenticate with CometChat.' }, 502, corsHeaders);
    }

    const authToken = tokenBody?.data?.authToken;
    if (typeof authToken !== 'string' || !authToken) {
      console.error('CometChat returned an invalid auth-token response.');
      return jsonResponse({ error: 'Unable to authenticate with CometChat.' }, 502, corsHeaders);
    }

    const updateResponse = await requestCometChat(
      baseUrl,
      apiKey,
      userPath,
      'PUT',
      { name },
    );
    if (!updateResponse.ok) {
      console.error('CometChat profile synchronization failed.', { status: updateResponse.status });
      return jsonResponse({ error: 'Unable to synchronize the CometChat profile.' }, 502, corsHeaders);
    }

    return jsonResponse({ authToken }, 200, corsHeaders);
  } catch (error) {
    console.error('CometChat token endpoint failed.', {
      message: error instanceof Error ? error.message : 'Unknown server error.',
    });
    return jsonResponse({ error: 'Unable to authenticate with CometChat.' }, 500, corsHeaders);
  }
});
