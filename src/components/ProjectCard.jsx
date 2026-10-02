function ProjectCard({ project, onView }) {
  return (
    <article className="project-card">
      <div className="project-card-top">
        <div>
          <div className="eyebrow">{project.hackathonName || project.hackathon || 'Hackathon'}</div>
          <h3>{project.title || project.name}</h3>
        </div>
        <span className="project-status">{project.status || 'open'}</span>
      </div>

      <p className="project-description">{project.description}</p>

      <div className="project-meta-block">
        <span>Required</span>
        <div className="skill-pills">
          {(project.skills || []).map((skill) => (
            <span key={skill}>{skill}</span>
          ))}
        </div>
      </div>

      <div className="detail-row">
        <span>Team</span>
        <strong>
          {project.acceptedMembers ?? project.members ?? 1} / {project.teamSize ?? project.members ?? 1}
        </strong>
      </div>

      <div className="detail-row">
        <span>Open position</span>
        <strong>{project.openPositions ?? project.openPosition ?? 0}</strong>
      </div>

      <button type="button" className="ghost-button full-width" onClick={() => onView(project)}>
        View Project →
      </button>
    </article>
  );
}

export default ProjectCard;
