import { Injectable } from '@nestjs/common';
import {
  PersonalizationRuleDto,
  PersonalizationContextDto,
  PersonalizationDecisionDto,
  PersonalizationSurface,
  ExperienceType,
} from '@ad-utility/shared';

@Injectable()
export class PersonalizationRuleService {
  /**
   * Reciprocal semantic pairing graph for multi-step workflows
   */
  private readonly reciprocalPairs: Record<string, string[]> = {
    'jpg-to-png': ['png-to-jpg', 'image-compressor'],
    'png-to-jpg': ['jpg-to-png', 'image-compressor'],
    'image-compressor': ['jpg-to-png', 'png-to-jpg'],
    'pdf-merge': ['pdf-split', 'pdf-compressor', 'pdf-to-jpg'],
    'pdf-split': ['pdf-merge', 'pdf-compressor'],
    'pdf-compressor': ['pdf-to-jpg', 'pdf-merge'],
    'pdf-to-jpg': ['image-compressor', 'pdf-compressor'],
    'text-cleaner': ['case-converter', 'word-counter'],
    'case-converter': ['text-cleaner', 'word-counter'],
    'word-counter': ['text-cleaner', 'case-converter'],
    'ai-humanizer': ['ai-grammar-checker', 'ai-paraphraser'],
    'ai-paraphraser': ['ai-humanizer', 'ai-grammar-checker'],
    'ai-grammar-checker': ['ai-humanizer', 'ai-paraphraser'],
    'json-formatter': ['base64-converter', 'text-hash'],
    'base64-converter': ['json-formatter', 'text-hash'],
    'text-hash': ['json-formatter', 'base64-converter'],
  };

  /**
   * Active administrator-configured rules
   */
  private rules: PersonalizationRuleDto[] = [
    {
      id: 'rule_mobile_touch_cta',
      name: 'Mobile Touch-Optimized CTA',
      surface: 'HERO_CTA',
      priority: 100,
      isActive: true,
      description: 'Provides concise, high-visibility tap targets for mobile visitors.',
      conditions: {
        deviceType: 'mobile',
      },
      targetVariantId: 'var_cta_mobile_instant',
      payload: {
        ctaText: 'Quick Convert',
        headline: 'Fast, Free Mobile Tool',
      },
    },
    {
      id: 'rule_organic_seo_landing',
      name: 'Organic Search Informational CTA',
      surface: 'HERO_CTA',
      priority: 90,
      isActive: true,
      description: 'Preserves clear educational reassurance for visitors arriving via search engines.',
      conditions: {
        acquisitionChannel: 'organic',
      },
      targetVariantId: 'var_cta_organic_educational',
      payload: {
        ctaText: 'Start Free Tool',
        headline: '100% Free Online Utility — No Registration',
      },
    },
    {
      id: 'rule_completed_downstream_cross_sell',
      name: 'Completed Task Downstream Reciprocal Discovery',
      surface: 'RELATED_UTILITIES',
      priority: 85,
      isActive: true,
      description: 'Recommends next natural workflow steps when a user finishes their current utility task.',
      conditions: {
        currentStepCompleted: true,
      },
      targetVariantId: 'var_rel_downstream_priority',
      payload: {
        headline: 'Next Recommended Step in Your Workflow',
      },
    },
    {
      id: 'rule_deep_session_explore_cta',
      name: 'Deep Session Cross-Utility Exploration',
      surface: 'POST_COMPLETION_CTA',
      priority: 80,
      isActive: true,
      description: 'Directs multi-task visitors to complementary tools after task completion.',
      conditions: {
        minSessionDepth: 2,
        currentStepCompleted: true,
      },
      targetVariantId: 'var_post_deep_explore',
      payload: {
        ctaText: 'Try Another Complementary Tool',
      },
    },
    {
      id: 'rule_pdf_merge_split_cta',
      name: 'PDF Merge to Split Direct Suggestion',
      surface: 'RELATED_UTILITIES',
      priority: 75,
      isActive: true,
      description: 'Directs PDF Merge users to PDF Split upon task completion.',
      conditions: {
        utilitySlug: 'pdf-merge',
        currentStepCompleted: true,
      },
      targetVariantId: 'var_rel_pdf_split',
      payload: {
        recommendedSlugs: ['pdf-split', 'pdf-compressor', 'pdf-to-jpg'],
      },
    },
  ];

  /**
   * Returns all active rules.
   */
  getActiveRules(): PersonalizationRuleDto[] {
    return [...this.rules];
  }

