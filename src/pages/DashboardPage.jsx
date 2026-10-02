import { useMemo, useState } from 'react';
import ConnectionRequestsPanel from '../components/ConnectionRequestsPanel';
import ProjectCard from '../components/ProjectCard';
import ProjectDetailModal from '../components/ProjectDetailModal';
import StatCard from '../components/StatCard';
import TeammateCard from '../components/TeammateCard';
import TeammateProfileModal from '../components/TeammateProfileModal';
import { useConnectionRequests } from '../hooks/useConnectionRequests';
import { useDiscoverProfiles } from '../hooks/useDiscoverProfiles';
import { buildRecentActivity, formatActivityDate } from '../lib/activity';
import {
  calculateProjectCandidateMatch,
  calculateProjectSkillGaps,
  calculateSkillMatch,
  uniqueSkillNames,
} from '../lib/matching';
import { getProfileCompletion } from '../lib/profileStorage';

const EMPTY_LIST = [];

function DashboardPage({ profile, projectData, session, onNavigate, onMessage }) {
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const profileName = profile?.name || 'HackMate';
  const currentUserId = session?.user?.id;
  const completion = getProfileCompletion(profile || {});
  const { profiles, loading: profilesLoading, error: profilesError } = useDiscoverProfiles(session);
  const connectionData = useConnectionRequests(session);
  const {
    requests,
    profilesByUserId,
    connections,
    incomingRequests,
    outgoingRequests,
    loading: connectionsLoading,
    error: connectionsError,
    actionError,
    busyRequestId,
    getConnectionState,
    sendRequest,
    respondToRequest,
  } = connectionData;

  const ownedProjects = projectData?.myProjects || EMPTY_LIST;
  const joinedProjects = projectData?.joinedProjects || EMPTY_LIST;
  const activeProjects = useMemo(
    () => [...new Map([...ownedProjects, ...joinedProjects].map((project) => [project.id, project])).values()],
    [ownedProjects, joinedProjects],
  );

  const missingProjectSkills = useMemo(
    () => uniqueSkillNames(activeProjects.flatMap((project) =>
      calculateProjectSkillGaps(project.skills, project.currentMembers).missingSkills,
    )),
    [activeProjects],
  );

  const recommendations = useMemo(() => {
    const memberIds = new Set(activeProjects.flatMap((project) =>
      project.currentMembers.map((member) => member.user_id),
    ));
    return profiles
      .filter((person) => person.id !== currentUserId && !memberIds.has(person.id))
      .map((person) => ({
        person,
        match: calculateSkillMatch(profile?.skills || [], person.skills),
        projectMatch: calculateProjectCandidateMatch(missingProjectSkills, person.skills),
      }))
      .filter(({ person }) => getConnectionState(person.id) !== 'connected')
      .sort((left, right) => (
        (missingProjectSkills.length
          ? right.projectMatch.score - left.projectMatch.score
          : 0) ||
        right.match.score - left.match.score ||
        left.person.name.localeCompare(right.person.name)
      ));
  }, [profiles, currentUserId, activeProjects, profile?.skills, missingProjectSkills, getConnectionState]);

  const activity = useMemo(
    () => buildRecentActivity(
      ownedProjects,
      requests,
      currentUserId,
      joinedProjects,
      profilesByUserId,
    ),
    [ownedProjects, requests, currentUserId, joinedProjects, profilesByUserId],
  );
  const currentSelectedProject = selectedProject
    ? projectData?.projects?.find((project) => project.id === selectedProject.id) || selectedProject
    : null;

  const handleConnect = async (userId) => {
    try {
      await sendRequest(userId);
    } catch {
      // The connection hook exposes the failure through actionError.
    }
  };

  const statCards = [
    {
      label: 'My Projects',
      value: projectData?.loading ? '…' : projectData?.error ? '—' : String(activeProjects.length),
      accent: 'violet',
    },
    {
      label: 'Connections',
      value: connectionsLoading ? '…' : connectionsError ? '—' : String(connections.length),
      accent: 'blue',
    },
    {
      label: 'Pending Requests',
      value: connectionsLoading ? '…' : connectionsError ? '—' : String(incomingRequests.length + outgoingRequests.length),
      accent: 'cyan',
    },
    {
      label: 'Recommended Teammates',
      value: profilesLoading ? '…' : profilesError ? '—' : String(recommendations.length),
      accent: 'green',
    },
  ];

  return (
    <div className="page">
      <section className="section-block">
        <div>
          <div className="eyebrow">Your workspace</div>
          <h2>Good to see you, {profileName}.</h2>
          <p className="section-subtitle">
            Your projects, connections, and next teammate opportunities in one place.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={() => onNavigate?.('profile')}>
          Profile {completion}% complete
        </button>
      </section>

      {actionError && <div className="form-status-panel" data-tone="error" role="alert">{actionError}</div>}
      {(projectData?.error || connectionsError || profilesError) && (
        <div className="form-status-panel" data-tone="error" role="alert">
          Some dashboard information could not be loaded. Refresh the page to try again.
        </div>
      )}

      <section className="stats-grid" aria-label="Your HackMate activity">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </section>

      <section className="section-block dashboard-content-grid">
        <div className="dashboard-main-column">
          <div className="section-header row-between">
            <div>
              <div className="eyebrow">Build together</div>
              <h3>Your projects</h3>
            </div>
            <button type="button" className="text-button" onClick={() => onNavigate?.('projects')}>
              Browse projects →
            </button>
          </div>
          {projectData?.loading ? (
            <div className="empty-state-card" role="status">Loading your project activity…</div>
          ) : activeProjects.length ? (
            <section className="projects-grid" aria-label="Your projects">
              {activeProjects.slice(0, 4).map((project) => (
                <ProjectCard key={project.id} project={project} onView={setSelectedProject} />
              ))}
            </section>
          ) : (
            <div className="empty-state-card">
              <h3>Start with a project</h3>
              <p>Create a project or explore teams looking for your skills.</p>
              <button type="button" className="primary-button" onClick={() => onNavigate?.('projects')}>
                Create or find a project →
              </button>
            </div>
          )}
        </div>

        <aside className="dashboard-activity-card">
          <div className="eyebrow">From your activity</div>
          <h3>Recent updates</h3>
          {connectionsLoading || projectData?.loading ? (
            <p className="section-supporting-text" role="status">Loading your activity…</p>
          ) : activity.length ? (
            <ul className="activity-list">
              {activity.map((item) => (
                <li key={item.id}>
                  <span className={`activity-marker ${item.type}`} aria-hidden="true" />
                  <div>
                    <p>{item.label}</p>
                    <time dateTime={item.createdAt}>{formatActivityDate(item.createdAt)}</time>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="section-supporting-text">Your project and connection activity will appear here.</p>
          )}
        </aside>
      </section>

      <section className="section-block">
        <div className="section-header row-between">
          <div>
            <div className="eyebrow">Public HackMate profiles</div>
            <h3>People to build with</h3>
          </div>
          <button type="button" className="ghost-button" onClick={() => onNavigate?.('discover')}>
            Explore Discover →
          </button>
        </div>
        {profilesLoading ? (
          <div className="empty-state-card" role="status">Finding teammates…</div>
        ) : profilesError ? (
          <div className="empty-state-card">Recommended profiles are temporarily unavailable.</div>
        ) : recommendations.length ? (
          <section className="discover-grid" aria-label="Recommended public profiles">
            {recommendations.slice(0, 3).map(({ person, match, projectMatch }) => (
              <TeammateCard
                key={person.id}
                person={person}
                match={match}
                projectMatch={projectMatch}
                connectionState={getConnectionState(person.id)}
                onViewProfile={() => setSelectedProfile(person)}
                onConnect={() => void handleConnect(person.id)}
                onRespond={(status) => {
                  const request = incomingRequests.find((item) => item.senderId === person.id);
                  if (request) void respondToRequest(request.id, status).catch(() => {});
                }}
                onMessage={() => onMessage?.(person.id)}
                connecting={connectionsLoading}
                busyRequest={incomingRequests.some((item) => item.senderId === person.id && item.id === busyRequestId)}
              />
            ))}
          </section>
        ) : (
          <div className="empty-state-card">
            <h3>No recommendations yet</h3>
            <p>Complete your public profile and skills to discover relevant teammates.</p>
            <button type="button" className="secondary-button" onClick={() => onNavigate?.('discover')}>
              Browse all public profiles
            </button>
          </div>
        )}
      </section>

      <ConnectionRequestsPanel
        requests={requests}
        profilesByUserId={profilesByUserId}
        currentUserId={currentUserId}
        onRespond={(id, status) => void respondToRequest(id, status).catch(() => {})}
        busyRequestId={busyRequestId}
      />

      <ProjectDetailModal
        isOpen={Boolean(selectedProject)}
        project={currentSelectedProject}
        currentUserId={currentUserId}
        session={session}
        onMessage={onMessage}
        requests={projectData?.requests || []}
        skillCatalog={projectData?.skillCatalog || []}
        onClose={() => setSelectedProject(null)}
        onRequestJoin={projectData?.requestToJoin}
        onManageRequest={projectData?.handleProjectRequest}
        onUpdateProject={projectData?.updateProject}
        onDeleteProject={projectData?.deleteProject}
      />
      <TeammateProfileModal
        profile={selectedProfile}
        match={selectedProfile ? calculateSkillMatch(profile?.skills || [], selectedProfile.skills) : null}
        onClose={() => setSelectedProfile(null)}
        connectionState={selectedProfile ? getConnectionState(selectedProfile.id) : 'none'}
        onConnect={() => selectedProfile && void handleConnect(selectedProfile.id)}
        onMessage={() => selectedProfile && onMessage?.(selectedProfile.id)}
        connecting={connectionsLoading}
      />
    </div>
  );
}

export default DashboardPage;
