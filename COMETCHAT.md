# CometChat direct messaging

HackMate uses the CometChat React UI Kit for one-to-one conversations. The Supabase Messages implementation remains available as a fallback. Each CometChat UID is the authenticated Supabase user's UUID.

## Authentication

The browser initializes the UI Kit with the public App ID and Region, then requests a per-user token from the `cometchat-auth-token` Supabase Edge Function. The function verifies the Supabase access token, derives the CometChat UID from the verified Supabase user, provisions the CometChat user if needed, and mints an auth token with the server-side CometChat REST API key. The client signs in with `CometChatUIKit.loginWithAuthToken(token)`.

The CometChat REST API key and Supabase service-role key must only be configured as Supabase server secrets. Do not use `VITE_` variables for credentials. `VITE_COMETCHAT_APP_ID` and `VITE_COMETCHAT_REGION` are public configuration values; the CometChat Auth Key is not used by the client.

If a previous build containing the CometChat Auth Key was deployed or shared, rotate that key in the CometChat Dashboard. The current client no longer reads or needs it.

## Accepted-connection enforcement

CometChat's Custom API moderation is used because the UI Kit sends messages directly to CometChat. The `cometchat-connection-moderation` Edge Function verifies the CometChat Basic Auth header, extracts the sender/recipient from CometChat's message payload, and checks the current accepted relationship in Supabase. Unaccepted, invalid, non-user, or self-directed messages are rejected. A failed relationship lookup returns an error so CometChat can block rather than approve the message.

**Do not consider the CometChat connection rule active until the CometChat Dashboard rule is enabled and configured to block on Custom API errors.** Configure the existing CometChat app (App ID `168409683ef2d4443`, Region `in`) as follows:

1. Deploy both functions and set server secrets (never put these in Vite):

   ```powershell
   supabase functions deploy cometchat-auth-token
   supabase functions deploy cometchat-connection-moderation
   supabase secrets set COMETCHAT_APP_ID=168409683ef2d4443 COMETCHAT_REGION=in COMETCHAT_REST_API_KEY=<REST_API_KEY> HACKMATE_ALLOWED_ORIGINS=<APP_ORIGIN>,http://localhost:5173 COMETCHAT_MODERATION_USERNAME=<RANDOM_USERNAME> COMETCHAT_MODERATION_PASSWORD=<RANDOM_PASSWORD>
   ```

   `COMETCHAT_REST_API_KEY` is the server-side REST API key from the CometChat Dashboard, not the Auth Key. `HACKMATE_ALLOWED_ORIGINS` must list the exact browser origins used by HackMate. Generate unique moderation Basic Auth credentials and set the same username/password in the Dashboard and the Supabase secrets. Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions.

2. In the CometChat Dashboard, open **Moderation → Settings → List**, add a **Custom API** list pointing to:

   ```text
   https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/cometchat-connection-moderation
   ```

   Enable Basic Auth and enter the same moderation username/password configured as Supabase secrets.

3. Under **Moderation → Settings → Advanced Settings**, set **On Custom API Error** to **Block Message**.

4. Create and enable a moderation rule using that Custom API list. Apply it to every direct-message type/category enabled for the CometChat app, with an action that blocks when the endpoint returns a match. Do not enable a rule that approves on endpoint failure.

5. Run two-account checks: accepted users can exchange messages; pending, rejected, and unrelated users cannot send; removing an accepted relationship blocks subsequent sends. Verify the CometChat Dashboard shows the moderation calls.

The frontend accepted-connections list is only a presentation gate; the enabled server moderation rule is the enforcement boundary. CometChat auth tokens are user-scoped but do not encode pairwise Supabase relationships.

## Local setup

Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_COMETCHAT_APP_ID`, and `VITE_COMETCHAT_REGION` in the root `.env`. Never set a CometChat Auth Key or REST API key as a Vite variable. Set the Supabase Edge Function secrets using the Supabase CLI before testing token login.

## Scope and validation

Presence is shown by the CometChat message header. Message search depends on the CometChat app plan. Team/group chat, calls, attachments, reactions, and other later-phase UI features are not enabled in HackMate's message UI.

Run `npm run lint` and `npm run build` to validate the frontend. Check built assets for credentials before deployment.