  /**
   * Evaluates personalization decision for a specific surface.
   * STRICTLY ENFORCES: EXPERIMENT PRECEDENCE.
   */
  evaluateDecision(
    surface: PersonalizationSurface,
    context: PersonalizationContextDto,
  ): PersonalizationDecisionDto {
    const experienceType: ExperienceType =
      surface === 'RELATED_UTILITIES'
        ? 'RELATED_UTILITIES'
        : surface === 'POST_COMPLETION_CTA'
        ? 'COMPLETION_RECOMMENDATION'
        : surface === 'DOWNLOAD_CTA'
        ? 'POST_DOWNLOAD'
        : 'CTA';

    // 1. EXPERIMENT PRECEDENCE CHECK
    // If an active experiment targets this surface, the experiment assignment WINS.
    const activeExperimentId = this.getExperimentForSurface(surface);
    if (activeExperimentId && context.experimentAssignments?.[activeExperimentId]) {
      const expVariant = context.experimentAssignments[activeExperimentId];
      return {
        surface,
        experienceType,
        variantId: expVariant,
        reason: `Experiment Precedence: assigned to variant ${expVariant} in experiment ${activeExperimentId}`,
        confidence: 1.0,
        experimentId: activeExperimentId,
        payload: this.getVariantPayload(surface, expVariant, context),
      };
    }

    // 2. DETERMINISTIC RULE EVALUATION (in descending priority order)
    const sortedRules = [...this.rules]
      .filter((r) => r.isActive && r.surface === surface)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (this.matchesRuleConditions(rule.conditions, context)) {
        const payload = {
          ...rule.payload,
          ...this.enhancePayloadWithContext(surface, rule.payload, context),
        };

        return {
          surface,
          experienceType,
          variantId: rule.targetVariantId,
          reason: `Matched Rule: ${rule.name}`,
          confidence: 0.9,
          ruleId: rule.id,
          payload,
        };
      }
    }

    // 3. DETERMINISTIC DEFAULT FALLBACK
    return this.getDefaultDecision(surface, experienceType, context);
  }

  /**
   * Deterministic Related Utilities Ranker based on workflow context.
   */
  rankRelatedUtilities(
    currentSlug: string,
    existingRelated: string[],
    isCompleted: boolean = false,
  ): string[] {
    const reciprocal = this.reciprocalPairs[currentSlug] || [];
    const combined = new Set<string>();

    // If task is completed, place reciprocal downstream tools first
    if (isCompleted) {
      for (const slug of reciprocal) {
        combined.add(slug);
      }
    }

    // Add existing related slugs
    for (const slug of existingRelated) {
      combined.add(slug);
    }

    // If not completed, append reciprocal tools if space remains
    if (!isCompleted) {
      for (const slug of reciprocal) {
        combined.add(slug);
      }
    }

    return Array.from(combined).slice(0, 6);
  }

  private matchesRuleConditions(
    conditions: PersonalizationRuleDto['conditions'],
    ctx: PersonalizationContextDto,
  ): boolean {
    if (conditions.utilitySlug && conditions.utilitySlug !== ctx.utilitySlug) {
      return false;
    }
    if (conditions.categorySlug && conditions.categorySlug !== ctx.categorySlug) {
      return false;
    }
    if (conditions.deviceType && conditions.deviceType !== ctx.deviceType) {
      return false;
    }
    if (conditions.acquisitionChannel && conditions.acquisitionChannel !== ctx.acquisitionChannel) {
      return false;
    }
    if (conditions.minSessionDepth && ctx.sessionDepth < conditions.minSessionDepth) {
      return false;
    }
    if (
      conditions.currentStepCompleted !== undefined &&
      conditions.currentStepCompleted !== ctx.currentStepCompleted
    ) {
      return false;
    }
    return true;
  }

  private getExperimentForSurface(surface: PersonalizationSurface): string | null {
    if (surface === 'HERO_CTA' || surface === 'TOOL_START_CTA') {
      return 'exp_utility_cta_v1';
    }
    if (surface === 'RELATED_UTILITIES') {
      return 'exp_related_ranking_v1';
    }
    return null;
  }

  private getVariantPayload(
    surface: PersonalizationSurface,
    variantId: string,
    context: PersonalizationContextDto,
  ): Record<string, any> {
    if (surface === 'RELATED_UTILITIES') {
      const rec = this.rankRelatedUtilities(context.utilitySlug || '', [], context.currentStepCompleted);
      return {
        headline: variantId === 'B' ? 'Complementary Tools You May Need Next' : 'Related Utilities',
        recommendedSlugs: rec,
      };
    }

    if (variantId === 'B') {
      return {
        ctaText: 'Start Converting Now',
        headline: 'Instant Free File Processing',
      };
    }

    return {
      ctaText: 'Use Tool Free',
      headline: 'Free Online Utility',
    };
  }

  private enhancePayloadWithContext(
    surface: PersonalizationSurface,
    basePayload: Record<string, any>,
    context: PersonalizationContextDto,
  ): Record<string, any> {
    if (surface === 'RELATED_UTILITIES' && context.utilitySlug) {
      const rec = this.rankRelatedUtilities(
        context.utilitySlug,
        basePayload.recommendedSlugs || [],
        context.currentStepCompleted,
      );
      return { recommendedSlugs: rec };
    }
    return {};
  }

  private getDefaultDecision(
    surface: PersonalizationSurface,
    experienceType: ExperienceType,
    context: PersonalizationContextDto,
  ): PersonalizationDecisionDto {
    const recommendedSlugs = context.utilitySlug
      ? this.rankRelatedUtilities(context.utilitySlug, [], context.currentStepCompleted)
      : [];

    let ctaText = 'Use Tool Free';
    if (surface === 'TOOL_START_CTA') ctaText = 'Run Tool';
    if (surface === 'POST_COMPLETION_CTA') ctaText = 'Download Result';
    if (surface === 'DOWNLOAD_CTA') ctaText = 'Download File';

    return {
      surface,
      experienceType,
      variantId: 'default',
      reason: 'Standard baseline default experience',
      confidence: 0.5,
      payload: {
        ctaText,
        headline: 'Free Online Utility',
        recommendedSlugs,
      },
    };
  }
}
