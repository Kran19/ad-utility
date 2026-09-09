import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';
import { AdminPaginationQueryDto } from '../dto/admin-query.dto';
import {
  AdminCreateUtilityDto,
  AdminUpdateUtilityDto,
  AdminCreateCategoryDto,
  AdminUpdateCategoryDto,
  AdminListUtilitiesQueryDto,
} from '../dto/admin-utilities.dto';
import { PaginatedResult, JwtPayload } from '@ad-utility/shared';
import { Prisma } from '@prisma/client';

import { UtilitiesCacheService } from '../../utilities/services/utilities-cache.service';

@Injectable()
export class AdminUtilitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly cache: UtilitiesCacheService,
  ) {}

  async listUtilities(query: AdminListUtilitiesQueryDto): Promise<PaginatedResult<any>> {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.UtilityWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.status) where.status = query.status as any;

    const [total, items] = await Promise.all([
      this.prisma.utility.count({ where }),
      this.prisma.utility.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { displayOrder: 'asc' },
        include: { category: true },
      }),
    ]);

    // Load active targeting rules to compute ad counts per utility without double counting
    const activeRules = await this.prisma.adTargetingRule.findMany({
      where: {
        isActive: true,
        campaign: { status: 'ACTIVE' },
      },
      select: {
        id: true,
        deviceTypes: true,
        utilitySlugs: true,
        categorySlugs: true,
      },
    });

    const enrichedItems = items.map((u) => {
      const uSlug = u.slug.toLowerCase();
      const cSlug = u.category?.slug?.toLowerCase();

      const applicableRules = activeRules.filter((r) => {
        const hasExactUtility =
          r.utilitySlugs && r.utilitySlugs.map((s) => s.toLowerCase()).includes(uSlug);
        const hasCategory =
          Boolean(
            cSlug &&
            r.categorySlugs &&
            r.categorySlugs.map((s) => s.toLowerCase()).includes(cSlug) &&
            (!r.utilitySlugs || r.utilitySlugs.length === 0),
          );
        return hasExactUtility || hasCategory;
      });

      const desktopRules = applicableRules.filter(
        (r) => r.deviceTypes.length === 0 || r.deviceTypes.includes('DESKTOP' as any),
      );
      const tabletRules = applicableRules.filter(
        (r) => r.deviceTypes.length === 0 || r.deviceTypes.includes('TABLET' as any),
      );
      const mobileRules = applicableRules.filter(
        (r) => r.deviceTypes.length === 0 || r.deviceTypes.includes('MOBILE' as any),
      );

      return {
        ...u,
        adCounts: {
          desktop: desktopRules.length,
          tablet: tabletRules.length,
          mobile: mobileRules.length,
          total: applicableRules.length,
        },
      };
    });

    return {
      items: enrichedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async getUtilityById(id: string) {
    const utility = await this.prisma.utility.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!utility) {
      throw new NotFoundException(`Utility with ID "${id}" not found`);
    }
    return utility;
  }

  async createUtility(dto: AdminCreateUtilityDto, currentUser: JwtPayload, ip?: string) {
    const existing = await this.prisma.utility.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new BadRequestException(`Utility with slug "${dto.slug}" already exists`);
    }

    const category = await this.prisma.utilityCategory.findUnique({ where: { id: dto.categoryId } });
    if (!category) {
      throw new BadRequestException(`Category with ID "${dto.categoryId}" does not exist`);
    }

    return this.prisma.$transaction(async (tx) => {
      const utility = await tx.utility.create({
        data: {
          slug: dto.slug,
          name: dto.name,
          description: dto.description,
          categoryId: dto.categoryId,
          implementationMode: dto.implementationMode || 'LOCAL',
          status: dto.status || 'DRAFT',
          isFeatured: dto.isFeatured || false,
          displayOrder: dto.displayOrder || 0,
          seoTitle: dto.seoTitle,
          seoDescription: dto.seoDescription,
          canonicalUrl: dto.canonicalUrl,
          faqContent: dto.faqContent || [],
          relatedSlugs: dto.relatedSlugs || [],
          config: dto.config || {},
          version: dto.version || '1.0.0',
        },
      });

      await this.auditService.record(
        {
          action: 'UTILITY_CREATED',
          entityType: 'Utility',
          entityId: utility.id,
          actorUserId: currentUser.sub,
          actorEmail: currentUser.email,
          actorIp: ip,
          details: { slug: utility.slug, name: utility.name, status: utility.status },
        },
        tx,
      );

      // Targeted cache invalidation
      await this.cache.invalidatePrefix(`detail:${utility.slug}`);
      await this.cache.invalidatePrefix('list:');
      await this.cache.invalidatePrefix('categories:');

      return utility;
    });
  }

  async updateUtility(id: string, dto: AdminUpdateUtilityDto, currentUser: JwtPayload, ip?: string) {
    const utility = await this.prisma.utility.findUnique({ where: { id } });
    if (!utility) {
      throw new NotFoundException(`Utility with ID "${id}" not found`);
    }

    if (dto.categoryId) {
      const category = await this.prisma.utilityCategory.findUnique({ where: { id: dto.categoryId } });
      if (!category) {
        throw new BadRequestException(`Category with ID "${dto.categoryId}" does not exist`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.utility.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          categoryId: dto.categoryId,
          implementationMode: dto.implementationMode,
          status: dto.status,
          isFeatured: dto.isFeatured,
          displayOrder: dto.displayOrder,
          seoTitle: dto.seoTitle,
          seoDescription: dto.seoDescription,
          canonicalUrl: dto.canonicalUrl,
          faqContent: dto.faqContent as any,
          relatedSlugs: dto.relatedSlugs,
          config: dto.config as any,
          version: dto.version,
        },
      });

      await this.auditService.record(
        {
          action: 'UTILITY_UPDATED',
          entityType: 'Utility',
          entityId: id,
          actorUserId: currentUser.sub,
          actorEmail: currentUser.email,
          actorIp: ip,
          details: { changes: dto },
        },
        tx,
      );

      // Targeted cache invalidation
      await this.cache.invalidatePrefix(`detail:${utility.slug}`);
      await this.cache.invalidatePrefix('list:');
      await this.cache.invalidatePrefix('categories:');

      return updated;
    });
  }

  async listCategories() {
    return this.prisma.utilityCategory.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: {
          select: { utilities: true },
        },
      },
    });
  }

  async createCategory(dto: AdminCreateCategoryDto, currentUser: JwtPayload, ip?: string) {
    const existing = await this.prisma.utilityCategory.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new BadRequestException(`Category with slug "${dto.slug}" already exists`);
    }

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.utilityCategory.create({
        data: {
          slug: dto.slug,
          name: dto.name,
          description: dto.description,
          icon: dto.icon,
          displayOrder: dto.displayOrder || 0,
        },
      });

      await this.auditService.record(
        {
          action: 'CATEGORY_CREATED',
          entityType: 'UtilityCategory',
          entityId: category.id,
          actorUserId: currentUser.sub,
          actorEmail: currentUser.email,
          actorIp: ip,
          details: { slug: category.slug, name: category.name },
        },
        tx,
      );

      // Targeted cache invalidation
      await this.cache.invalidatePrefix('categories:');
      await this.cache.invalidatePrefix(`category:${category.slug}`);
      await this.cache.invalidatePrefix('list:');

      return category;
    });
  }

  async updateCategory(id: string, dto: AdminUpdateCategoryDto, currentUser: JwtPayload, ip?: string) {
    const category = await this.prisma.utilityCategory.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.utilityCategory.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          icon: dto.icon,
          displayOrder: dto.displayOrder,
        },
      });

      await this.auditService.record(
        {
          action: 'CATEGORY_UPDATED',
          entityType: 'UtilityCategory',
          entityId: id,
          actorUserId: currentUser.sub,
          actorEmail: currentUser.email,
          actorIp: ip,
          details: { changes: dto },
        },
        tx,
      );

      // Targeted cache invalidation
      await this.cache.invalidatePrefix('categories:');
      await this.cache.invalidatePrefix(`category:${category.slug}`);
      await this.cache.invalidatePrefix('list:');

      return updated;
    });
  }
}
