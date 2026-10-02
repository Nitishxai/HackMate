import { useMemo, useState } from 'react';
import ConnectionRequestsPanel from '../components/ConnectionRequestsPanel';
import TeammateCard from '../components/TeammateCard';
import TeammateProfileModal from '../components/TeammateProfileModal';
import { useConnectionRequests } from '../hooks/useConnectionRequests';
import { useDiscoverProfiles } from '../hooks/useDiscoverProfiles';
import {
  calculateProjectCandidateMatch,
  calculateProjectSkillGaps,
  calculateSkillMatch,
  uniqueSkillNames,
} from '../lib/matching';

function DiscoverPage({ profile, projectData, session, searchQuery = '', onSearch, onMessage, onNavigate }) {
  const [skillFilter, setSkillFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('');
  const [sortBy, setSortBy] = useState('compatibility');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [connectingId, setConnectingId] = useState('');
  const {
    profiles,
    loading: profilesLoading,
    error: profilesError,
    reload: reloadProfiles,
  } = useDiscoverProfiles(session);
  const connectionData = useConnectionRequests(session);
  const {
    requests,
    profilesByUserId,
    incomingRequests,
    loading: requestsLoading,
    error: requestError,
    actionError,
    busyRequestId,
    getConnectionState,
    sendRequest,
    respondToRequest,
    reload: reloadRequests,
  } = connectionData;
  const currentSkills = useMemo(() => profile?.skills || [], [profile?.skills]);
  const activeProjects = useMemo(
    () => [...new Map([
      ...(projectData?.myProjects || []),
      ...(projectData?.joinedProjects || []),
    ].map((project) => [project.id, project])).values()],
    [projectData?.myProjects, projectData?.joinedProjects],
  );
  const missingProjectSkills = useMemo(
    () => uniqueSkillNames(activeProjects.flatMap((project) =>
      calculateProjectSkillGaps(project.skills, project.currentMembers).missingSkills,
    )),
    [activeProjects],
  );

  const skills = useMemo(
    () => [...new Set(profiles.flatMap((person) => person.skills))].sort((a, b) => a.localeCompare(b)),
    [profiles],
  );
  const roles = useMemo(
    () => [...new Set(profiles.map((person) => person.role).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [profiles],
  );
  const availabilities = useMemo(
    () => [...new Set(profiles.map((person) => person.availability).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [profiles],
  );

  const visibleProfiles = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return profiles
      .map((person) => ({
        person,
        match: calculateSkillMatch(currentSkills, person.skills),
        projectMatch: calculateProjectCandidateMatch(missingProjectSkills, person.skills),
      }))
      .filter(({ person }) => {
        const matchesSearch = !query ||
          person.name.toLocaleLowerCase().includes(query) ||
          person.username.toLocaleLowerCase().includes(query);
        const matchesSkill = !skillFilter || person.skills.some(
          (skill) => skill.toLocaleLowerCase() === skillFilter.toLocaleLowerCase(),
        );
        return matchesSearch &&
          matchesSkill &&
          (!roleFilter || person.role === roleFilter) &&
          (!availabilityFilter || person.availability === availabilityFilter);
      })
      .sort((left, right) => {
        if (sortBy === 'recent') {
          return Date.parse(right.person.updatedAt) - Date.parse(left.person.updatedAt);
        }
        return right.match.score - left.match.score ||
          left.person.name.localeCompare(right.person.name);
      });
  }, [profiles, currentSkills, missingProjectSkills, searchQuery, skillFilter, roleFilter, availabilityFilter, sortBy]);

  const handleConnect = async (userId) => {
    setConnectingId(userId);
    try {
      await sendRequest(userId);
    } catch {
      // The connection hook records the failure for its inline status message.
    } finally {
      setConnectingId('');
    }
  };

  const handleRespond = async (requestId, status) => {
    try {
      await respondToRequest(requestId, status);
    } catch {
      // The hook keeps the server error visible in the request status panel.
    }
  };

  const selectedMatch = selectedProfile
    ? calculateSkillMatch(currentSkills, selectedProfile.skills)
    : null;
  const noSkillOverlap = visibleProfiles.length > 0 &&
    visibleProfiles.every(({ match }) => match.matchingSkills.length === 0);

  return (
    <div className="page">
      <section className="section-block compact">
        <div>
          <div className="eyebrow">Find teammates</div>
          <h2>Discover Teammates</h2>
          <p className="section-subtitle">
            Explore public profiles, compare skills, and find teammates for projects you are building.
          </p>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            void reloadProfiles();
            void reloadRequests();
          }}
          disabled={profilesLoading || requestsLoading}
        >
          Refresh
        </button>
      </section>

      <section className="discover-summary stats-grid" aria-label="Discover summary">
        <article className="discover-summary-card">
          <span>Public builders</span>
          <strong>{profilesLoading ? '…' : profilesError ? '—' : profiles.length}</strong>
        </article>
        <article className="discover-summary-card">
          <span>My connections</span>
          <strong>{requestsLoading ? '…' : requestError ? '—' : connectionData.connections.length}</strong>
        </article>
        <article className="discover-summary-card">
          <span>Pending requests</span>
          <strong>
            {requestsLoading ? '…' : requestError ? '—' : connectionData.incomingRequests.length + connectionData.outgoingRequests.length}
          </strong>
        </article>
      </section>

      {missingProjectSkills.length > 0 && (
        <div className="project-fit-banner">
          <div>
            <div className="eyebrow">Project-aware discovery</div>
            <p>Prioritize public teammates who bring skills missing from your teams.</p>
            <div className="skill-pills">
              {missingProjectSkills.map((skill) => <span key={skill}>{skill}</span>)}
            </div>
          </div>
          <button type="button" className="ghost-button" onClick={() => onNavigate?.('projects')}>
            View projects →
          </button>
        </div>
      )}

      <section className="filters-bar discover-filters" aria-label="Filter teammates">
        <label className="filter-field wide">
          <span>Search name or username</span>
          <input
            type="search"
            value={searchQuery}
            onChange={onSearch}
            placeholder="Search by name or username"
          />
        </label>
        <label className="filter-field">
          <span>Skill</span>
          <select value={skillFilter} onChange={(event) => setSkillFilter(event.target.value)}>
            <option value="">Any skill</option>
            {skills.map((skill) => <option key={skill} value={skill}>{skill}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Role</span>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">Any role</option>
            {roles.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Availability</span>
          <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)}>
            <option value="">Any availability</option>
            {availabilities.map((availability) => (
              <option key={availability} value={availability}>{availability}</option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Sort by</span>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="compatibility">Compatibility</option>
            <option value="recent">Recently updated</option>
          </select>
        </label>
      </section>

      {profilesError && (
        <div className="form-status-panel" data-tone="error">
          <span>Unable to load teammates. Please try again.</span>
          <button type="button" className="text-button" onClick={() => void reloadProfiles()}>Retry</button>
        </div>
      )}
      {actionError && <div className="form-status-panel" data-tone="error">{actionError}</div>}
      {requestError && (
        <div className="form-status-panel" data-tone="error">
          <span>Unable to load connection requests. Please try again.</span>
          <button type="button" className="text-button" onClick={() => void reloadRequests()}>Retry</button>
        </div>
      )}
      {profilesLoading ? (
        <div className="empty-state-card" role="status">Finding teammates...</div>
      ) : profilesError ? null : profiles.length === 0 ? (
        <div className="empty-state-card">No teammates found yet.</div>
      ) : visibleProfiles.length === 0 ? (
        <div className="empty-state-card discover-empty-state">
          <h3>No teammates match these filters</h3>
          <p>Try broadening your filters or complete your profile to improve your recommendations.</p>
          <div className="teammate-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setSkillFilter('');
                setRoleFilter('');
                setAvailabilityFilter('');
                if (onSearch) onSearch({ target: { value: '' } });
              }}
            >
              Clear filters
            </button>
            <button type="button" className="primary-button small" onClick={() => onNavigate?.('profile')}>
              Complete profile
            </button>
          </div>
        </div>
      ) : (
        <>
          {noSkillOverlap && (
            <div className="status-banner status-info">
              No strong skill matches yet. These profiles may still bring complementary skills.
            </div>
          )}
          <section className="discover-grid" aria-label="Public teammate profiles">
            {visibleProfiles.map(({ person, match, projectMatch }) => {
              const connectionState = getConnectionState(person.id);
              return (
                <TeammateCard
                  key={person.id}
                  person={person}
                  match={match}
                  projectMatch={projectMatch}
                  connectionState={connectionState}
                  onViewProfile={() => setSelectedProfile(person)}
                  onConnect={() => void handleConnect(person.id)}
                  onRespond={(status) => {
                    const request = incomingRequests.find((item) => item.senderId === person.id);
                    if (request) void handleRespond(request.id, status);
                  }}
                  onMessage={() => onMessage?.(person.id)}
                  connecting={connectingId === person.id || requestsLoading}
                  busyRequest={incomingRequests.some((item) => item.senderId === person.id && item.id === busyRequestId)}
                />
              );
            })}
          </section>
        </>
      )}

      <ConnectionRequestsPanel
        requests={requests}
        profilesByUserId={profilesByUserId}
        currentUserId={session?.user?.id}
        onRespond={handleRespond}
        busyRequestId={busyRequestId}
      />

      <TeammateProfileModal
        profile={selectedProfile}
        match={selectedMatch}
        onClose={() => setSelectedProfile(null)}
        connectionState={selectedProfile ? getConnectionState(selectedProfile.id) : 'none'}
        onConnect={() => selectedProfile && void handleConnect(selectedProfile.id)}
        onMessage={() => selectedProfile && onMessage?.(selectedProfile.id)}
        connecting={selectedProfile ? connectingId === selectedProfile.id || requestsLoading : false}
      />
    </div>
  );
}

export default DiscoverPage;
