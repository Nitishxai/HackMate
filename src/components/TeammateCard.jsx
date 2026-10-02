import { getProfileCompletion } from '../lib/profileStorage';
import { isSafeExternalUrl } from '../lib/safeUrl';

function TeammateCard({
  person,
  match,
  connectionState,
  onViewProfile,
  onConnect,
  onRespond,
  onMessage,
  connecting,
  busyRequest = false,
  projectMatch,
}) {
  const initials = person.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('');
  const skills = Array.isArray(person.skills) ? person.skills : [];
  const visibleSkills = skills.slice(0, 6);
  const additionalSkillCount = Math.max(0, skills.length - visibleSkills.length);
  const connectionLabels = {
    pending: 'Request Sent',
    incoming: 'Incoming Request',
    connected: 'Connected',
    rejected: 'Request Declined',
    none: 'Connect',
  };

  return (
    <article className="discover-card">
      <div className="discover-card-head">
        <div className="teammate-avatar small" aria-hidden="true">{initials}</div>
        <div className="teammate-identity">
          <h3>{person.name}</h3>
          {person.username && <p className="teammate-username">@{person.username}</p>}
        </div>
        <div className="teammate-match-summary">
          <span className="match-badge" title="Deterministic skill compatibility">
            <strong>{match.score}%</strong>
            <span>match</span>
          </span>
          {projectMatch?.totalMatchingSkills > 0 && (
            <span className="project-match-badge" title="Skills that address your project gaps">
              {projectMatch.score}% project fit
            </span>
          )}
        </div>
      </div>

      <p className="teammate-role">{person.role || 'Role not set'}</p>
      <p className="teammate-bio">{person.bio || 'No bio provided.'}</p>

      <div className="teammate-skills">
        <span className="skill-match-label">SKILLS</span>
        <div className="skill-pills">
          {visibleSkills.length ? (
            visibleSkills.map((skill) => <span key={skill}>{skill}</span>)
          ) : (
            <small>No skills listed</small>
          )}
          {additionalSkillCount > 0 && (
            <span className="teammate-more-skills">+{additionalSkillCount}</span>
          )}
        </div>
      </div>

      {projectMatch?.totalMatchingSkills > 0 && (
        <div className="teammate-project-skills">
          <span className="skill-match-label complementary-label">PROJECT GAPS COVERED</span>
          <div className="skill-pills">
            {projectMatch.matchingMissingSkills.map((skill) => <span className="fill-chip" key={skill}>{skill}</span>)}
          </div>
        </div>
      )}

      <div className="teammate-match-metrics" aria-label="Skill match details">
        <span>
          <strong>{match.matchingSkills.length}</strong>
          Matched skills
        </span>
        <span>
          <strong>{match.complementarySkills.length}</strong>
          Complementary
        </span>
      </div>

      <div className="availability-row teammate-availability">
        <span className="meta-label">Availability</span>
        <span className="availability-pill">{person.availability || 'Not specified'}</span>
      </div>

      <div className="teammate-link-row">
        {isSafeExternalUrl(person.github) && <a href={person.github} target="_blank" rel="noreferrer">GitHub</a>}
        {isSafeExternalUrl(person.portfolio) && <a href={person.portfolio} target="_blank" rel="noreferrer">Portfolio</a>}
        <span className="teammate-profile-completion">{getProfileCompletion(person)}% profile</span>
      </div>

      <div className="teammate-actions">
        <button type="button" className="ghost-button" onClick={onViewProfile}>View Profile</button>
        {connectionState === 'connected' ? (
          <button type="button" className="primary-button small" onClick={onMessage}>
            Message →
          </button>
        ) : connectionState === 'incoming' ? (
          <>
            <button
              type="button"
              className="ghost-button"
              onClick={() => onRespond?.('rejected')}
              disabled={busyRequest}
            >
              Decline
            </button>
            <button
              type="button"
              className="primary-button small"
              onClick={() => onRespond?.('accepted')}
              disabled={busyRequest}
            >
              {busyRequest ? 'Saving…' : 'Accept'}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="primary-button small"
            onClick={onConnect}
            disabled={connectionState !== 'none' || connecting}
          >
            {connecting ? 'Sending…' : connectionLabels[connectionState]}
          </button>
        )}
      </div>
    </article>
  );
}

export default TeammateCard;
