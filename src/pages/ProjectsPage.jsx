import { useMemo, useState } from 'react';
import ProjectCard from '../components/ProjectCard';
import ProjectCreateModal from '../components/ProjectCreateModal';
import ProjectDetailModal from '../components/ProjectDetailModal';

function matchesSearch(project, searchQuery) {
  const query = searchQuery.trim().toLocaleLowerCase();
  return !query ||
    project.title.toLocaleLowerCase().includes(query) ||
    project.hackathonName.toLocaleLowerCase().includes(query) ||
    project.description.toLocaleLowerCase().includes(query) ||
    project.skills.some((skill) => skill.toLocaleLowerCase().includes(query));
}

function ProjectsPage({ projectData, session, searchQuery = '', onMessage }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const {
    projects = [],
    openProjects = [],
    myProjects = [],
    requests = [],
    skillCatalog = [],
    loading,
    error,
    userId,
    refreshProjects,
    createProject,
    updateProject,
    deleteProject,
    requestToJoin,
    handleProjectRequest,
  } = projectData || {};
  const availableProjects = useMemo(
    () => openProjects.filter((project) =>
      project.ownerId !== userId &&
      !project.currentMembers.some((member) => member.user_id === userId) &&
      matchesSearch(project, searchQuery),
    ),
    [openProjects, searchQuery, userId],
  );
  const ownedProjects = useMemo(
    () => myProjects.filter((project) => matchesSearch(project, searchQuery)),
    [myProjects, searchQuery],
  );

  const handleCreate = async (project) => {
    await createProject(project);
    setSuccessMessage('Project created successfully.');
  };

  const handleJoinRequest = async (projectId, message) => {
    await requestToJoin(projectId, message);
    setSuccessMessage('Your request to join was sent.');
  };

  const handleRequestDecision = async (requestId, decision) => {
    await handleProjectRequest(requestId, decision);
    setSuccessMessage(decision === 'accept' ? 'Request accepted; the member joined your team.' : 'Request rejected.');
  };

  return (
    <div className="page">
      <section className="section-block row-between">
        <div>
          <div className="eyebrow">Projects</div>
          <h2>Hackathon projects</h2>
          <p className="section-subtitle">Find a project to join or create one for your team.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => setShowCreateModal(true)}>
          + Create Project
        </button>
      </section>

      {successMessage && (
        <div className="form-status-panel" data-tone="success" role="status">
          <span>{successMessage}</span>
          <button type="button" className="text-button" onClick={() => setSuccessMessage('')}>
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div className="form-status-panel" data-tone="error" role="alert">
          <span>Unable to load projects. {error}</span>
          <button type="button" className="text-button" onClick={refreshProjects}>Retry</button>
        </div>
      )}

      <section className="project-list-section">
        <div className="section-header">
          <div>
            <h3>Projects to join</h3>
            <p className="section-supporting-text">Open projects looking for teammates.</p>
          </div>
        </div>
        {loading ? (
          <div className="empty-state-card" role="status">Loading projects…</div>
        ) : availableProjects.length ? (
          <section className="projects-grid">
            {availableProjects.map((project) => (
              <ProjectCard key={project.id} project={project} onView={setSelectedProject} />
            ))}
          </section>
        ) : (
          <div className="empty-state-card">
            {searchQuery ? 'No joinable projects match your search.' : 'No projects are currently looking for teammates.'}
          </div>
        )}
      </section>

      <section className="project-list-section">
        <div className="section-header">
          <div>
            <h3>Your projects</h3>
            <p className="section-supporting-text">Projects you created and manage.</p>
          </div>
        </div>
        {loading ? (
          <div className="empty-state-card" role="status">Loading your projects…</div>
        ) : ownedProjects.length ? (
          <section className="projects-grid">
            {ownedProjects.map((project) => (
              <ProjectCard key={project.id} project={project} onView={setSelectedProject} />
            ))}
          </section>
        ) : (
          <div className="empty-state-card">You haven&apos;t created a project yet.</div>
        )}
      </section>

      <ProjectCreateModal
        isOpen={showCreateModal}
        skillCatalog={skillCatalog}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />
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

export default ProjectsPage;
