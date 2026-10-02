import { useMemo, useState } from 'react';
import ProjectCard from '../components/ProjectCard';
import ProjectDetailModal from '../components/ProjectDetailModal';
import ProfileEditorModal from '../components/ProfileEditorModal';
import { useConnectionRequests } from '../hooks/useConnectionRequests';
import { buildRecentActivity, formatActivityDate } from '../lib/activity';
import { calculateProjectSkillGaps } from '../lib/matching';
import { getProfileCompletion, normalizeProfile } from '../lib/profileStorage';

const EMPTY_LIST = [];

function ProfilePage({
  profile,
  projectData,
  session,
  onSaveProfile,
  loading,
  saving,
  error,
  saveMessage,
  onNavigate,
  onMessage,
}) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const resolvedProfile = useMemo(() => normalizeProfile(profile), [profile]);
  const currentUserId = session?.user?.id;
  const connectionData = useConnectionRequests(session);
  const ownedProjects = projectData?.myProjects || EMPTY_LIST;
  const joinedProjects = projectData?.joinedProjects || EMPTY_LIST;
  const projectList = useMemo(
    () => [...new Map([...ownedProjects, ...joinedProjects].map((project) => [project.id, project])).values()],
    [ownedProjects, joinedProjects],
  );
  const activity = useMemo(
    () => buildRecentActivity(
      ownedProjects,
      connectionData.requests,
      currentUserId,
      joinedProjects,
      connectionData.profilesByUserId,
    ),
    [ownedProjects, connectionData.requests, currentUserId, joinedProjects, connectionData.profilesByUserId],
  );
  const teamGaps = useMemo(
    () => projectList.map((project) => ({
      project,
      ...calculateProjectSkillGaps(project.skills, project.currentMembers),
    })),
    [projectList],
  );
  const currentSelectedProject = selectedProject
    ? projectData?.projects?.find((project) => project.id === selectedProject.id) || selectedProject
    : null;

  const skillList = (resolvedProfile.skills || []).map((skill) =>
    typeof skill === 'string' ? skill : skill.name,
  );

  const completion = getProfileCompletion(resolvedProfile);

  const missingFields = [];
  if (!resolvedProfile.name?.trim()) missingFields.push('Name');
  if (!resolvedProfile.role?.trim()) missingFields.push('Role');
  if (!resolvedProfile.bio?.trim()) missingFields.push('Bio');
  if (!skillList.length) missingFields.push('Skills');
  if (!resolvedProfile.availability?.trim()) missingFields.push('Availability');
  if (!resolvedProfile.experience?.trim()) missingFields.push('Experience');
  if (!resolvedProfile.github?.trim()) missingFields.push('GitHub');
  if (!resolvedProfile.portfolio?.trim()) missingFields.push('Portfolio');

  const initials = (resolvedProfile.name || 'HackMate member')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'HM';

  const handleSave = async (nextProfile) => {
    await onSaveProfile?.(nextProfile);
    setIsEditorOpen(false);
  };

  return (
    <>
      <div className="page">
        {(loading || saving || error || saveMessage) && (
          <div className="form-status-panel" data-tone={error ? 'error' : 'info'}>
            {loading && <span>Loading profile…</span>}
            {saving && <span>Saving profile…</span>}
            {error && <span>{error}</span>}
            {!error && saveMessage && <span>{saveMessage}</span>}
          </div>
        )}
        {(projectData?.error || connectionData.error) && (
          <div className="form-status-panel" data-tone="error" role="alert">
            {projectData?.error && <span>Your project information could not be loaded.</span>}
            {connectionData.error && <span>Your connection activity could not be loaded.</span>}
          </div>
        )}

        <section className="profile-header-card">
          <div className="profile-summary">
            <div className="profile-avatar">{initials}</div>
            <div className="profile-info">
              <div className="eyebrow">Developer profile</div>
              <h2>{resolvedProfile.name || 'Your profile'}</h2>
              <p className="profile-role">{resolvedProfile.role || 'Add your role'}</p>
              <span className={`profile-visibility-label ${resolvedProfile.isPublic ? 'is-public' : ''}`}>
                {resolvedProfile.isPublic ? 'Public discovery on' : 'Private profile'}
              </span>
              <div className="availability-badge">
                <span className="status-dot" aria-hidden="true" />
                {resolvedProfile.availability || 'Add your availability'}
              </div>
              <div className="profile-tags">
                {skillList.slice(0, 5).map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="profile-actions">
            <button type="button" className="primary-button" onClick={() => onNavigate?.('discover')}>
              Find Teammates →
            </button>
            <button type="button" className="secondary-button" onClick={() => setIsEditorOpen(true)}>
              Edit Profile
            </button>
          </div>
        </section>

        <section className="profile-stats-grid" aria-label="Profile activity">
          <article className="profile-stat-card">
            <span>Projects</span>
            <strong>{projectData?.loading ? '…' : projectData?.error ? '—' : projectList.length}</strong>
          </article>
          <article className="profile-stat-card">
            <span>Connections</span>
            <strong>{connectionData.loading ? '…' : connectionData.error ? '—' : connectionData.connections.length}</strong>
          </article>
          <article className="profile-stat-card">
            <span>Pending requests</span>
            <strong>
              {connectionData.loading ? '…' : connectionData.error ? '—' : connectionData.incomingRequests.length + connectionData.outgoingRequests.length}
            </strong>
          </article>
          <article className="profile-stat-card">
            <span>Profile completion</span>
            <strong>{completion}%</strong>
          </article>
        </section>

        <section className="profile-grid">
          <article className="profile-main-card">
            <div className="profile-copy">
              <h3>Bio</h3>
              <p>{resolvedProfile.bio || 'Add a short bio to tell other hackers what you build and care about.'}</p>
            </div>

            <div className="profile-section-block">
              <div className="section-headline-row">
                <h3>Core Skills</h3>
              </div>
              <p className="section-supporting-text">Skills you can bring to a hackathon team.</p>
              <div className="skill-pills compact-skills">
                {skillList.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
            </div>

            <div className="profile-section-block availability-block">
              <div className="section-headline-row">
                <h3>Availability</h3>
              </div>
              <p className="availability-status">{resolvedProfile.availability || 'Availability not set yet'}</p>
              <p className="section-supporting-text">Open to joining teams and collaborating on new builds.</p>
            </div>

            <div className="profile-section-block">
              <div className="section-headline-row">
                <h3>Projects</h3>
                <span className="counter-pill">{projectList.length}</span>
              </div>
              {projectData?.loading ? (
                <p className="section-supporting-text" role="status">Loading your projects…</p>
              ) : projectData?.error ? (
                <p className="section-supporting-text" role="alert">Unable to load project information.</p>
              ) : projectList.length ? (
                <section className="projects-grid profile-projects-grid" aria-label="Your projects and teams">
                  {projectList.map((project) => (
                    <ProjectCard key={project.id} project={project} onView={setSelectedProject} />
                  ))}
                </section>
              ) : (
                <div className="empty-state-card compact-empty-state">
                  <p>You have not joined or created a project yet.</p>
                  <button type="button" className="text-button" onClick={() => onNavigate?.('projects')}>
                    Explore projects →
                  </button>
                </div>
              )}
            </div>

            {(resolvedProfile.github || resolvedProfile.portfolio) && (
              <div className="profile-section-block">
                <div className="section-headline-row">
                  <h3>Links</h3>
                </div>
                <div className="profile-link-list">
                  {resolvedProfile.github && (
                    <a href={resolvedProfile.github} target="_blank" rel="noreferrer">
                      GitHub
                    </a>
                  )}
                  {resolvedProfile.portfolio && (
                    <a href={resolvedProfile.portfolio} target="_blank" rel="noreferrer">
                      Portfolio
                    </a>
                  )}
                </div>
              </div>
            )}
          </article>

          <aside className="profile-aside-card">
            <div className="completion-box">
              <div className="completion-top">
                <span>Profile completion</span>
                <strong>{completion}%</strong>
              </div>
              <div className="progress-bar">
                <span style={{ width: `${completion}%` }} />
              </div>
              <p className="completion-copy">Complete your profile to improve teammate matching.</p>
              {missingFields.length ? (
                <ul className="missing-list">
                  {missingFields.map((field) => (
                    <li key={field}>Missing: {field}</li>
                  ))}
                </ul>
              ) : (
                <ul className="missing-list">
                  <li>Profile looks great — everything is in place.</li>
                </ul>
              )}
              <button type="button" className="text-button" onClick={() => setIsEditorOpen(true)}>
                Complete Profile →
              </button>
            </div>

            <div className="mini-list-block team-readiness">
              <div className="section-headline-row">
                <h3>Team Readiness</h3>
              </div>
              <p className="team-readiness-copy">
                Your current skills: {skillList.slice(0, 3).join(' • ') || 'Add your skills'}
              </p>
              {projectData?.loading ? (
                <p className="section-supporting-text" role="status">Calculating readiness from your teams…</p>
              ) : teamGaps.length ? (
                <div className="team-readiness-projects">
                  {teamGaps.map(({ project, missingSkills }) => (
                    <div className="team-readiness-project" key={project.id}>
                      <strong>{project.title}</strong>
                      {missingSkills.length ? (
                        <>
                          <span>Required skills still needed</span>
                          <div className="skill-pills">
                            {missingSkills.map((skill) => <span className="fill-chip" key={skill}>{skill}</span>)}
                          </div>
                        </>
                      ) : (
                        <span>Your current team covers all required skills.</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="section-supporting-text">
                  Join or create a project to see team readiness based on its required skills and current members.
                </p>
              )}
              <button
                type="button"
                className="secondary-button"
                aria-label="Explore projects"
                onClick={() => onNavigate?.('projects')}
              >
                Create a Project →
              </button>
            </div>

            <div className="mini-list-block">
              <div className="section-headline-row">
                <h3>Recent activity</h3>
              </div>
              {connectionData.loading || projectData?.loading ? (
                <p className="section-supporting-text" role="status">Loading activity…</p>
              ) : activity.length ? (
                <ul className="activity-list">
                  {activity.slice(0, 4).map((item) => (
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
                <p>{resolvedProfile.experience || 'Add your hackathon experience and activity will appear here as you build.'}</p>
              )}
            </div>
          </aside>
        </section>
      </div>

      <ProfileEditorModal
        key={isEditorOpen ? 'profile-editor-open' : 'profile-editor-closed'}
        isOpen={isEditorOpen}
        profile={resolvedProfile}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSave}
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
    </>
  );
}

export default ProfilePage;
