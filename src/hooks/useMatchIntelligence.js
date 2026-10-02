import { useEffect, useState } from 'react';
import {
  buildFallbackMatchExplanations,
  buildMatchIntelligencePayload,
  validateMatchIntelligenceResponse,
} from '../lib/matchIntelligence';

const AI_TIMEOUT_MS = 8000;
const MATCH_INTELLIGENCE_URL = import.meta.env.VITE_MATCH_INTELLIGENCE_URL?.trim() || '';

export function useMatchIntelligence(project, skillGaps, recommendations) {
  const [result, setResult] = useState(null);
  const payload = buildMatchIntelligencePayload(project, skillGaps, recommendations);
  const payloadKey = JSON.stringify(payload);
  const fallback = buildFallbackMatchExplanations(project, skillGaps, recommendations);

  useEffect(() => {
    let active = true;
    let timeoutId;
    const controller = new AbortController();

    if (!MATCH_INTELLIGENCE_URL || !skillGaps.missingSkills.length) {
      return () => {
        active = false;
        controller.abort();
      };
    }
    timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    const requestExplanations = async () => {
      try {
        const response = await fetch(MATCH_INTELLIGENCE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadKey,
          signal: controller.signal,
        });
        if (!response.ok) return;
        const responseText = await response.text();
        if (responseText.length > 16000) return;
        const data = JSON.parse(responseText);
        const validated = validateMatchIntelligenceResponse(
          data,
          recommendations.map(({ person }) => person.id),
        );
        if (validated && active) setResult({ key: payloadKey, explanation: validated });
      } catch {
        // AI is optional; keep the deterministic explanation when unavailable.
      } finally {
        clearTimeout(timeoutId);
      }
    };

    void requestExplanations();
    return () => {
      active = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [payloadKey, recommendations, skillGaps.missingSkills.length]);

  return {
    explanation: result?.key === payloadKey ? result.explanation : fallback,
  };
}
