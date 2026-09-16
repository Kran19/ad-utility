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

export function usePersonalization(
  surface: PersonalizationSurface,
  options?: UsePersonalizationOptions,
): PersonalizationDecisionDto {
  const defaultVal = DEFAULT_DECISIONS[surface] || DEFAULT_DECISIONS.HERO_CTA;
  const [decision, setDecision] = useState<PersonalizationDecisionDto>(defaultVal);

  const utilitySlug = options?.utilitySlug;
  const categorySlug = options?.categorySlug;
  const sessionDepth = options?.sessionDepth;
  const currentStep = options?.currentStep;
  const currentStepCompleted = options?.currentStepCompleted;

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
            utilitySlug,
            categorySlug,
            sessionDepth: sessionDepth || 1,
            currentStep: currentStep || 'LANDING',
            currentStepCompleted: currentStepCompleted || false,
            sessionToken,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data && isMounted) {
            setDecision((prev) => {
              if (
                prev.variantId === json.data.variantId &&
                JSON.stringify(prev.payload) === JSON.stringify(json.data.payload)
              ) {
                return prev;
              }
              return json.data;
            });
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
    utilitySlug,
    categorySlug,
    sessionDepth,
    currentStep,
    currentStepCompleted,
  ]);

  return decision;
}
