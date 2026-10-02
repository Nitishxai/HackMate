import { useMemo, useState } from 'react';
import { PROFILE_CATEGORIES, normalizeProfile } from '../lib/profileStorage';

const availabilityOptions = [
  'Available for hackathons',
  'Open to opportunities',
  'Currently building a team',
  'Not available',
];

function isValidUrl(value) {
  if (!value || !value.trim()) return true;

  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function ProfileEditorModal({ isOpen, profile, onClose, onSave }) {
  const [draft, setDraft] = useState(normalizeProfile(profile));
  const [skillInput, setSkillInput] = useState('');
  const [skillCategory, setSkillCategory] = useState('Programming');
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const skillList = useMemo(() => draft.skills ?? [], [draft.skills]);

  if (!isOpen) return null;

  const handleFieldChange = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const handleAddSkill = () => {
    const name = skillInput.trim();

    if (!name) {
      setErrors((current) => ({ ...current, skill: 'Please enter a skill name.' }));
      return;
    }

    const normalizedName = name.replace(/\s+/g, ' ');
    const hasDuplicate = skillList.some(
      (skill) => (typeof skill === 'string' ? skill : skill.name).toLowerCase() === normalizedName.toLowerCase(),
    );

    if (hasDuplicate) {
      setErrors((current) => ({ ...current, skill: 'That skill already exists for this profile.' }));
      return;
    }

    setDraft((current) => ({
      ...current,
      skills: [...(current.skills || []), { name: normalizedName, category: skillCategory }],
    }));
    setSkillInput('');
    setSkillCategory('Programming');
    setErrors((current) => ({ ...current, skill: '' }));
  };

  const handleRemoveSkill = (skillName) => {
    setDraft((current) => ({
      ...current,
      skills: (current.skills || []).filter(
        (skill) => (typeof skill === 'string' ? skill : skill.name).toLowerCase() !== skillName.toLowerCase(),
      ),
    }));
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!draft.name?.trim()) {
      nextErrors.name = 'Name is required.';
    }

    if (!draft.role?.trim()) {
      nextErrors.role = 'Role is required.';
    }

    if (!draft.skills || draft.skills.length === 0) {
      nextErrors.skills = 'Add at least one skill.';
    }

    if (draft.github && !isValidUrl(draft.github)) {
      nextErrors.github = 'GitHub must be a valid URL.';
    }

    if (draft.portfolio && !isValidUrl(draft.portfolio)) {
      nextErrors.portfolio = 'Portfolio must be a valid URL.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);

    try {
      const sanitizedProfile = normalizeProfile(draft);
      await onSave(sanitizedProfile);
      onClose();
    } catch (error) {
      setErrors((current) => ({
        ...current,
        form: error?.message || 'Unable to save profile. Please try again.',
      }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="profile-editor-title">
      <div className="profile-editor">
        <div className="editor-header">
          <div>
            <div className="eyebrow">Edit profile</div>
            <h3 id="profile-editor-title">Update your details</h3>
          </div>
          <button type="button" className="icon-close" onClick={onClose} aria-label="Close editor">
            ×
          </button>
        </div>

        <div className="form-grid">
          <label className="field-group">
            <span>Name</span>
            <input
              type="text"
              value={draft.name || ''}
              onChange={(event) => handleFieldChange('name', event.target.value)}
              placeholder="Your name"
            />
            {errors.name && <small className="validation-message">{errors.name}</small>}
          </label>

          <label className="field-group">
            <span>Role</span>
            <input
              type="text"
              value={draft.role || ''}
              onChange={(event) => handleFieldChange('role', event.target.value)}
              placeholder="Your role"
            />
            {errors.role && <small className="validation-message">{errors.role}</small>}
          </label>

          <label className="field-group full-width">
            <span>Bio</span>
            <textarea
              value={draft.bio || ''}
              onChange={(event) => handleFieldChange('bio', event.target.value)}
              rows="4"
              placeholder="Tell other hackers what you build and what you care about"
            />
          </label>

          <label className="field-group">
            <span>Availability</span>
            <select
              value={draft.availability || ''}
              onChange={(event) => handleFieldChange('availability', event.target.value)}
            >
              <option value="">Select availability</option>
              {availabilityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="public-profile-toggle full-width">
            <input
              type="checkbox"
              checked={draft.isPublic}
              onChange={(event) => handleFieldChange('isPublic', event.target.checked)}
            />
            <span>
              <strong>Make my profile discoverable</strong>
              <small>Only public profiles appear in Find Teammates.</small>
            </span>
          </label>

          <label className="field-group">
            <span>Experience</span>
            <input
              type="text"
              value={draft.experience || ''}
              onChange={(event) => handleFieldChange('experience', event.target.value)}
              placeholder="e.g. 3 hackathons • 2 startup prototypes"
            />
          </label>

          <label className="field-group">
            <span>GitHub</span>
            <input
              type="url"
              value={draft.github || ''}
              onChange={(event) => handleFieldChange('github', event.target.value)}
              placeholder="https://github.com/yourname"
            />
            {errors.github && <small className="validation-message">{errors.github}</small>}
          </label>

          <label className="field-group">
            <span>Portfolio</span>
            <input
              type="url"
              value={draft.portfolio || ''}
              onChange={(event) => handleFieldChange('portfolio', event.target.value)}
              placeholder="https://yourportfolio.dev"
            />
            {errors.portfolio && <small className="validation-message">{errors.portfolio}</small>}
          </label>

          <div className="field-group full-width">
            <span>Skills</span>
            <div className="skill-editor">
              <input
                type="text"
                value={skillInput}
                onChange={(event) => setSkillInput(event.target.value)}
                placeholder="Add a skill..."
              />
              <select value={skillCategory} onChange={(event) => setSkillCategory(event.target.value)}>
                {PROFILE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <button type="button" className="secondary-button" onClick={handleAddSkill}>
                Add
              </button>
            </div>

            {errors.skills && <small className="validation-message">{errors.skills}</small>}
            {errors.skill && <small className="validation-message">{errors.skill}</small>}
            {errors.form && <small className="validation-message">{errors.form}</small>}

            <div className="skill-chip-list">
              {skillList.map((skill) => {
                const label = typeof skill === 'string' ? skill : skill.name;
                const category = typeof skill === 'string' ? 'Other' : skill.category;

                return (
                  <span key={`${label}-${category}`} className="skill-chip">
                    <span>{label}</span>
                    <button type="button" aria-label={`Remove ${label}`} onClick={() => handleRemoveSkill(label)}>
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="editor-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileEditorModal;
