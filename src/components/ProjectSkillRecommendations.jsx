import { useMemo, useState } from 'react';
import TeammateProfileModal from './TeammateProfileModal';
import { calculateProjectCandidateMatch, calculateProjectSkillGaps, calculateSkillMatch } from '../lib/matching';
import { useProjectRecommendationData } from '../hooks/useProjectRecommendationData';
import { useMatchIntelligence } from '../hooks/useMatchIntelligence';

function ProjectSkillRecommendations({
  project,
  currentUserId,
  session,
  onMessage,
}) {
  const [selectedProfile, setSelectedProfile] = useState(null);
  const recommendationData = useProjectRecommendationData(session);
  const {
    profiles,
    profilesLoading,
    profilesError,
    connectionLoading,
    connectionError,
    actionError,
    getConnectionState,
    connectingId,
    connect,
    reload,
  } = recommendationData;
  const recommendationsReady = !profilesLoading && !profilesError && !connectionLoading && !connectionError;
  const skillGaps = useMemo(
    () => calculateProjectSkillGaps(project.skills, project.currentMembers),
    [project.currentMembers, project.skills],
  );
  const memberIds = useMemo(
    () => new Set(project.currentMembers.map((member) => member.user_id)),
    [project.currentMembers],
  );
  const recommendations = useMemo(() => {
    if (!skillGaps.missingSkills.length) return [];
    return profiles
      .filter((candidate) =>
        candidate.isPublic === true &&
        candidate.id !== currentUserId &&
        candidate.id !== project.ownerId &&
        !memberIds.has(candidate.id),
      )
      .map((person) => ({
        person,
        match: calculateProjectCandidateMatch(skillGaps.missingSkills, person.skills),
      }))
      .filter(({ match }) => match.totalMatchingSkills > 0)
      .sort((left, right) =>
        right.match.totalMatchingSkills - left.match.totalMatchingSkills ||
        right.match.score - left.match.score ||
        left.person.name.localeCompare(right.person.name),
      )
      .slice(0, 6);
  }, [currentUserId, memberIds, profiles, project.ownerId, skillGaps.missingSkills]);
  const { explanation } = useMatchIntelligence(project, skillGaps, recommendations);
  const selectedProfileMatch = selectedProfile
    ? calculateSkillMatch(skillGaps.teamSkills, selectedProfile.skills)
    : null;

  return (
    <section className="project-recommendations" aria-labelledby="project-skill-gaps-title">
      <div className="project-meta-block">
        <span id="project-skill-gaps-title">Skill Gaps</span>
        {skillGaps.missingSkills.length ? (
          <>
            <p className="project-gap-explanation">{explanation.teamGapExplanation}</p>
            <div className="skill-pills">
              {skillGaps.missingSkills.map((skill) => <span className="fill-chip" key={skill}>{skill}</span>)}
            </div>
          </>
        ) : (
          <p className="empty-copy">Your current team covers all required skills.</p>
        )}
      </div>

      {skillGaps.missingSkills.length > 0 && (
        <div className="project-recommended-teammates">
          <div>
            <h4>Recommended Teammates</h4>
            <p className="section-supporting-text">Public profiles with skills that can fill this project&apos;s gaps.</p>
          </div>
          {profilesLoading ? (
            <div className="empty-state-card" role="status">Finding matching teammates…</div>
          ) : profilesError ? (
            <div className="form-status-panel" data-tone="error" role="alert">
              <span>Unable to load teammate recommendations.</span>
              <button type="button" className="text-button" onClick={reload}>Retry</button>
            </div>
          ) : connectionError ? (
            <div className="form-status-panel" data-tone="error" role="alert">
              <span>Unable to load connection status. Retry before connecting or messaging.</span>
              <button type="button" className="text-button" onClick={reload}>Retry</button>
            </div>
          ) : !recommendationsReady ? (
            <div className="empty-state-card" role="status">Loading connection status…</div>
          ) : recommendations.length ? (
            <div className="project-recommendation-list">
              {recommendations.map(({ person, match }) => {
                const connectionState = getConnectionState(person.id);
                const isConnecting = connectingId === person.id;
                return (
                  <article className="project-recommendation-card" key={person.id}>
                    <div className="project-recommendation-heading">
                      <div>
                        <strong>{person.name}</strong>
                        <p>{person.role || 'Role not set'}</p>
                      </div>
                      <span className="match-badge" title="Share of project skill gaps this profile covers">
                        {match.score}% fit
                      </span>
                    </div>
                    <div className="project-match-explanation">
                      <strong>Why this match?</strong>
                      <p>{explanation.candidateExplanations[person.id]}</p>
                      {explanation.source === 'ai' && <span className="ai-explanation-label">AI-assisted insight</span>}
                    </div>
                    <div className="skill-match-group">
                      <span className="skill-match-label">MATCHES MISSING SKILLS</span>
                      <div className="skill-pills">
                        {match.matchingMissingSkills.map((skill) => <span className="fill-chip" key={skill}>{skill}</span>)}
                      </div>
                    </div>
                    <div className="project-recommendation-actions">
                      <button type="button" className="ghost-button small" onClick={() => setSelectedProfile(person)}>
                        View Profile
                      </button>
                      {connectionState === 'connected' ? (
                        <button type="button" className="primary-button small" onClick={() => onMessage(person.id)}>
                          Message
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="primary-button small"
                          disabled={connectionState !== 'none' || isConnecting}
                          onClick={() => void connect(person.id)}
                        >
                          {isConnecting
                            ? 'Sending…'
                            : connectionState === 'pending'
                              ? 'Request Sent'
                              : connectionState === 'incoming'
                                ? 'Incoming Request'
                                : connectionState === 'rejected'
                                  ? 'Request Declined'
                                  : 'Connect'}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state-card">No matching teammates found yet.</div>
          )}
          {actionError && <div className="form-status-panel" data-tone="error" role="alert">{actionError}</div>}
        </div>
      )}

      <TeammateProfileModal
        profile={selectedProfile}
        match={selectedProfileMatch}
        onClose={() => setSelectedProfile(null)}
        connectionState={selectedProfile ? getConnectionState(selectedProfile.id) : 'none'}
        onConnect={() => selectedProfile && void connect(selectedProfile.id)}
        onMessage={() => selectedProfile && onMessage(selectedProfile.id)}
        connecting={
          selectedProfile
            ? connectingId === selectedProfile.id || connectionLoading || Boolean(connectionError)
            : false
        }
      />
    </section>
  );
}

export default ProjectSkillRecommendations;
