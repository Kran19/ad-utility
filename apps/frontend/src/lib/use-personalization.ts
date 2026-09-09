'use client';

import { useState, useEffect } from 'react';
import {
  PersonalizationSurface,
  PersonalizationDecisionDto,
} from '@ad-utility/shared';
import { getAnonymousSessionToken } from './analytics';
import { getClientApiUrl } from './site-config';

/**
 * Default fallback decisions to guarantee instant zero-blocking render
 */
const DEFAULT_DECISIONS: Record<PersonalizationSurface, PersonalizationDecisionDto> = {
  HERO_CTA: {
    surface: 'HERO_CTA',
    experienceType: 'CTA',
    variantId: 'default',
    reason: 'Standard baseline default experience',
    confidence: 0.5,
    payload: {
      ctaText: 'Use Tool Free',
      headline: 'Free Online Utility',
    },
  },
  TOOL_START_CTA: {
    surface: 'TOOL_START_CTA',
    experienceType: 'CTA',
    variantId: 'default',
    reason: 'Standard baseline default experience',
    confidence: 0.5,
    payload: {
      ctaText: 'Run Tool',
    },
  },
  POST_COMPLETION_CTA: {
    surface: 'POST_COMPLETION_CTA',
    experienceType: 'COMPLETION_RECOMMENDATION',
    variantId: 'default',
    reason: 'Standard baseline default experience',
    confidence: 0.5,
    payload: {
      ctaText: 'Download Result',
    },
  },
  DOWNLOAD_CTA: {
    surface: 'DOWNLOAD_CTA',
    experienceType: 'POST_DOWNLOAD',
    variantId: 'default',
    reason: 'Standard baseline default experience',
    confidence: 0.5,
    payload: {
      ctaText: 'Download File',
    },
  },
  RELATED_UTILITIES: {
    surface: 'RELATED_UTILITIES',
    experienceType: 'RELATED_UTILITIES',
    variantId: 'default',
    reason: 'Standard baseline default experience',
    confidence: 0.5,
    payload: {
      headline: 'Related Utilities',
    },
  },
  CATEGORY_NAVIGATION: {
    surface: 'CATEGORY_NAVIGATION',
    experienceType: 'CTA',
    variantId: 'default',
    reason: 'Standard baseline default experience',
    confidence: 0.5,
    payload: {},
  },
};

export interface UsePersonalizationOptions {
  utilitySlug?: string;
  categorySlug?: string;
  sessionDepth?: number;
  currentStep?: 'LANDING' | 'TOOL_START' | 'TOOL_COMPLETE' | 'RESULT_DOWNLOAD';
  currentStepCompleted?: boolean;
}

/**
 * Non-blocking progressive enhancement hook for personalization.
 * Instantly returns default fallback to prevent any render delays.
 */
export function usePersonalization(
  surface: PersonalizationSurface,
  options?: UsePersonalizationOptions,
): PersonalizationDecisionDto {
  const defaultVal = DEFAULT_DECISIONS[surface] || DEFAULT_DECISIONS.HERO_CTA;
  const [decision, setDecision] = useState<PersonalizationDecisionDto>(defaultVal);

  useEffect(() => {
    let isMounted = true;

    async function fetchDecision() {
      try {
        const apiUrl = getClientApiUrl();
        const sessionToken = getAnonymousSessionToken();

        const res = await fetch(`${apiUrl}/personalization/decision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            surface,
            utilitySlug: options?.utilitySlug,
            categorySlug: options?.categorySlug,
            sessionDepth: options?.sessionDepth || 1,
            currentStep: options?.currentStep || 'LANDING',
            currentStepCompleted: options?.currentStepCompleted || false,
            sessionToken,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data && isMounted) {
            setDecision(json.data);
          }
        }
      } catch {
        // Silently preserve default baseline on any failure
      }
    }

    fetchDecision();

    return () => {
      isMounted = false;
    };
  }, [
    surface,
    options?.utilitySlug,
    options?.categorySlug,
    options?.sessionDepth,
    options?.currentStep,
    options?.currentStepCompleted,
  ]);

  return decision;
}
