function normalizedText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const text = [...value]
    .filter((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint >= 32 && codePoint !== 127;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text || text.length > maxLength || /<[^>]*>/.test(text)) return null;
  return text;
}

function inputText(value, maxLength) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';
}

export function buildMatchIntelligencePayload(project, skillGaps, recommendations) {
  return {
    project: {
      title: inputText(project.title, 160),
      description: inputText(project.description, 500),
      requiredSkills: skillGaps.requiredSkills,
      teamSkills: skillGaps.teamSkills,
      missingSkills: skillGaps.missingSkills,
    },
    candidates: recommendations.map(({ person, match }) => ({
      profileId: person.id,
      name: inputText(person.name, 100),
      role: inputText(person.role, 120),
      bio: inputText(person.bio, 300),
      experience: inputText(person.experience, 200),
      skills: person.skills,
      matchingMissingSkills: match.matchingMissingSkills,
      compatibilityScore: match.score,
    })),
  };
}

export function buildFallbackMatchExplanations(project, skillGaps, recommendations) {
  const teamSummary = skillGaps.teamSkills.length
    ? `The team already covers ${skillGaps.teamSkills.join(', ')}.`
    : 'The team has not listed skills that cover the project requirements yet.';
  const gapSummary = skillGaps.missingSkills.length
    ? ` Remaining required skills are ${skillGaps.missingSkills.join(', ')}.`
    : ' All required project skills are covered.';
  const nextStep = skillGaps.missingSkills.length
    ? ` A teammate with ${skillGaps.missingSkills.join(' or ')} experience could fill those gaps.`
    : '';

  const candidateExplanations = Object.fromEntries(recommendations.map(({ person, match }) => {
    const skills = match.matchingMissingSkills.join(', ');
    const role = person.role ? ` Their ${person.role} role` : ' Their profile';
    const relevantProfile = person.experience
      ? ` and experience (${inputText(person.experience, 100)})`
      : person.bio
        ? ` and profile summary (${inputText(person.bio, 100)})`
        : '';
    return [
      person.id,
      `${person.name} lists ${skills}, which directly covers ${match.totalMatchingSkills} of the project's missing required skills.${role}${relevantProfile} may also be relevant to ${project.title}.`,
    ];
  }));

  return {
    teamGapExplanation: `${teamSummary}${gapSummary}${nextStep}`,
    candidateExplanations,
    source: 'fallback',
  };
}

export function validateMatchIntelligenceResponse(response, candidateIds) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return null;
  if (Object.keys(response).sort().join(',') !== 'candidateExplanations,teamGapExplanation') return null;

  const teamGapExplanation = normalizedText(response.teamGapExplanation, 500);
  if (!teamGapExplanation || !Array.isArray(response.candidateExplanations)) return null;

  const allowedIds = new Set(candidateIds);
  const explanations = new Map();
  for (const item of response.candidateExplanations) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    if (Object.keys(item).sort().join(',') !== 'explanation,profileId') return null;
    if (typeof item.profileId !== 'string' || !allowedIds.has(item.profileId)) return null;
    if (explanations.has(item.profileId)) return null;

    const explanation = normalizedText(item.explanation, 350);
    if (!explanation) return null;
    explanations.set(item.profileId, explanation);
  }

  if (explanations.size !== allowedIds.size) return null;

  return {
    teamGapExplanation,
    candidateExplanations: Object.fromEntries(explanations),
    source: 'ai',
  };
}
