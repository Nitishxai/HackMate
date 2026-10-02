# HackMate Supabase setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env` and add your project URL and anon key.
3. For a new project, open the Supabase SQL editor and run `schema.sql`, then run the migrations in date order. For an existing project that already ran the earlier schema, run `migrations/20260930_connection_requests.sql`, `migrations/20260930_messages.sql`, `migrations/20261001_project_lifecycle.sql`, `migrations/20261002_project_request_lock_rls.sql`, and `migrations/20261003_project_management.sql` as applicable. The Phase 7 lifecycle migration must be applied before project creation, membership visibility for closed projects, and database-enforced join/decision rules work. It stops with an error if duplicate active project requests already exist; resolve those rows before retrying rather than deleting them automatically.
4. Ensure email auth is enabled in Authentication > Providers.
5. Refresh the app and sign up with email + password + name.

The schema creates:
- `profiles` for authenticated user profile data
- `skills` for the global skill catalog
- `profile_skills` for one-to-many profile-to-skill links
- `connection_requests` for protected direct connection requests

RLS policies ensure each user can only update their own profile. Authenticated users can discover public profiles and their skills only when `is_public = true`. Connection requests are visible only to their sender and receiver; only the receiver can accept or reject a pending request. A database constraint prevents duplicate active requests between a pair of users.

Skill compatibility is deterministic: exact normalized skill overlaps count twice as much as candidate-only skills, with the weighted total divided by twice the larger skill-list size. The result is naturally bounded from 0–100; no overlap is presented as a strong match, while candidate-only skills are shown as complementary when the current user has listed skills.

For Phase 5, run `20260930_messages.sql` in the SQL editor after the connection-request migration. It creates the private `messages` table, enforces accepted-connection-only inserts with RLS, grants connected users visibility of one another's profile cards for conversation headers, and adds the table to `supabase_realtime`. The app uses the anon key and the authenticated user's session; never configure a service-role key in Vite.

For Phase 7, run `20261001_project_lifecycle.sql` after the base schema and earlier migrations. It adds the atomic project-creation RPC, active join-request uniqueness, lifecycle/capacity enforcement, and policies that let accepted team members view their project, teammates, and project requirements. This migration has not been applied automatically by the frontend.

If Account B sees an open project but a join request fails with `Project not found`, run `20261002_project_request_lock_rls.sql` after the lifecycle migration. It updates the lifecycle trigger to lock the visible project under a constrained `SECURITY DEFINER` context; the trigger retains its explicit authenticated requester/owner, project status, membership, and capacity checks. This does not change project visibility policies.

For owner project management, run `20261003_project_management.sql` after the project lifecycle migrations. It adds a `SECURITY INVOKER` RPC that atomically updates project fields and required skills; the existing owner-only project and project-skill RLS policies remain responsible for authorization. Project deletion uses the existing owner-only delete policy, and existing foreign keys cascade removal of associated project skills, members, and join requests.

## Optional Phase 9 match explanations

Set `VITE_MATCH_INTELLIGENCE_URL` to an HTTPS endpoint you operate to enable AI-written match and team-gap explanations. Leave it empty to use the built-in deterministic explanations; matching scores, ordering, connection actions, and project workflows do not depend on the endpoint. The browser sends only project requirements/details and already-public candidate profile fields for the candidates currently recommended. The endpoint must enforce its own authentication, rate limits, and provider policy, keep any model API key server-side, and must not mutate Supabase data.

The endpoint accepts a JSON `POST` with `project` (`title`, `description`, `requiredSkills`, `teamSkills`, `missingSkills`) and `candidates` (each includes `profileId`, `name`, `role`, `bio`, `experience`, `skills`, `matchingMissingSkills`, `compatibilityScore`). It must return exactly this JSON shape:

```json
{
  "teamGapExplanation": "Plain-text explanation, at most 500 characters.",
  "candidateExplanations": [
    {
      "profileId": "one of the candidate profile IDs in the request",
      "explanation": "Plain-text explanation, at most 350 characters."
    }
  ]
}
```

Include exactly one explanation for each requested candidate and no other fields. Responses with unexpected IDs, HTML-like markup, missing/duplicate candidates, incorrect types, or overlong text are rejected and the deterministic explanation remains visible. The client never receives or stores provider credentials.
