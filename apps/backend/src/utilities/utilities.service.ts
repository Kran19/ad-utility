import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  RequestTimeoutException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiGatewayService } from '../ai/services/ai-gateway.service';
import { UtilitiesCacheService } from './services/utilities-cache.service';
import { EntitlementService } from '../billing/services/entitlement.service';
import {
  UtilityRegistry,
  defaultUtilityRegistry,
  UtilityPublicDto,
  UtilityExecutionResponseDto,
  UtilityExecutionContext,
  UtilityExecutionMode,
  FAQItem,
  CategoryPublicDto,
} from '@ad-utility/shared';
import { randomUUID } from 'crypto';
import { registerServerAdapters } from './adapters';

const DEFAULT_RELATED_MAP: Record<string, string[]> = {
  'jpg-to-png': ['png-to-jpg', 'image-compressor'],
  'png-to-jpg': ['jpg-to-png', 'image-compressor'],
  'image-compressor': ['jpg-to-png', 'png-to-jpg'],
  'pdf-compressor': ['pdf-merge', 'pdf-split', 'pdf-to-jpg'],
  'pdf-merge': ['pdf-split', 'pdf-compressor', 'pdf-to-jpg'],
  'pdf-split': ['pdf-merge', 'pdf-compressor', 'pdf-to-jpg'],
  'pdf-to-jpg': ['pdf-compressor', 'pdf-merge', 'pdf-split'],
  'text-cleaner': ['case-converter', 'word-counter'],
  'case-converter': ['text-cleaner', 'word-counter'],
  'word-counter': ['text-cleaner', 'case-converter'],
  'json-formatter': ['text-hash'],
  'text-hash': ['json-formatter'],
  'ai-summarizer': ['ai-humanizer', 'ai-paraphraser', 'ai-grammar-checker'],
  'ai-humanizer': ['ai-paraphraser', 'ai-grammar-checker', 'ai-summarizer'],
  'ai-paraphraser': ['ai-humanizer', 'ai-grammar-checker', 'ai-summarizer'],
  'ai-grammar-checker': ['ai-humanizer', 'ai-paraphraser', 'ai-summarizer'],
};

