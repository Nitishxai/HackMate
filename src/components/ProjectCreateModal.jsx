import { useEffect, useMemo, useState } from 'react';

const EMPTY_FORM = {
  title: '',
  description: '',
  hackathonName: '',
  hackathonUrl: '',
  teamSize: '4',
  status: 'open',
};

function ProjectCreateModal({
  isOpen,
  project,
  skillCatalog = [],
  minimumTeamSize = 1,
  onClose,
  onCreate,
  submitLabel = 'Create Project',
}) {
  const [form, setForm] = useState(() => project ? {
    title: project.title,
    description: project.description,
    hackathonName: project.hackathonName === 'Hackathon' ? '' : project.hackathonName,
    hackathonUrl: project.hackathonUrl,
    teamSize: String(project.teamSize),
    status: project.status,
  } : EMPTY_FORM);
  const [selectedSkills, setSelectedSkills] = useState(() => project?.skills || []);
  const [skillInput, setSkillInput] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && !project) {
      setForm(EMPTY_FORM);
      setSelectedSkills([]);
      setSkillInput('');
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, project]);

  const catalogLabels = useMemo(
    () => [...new Set([...skillCatalog.map((skill) => skill.name || skill), ...selectedSkills])],
    [skillCatalog, selectedSkills],
  );

  const addSkill = () => {
    const value = skillInput.trim();
    if (!value) {
      setErrors((current) => ({ ...current, skill: 'Add at least one skill.' }));
      return;
    }

    const normalized = value.replace(/\s+/g, ' ');
    const alreadySelected = selectedSkills.some(
      (skill) => skill.toLowerCase() === normalized.toLowerCase(),
    );

    if (alreadySelected) {
      setErrors((current) => ({ ...current, skill: 'This skill is already added.' }));
      return;
    }

    setSelectedSkills((current) => [...current, normalized]);
    setSkillInput('');
    setErrors((current) => ({ ...current, skill: '' }));
  };

  const removeSkill = (skillName) => {
    setSelectedSkills((current) => current.filter((skill) => skill !== skillName));
  };

  const handleFieldChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const validate = () => {
    const nextErrors = {};
    const teamSize = Number(form.teamSize);

    if (!form.title.trim()) {
      nextErrors.title = 'Project name is required.';
    }

    if (!form.description.trim()) {
      nextErrors.description = 'Project description is required.';
    }

    if (!selectedSkills.length) {
      nextErrors.skill = 'Add at least one required skill.';
    }

    if (!Number.isInteger(teamSize) || teamSize < 1) {
      nextErrors.teamSize = 'Team size must be a whole number greater than 0.';
    } else if (teamSize < minimumTeamSize) {
      nextErrors.teamSize = `Team size cannot be less than ${minimumTeamSize} accepted team member${minimumTeamSize === 1 ? '' : 's'}.`;
    }

    if (form.hackathonUrl && !/^(https?:\/\/)/i.test(form.hackathonUrl.trim())) {
      nextErrors.hackathonUrl = 'Hackathon URL must be a valid http or https URL.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      await onCreate({
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        hackathonName: form.hackathonName.trim(),
        hackathonUrl: form.hackathonUrl.trim(),
        teamSize: Number(form.teamSize),
        skills: selectedSkills,
      });
      onClose();
    } catch (error) {
      setErrors((current) => ({
        ...current,
        form: error?.message || 'Unable to create project. Please try again.',
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="project-create-title">
      <div className="project-modal">
        <div className="editor-header">
          <div>
            <div className="eyebrow">{project ? 'Edit project' : 'Create project'}</div>
            <h3 id="project-create-title">{project ? 'Update project details' : 'Start a new hackathon project'}</h3>
          </div>
          <button type="button" className="icon-close" aria-label="Close project modal" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="form-grid">
          <label className="field-group">
            <span>Project name</span>
            <input
              value={form.title}
              onChange={(event) => handleFieldChange('title', event.target.value)}
              placeholder="AI Education Assistant"
            />
            {errors.title && <small className="validation-message">{errors.title}</small>}
          </label>

          <label className="field-group">
            <span>Team size</span>
            <input
              type="number"
              min="1"
              value={form.teamSize}
              onChange={(event) => handleFieldChange('teamSize', event.target.value)}
            />
            {errors.teamSize && <small className="validation-message">{errors.teamSize}</small>}
          </label>

          <label className="field-group">
            <span>Hackathon name</span>
            <input
              value={form.hackathonName}
              onChange={(event) => handleFieldChange('hackathonName', event.target.value)}
              placeholder="Google AI Challenge"
            />
          </label>

          <label className="field-group">
            <span>Hackathon URL</span>
            <input
              value={form.hackathonUrl}
              onChange={(event) => handleFieldChange('hackathonUrl', event.target.value)}
              placeholder="https://example.com"
            />
            {errors.hackathonUrl && <small className="validation-message">{errors.hackathonUrl}</small>}
          </label>

          <label className="field-group full-width">
            <span>Description</span>
            <textarea
              value={form.description}
              onChange={(event) => handleFieldChange('description', event.target.value)}
              rows="4"
              placeholder="Describe the product, problem space, and what you want to build."
            />
            {errors.description && <small className="validation-message">{errors.description}</small>}
          </label>

          <div className="field-group full-width">
            <span>Required skills</span>
            <div className="skill-editor">
              <input
                type="text"
                value={skillInput}
                onChange={(event) => setSkillInput(event.target.value)}
                placeholder="Add skill name"
              />
              <button type="button" className="secondary-button" onClick={addSkill}>
                Add skill
              </button>
            </div>

            {errors.skill && <small className="validation-message">{errors.skill}</small>}

            <div className="skill-chip-list">
              {selectedSkills.map((skill) => (
                <span key={skill} className="skill-chip">
                  <span>{skill}</span>
                  <button type="button" aria-label={`Remove ${skill}`} onClick={() => removeSkill(skill)}>
                    ×
                  </button>
                </span>
              ))}
            </div>

            {catalogLabels.length > 0 && (
              <div className="quick-skill-row">
                {catalogLabels.slice(0, 8).map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    className="quick-skill-button"
                    onClick={() => {
                      const normalized = String(skill).trim();
                      if (!normalized) return;
                      const alreadySelected = selectedSkills.some(
                        (currentSkill) => currentSkill.toLowerCase() === normalized.toLowerCase(),
                      );
                      if (!alreadySelected) {
                        setSelectedSkills((current) => [...current, normalized]);
                      }
                    }}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="field-group">
            <span>Status</span>
            <select value={form.status} onChange={(event) => handleFieldChange('status', event.target.value)}>
              <option value="open">Open</option>
              <option value="forming">Forming</option>
              <option value="closed">Closed</option>
            </select>
          </label>
        </div>

        {errors.form && <small className="validation-message block-error">{errors.form}</small>}

        <div className="editor-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProjectCreateModal;
