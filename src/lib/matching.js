function toSkillName(skill) {
  return typeof skill === 'string' ? skill.trim() : String(skill?.name || '').trim();
}

function skillKey(skill) {
  return toSkillName(skill).replace(/\s+/g, ' ').toLowerCase();
}

function uniqueSkills(skills = []) {
  const namesByKey = new Map();
  skills.forEach((skill) => {
    const name = toSkillName(skill);
    const key = skillKey(name);
    if (key && !namesByKey.has(key)) {
      namesByKey.set(key, name);
    }
  });
  return namesByKey;
}

export function uniqueSkillNames(skills = []) {
  return [...uniqueSkills(skills).values()];
}

export function calculateSkillMatch(currentSkills = [], candidateSkills = []) {
  const currentByKey = uniqueSkills(currentSkills);
  const candidateByKey = uniqueSkills(candidateSkills);

  const matchingSkills = [...currentByKey.keys()]
    .filter((key) => candidateByKey.has(key))
    .map((key) => candidateByKey.get(key));
  const complementarySkills = currentByKey.size
    ? [...candidateByKey.keys()]
        .filter((key) => !currentByKey.has(key))
        .map((key) => candidateByKey.get(key))
    : [];
  const score = currentByKey.size && candidateByKey.size
    ? Math.round(
        ((matchingSkills.length * 2 + complementarySkills.length) /
          (2 * Math.max(currentByKey.size, candidateByKey.size))) *
          100,
      )
    : 0;

  return {
    score,
    matchingSkills,
    complementarySkills,
    hasCurrentSkills: currentByKey.size > 0,
  };
}

export function calculateProjectSkillGaps(requiredSkills = [], teamMembers = []) {
  const requiredByKey = uniqueSkills(requiredSkills);
  const teamByKey = uniqueSkills(teamMembers.flatMap((member) => member.skills || []));
  const missingSkills = [...requiredByKey]
    .filter(([key]) => !teamByKey.has(key))
    .map(([, name]) => name);

  return {
    requiredSkills: [...requiredByKey.values()],
    teamSkills: [...teamByKey.values()],
    missingSkills,
  };
}

export function calculateProjectCandidateMatch(missingSkills = [], candidateSkills = []) {
  const candidateByKey = uniqueSkills(candidateSkills);
  const matchingMissingSkills = missingSkills.filter((skill) => candidateByKey.has(skillKey(skill)));
  const totalMatchingSkills = matchingMissingSkills.length;

  return {
    matchingMissingSkills,
    totalMatchingSkills,
    score: missingSkills.length
      ? Math.round((totalMatchingSkills / missingSkills.length) * 100)
      : 0,
  };
}
