import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';
import { AdminPaginationQueryDto } from '../dto/admin-query.dto';
import {
  AdminCreateCampaignDto,
  AdminUpdateCampaignDto,
  AdminCreateCreativeDto,
  AdminUpdateCreativeDto,
  AdminUpdatePlacementDto,
  AdminCreateTargetingRuleDto,
  AdminUpdateTargetingRuleDto,
  AdminCreateScheduleDto,
  AdminUpdateScheduleDto,
  AdminAdPreviewRequestDto,
  AdminAdMatrixQueryDto,
  AdminListTargetingRulesQueryDto,
} from '../dto/admin-ads.dto';
import { PaginatedResult, JwtPayload } from '@ad-utility/shared';
import { CampaignStatus, CreativeType, Prisma } from '@prisma/client';

import { RedisAdCacheService } from '../../ads/services/redis-ad-cache.service';
import { AdSelectorService } from '../../ads/services/ad-selector.service';

@Injectable()
export class AdminAdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly redisCache: RedisAdCacheService,
    private readonly adSelectorService: AdSelectorService,
  ) {}

  // -------------------------------------------------------------
  // CAMPAIGNS
  // -------------------------------------------------------------
  async listCampaigns(query: AdminPaginationQueryDto & { status?: CampaignStatus }): Promise<PaginatedResult<any>> {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.AdCampaignWhereInput = {};
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }
    if (query.status) {
      where.status = query.status;
    }

    const [total, items] = await Promise.all([
      this.prisma.adCampaign.count({ where }),
      this.prisma.adCampaign.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: query.sortOrder || 'desc' },
        include: {
          _count: {
            select: { targetingRules: true, schedules: true, impressions: true, clicks: true },
          },
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async getCampaignById(id: string) {
    const campaign = await this.prisma.adCampaign.findUnique({
      where: { id },
      include: {
        targetingRules: {
          include: { placement: true, creative: true },
        },
        schedules: true,
        _count: {
          select: { impressions: true, clicks: true },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID "${id}" not found`);
    }

    return campaign;
  }

  async createCampaign(dto: AdminCreateCampaignDto, currentUser: JwtPayload, ip?: string) {
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.adCampaign.create({
        data: {
          name: dto.name,
          status: dto.status || CampaignStatus.DRAFT,
          priority: dto.priority || 50,
          weight: dto.weight || 100,
          dailyImpressionCap: dto.dailyImpressionCap,
          totalImpressionCap: dto.totalImpressionCap,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        },
      });

      await this.auditService.record(
        {
          action: 'CAMPAIGN_CREATED',
          entityType: 'AdCampaign',
          entityId: campaign.id,
          actorUserId: currentUser.sub,
          actorEmail: currentUser.email,
          actorIp: ip,
          details: { name: campaign.name, status: campaign.status, priority: campaign.priority },
        },
        tx,
      );

      await this.redisCache.invalidateCache('cache:adslot:*');
      return campaign;
    });
  }

  async updateCampaign(id: string, dto: AdminUpdateCampaignDto, currentUser: JwtPayload, ip?: string) {
    const campaign = await this.prisma.adCampaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID "${id}" not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.adCampaign.update({
        where: { id },
        data: {
          name: dto.name,
          status: dto.status,
          priority: dto.priority,
          weight: dto.weight,
          dailyImpressionCap: dto.dailyImpressionCap,
          totalImpressionCap: dto.totalImpressionCap,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        },
      });

      await this.auditService.record(
        {
          action: 'CAMPAIGN_UPDATED',
          entityType: 'AdCampaign',
          entityId: id,
          actorUserId: currentUser.sub,
          actorEmail: currentUser.email,
          actorIp: ip,
          details: { changes: dto },
        },
        tx,
      );

      await this.redisCache.invalidateCache('cache:adslot:*');
      return updated;
    });
  }

  async deleteCampaign(id: string, currentUser: JwtPayload, ip?: string) {
    const campaign = await this.prisma.adCampaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID "${id}" not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.adCampaign.delete({ where: { id } });
      await this.auditService.record(
        {
          action: 'CAMPAIGN_DELETED',
          entityType: 'AdCampaign',
          entityId: id,
          actorUserId: currentUser.sub,
          actorEmail: currentUser.email,
          actorIp: ip,
          details: { name: campaign.name },
        },
        tx,
      );
      await this.redisCache.invalidateCache('cache:adslot:*');
      return { deleted: true };
    });
  }

  // -------------------------------------------------------------
  // CREATIVES
  // -------------------------------------------------------------
  private validateUrlSafety(url?: string | null) {
    if (!url) return;
    const lower = url.trim().toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) {
      throw new BadRequestException(`Unsafe URL scheme detected in "${url}"`);
    }
    if (lower.startsWith('data:') && !lower.startsWith('data:image/')) {
      throw new BadRequestException(`Unsafe data scheme detected in "${url}". Only data:image/ is permitted.`);
    }
  }

  private validateHtmlSafety(customHtml?: string | null) {
    if (!customHtml) return;
    const lower = customHtml.toLowerCase();
    // Block inline scripts and event handler attributes
    if (
      lower.includes('<script') ||
      lower.includes('</script') ||
      /on\w+\s*=/i.test(lower) ||
      lower.includes('javascript:')
    ) {
      throw new BadRequestException('Unsafe script execution or event handler detected in custom HTML creative');
    }
  }

  async listCreatives(query: AdminPaginationQueryDto & { type?: CreativeType }): Promise<PaginatedResult<any>> {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.AdCreativeWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { altText: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.type) {
      where.type = query.type;
    }

    const [total, items] = await Promise.all([
      this.prisma.adCreative.count({ where }),
      this.prisma.adCreative.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: query.sortOrder || 'desc' },
      }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async getCreativeById(id: string) {
    const creative = await this.prisma.adCreative.findUnique({
      where: { id },
      include: {
        targetingRules: { include: { campaign: true, placement: true } },
      },
    });
    if (!creative) {
      throw new NotFoundException(`Creative with ID "${id}" not found`);
    }
    return creative;
  }

  async createCreative(dto: AdminCreateCreativeDto, currentUser: JwtPayload, ip?: string) {
    this.validateUrlSafety(dto.mediaUrl);
    this.validateUrlSafety(dto.targetUrl);
    this.validateHtmlSafety(dto.customHtml);

    return this.prisma.$transaction(async (tx) => {
      const creative = await tx.adCreative.create({
        data: {
          name: dto.name,
          type: dto.type,
          mediaUrl: dto.mediaUrl,
          targetUrl: dto.targetUrl,
          width: dto.width,
          height: dto.height,
          altText: dto.altText,
          customHtml: dto.customHtml,
          isGlobalFallback: dto.isGlobalFallback || false,
        },
      });

      await this.auditService.record(
        {
          action: 'CREATIVE_CREATED',
          entityType: 'AdCreative',
          entityId: creative.id,
          actorUserId: currentUser.sub,
          actorEmail: currentUser.email,
          actorIp: ip,
          details: { name: creative.name, type: creative.type },
        },
        tx,
      );

      await this.redisCache.invalidateCache('cache:adslot:*');
      return creative;
    });
  }

  async updateCreative(id: string, dto: AdminUpdateCreativeDto, currentUser: JwtPayload, ip?: string) {
    const creative = await this.prisma.adCreative.findUnique({ where: { id } });
    if (!creative) {
      throw new NotFoundException(`Creative with ID "${id}" not found`);
    }

    this.validateUrlSafety(dto.mediaUrl);
    this.validateUrlSafety(dto.targetUrl);
    this.validateHtmlSafety(dto.customHtml);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.adCreative.update({
        where: { id },
        data: {
          name: dto.name,
          type: dto.type,
          mediaUrl: dto.mediaUrl,
          targetUrl: dto.targetUrl,
          width: dto.width,
          height: dto.height,
          altText: dto.altText,
          customHtml: dto.customHtml,
          isGlobalFallback: dto.isGlobalFallback,
        },
      });

      await this.auditService.record(
        {
          action: 'CREATIVE_UPDATED',
          entityType: 'AdCreative',
          entityId: id,
          actorUserId: currentUser.sub,
          actorEmail: currentUser.email,
          actorIp: ip,
          details: { changes: dto },
        },
        tx,
      );

      await this.redisCache.invalidateCache('cache:adslot:*');
      return updated;
    });
  }

  async deleteCreative(id: string, currentUser: JwtPayload, ip?: string) {
    const creative = await this.prisma.adCreative.findUnique({ where: { id } });
    if (!creative) {
      throw new NotFoundException(`Creative with ID "${id}" not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.adCreative.delete({ where: { id } });
      await this.auditService.record(
        {
          action: 'CREATIVE_DELETED',
          entityType: 'AdCreative',
          entityId: id,
          actorUserId: currentUser.sub,
          actorEmail: currentUser.email,
          actorIp: ip,
          details: { name: creative.name },
        },
        tx,
      );
      await this.redisCache.invalidateCache('cache:adslot:*');
      return { deleted: true };
    });
  }

  // -------------------------------------------------------------
  // PLACEMENTS
  // -------------------------------------------------------------
  async listPlacements() {
    return this.prisma.adPlacement.findMany({
      include: {
        _count: {
          select: { targetingRules: true, impressions: true, clicks: true },
        },
      },
    });
  }

  async updatePlacement(id: string, dto: AdminUpdatePlacementDto, currentUser: JwtPayload, ip?: string) {
    const placement = await this.prisma.adPlacement.findUnique({ where: { id } });
    if (!placement) {
      throw new NotFoundException(`Placement with ID "${id}" not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.adPlacement.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          supportedTypes: dto.supportedTypes,
        },
      });

      await this.auditService.record(
        {
          action: 'PLACEMENT_UPDATED',
          entityType: 'AdPlacement',
          entityId: id,
          actorUserId: currentUser.sub,
          actorEmail: currentUser.email,
          actorIp: ip,
          details: { changes: dto },
        },
        tx,
      );

      await this.redisCache.invalidateCache('cache:adslot:*');
      return updated;
    });
  }

  // -------------------------------------------------------------
  // TARGETING RULES
  // -------------------------------------------------------------
  async listTargetingRules(query: AdminListTargetingRulesQueryDto) {
    const where: Prisma.AdTargetingRuleWhereInput = {};
    if (query.campaignId) where.campaignId = query.campaignId;
    if (query.placementId) where.placementId = query.placementId;
    if (query.utilitySlug) {
      if (query.utilitySlug.toLowerCase() === 'home') {
        where.OR = [
          { utilitySlugs: { has: 'home' } },
          { utilitySlugs: { isEmpty: true }, categorySlugs: { isEmpty: true } },
        ];
      } else {
        where.utilitySlugs = { has: query.utilitySlug.toLowerCase() };
      }
    }
    if (query.deviceType) where.deviceTypes = { has: query.deviceType as any };
    if (query.isActive !== undefined) where.isActive = query.isActive;

    return this.prisma.adTargetingRule.findMany({
      where,
      include: {
        campaign: {
          include: { schedules: true },
        },
        placement: true,
        creative: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTargetingRule(dto: AdminCreateTargetingRuleDto, currentUser: JwtPayload, ip?: string) {
    // Validate duplicate assignment
    const existingRules = await this.prisma.adTargetingRule.findMany({
      where: {
        campaignId: dto.campaignId,
        placementId: dto.placementId,
        creativeId: dto.creativeId,
      },
    });

    const hasDuplicate = existingRules.some((r) => {
      const sameDevices =
        r.deviceTypes.length === (dto.deviceTypes || []).length &&
        r.deviceTypes.every((d) => (dto.deviceTypes || []).includes(d as any));
      const sameUtilities =
        r.utilitySlugs.length === (dto.utilitySlugs || []).length &&
        r.utilitySlugs.every((u) => (dto.utilitySlugs || []).map((s) => s.toLowerCase()).includes(u.toLowerCase()));
      return sameDevices && sameUtilities;
    });

    if (hasDuplicate) {
      throw new BadRequestException(
        'An identical ad targeting assignment already exists for this campaign, placement, creative, device, and utility combination.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const rule = await tx.adTargetingRule.create({
        data: {
          campaignId: dto.campaignId,
          placementId: dto.placementId,
          creativeId: dto.creativeId,
          deviceTypes: dto.deviceTypes || [],
          utilitySlugs: dto.utilitySlugs || [],
          categorySlugs: dto.categorySlugs || [],
          countries: dto.countries || [],
          priorityOverride: dto.priorityOverride,
          weight: dto.weight || 100,
          isActive: dto.isActive !== undefined ? dto.isActive : true,
        },
        include: { campaign: true, placement: true, creative: true },
      });

      await this.auditService.record(
        {
          action: 'TARGETING_RULE_CREATED',
          entityType: 'AdTargetingRule',
          entityId: rule.id,
          actorUserId: currentUser.sub,
          actorEmail: currentUser.email,
          actorIp: ip,
          details: { campaignId: dto.campaignId, placementId: dto.placementId },
        },
        tx,
      );

      await this.redisCache.invalidateCache('cache:adslot:*');
      return rule;
    });
  }

  async updateTargetingRule(id: string, dto: AdminUpdateTargetingRuleDto, currentUser: JwtPayload, ip?: string) {
    const rule = await this.prisma.adTargetingRule.findUnique({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Targeting rule with ID "${id}" not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.adTargetingRule.update({
        where: { id },
        data: {
          placementId: dto.placementId,
          creativeId: dto.creativeId,
          deviceTypes: dto.deviceTypes,
          utilitySlugs: dto.utilitySlugs,
          categorySlugs: dto.categorySlugs,
          countries: dto.countries,
          priorityOverride: dto.priorityOverride,
          weight: dto.weight,
          isActive: dto.isActive,
        },
        include: { campaign: true, placement: true, creative: true },
      });

      await this.auditService.record(
        {
          action: 'TARGETING_RULE_UPDATED',
          entityType: 'AdTargetingRule',
          entityId: id,
          actorUserId: currentUser.sub,
          actorEmail: currentUser.email,
          actorIp: ip,
          details: { changes: dto },
        },
        tx,
      );

      await this.redisCache.invalidateCache('cache:adslot:*');
      return updated;
    });
  }

  async deleteTargetingRule(id: string, currentUser: JwtPayload, ip?: string) {
    const rule = await this.prisma.adTargetingRule.findUnique({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Targeting rule with ID "${id}" not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.adTargetingRule.delete({ where: { id } });
      await this.auditService.record(
        {
          action: 'TARGETING_RULE_DELETED',
          entityType: 'AdTargetingRule',
          entityId: id,
          actorUserId: currentUser.sub,
          actorEmail: currentUser.email,
          actorIp: ip,
          details: { id },
        },
        tx,
      );
      await this.redisCache.invalidateCache('cache:adslot:*');
      return { deleted: true };
    });
  }

  // -------------------------------------------------------------
  // AD MANAGER OPERATIONS
  // -------------------------------------------------------------
  async getAdMatrix(query: AdminAdMatrixQueryDto) {
    const whereUtility: Prisma.UtilityWhereInput = {};
    if (query.search) {
      whereUtility.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.categoryId) {
      whereUtility.categoryId = query.categoryId;
    }

    const utilities = await this.prisma.utility.findMany({
      where: whereUtility,
      include: { category: true },
      orderBy: { displayOrder: 'asc' },
    });

    const whereRule: Prisma.AdTargetingRuleWhereInput = {};
    if (query.campaignId) whereRule.campaignId = query.campaignId;
    if (query.placementId) whereRule.placementId = query.placementId;
    if (query.status === 'ACTIVE') whereRule.isActive = true;
    if (query.status === 'DISABLED') whereRule.isActive = false;

    const rules = await this.prisma.adTargetingRule.findMany({
      where: whereRule,
      include: {
        campaign: true,
        placement: true,
        creative: true,
      },
    });

    const matrix = utilities.map((u) => {
      const uSlug = u.slug.toLowerCase();
      const cSlug = u.category?.slug.toLowerCase();

      const applicableRules = rules.filter((r) => {
        const hasExactUtility = r.utilitySlugs && r.utilitySlugs.map((s) => s.toLowerCase()).includes(uSlug);
        const hasCategory =
          cSlug &&
          r.categorySlugs &&
          r.categorySlugs.map((s) => s.toLowerCase()).includes(cSlug) &&
          (!r.utilitySlugs || r.utilitySlugs.length === 0);
        return hasExactUtility || hasCategory;
      });

      const desktopRules = applicableRules.filter(
        (r) => r.deviceTypes.length === 0 || r.deviceTypes.includes('DESKTOP'),
      );
      const tabletRules = applicableRules.filter(
        (r) => r.deviceTypes.length === 0 || r.deviceTypes.includes('TABLET'),
      );
      const mobileRules = applicableRules.filter(
        (r) => r.deviceTypes.length === 0 || r.deviceTypes.includes('MOBILE'),
      );

      return {
        id: u.id,
        slug: u.slug,
        name: u.name,
        category: u.category ? { id: u.category.id, name: u.category.name, slug: u.category.slug } : null,
        status: u.status,
        desktop: desktopRules.length,
        tablet: tabletRules.length,
        mobile: mobileRules.length,
        total: applicableRules.length,
        activeAssignments: applicableRules.filter((r) => r.isActive).length,
      };
    });

    // Dedicated Home Page / Global Website entry
    const isSearchMatchHome =
      !query.search ||
      'home page'.includes(query.search.toLowerCase()) ||
      'homepage'.includes(query.search.toLowerCase()) ||
      'home'.includes(query.search.toLowerCase()) ||
      'global'.includes(query.search.toLowerCase());

    const isCategoryMatchHome = !query.categoryId;

    const homeRules = rules.filter((r) => {
      const hasExactHome = r.utilitySlugs && r.utilitySlugs.map((s) => s.toLowerCase()).includes('home');
      const isGlobalPlacement =
        (!r.utilitySlugs || r.utilitySlugs.length === 0) &&
        (!r.categorySlugs || r.categorySlugs.length === 0);
      return hasExactHome || isGlobalPlacement;
    });

    const homeDesktopRules = homeRules.filter(
      (r) => r.deviceTypes.length === 0 || r.deviceTypes.includes('DESKTOP'),
    );
    const homeTabletRules = homeRules.filter(
      (r) => r.deviceTypes.length === 0 || r.deviceTypes.includes('TABLET'),
    );
    const homeMobileRules = homeRules.filter(
      (r) => r.deviceTypes.length === 0 || r.deviceTypes.includes('MOBILE'),
    );

    const homeItem =
      isSearchMatchHome && isCategoryMatchHome
        ? {
            id: 'homepage-entry',
            slug: 'home',
            name: '🏠 Home Page (Website Homepage)',
            category: { id: 'global-home', name: 'Homepage / Global', slug: 'home' },
            status: 'ACTIVE',
            desktop: homeDesktopRules.length,
            tablet: homeTabletRules.length,
            mobile: homeMobileRules.length,
            total: homeRules.length,
            activeAssignments: homeRules.filter((r) => r.isActive).length,
          }
        : null;

    const fullMatrix = [...(homeItem ? [homeItem] : []), ...matrix];

    return {
      items: query.device
        ? fullMatrix.filter((item) => (item as any)[query.device!.toLowerCase()] > 0)
        : fullMatrix,
      total: fullMatrix.length,
    };
  }

  async previewAd(dto: AdminAdPreviewRequestDto) {
    let utilitySlug = dto.utilitySlug.toLowerCase();
    let utilityName = 'Home Page';
    let categoryName: string | undefined = 'Homepage / Global';

    if (utilitySlug !== 'home') {
      const utility = await this.prisma.utility.findUnique({
        where: { slug: dto.utilitySlug.toLowerCase() },
        include: { category: true },
      });
      if (!utility) {
        throw new NotFoundException(`Utility with slug "${dto.utilitySlug}" not found`);
      }
      utilityName = utility.name;
      categoryName = utility.category?.name;
    }

    const selectionResult = await this.adSelectorService.selectAd(
      {
        placement: dto.placement as any,
        utilitySlug,
        categorySlug: undefined,
      },
      dto.device as any,
      dto.country,
      'admin_preview_session',
    );

    const tierMap: Record<string, { code: string; label: string; description: string }> = {
      TIER_1_EXACT_UTILITY: {
        code: 'EXACT_UTILITY',
        label: 'Exact Utility Match',
        description: `Direct match: An active campaign rule is targeted specifically to "${utilityName}".`,
      },
      TIER_2_CATEGORY: {
        code: 'CATEGORY',
        label: 'Category Match',
        description: `Category fallback: No exact rule found for "${utilitySlug}". Selected rule targeted to category "${categoryName || 'General'}".`,
      },
      TIER_3_GLOBAL_PLACEMENT: {
        code: 'GLOBAL_PLACEMENT',
        label: 'Global Placement Fallback',
        description: `Placement fallback: Matched a global campaign targeted to placement slot across all utilities.`,
      },
      TIER_4_GLOBAL_FALLBACK: {
        code: 'HOUSE_FALLBACK',
        label: 'House Ad / Global Fallback',
        description: `House ad: No internal campaign rules matched. Served house/global fallback creative.`,
      },
      TIER_5_NO_AD: {
        code: 'NO_AD',
        label: 'No Ad',
        description: `No active creative or campaign is configured for ${dto.device} on this placement.`,
      },
    };

    const selection = tierMap[selectionResult.fallbackTier] || {
      code: selectionResult.fallbackTier,
      label: selectionResult.fallbackTier,
      description: 'Evaluated via production AdSelectorService.',
    };

    let campaignName: string | undefined;
    if (selectionResult.creative?.campaignId) {
      const camp = await this.prisma.adCampaign.findUnique({
        where: { id: selectionResult.creative.campaignId },
        select: { name: true },
      });
      campaignName = camp?.name;
    }

    const selectedAd = selectionResult.creative
      ? {
          campaignName: campaignName || (selectionResult.provider ? `External: ${selectionResult.provider}` : 'Internal Campaign'),
          creative: selectionResult.creative,
        }
      : null;

    return {
      hasAd: selectionResult.hasAd,
      explanation: selection,
      selectionTier: selectionResult.fallbackTier,
      placement: selectionResult.placement,
      selectedAd,
      utility: { slug: utilitySlug, name: utilityName, category: categoryName },
      device: dto.device,
    };
  }

  // -------------------------------------------------------------
  // SCHEDULES
  // -------------------------------------------------------------
  async listSchedules(query: { campaignId?: string }) {
    const where: Prisma.AdScheduleWhereInput = {};
    if (query.campaignId) where.campaignId = query.campaignId;

    return this.prisma.adSchedule.findMany({
      where,
      include: { campaign: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startHour: 'asc' }],
    });
  }

  async createSchedule(dto: AdminCreateScheduleDto, currentUser: JwtPayload, ip?: string) {
    return this.prisma.$transaction(async (tx) => {
      const schedule = await tx.adSchedule.create({
        data: {
          campaignId: dto.campaignId,
          dayOfWeek: dto.dayOfWeek,
          startHour: dto.startHour || 0,
          endHour: dto.endHour || 23,
          timezone: dto.timezone || 'UTC',
        },
        include: { campaign: true },
      });

      await this.auditService.record(
        {
          action: 'SCHEDULE_CREATED',
          entityType: 'AdSchedule',
          entityId: schedule.id,
          actorUserId: currentUser.sub,
          actorEmail: currentUser.email,
          actorIp: ip,
          details: { campaignId: dto.campaignId, dayOfWeek: dto.dayOfWeek },
        },
        tx,
      );

      return schedule;
    });
  }

  async updateSchedule(id: string, dto: AdminUpdateScheduleDto, currentUser: JwtPayload, ip?: string) {
    const schedule = await this.prisma.adSchedule.findUnique({ where: { id } });
    if (!schedule) {
      throw new NotFoundException(`Schedule with ID "${id}" not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.adSchedule.update({
        where: { id },
        data: {
          dayOfWeek: dto.dayOfWeek,
          startHour: dto.startHour,
          endHour: dto.endHour,
          timezone: dto.timezone,
        },
        include: { campaign: true },
      });

      await this.auditService.record(
        {
          action: 'SCHEDULE_UPDATED',
          entityType: 'AdSchedule',
          entityId: id,
          actorUserId: currentUser.sub,
          actorEmail: currentUser.email,
          actorIp: ip,
          details: { changes: dto },
        },
        tx,
      );

      return updated;
    });
  }

  async deleteSchedule(id: string, currentUser: JwtPayload, ip?: string) {
    const schedule = await this.prisma.adSchedule.findUnique({ where: { id } });
    if (!schedule) {
      throw new NotFoundException(`Schedule with ID "${id}" not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.adSchedule.delete({ where: { id } });
      await this.auditService.record(
        {
          action: 'SCHEDULE_DELETED',
          entityType: 'AdSchedule',
          entityId: id,
          actorUserId: currentUser.sub,
          actorEmail: currentUser.email,
          actorIp: ip,
        },
        tx,
      );
      return { deleted: true };
    });
  }
}
