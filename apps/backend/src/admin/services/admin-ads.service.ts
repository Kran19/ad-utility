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
} from '../dto/admin-ads.dto';
import { PaginatedResult, JwtPayload } from '@ad-utility/shared';
import { CampaignStatus, CreativeType, Prisma } from '@prisma/client';

import { RedisAdCacheService } from '../../ads/services/redis-ad-cache.service';

@Injectable()
export class AdminAdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly redisCache: RedisAdCacheService,
  ) {}

  // -------------------------------------------------------------
  // CAMPAIGNS
  // -------------------------------------------------------------
  async listCampaigns(query: AdminPaginationQueryDto & { status?: CampaignStatus }): Promise<PaginatedResult<any>> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
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
    if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:')) {
      throw new BadRequestException(`Unsafe URL scheme detected in "${url}"`);
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
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
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
  async listTargetingRules(query: { campaignId?: string; placementId?: string }) {
    const where: Prisma.AdTargetingRuleWhereInput = {};
    if (query.campaignId) where.campaignId = query.campaignId;
    if (query.placementId) where.placementId = query.placementId;

    return this.prisma.adTargetingRule.findMany({
      where,
      include: {
        campaign: true,
        placement: true,
        creative: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTargetingRule(dto: AdminCreateTargetingRuleDto, currentUser: JwtPayload, ip?: string) {
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
