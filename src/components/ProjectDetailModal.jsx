import { useMemo, useState } from 'react';
import ProjectSkillRecommendations from './ProjectSkillRecommendations';
import ProjectCreateModal from './ProjectCreateModal';

function ProjectDetailModal({
  isOpen,
  project,
  currentUserId,
  session,
  onMessage,
  requests = [],
  skillCatalog = [],
  onClose,
  onRequestJoin,
  onManageRequest,
  onUpdateProject,
  onDeleteProject,
}) {
  const [message, setMessage] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [messageError, setMessageError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.projectId === project?.id && request.status === 'pending'),
    [project, requests],
  );

  const isOwner = project && currentUserId && project.ownerId === currentUserId;
  const isMember =
    project &&
    currentUserId &&
    project.currentMembers.some((member) => member.user_id === currentUserId && member.status === 'accepted');
  const hasPendingRequest =
    project &&
    currentUserId &&
    requests.some(
      (request) =>
        request.projectId === project.id &&
        request.requesterId === currentUserId &&
        ['pending', 'accepted'].includes(request.status),
    );
  const projectClosed = project?.status === 'closed';
  const teamFull = project ? project.openPositions <= 0 : false;

  if (!isOpen || !project) return null;

  const requestButtonLabel = isOwner
    ? 'Manage Project'
    : isMember
      ? 'Already a Member'
      : hasPendingRequest
        ? 'Request Pending'
        : projectClosed
          ? 'Project Closed'
          : teamFull
            ? 'Team Full'
            : 'Request to Join';

  const handleRequestSubmit = async () => {
    if (!message.trim()) {
      setMessageError('Add a short message with your request.');
      return;
    }
    setIsSubmitting(true);
    setActionError('');
    setActionMessage('');
    try {
      await onRequestJoin(project.id, message.trim());
      setMessage('');
      setShowRequestForm(false);
      setMessageError('');
      setActionMessage('Your request to join was sent.');
    } catch (error) {
      setActionError(error?.message || 'Unable to send your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestDecision = async (requestId, decision) => {
    setBusyRequestId(requestId);
    setActionError('');
    setActionMessage('');
    try {
      await onManageRequest(requestId, decision);
      setActionMessage(decision === 'accept' ? 'Request accepted; the member joined your team.' : 'Request rejected.');
    } catch (error) {
      setActionError(error?.message || 'Unable to update this request. Please try again.');
    } finally {
      setBusyRequestId('');
    }
  };

  const handleProjectUpdate = async (updates) => {
    await onUpdateProject(project.id, updates);
    setShowEditModal(false);
    setActionError('');
    setActionMessage('Project updated successfully.');
  };

  const handleProjectDelete = async () => {
    setIsDeleting(true);
    setActionError('');
    try {
      await onDeleteProject(project.id);
      onClose();
    } catch (error) {
      setActionError(error?.message || 'Unable to delete this project. Please try again.');
      setShowDeleteConfirmation(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="project-detail-title">
      <div className="project-detail-modal">
        <div className="editor-header">
          <div>
            <div className="eyebrow">Project detail</div>
            <h3 id="project-detail-title">{project.title}</h3>
          </div>
          <button type="button" className="icon-close" aria-label="Close project detail" onClick={onClose}>
            ×
          </button>
        </div>

        {isOwner && (
          <div className="project-owner-actions">
            <button type="button" className="ghost-button" onClick={() => setShowEditModal(true)}>
              Edit Project
            </button>
            <button type="button" className="danger-button" onClick={() => setShowDeleteConfirmation(true)}>
              Delete Project
            </button>
          </div>
        )}

        <div className="project-detail-body">
          <div className="project-detail-card">
            <div className="detail-row">
              <span>Hackathon</span>
              <strong>{project.hackathonName}</strong>
            </div>
            <div className="detail-row">
              <span>Owner</span>
              <strong>{project.ownerName}</strong>
            </div>
            <div className="detail-row">
              <span>Team</span>
              <strong>
                {project.acceptedMembers} / {project.teamSize}
              </strong>
            </div>
            <div className="detail-row">
              <span>Open positions</span>
              <strong>{project.openPositions}</strong>
            </div>
            <div className="detail-row">
              <span>Status</span>
              <strong>{project.status}</strong>
            </div>

            <p className="project-description detail-copy">{project.description}</p>

            <div className="project-meta-block">
              <span>Required skills</span>
              {project.skills.length ? (
                <div className="skill-pills">
                  {project.skills.map((skill) => <span key={skill}>{skill}</span>)}
                </div>
              ) : <p className="empty-copy">No required skills are listed.</p>}
            </div>

            <div className="project-meta-block">
              <span>Current members</span>
              {project.currentMembers.length ? (
                <div className="project-member-list">
                  {project.currentMembers.map((member) => (
                    <div className="project-member-row" key={member.user_id}>
                      <div>
                        <strong>{member.name}</strong>
                        <p>{member.profileRole || member.role}</p>
                      </div>
                      {member.skills.length > 0 && (
                        <div className="skill-pills compact-skills">
                          {member.skills.map((skill) => <span key={skill}>{skill}</span>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : <p className="empty-copy">No team members are listed yet.</p>}
            </div>

            {project.hackathonUrl && (
              <div className="project-link-row">
                <a href={project.hackathonUrl} target="_blank" rel="noreferrer">
                  Open hackathon page →
                </a>
              </div>
            )}
          </div>

          <div className="project-detail-sidebar">
            <ProjectSkillRecommendations
              project={project}
              currentUserId={currentUserId}
              session={session}
              onMessage={onMessage}
            />

            {!isOwner && !isMember && !projectClosed && !teamFull && !hasPendingRequest && (
              <div className="request-cta-block">
                {!showRequestForm ? (
                  <button type="button" className="primary-button full-width" onClick={() => setShowRequestForm(true)}>
                    {requestButtonLabel}
                  </button>
                ) : (
                  <div className="request-panel">
                    <label className="field-group full-width">
                      <span>Message</span>
                      <textarea
                        value={message}
                        onChange={(event) => {
                          setMessage(event.target.value);
                          setMessageError('');
                        }}
                        rows="4"
                        placeholder="Hi! I have experience with React and AI/ML and would love to contribute to this project."
                      />
                      {messageError && <small className="validation-message">{messageError}</small>}
                    </label>
                    <div className="editor-actions compact-actions">
                      <button type="button" className="ghost-button" onClick={() => setShowRequestForm(false)}>
                        Cancel
                      </button>
                      <button type="button" className="primary-button" onClick={handleRequestSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Sending...' : 'Send request'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {actionError && (
              <div className="form-status-panel" data-tone="error" role="alert">{actionError}</div>
            )}
            {actionMessage && (
              <div className="form-status-panel" data-tone="success" role="status">{actionMessage}</div>
            )}

            {isOwner && (
              <div className="owner-management-block">
                <h4>Pending requests</h4>
                {pendingRequests.length ? (
                  <div className="request-list">
                    {pendingRequests.map((request) => (
                      <div key={request.id} className="request-row">
                        <div className="request-head">
                          <div>
                            <strong>{request.requesterName}</strong>
                            <p>{request.requesterRole}</p>
                          </div>
                          <div className="request-status-label">{request.status}</div>
                        </div>

                        <div className="skill-pills compact-skills">
                          {request.requesterSkills.map((skill) => (
                            <span key={skill}>{skill}</span>
                          ))}
                        </div>

                        <p className="request-message">{request.message}</p>

                        <div className="editor-actions compact-actions">
                          <button
                            type="button"
                            className="ghost-button"
                            disabled={busyRequestId === request.id}
                            onClick={() => void handleRequestDecision(request.id, 'reject')}
                          >
                            {busyRequestId === request.id ? 'Saving…' : 'Reject'}
                          </button>
                          <button
                            type="button"
                            className="primary-button"
                            disabled={busyRequestId === request.id}
                            onClick={() => void handleRequestDecision(request.id, 'accept')}
                          >
                            {busyRequestId === request.id ? 'Saving…' : 'Accept'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-copy">No pending requests right now.</p>
                )}
              </div>
            )}

            {!isOwner && !isMember && !projectClosed && hasPendingRequest && (
              <div className="status-banner status-info">Request Pending</div>
            )}

            {!isOwner && isMember && <div className="status-banner status-success">Already a Member</div>}
            {!isOwner && !isMember && projectClosed && <div className="status-banner status-warning">Project closed</div>}
            {!isOwner && !isMember && teamFull && <div className="status-banner status-warning">Team full</div>}
          </div>

        </div>
      </div>
      {showEditModal && (
        <ProjectCreateModal
          key={`edit-${project.id}`}
          isOpen={showEditModal}
          project={project}
          skillCatalog={skillCatalog}
          minimumTeamSize={project.acceptedMembers}
          onClose={() => setShowEditModal(false)}
          onCreate={handleProjectUpdate}
          submitLabel="Save Changes"
        />
      )}

      {showDeleteConfirmation && (
        <div className="modal-backdrop project-confirm-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="delete-project-title">
          <section className="project-confirm-modal">
            <h3 id="delete-project-title">Delete this project?</h3>
            <p>This action cannot be undone.</p>
            {actionError && <div className="form-status-panel" data-tone="error" role="alert">{actionError}</div>}
            <div className="editor-actions">
              <button type="button" className="ghost-button" disabled={isDeleting} onClick={() => setShowDeleteConfirmation(false)}>
                Cancel
              </button>
              <button type="button" className="danger-button" disabled={isDeleting} onClick={() => void handleProjectDelete()}>
                {isDeleting ? 'Deleting…' : 'Delete Project'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default ProjectDetailModal;
