import { getProfileCompletion } from '../lib/profileStorage';
import { isSafeExternalUrl } from '../lib/safeUrl';

function TeammateProfileModal({
  profile,
  match,
  onClose,
  connectionState,
  onConnect,
  onMessage,
  connecting,
}) {
  if (!profile) return null;

  const initials = profile.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="teammate-profile-title">
      <section className="profile-editor teammate-profile-modal">
        <div className="editor-header">
          <div>
            <div className="eyebrow">Public teammate profile</div>
            <h3 id="teammate-profile-title">{profile.name}</h3>
          </div>
          <button type="button" className="icon-close" onClick={onClose} aria-label="Close profile">×</button>
        </div>
        <div className="teammate-modal-summary">
          <div className="teammate-avatar">{initials}</div>
          <div>
            {profile.username && <p className="profile-role">@{profile.username}</p>}
            <p className="profile-role">{profile.role || 'Role not set'}</p>
            <span className="availability-pill">{profile.availability || 'Availability not specified'}</span>
          </div>
          <span className="match-badge">{match.score}% match</span>
        </div>
        <div className="teammate-modal-section">
          <h4>About</h4>
          <p>{profile.bio || 'No bio provided.'}</p>
        </div>
        <div className="teammate-modal-section">
          <h4>Skills</h4>
          <div className="skill-pills">
            {profile.skills.length ? profile.skills.map((skill) => <span key={skill}>{skill}</span>) : <small>No skills listed.</small>}
          </div>
        </div>
        <div className="teammate-modal-section">
          <h4>Skill fit</h4>
          <p>{getProfileCompletion(profile)}% profile completion</p>
          <div className="skill-match-group">
            <span className="skill-match-label">MATCHED</span>
            <div className="skill-pills">
              {match.matchingSkills.length ? match.matchingSkills.map((skill) => <span key={skill}>{skill}</span>) : <small>No overlapping skills yet.</small>}
            </div>
          </div>
          <div className="skill-match-group">
            <span className="skill-match-label complementary-label">COMPLEMENTARY</span>
            <div className="skill-pills">
              {match.complementarySkills.length
                ? match.complementarySkills.map((skill) => <span className="fill-chip" key={skill}>{skill}</span>)
                : <small>{match.hasCurrentSkills ? 'No additional skills listed.' : 'Add skills to your profile to see skill gaps.'}</small>}
            </div>
          </div>
        </div>
        {(isSafeExternalUrl(profile.github) || isSafeExternalUrl(profile.portfolio)) && (
          <div className="teammate-modal-section teammate-link-row">
            {isSafeExternalUrl(profile.github) && <a href={profile.github} target="_blank" rel="noreferrer">GitHub</a>}
            {isSafeExternalUrl(profile.portfolio) && <a href={profile.portfolio} target="_blank" rel="noreferrer">Portfolio</a>}
          </div>
        )}
        <div className="editor-actions">
          <button type="button" className="ghost-button" onClick={onClose}>Close</button>
          {connectionState === 'connected' ? (
            <button type="button" className="primary-button" onClick={onMessage}>Message →</button>
          ) : (
            <button
              type="button"
              className="primary-button"
              disabled={connectionState !== 'none' || connecting}
              onClick={onConnect}
            >
              {connecting ? 'Sending…' : connectionState === 'none' ? 'Connect' : connectionState === 'pending' ? 'Request Sent' : connectionState === 'incoming' ? 'Incoming Request' : 'Request Declined'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

export default TeammateProfileModal;
