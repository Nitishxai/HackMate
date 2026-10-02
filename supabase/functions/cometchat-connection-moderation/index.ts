type CometChatMessage = {
  sender?: unknown;
  receiver?: unknown;
  receiverType?: unknown;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  });
}

function isEqualConstantTime(actual: string, expected: string) {
  const actualBytes = new TextEncoder().encode(actual);
  const expectedBytes = new TextEncoder().encode(expected);
  let difference = actualBytes.length ^ expectedBytes.length;
  const maxLength = Math.max(actualBytes.length, expectedBytes.length);

  for (let index = 0; index < maxLength; index += 1) {
    difference |= (actualBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  }
  return difference === 0;
}

function findMessage(value: unknown, depth = 0): CometChatMessage | null {
  if (!value || typeof value !== 'object' || depth > 8) return null;

  if (
    'sender' in value &&
    'receiver' in value &&
    'receiverType' in value
  ) {
    return value as CometChatMessage;
  }

  for (const child of Object.values(value)) {
    const message = findMessage(child, depth + 1);
    if (message) return message;
  }
  return null;
}

function blocked(reason: string) {
  return jsonResponse({
    isMatchingCondition: true,
    confidence: 1,
    reason,
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const username = Deno.env.get('COMETCHAT_MODERATION_USERNAME') ?? '';
  const password = Deno.env.get('COMETCHAT_MODERATION_PASSWORD') ?? '';
  const expectedAuthorization = username && password
    ? `Basic ${btoa(`${username}:${password}`)}`
    : '';
  const actualAuthorization = request.headers.get('authorization') ?? '';
  if (!expectedAuthorization || !isEqualConstantTime(actualAuthorization, expectedAuthorization)) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  let payload: unknown;
  try {
    const rawPayload = await request.text();
    if (new TextEncoder().encode(rawPayload).byteLength > 1_000_000) {
      return blocked('Message payload is too large.');
    }
    payload = JSON.parse(rawPayload);
  } catch {
    return blocked('Message payload is invalid.');
  }

  const message = findMessage(payload);
  if (
    typeof message?.sender !== 'string' ||
    typeof message.receiver !== 'string' ||
    message.receiverType !== 'user'
  ) {
    return blocked('Only direct messages between accepted connections are allowed.');
  }

  const senderId = message.sender.toLowerCase();
  const receiverId = message.receiver.toLowerCase();
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  if (!uuidPattern.test(senderId) || !uuidPattern.test(receiverId) || senderId === receiverId) {
    return blocked('Only direct messages between accepted connections are allowed.');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('CometChat moderation is missing its Supabase server configuration.');
    return jsonResponse({ error: 'Connection verification is unavailable.' }, 503);
  }

  const query = new URLSearchParams({
    select: 'id',
    status: 'eq.accepted',
    limit: '1',
    or: `(and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId}))`,
  });

  try {
    const relationshipResponse = await fetch(
      `${supabaseUrl}/rest/v1/connection_requests?${query.toString()}`,
      {
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );
    if (!relationshipResponse.ok) {
      console.error('CometChat moderation could not verify the connection.', {
        status: relationshipResponse.status,
      });
      return jsonResponse({ error: 'Connection verification is unavailable.' }, 503);
    }

    const acceptedConnections = await relationshipResponse.json();
    if (!Array.isArray(acceptedConnections) || acceptedConnections.length === 0) {
      return blocked('Messages are allowed only between accepted HackMate connections.');
    }

    return jsonResponse({
      isMatchingCondition: false,
      confidence: 1,
      reason: '',
    });
  } catch (error) {
    console.error('CometChat connection moderation failed.', {
      message: error instanceof Error ? error.message : 'Unknown server error.',
    });
    return jsonResponse({ error: 'Connection verification is unavailable.' }, 503);
  }
});
