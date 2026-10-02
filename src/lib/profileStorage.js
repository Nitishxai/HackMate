export const PROFILE_STORAGE_KEY = 'hackmate_profile';

export const PROFILE_CATEGORIES = [
  'Programming',
  'Frontend',
  'Backend',
  'AI',
  'Data',
  'Design',
  'DevOps',
  'Mobile',
  'Product',
  'Other',
];

export const DEFAULT_PROFILE = {
  name: '',
  role: '',
  bio: '',
  skills: [],
  availability: '',
  experience: '',
  github: '',
  portfolio: '',
  projects: [],
  interests: [],
};

function normalizeSkill(skill) {
  if (typeof skill === 'string') {
    const trimmed = skill.trim();
    return trimmed ? { name: trimmed, category: 'Other' } : null;
  }

  if (skill && typeof skill === 'object') {
    const name = typeof skill.name === 'string' ? skill.name.trim() : '';
    if (!name) return null;

    const category = PROFILE_CATEGORIES.includes(skill.category) ? skill.category : 'Other';
    return { name, category };
  }

  return null;
}

export function normalizeProfile(profile) {
  const source = profile && typeof profile === 'object' ? profile : {};
  const skills = Array.isArray(source.skills)
    ? source.skills.map(normalizeSkill).filter(Boolean)
    : DEFAULT_PROFILE.skills;

  const projects = Array.isArray(source.projects)
    ? source.projects.map((project) => String(project).trim()).filter(Boolean)
    : [...DEFAULT_PROFILE.projects];

  const interests = Array.isArray(source.interests)
    ? source.interests.map((interest) => String(interest).trim()).filter(Boolean)
    : [...DEFAULT_PROFILE.interests];

  return {
    name: typeof source.name === 'string' ? source.name.trim() : DEFAULT_PROFILE.name,
    role: typeof source.role === 'string' ? source.role.trim() : DEFAULT_PROFILE.role,
    bio: typeof source.bio === 'string' ? source.bio.trim() : DEFAULT_PROFILE.bio,
    skills,
    availability:
      typeof source.availability === 'string' ? source.availability : DEFAULT_PROFILE.availability,
    experience: typeof source.experience === 'string' ? source.experience : DEFAULT_PROFILE.experience,
    github: typeof source.github === 'string' ? source.github.trim() : '',
    portfolio: typeof source.portfolio === 'string' ? source.portfolio.trim() : '',
    projects,
    interests,
    isPublic: source.isPublic === true,
    username: typeof source.username === 'string' ? source.username : '',
  };
}

export function getStoredProfile() {
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      return normalizeProfile(DEFAULT_PROFILE);
    }

    return normalizeProfile(JSON.parse(raw));
  } catch {
    return normalizeProfile(DEFAULT_PROFILE);
  }
}

export function saveProfile(profile) {
  const normalized = normalizeProfile(profile);

  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage failures in the frontend prototype.
  }

  return normalized;
}

export function getProfileCompletion(profile) {
  const normalized = normalizeProfile(profile);
  const checks = [
    !!normalized.name?.trim(),
    !!normalized.role?.trim(),
    !!normalized.bio?.trim(),
    Array.isArray(normalized.skills) && normalized.skills.length > 0,
    !!normalized.availability?.trim(),
    !!normalized.experience?.trim(),
    !!normalized.github?.trim(),
    !!normalized.portfolio?.trim(),
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
