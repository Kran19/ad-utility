import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  RequestTimeoutException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  UtilityRegistry,
  defaultUtilityRegistry,
  UtilityPublicDto,
  UtilityExecutionResponseDto,
  UtilityExecutionContext,
  UtilityExecutionMode,
  FAQItem,
} from '@ad-utility/shared';
import { randomUUID } from 'crypto';

@Injectable()
export class UtilitiesService {
  private readonly logger = new Logger(UtilitiesService.name);
  private readonly registry: UtilityRegistry;

  constructor(private readonly prisma: PrismaService) {
    this.registry = defaultUtilityRegistry;
  }

  /**
   * Expose access to code registry (used for adapter inspection and testing)
   */
  getRegistry(): UtilityRegistry {
    return this.registry;
  }

  /**
   * Resolve public metadata for a utility by slug
   */
  async getPublicUtility(slug: string): Promise<UtilityPublicDto> {
    const normalizedSlug = slug.toLowerCase().trim();

    const utility = await this.prisma.utility.findUnique({
      where: { slug: normalizedSlug },
      include: { category: true },
    });

    if (!utility) {
      throw new NotFoundException(`Utility with slug "${normalizedSlug}" was not found`);
    }

    if (utility.status !== 'ACTIVE') {
      throw new NotFoundException(`Utility with slug "${normalizedSlug}" is currently unpublished or disabled`);
    }

    const adapter = this.registry.get(normalizedSlug);
    const isAdapterAvailable = !!adapter;

    const faqContent = Array.isArray(utility.faqContent)
      ? (utility.faqContent as unknown as FAQItem[])
      : [];

    return {
      id: utility.id,
      slug: utility.slug,
      name: utility.name,
      description: utility.description,
      categoryId: utility.categoryId,
      categorySlug: utility.category.slug,
      categoryName: utility.category.name,
      implementationMode: utility.implementationMode as UtilityExecutionMode,
      status: utility.status,
      isFeatured: utility.isFeatured,
      displayOrder: utility.displayOrder,
      seoTitle: utility.seoTitle,
      seoDescription: utility.seoDescription,
      canonicalUrl: utility.canonicalUrl,
      faqContent,
      relatedSlugs: utility.relatedSlugs || [],
      config: (utility.config as Record<string, any>) || {},
      version: utility.version,
      isAdapterAvailable,
    };
  }

  /**
   * List all published public utilities
   */
  async listPublicUtilities(categorySlug?: string): Promise<UtilityPublicDto[]> {
    const whereClause: any = {
      status: 'ACTIVE',
    };

    if (categorySlug) {
      whereClause.category = { slug: categorySlug.toLowerCase().trim() };
    }

    const utilities = await this.prisma.utility.findMany({
      where: whereClause,
      include: { category: true },
      orderBy: { displayOrder: 'asc' },
    });

    return utilities.map((utility) => {
      const adapter = this.registry.get(utility.slug);
      const faqContent = Array.isArray(utility.faqContent)
        ? (utility.faqContent as unknown as FAQItem[])
        : [];

      return {
        id: utility.id,
        slug: utility.slug,
        name: utility.name,
        description: utility.description,
        categoryId: utility.categoryId,
        categorySlug: utility.category.slug,
        categoryName: utility.category.name,
        implementationMode: utility.implementationMode as UtilityExecutionMode,
        status: utility.status,
        isFeatured: utility.isFeatured,
        displayOrder: utility.displayOrder,
        seoTitle: utility.seoTitle,
        seoDescription: utility.seoDescription,
        canonicalUrl: utility.canonicalUrl,
        faqContent,
        relatedSlugs: utility.relatedSlugs || [],
        config: (utility.config as Record<string, any>) || {},
        version: utility.version,
        isAdapterAvailable: !!adapter,
      };
    });
  }

  /**
   * Execute utility using registered code adapter
   */
  async executeUtility(
    slug: string,
    rawInput: unknown,
    ip?: string,
    userAgent?: string,
    sessionToken?: string,
  ): Promise<UtilityExecutionResponseDto> {
    const normalizedSlug = slug.toLowerCase().trim();
    const requestId = randomUUID();
    const startTime = Date.now();

    // 1. Resolve database metadata & check active status
    const utility = await this.prisma.utility.findUnique({
      where: { slug: normalizedSlug },
    });

    if (!utility) {
      throw new NotFoundException(`Utility "${normalizedSlug}" not found`);
    }

    if (utility.status !== 'ACTIVE') {
      throw new NotFoundException(`Utility "${normalizedSlug}" is currently disabled`);
    }

    // 2. Resolve code adapter from application registry
    const adapter = this.registry.get(normalizedSlug);
    if (!adapter) {
      this.logger.warn(`Executable adapter missing for slug "${normalizedSlug}" (DB record exists)`);
      throw new ServiceUnavailableException(
        `Execution adapter for "${normalizedSlug}" is currently not available in this environment`,
      );
    }

    // 3. Input validation & Resource limits check
    let validatedInput: any;
    try {
      validatedInput = adapter.validateInput(rawInput);
    } catch (valErr: any) {
      throw new BadRequestException(valErr.message || 'Invalid input payload provided');
    }

    // 4. Build execution context
    const context: UtilityExecutionContext = {
      requestId,
      utilitySlug: normalizedSlug,
      executionMode: adapter.mode,
      ip,
      userAgent,
      sessionToken,
      limits: adapter.resourceLimits,
    };

    // 5. Execute with clean timer timeout enforcement
    const timeoutMs = adapter.resourceLimits?.maxExecutionTimeMs || 10000;

    let result: any;
    let timerId: any;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timerId = setTimeout(
          () => reject(new RequestTimeoutException(`Execution timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      });

      result = await Promise.race([
        Promise.resolve(adapter.execute(validatedInput, context)),
        timeoutPromise,
      ]);
    } catch (execErr: any) {
      if (execErr instanceof RequestTimeoutException) {
        throw execErr;
      }
      this.logger.error(`Execution failed for ${normalizedSlug}: ${execErr.message}`);
      throw new BadRequestException(`Utility execution failed: ${execErr.message}`);
    } finally {
      if (timerId) {
        clearTimeout(timerId);
      }
    }

    // 6. Optional Output validation
    if (typeof adapter.validateOutput === 'function') {
      try {
        result = adapter.validateOutput(result);
      } catch (outErr: any) {
        this.logger.error(`Output validation failed for ${normalizedSlug}: ${outErr.message}`);
        throw new BadRequestException(`Utility output validation failed: ${outErr.message}`);
      }
    }

    const executionTimeMs = Date.now() - startTime;

    return {
      result,
      executionTimeMs,
      mode: adapter.mode,
      requestId,
    };
  }
}