@Injectable()
export class UtilitiesService {
  private readonly logger = new Logger(UtilitiesService.name);
  private readonly registry: UtilityRegistry;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGatewayService,
    private readonly cache: UtilitiesCacheService,
    private readonly entitlementService?: EntitlementService,
  ) {
    this.registry = defaultUtilityRegistry;
    registerServerAdapters(this.registry, this.aiGateway);
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
    const cacheKey = `detail:${normalizedSlug}`;

    let cached: UtilityPublicDto | null = null;
    try {
      cached = await this.cache.get<UtilityPublicDto>(cacheKey);
    } catch (err: any) {
      this.logger.warn(`Cache read failed for ${cacheKey}: ${err?.message}`);
    }
    if (cached) {
      return cached;
    }

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

    const relatedSlugs =
      utility.relatedSlugs && utility.relatedSlugs.length > 0
        ? utility.relatedSlugs
        : DEFAULT_RELATED_MAP[utility.slug] || [];

    const result: UtilityPublicDto = {
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
      relatedSlugs,
      config: (utility.config as Record<string, any>) || {},
      version: utility.version,
      isAdapterAvailable,
    };

    try {
      await this.cache.set(cacheKey, result, 300);
    } catch {
      // fail open
    }
    return result;
  }

  /**
   * List all published public utilities
   */
  async listPublicUtilities(categorySlug?: string): Promise<UtilityPublicDto[]> {
    const normalizedCategory = categorySlug ? categorySlug.toLowerCase().trim() : null;
    const cacheKey = `list:${normalizedCategory || 'all'}`;

    let cached: UtilityPublicDto[] | null = null;
    try {
      cached = await this.cache.get<UtilityPublicDto[]>(cacheKey);
    } catch (err: any) {
      this.logger.warn(`Cache read failed for ${cacheKey}: ${err?.message}`);
    }
    if (cached) {
      return cached;
    }

    const whereClause: any = {
      status: 'ACTIVE',
    };

    if (normalizedCategory) {
      whereClause.category = { slug: normalizedCategory };
    }

    const utilities = await this.prisma.utility.findMany({
      where: whereClause,
      include: { category: true },
      orderBy: { displayOrder: 'asc' },
    });

    const result = utilities.map((utility) => {
      const adapter = this.registry.get(utility.slug);
      const faqContent = Array.isArray(utility.faqContent)
        ? (utility.faqContent as unknown as FAQItem[])
        : [];

      const relatedSlugs =
        utility.relatedSlugs && utility.relatedSlugs.length > 0
          ? utility.relatedSlugs
          : DEFAULT_RELATED_MAP[utility.slug] || [];

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
        relatedSlugs,
        config: (utility.config as Record<string, any>) || {},
        version: utility.version,
        isAdapterAvailable: !!adapter,
      };
    });

    try {
      await this.cache.set(cacheKey, result, 300);
    } catch {
      // fail open
    }
    return result;
  }

  /**
   * List all public categories with their active utilities
   */
  async listPublicCategories(): Promise<CategoryPublicDto[]> {
    const cacheKey = 'categories:list';
    let cached: CategoryPublicDto[] | null = null;
    try {
      cached = await this.cache.get<CategoryPublicDto[]>(cacheKey);
    } catch (err: any) {
      this.logger.warn(`Cache read failed for ${cacheKey}: ${err?.message}`);
    }
    if (cached) {
      return cached;
    }

    const categories = await this.prisma.utilityCategory.findMany({
      include: {
        utilities: {
          where: { status: 'ACTIVE' },
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    const result: CategoryPublicDto[] = categories.map((cat) => ({
      id: cat.id,
      slug: cat.slug,
      name: cat.name,
      description: cat.description,
      icon: cat.icon,
      displayOrder: cat.displayOrder,
      utilityCount: cat.utilities.length,
      utilities: cat.utilities.map((u) => ({
        id: u.id,
        slug: u.slug,
        name: u.name,
        description: u.description,
        implementationMode: u.implementationMode as UtilityExecutionMode,
        isFeatured: u.isFeatured,
        displayOrder: u.displayOrder,
      })),
    }));

    try {
      await this.cache.set(cacheKey, result, 300);
    } catch {
      // fail open
    }
    return result;
  }

  /**
   * Get single public category by slug with its active utilities
   */
  async getPublicCategory(categorySlug: string): Promise<CategoryPublicDto> {
    const normalizedSlug = categorySlug.toLowerCase().trim();
    const cacheKey = `category:${normalizedSlug}`;

    let cached: CategoryPublicDto | null = null;
    try {
      cached = await this.cache.get<CategoryPublicDto>(cacheKey);
    } catch (err: any) {
      this.logger.warn(`Cache read failed for ${cacheKey}: ${err?.message}`);
    }
    if (cached) {
      return cached;
    }

    const category = await this.prisma.utilityCategory.findUnique({
      where: { slug: normalizedSlug },
      include: {
        utilities: {
          where: { status: 'ACTIVE' },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category "${normalizedSlug}" was not found`);
    }

    const result: CategoryPublicDto = {
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      icon: category.icon,
      displayOrder: category.displayOrder,
      utilityCount: category.utilities.length,
      utilities: category.utilities.map((u) => ({
        id: u.id,
        slug: u.slug,
        name: u.name,
        description: u.description,
        implementationMode: u.implementationMode as UtilityExecutionMode,
        isFeatured: u.isFeatured,
        displayOrder: u.displayOrder,
      })),
    };

    try {
      await this.cache.set(cacheKey, result, 300);
    } catch {
      // fail open
    }
    return result;
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
    providedRequestId?: string,
    userId?: string,
  ): Promise<UtilityExecutionResponseDto> {
    const normalizedSlug = slug.toLowerCase().trim();
    const requestId =
      typeof providedRequestId === 'string' && providedRequestId.trim().length > 0
        ? providedRequestId.trim()
        : randomUUID();
    const startTime = Date.now();

    // 0. Entitlement Check (Decoupled Billing & Entitlements)
    if (this.entitlementService) {
      const entitlement = await this.entitlementService.canUseUtility(normalizedSlug, userId);
      if (!entitlement.allowed) {
        throw new ForbiddenException({
          code: 'ENTITLEMENT_REQUIRED',
          message: entitlement.reason || 'This utility requires an active Premium subscription.',
          upgradeUrl: entitlement.upgradeUrl || '/pricing',
        });
      }

      if (userId) {
        const usage = await this.entitlementService.checkAndIncrementUsage(userId, 'dailyConversions');
        if (!usage.allowed) {
          throw new ForbiddenException({
            code: 'USAGE_LIMIT_EXCEEDED',
            message: 'Daily conversion limit exceeded for your current plan.',
            upgradeUrl: '/pricing',
          });
        }
      }
    }

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
