import { useMemo, useState } from 'react';
import ProjectDetailModal from '../components/ProjectDetailModal';

function getInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function MyTeamPage({ projectData, session, onNavigate, onMessage }) {
  const [selectedProject, setSelectedProject] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const {
    projects = [],
    requests = [],
    skillCatalog = [],
    myProjects = [],
    joinedProjects = [],
    loading,
    error,
    userId,
    refreshProjects,
    requestToJoin,
    handleProjectRequest,
    updateProject,
    deleteProject,
  } = projectData || {};
  const teamProjects = useMemo(
    () => [...new Map([...myProjects, ...joinedProjects].map((project) => [project.id, project])).values()],
    [joinedProjects, myProjects],
  );

  const handleJoinRequest = async (projectId, message) => {
    await requestToJoin(projectId, message);
    setActionMessage('Your request to join was sent.');
  };

  const handleRequestDecision = async (requestId, decision) => {
    await handleProjectRequest(requestId, decision);
    setActionMessage(decision === 'accept' ? 'Request accepted; the member joined your team.' : 'Request rejected.');
  };

  return (
    <div className="page">
      <section className="section-block compact">
        <div>
          <div className="eyebrow">Team workspace</div>
          <h2>My Teams</h2>
          <p className="section-subtitle">Projects you own or have joined, with their current members and required skills.</p>
        </div>
        <button type="button" className="primary-button small" onClick={() => onNavigate?.('projects')}>
          Explore Projects
        </button>
      </section>

      {actionMessage && (
        <div className="form-status-panel" data-tone="success" role="status">
          <span>{actionMessage}</span>
          <button type="button" className="text-button" onClick={() => setActionMessage('')}>Dismiss</button>
        </div>
      )}
      {error && (
        <div className="form-status-panel" data-tone="error" role="alert">
          <span>Unable to load team projects. {error}</span>
          <button type="button" className="text-button" onClick={refreshProjects}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="empty-state-card" role="status">Loading your teams…</div>
      ) : teamProjects.length ? (
        <div className="team-projects-list">
          {teamProjects.map((project) => {
            const isOwner = project.ownerId === userId;
            return (
              <section className="team-shell" key={project.id}>
                <div className="team-header row-between">
                  <div>
                    <div className="eyebrow">{project.hackathonName}</div>
                    <h2>{project.title}</h2>
                    <p className="section-supporting-text">
                      {isOwner ? 'You own this project' : `Project owner: ${project.ownerName}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setSelectedProject(project)}
                  >
                    Project details
                  </button>
                </div>

                <div className="team-layout">
                  <div className="team-overview-panel">
                    <div className="team-meta">
                      <span className="meta-label">Team members · {project.acceptedMembers}/{project.teamSize}</span>
                      <div className="team-members-list">
                        {project.currentMembers.map((member) => (
                          <div className="team-member-row" key={member.user_id}>
                            <div className="team-member-avatar">{getInitials(member.name) || 'HM'}</div>
                            <div className="team-member-identity">
                              <strong>{member.name}{member.user_id === userId ? ' (you)' : ''}</strong>
                              <p>{member.profileRole || member.role}</p>
                              {member.skills.length > 0 && (
                                <div className="skill-pills compact-skills">
                                  {member.skills.map((skill) => <span key={skill}>{skill}</span>)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="team-overview-panel">
                    <div className="team-meta">
                      <span className="meta-label">Required skills</span>
                      {project.skills.length ? (
                        <div className="skill-pills">
                          {project.skills.map((skill) => <span key={skill}>{skill}</span>)}
                        </div>
                      ) : (
                        <p className="empty-copy">No required skills are listed.</p>
                      )}
                    </div>
                    <div className="team-meta">
                      <span className="meta-label">Open positions</span>
                      <strong>{project.openPositions}</strong>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="empty-state-card">
          <h3>You&apos;re not on a project team yet.</h3>
          <p>Explore projects to request a spot, or create a project to start building a team.</p>
          <button type="button" className="primary-button" onClick={() => onNavigate?.('projects')}>
            Browse Projects
          </button>
        </div>
      )}

      <ProjectDetailModal
        key={selectedProject?.id || 'closed'}
        isOpen={Boolean(selectedProject)}
        project={projects.find((project) => project.id === selectedProject?.id) || selectedProject}
        currentUserId={userId}
        session={session}
        onMessage={onMessage}
        requests={requests}
        skillCatalog={skillCatalog}
        onClose={() => setSelectedProject(null)}
        onRequestJoin={handleJoinRequest}
        onManageRequest={handleRequestDecision}
        onUpdateProject={updateProject}
        onDeleteProject={deleteProject}
      />
    </div>
  );
}

export default MyTeamPage;
