import { Controller, Post, Body, Headers, Query } from '@nestjs/common';
import { PersonalizationContextService } from '../services/personalization-context.service';
import { PersonalizationRuleService } from '../services/personalization-rule.service';
import {
  ApiResponse,
  PersonalizationDecisionDto,
  PersonalizationSurface,
} from '@ad-utility/shared';

@Controller('personalization')
export class PersonalizationController {
  constructor(
    private readonly contextService: PersonalizationContextService,
    private readonly ruleService: PersonalizationRuleService,
  ) {}

  /**
   * Public, lightweight, non-blocking personalization decision endpoint.
   * Fails open to default experience on any error or missing input.
   */
  @Post('decision')
  getDecision(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: Record<string, string | undefined>,
    @Body()
    body?: {
      surface?: PersonalizationSurface;
      utilitySlug?: string;
      categorySlug?: string;
      sessionDepth?: number;
      currentStep?: 'LANDING' | 'TOOL_START' | 'TOOL_COMPLETE' | 'RESULT_DOWNLOAD';
      currentStepCompleted?: boolean;
      sessionToken?: string;
      experimentAssignments?: Record<string, string>;
    },
  ): ApiResponse<PersonalizationDecisionDto> {
    try {
      const surface = body?.surface || 'HERO_CTA';
      const context = this.contextService.resolveContext(headers, query, body);
      const decision = this.ruleService.evaluateDecision(surface, context);

      return {
        success: true,
        data: decision,
        timestamp: new Date().toISOString(),
      };
    } catch {
      // Fail open to standard baseline default
      const defaultDecision: PersonalizationDecisionDto = {
        surface: body?.surface || 'HERO_CTA',
        experienceType: 'CTA',
        variantId: 'default',
        reason: 'Fail-open fallback experience',
        confidence: 0.5,
        payload: {
          ctaText: 'Use Tool Free',
          headline: 'Free Online Utility',
        },
      };

      return {
        success: true,
        data: defaultDecision,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
