import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisAdCacheService } from './redis-ad-cache.service';
import { TrackingTokenService } from './tracking-token.service';
import {
  AdSlotRequestDto,
  AdSlotResponseDto,
  AdPlacement,
  DeviceType,
  CreativeType,
} from '@ad-utility/shared';
import {
  PlacementCode,
  CampaignStatus,
  CreativeType as PrismaCreativeType,
  DeviceType as PrismaDeviceType,
  UtilityStatus,
} from '@prisma/client';
import { ExternalAdNetworkService } from '../providers/external-ad-network.service';

export const FALLBACK_BANNER_IMAGE = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&h=200&fit=crop&q=80';

export function sanitizeMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('data:image/')) return url;

  const filename = url.split('/').pop() || '';
  const lower = (filename + ' ' + url).toLowerCase();

  if (lower.includes('aviator') && (lower.includes('728') || lower.includes('top'))) return '/media/promos/aviator-top.jpg';
  if (lower.includes('aviator') && (lower.includes('250') || lower.includes('mid'))) return '/media/promos/aviator-mid.jpg';
  if (lower.includes('aviator') && (lower.includes('300x600') || lower.includes('300-600') || lower.includes('300 600') || lower.includes('side'))) return '/media/promos/aviator-side.jpg';
  if (lower.includes('aviator') && (lower.includes('125') || lower.includes('badge'))) return '/media/promos/aviator-badge.jpg';
  if (lower.includes('aviator') && (lower.includes('160') || lower.includes('tall'))) return '/media/promos/aviator-tall.jpg';
  if (lower.includes('aviator')) return '/media/promos/aviator-top.jpg';

  if (lower.includes('jetx') && (lower.includes('728') || lower.includes('top'))) return '/media/promos/jetx-top.jpg';
  if (lower.includes('jetx') && (lower.includes('250') || lower.includes('mid'))) return '/media/promos/jetx-mid.jpg';
  if (lower.includes('jetx') && (lower.includes('300x600') || lower.includes('300-600') || lower.includes('300 600') || lower.includes('side'))) return '/media/promos/jetx-side.jpg';
  if (lower.includes('jetx') && (lower.includes('125') || lower.includes('badge'))) return '/media/promos/jetx-badge.jpg';
  if (lower.includes('jetx') && (lower.includes('160') || lower.includes('tall'))) return '/media/promos/jetx-tall.jpg';
  if (lower.includes('jetx')) return '/media/promos/jetx-top.jpg';

  if ((lower.includes('roulette') || lower.includes('roullet')) && (lower.includes('728') || lower.includes('top'))) return '/media/promos/roulette-top.jpg';
  if ((lower.includes('roulette') || lower.includes('roullet')) && (lower.includes('250') || lower.includes('mid'))) return '/media/promos/roulette-mid.jpg';
  if ((lower.includes('roulette') || lower.includes('roullet')) && (lower.includes('300x600') || lower.includes('300-600') || lower.includes('300 600') || lower.includes('side'))) return '/media/promos/roulette-side.jpg';
  if ((lower.includes('roulette') || lower.includes('roullet')) && (lower.includes('125') || lower.includes('badge'))) return '/media/promos/roulette-badge.jpg';
  if ((lower.includes('roulette') || lower.includes('roullet')) && (lower.includes('160') || lower.includes('tall'))) return '/media/promos/roulette-tall.jpg';
  if (lower.includes('roulette') || lower.includes('roullet')) return '/media/promos/roulette-top.jpg';

  return url;
}

export function formatGlobalFallbackHtml(mediaUrl?: string): string {
  const bannerUrl = mediaUrl || FALLBACK_BANNER_IMAGE;
  return `<div style="width:100%;max-width:728px;margin:0 auto;position:relative;overflow:hidden;border-radius:8px;border:1px solid #1e293b;background:#0f172a;display:flex;align-items:center;justify-content:center;cursor:pointer;"><img src="${bannerUrl}" alt="⚡ Global Platform Sponsor • Fast Utilities" style="width:100%;max-height:100px;object-fit:cover;display:block;" /><div style="position:absolute;bottom:6px;left:10px;background:rgba(15,23,42,0.85);backdrop-filter:blur(4px);padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#38bdf8;border:1px solid rgba(56,189,248,0.25);display:flex;align-items:center;gap:4px;">⚡ Global Platform Sponsor &bull; Fast Utilities</div></div>`;
}

export interface SelectedCandidate {
  ruleId: string;
  campaignId: string;
  creativeId: string;
  placementId: string;
  placementCode: AdPlacement;
  effectivePriority: number;
  weight: number;
  fallbackTier: string;
  creative: {
    id: string;
    name: string;
    type: CreativeType;
    mediaUrl: string | null;
    targetUrl: string | null;
    width: number | null;
    height: number | null;
    altText: string | null;
    customHtml: string | null;
  };
}

@Injectable()
export class AdSelectorService implements OnModuleInit {
  private readonly logger = new Logger(AdSelectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisCache: RedisAdCacheService,
    private readonly trackingTokenService: TrackingTokenService,
    private readonly externalAdNetwork: ExternalAdNetworkService,
  ) {}

  onModuleInit() {
    // Run background setup asynchronously so HTTP healthcheck succeeds immediately
    setImmediate(async () => {
      try {
        const bannerHtml = formatGlobalFallbackHtml();
        await this.prisma.adCreative.updateMany({
          where: {
            OR: [
              { isGlobalFallback: true },
              { customHtml: { contains: 'Global Platform Sponsor' } },
              { name: { contains: 'Global Fallback' } },
            ],
          },
          data: {
            customHtml: bannerHtml,
            mediaUrl: FALLBACK_BANNER_IMAGE,
          },
        });
        this.logger.log('Fallback ad creatives successfully synced with image banner');

        await this.ensureDefaultTargeting();
      } catch (err: any) {
        this.logger.warn(`Could not sync fallback ad creatives or default targeting: ${err.message}`);
      }
    });
  }

  /**
   * Self-healing default campaigns, creatives, and zig-zag targeting rules for all active tools
   */
  async ensureDefaultTargeting() {
    try {
      this.logger.log('Syncing Rocky11 campaigns, creatives, and tool targeting rules...');

      const DEFAULT_TARGET_URL = 'https://rocky11.club/?refercode=SEO';

      // 1. Ensure placements exist
      const placementsData = [
        { code: PlacementCode.HEADER_BANNER, name: 'Header Banner', description: 'Top horizontal banner (728x90 desktop / 320x50 mobile)', supportedTypes: [PrismaCreativeType.IMAGE, PrismaCreativeType.HTML, PrismaCreativeType.IFRAME] },
        { code: PlacementCode.TOP_CONTENT, name: 'Top Content Banner', description: 'Banner displayed above the tool interface workspace', supportedTypes: [PrismaCreativeType.IMAGE, PrismaCreativeType.VIDEO, PrismaCreativeType.HTML, PrismaCreativeType.IFRAME] },
        { code: PlacementCode.AFTER_TOOL, name: 'After Tool Banner', description: 'Banner placed directly below the active tool interface', supportedTypes: [PrismaCreativeType.IMAGE, PrismaCreativeType.VIDEO, PrismaCreativeType.HTML, PrismaCreativeType.IFRAME] },
        { code: PlacementCode.MID_CONTENT, name: 'Mid Content Banner', description: 'Banner embedded inside the content / how-to documentation', supportedTypes: [PrismaCreativeType.IMAGE, PrismaCreativeType.HTML, PrismaCreativeType.IFRAME] },
        { code: PlacementCode.BOTTOM_CONTENT, name: 'Bottom Content Banner', description: 'Banner placed directly above the FAQ section', supportedTypes: [PrismaCreativeType.IMAGE, PrismaCreativeType.HTML, PrismaCreativeType.IFRAME] },
        { code: PlacementCode.SIDEBAR, name: 'Sidebar Banner', description: 'Vertical skyscraper banner on desktop viewports (300x250 / 160x600)', supportedTypes: [PrismaCreativeType.IMAGE, PrismaCreativeType.VIDEO, PrismaCreativeType.HTML, PrismaCreativeType.IFRAME] },
        { code: PlacementCode.MOBILE_STICKY, name: 'Mobile Sticky Footer', description: 'Sticky bottom banner overlay on mobile viewports', supportedTypes: [PrismaCreativeType.IMAGE, PrismaCreativeType.HTML] },
        { code: PlacementCode.DESKTOP_STICKY, name: 'Desktop Corner Sticky', description: 'Floating corner overlay on desktop viewports', supportedTypes: [PrismaCreativeType.IMAGE, PrismaCreativeType.HTML] },
      ];

      const createdPlacements: Record<string, any> = {};
      for (const p of placementsData) {
        const placement = await this.prisma.adPlacement.upsert({
          where: { code: p.code },
          update: { name: p.name, description: p.description, supportedTypes: p.supportedTypes },
          create: p,
        });
        createdPlacements[p.code] = placement;
      }

      // 2. Ensure Creatives exist with clean adblock-safe media URLs
      const creativesData = [
        // Aviator Creatives
        { name: 'Aviator Desktop Leaderboard (728x90)', type: PrismaCreativeType.IMAGE, mediaUrl: '/media/promos/aviator-top.jpg', targetUrl: DEFAULT_TARGET_URL, width: 728, height: 90, altText: 'Play Aviator Game Online', isGlobalFallback: false },
        { name: 'Aviator Medium Banner (300x250)', type: PrismaCreativeType.IMAGE, mediaUrl: '/media/promos/aviator-mid.jpg', targetUrl: DEFAULT_TARGET_URL, width: 300, height: 250, altText: 'Aviator Online Multiplier', isGlobalFallback: false },
        { name: 'Aviator Sidebar Skyscraper (300x600)', type: PrismaCreativeType.IMAGE, mediaUrl: '/media/promos/aviator-side.jpg', targetUrl: DEFAULT_TARGET_URL, width: 300, height: 600, altText: 'Aviator Crash Game Bonus', isGlobalFallback: false },
        { name: 'Aviator Mobile Badge (125x125)', type: PrismaCreativeType.IMAGE, mediaUrl: '/media/promos/aviator-badge.jpg', targetUrl: DEFAULT_TARGET_URL, width: 125, height: 125, altText: 'Aviator Quick Play', isGlobalFallback: false },
        { name: 'Aviator Skyscraper (160x600)', type: PrismaCreativeType.IMAGE, mediaUrl: '/media/promos/aviator-tall.jpg', targetUrl: DEFAULT_TARGET_URL, width: 160, height: 600, altText: 'Aviator Crash Game', isGlobalFallback: false },
        // JetX Creatives
        { name: 'JetX Desktop Leaderboard (728x90)', type: PrismaCreativeType.IMAGE, mediaUrl: '/media/promos/jetx-top.jpg', targetUrl: DEFAULT_TARGET_URL, width: 728, height: 90, altText: 'Play JetX Game Online', isGlobalFallback: false },
        { name: 'JetX Medium Banner (300x250)', type: PrismaCreativeType.IMAGE, mediaUrl: '/media/promos/jetx-mid.jpg', targetUrl: DEFAULT_TARGET_URL, width: 300, height: 250, altText: 'JetX Online Multiplier', isGlobalFallback: false },
        { name: 'JetX Sidebar Skyscraper (300x600)', type: PrismaCreativeType.IMAGE, mediaUrl: '/media/promos/jetx-side.jpg', targetUrl: DEFAULT_TARGET_URL, width: 300, height: 600, altText: 'JetX Rocket Game Bonus', isGlobalFallback: false },
        { name: 'JetX Mobile Badge (125x125)', type: PrismaCreativeType.IMAGE, mediaUrl: '/media/promos/jetx-badge.jpg', targetUrl: DEFAULT_TARGET_URL, width: 125, height: 125, altText: 'JetX Quick Play', isGlobalFallback: false },
        { name: 'JetX Skyscraper (160x600)', type: PrismaCreativeType.IMAGE, mediaUrl: '/media/promos/jetx-tall.jpg', targetUrl: DEFAULT_TARGET_URL, width: 160, height: 600, altText: 'JetX Crash Game', isGlobalFallback: false },
        // Roulette Creatives
        { name: 'Roulette Desktop Leaderboard (728x90)', type: PrismaCreativeType.IMAGE, mediaUrl: '/media/promos/roulette-top.jpg', targetUrl: DEFAULT_TARGET_URL, width: 728, height: 90, altText: 'Play Roulette Online Casino', isGlobalFallback: false },
        { name: 'Roulette Medium Banner (300x250)', type: PrismaCreativeType.IMAGE, mediaUrl: '/media/promos/roulette-mid.jpg', targetUrl: DEFAULT_TARGET_URL, width: 300, height: 250, altText: 'Roulette Classic Casino', isGlobalFallback: false },
        { name: 'Roulette Sidebar Skyscraper (300x600)', type: PrismaCreativeType.IMAGE, mediaUrl: '/media/promos/roulette-side.jpg', targetUrl: DEFAULT_TARGET_URL, width: 300, height: 600, altText: 'Roulette Live Wheel Bonus', isGlobalFallback: false },
        { name: 'Roulette Mobile Badge (125x125)', type: PrismaCreativeType.IMAGE, mediaUrl: '/media/promos/roulette-badge.jpg', targetUrl: DEFAULT_TARGET_URL, width: 125, height: 125, altText: 'Roulette Quick Play', isGlobalFallback: false },
        { name: 'Roulette Skyscraper (160x600)', type: PrismaCreativeType.IMAGE, mediaUrl: '/media/promos/roulette-tall.jpg', targetUrl: DEFAULT_TARGET_URL, width: 160, height: 600, altText: 'Roulette Classic Game', isGlobalFallback: false },
      ];

      const createdCreatives: Record<string, any> = {};
      for (const c of creativesData) {
        let creative = await this.prisma.adCreative.findFirst({ where: { name: c.name } });
        if (!creative) {
          creative = await this.prisma.adCreative.create({ data: c });
        } else {
          creative = await this.prisma.adCreative.update({
            where: { id: creative.id },
            data: { mediaUrl: c.mediaUrl, targetUrl: c.targetUrl, width: c.width, height: c.height },
          });
        }
        createdCreatives[c.name] = creative;
      }

      // 3. Ensure Campaigns exist
      let campaignAviator = await this.prisma.adCampaign.findFirst({ where: { name: 'Aviator Game Campaign' } });
      if (!campaignAviator) {
        campaignAviator = await this.prisma.adCampaign.create({
          data: { name: 'Aviator Game Campaign', status: CampaignStatus.ACTIVE, priority: 100, weight: 100 },
        });
      }

      let campaignJetX = await this.prisma.adCampaign.findFirst({ where: { name: 'JetX Game Campaign' } });
      if (!campaignJetX) {
        campaignJetX = await this.prisma.adCampaign.create({
          data: { name: 'JetX Game Campaign', status: CampaignStatus.ACTIVE, priority: 100, weight: 100 },
        });
      }

      let campaignRoulette = await this.prisma.adCampaign.findFirst({ where: { name: 'Roulette Game Campaign' } });
      if (!campaignRoulette) {
        campaignRoulette = await this.prisma.adCampaign.create({
          data: { name: 'Roulette Game Campaign', status: CampaignStatus.ACTIVE, priority: 100, weight: 100 },
        });
      }

      const themeConfigs = [
        {
          name: 'Aviator',
          campaign: campaignAviator,
          desktopHeader: createdCreatives['Aviator Desktop Leaderboard (728x90)'],
          mobileHeader: createdCreatives['Aviator Desktop Leaderboard (728x90)'],
          desktopAfterTool: createdCreatives['Aviator Medium Banner (300x250)'],
          mobileAfterTool: createdCreatives['Aviator Mobile Badge (125x125)'],
          desktopSidebar: createdCreatives['Aviator Sidebar Skyscraper (300x600)'],
          mobileSticky: createdCreatives['Aviator Desktop Leaderboard (728x90)'],
        },
        {
          name: 'JetX',
          campaign: campaignJetX,
          desktopHeader: createdCreatives['JetX Desktop Leaderboard (728x90)'],
          mobileHeader: createdCreatives['JetX Desktop Leaderboard (728x90)'],
          desktopAfterTool: createdCreatives['JetX Medium Banner (300x250)'],
          mobileAfterTool: createdCreatives['JetX Mobile Badge (125x125)'],
          desktopSidebar: createdCreatives['JetX Sidebar Skyscraper (300x600)'],
          mobileSticky: createdCreatives['JetX Desktop Leaderboard (728x90)'],
        },
        {
          name: 'Roulette',
          campaign: campaignRoulette,
          desktopHeader: createdCreatives['Roulette Desktop Leaderboard (728x90)'],
          mobileHeader: createdCreatives['Roulette Desktop Leaderboard (728x90)'],
          desktopAfterTool: createdCreatives['Roulette Medium Banner (300x250)'],
          mobileAfterTool: createdCreatives['Roulette Mobile Badge (125x125)'],
          desktopSidebar: createdCreatives['Roulette Sidebar Skyscraper (300x600)'],
          mobileSticky: createdCreatives['Roulette Desktop Leaderboard (728x90)'],
        },
      ];

      const canonicalToolOrder = [
        'jpg-to-png', 'png-to-jpg', 'image-compressor', 'image-to-pdf', 'image-resizer', 'image-cropper', 'webp-to-jpg', 'jpg-to-webp', 'png-to-webp',
        'pdf-compressor', 'pdf-merge', 'pdf-split', 'pdf-to-jpg', 'pdf-to-png', 'pdf-to-text', 'pdf-page-extractor', 'pdf-rotator', 'pdf-reorder-pages', 'pdf-watermark', 'pdf-metadata-remover',
        'word-counter', 'text-cleaner', 'case-converter',
        'json-formatter', 'text-hash',
        'ai-summarizer', 'ai-humanizer', 'ai-paraphraser', 'ai-grammar-checker',
        'video-compressor', 'mp4-to-mp3', 'video-to-gif', 'video-trimmer',
        'audio-cutter',
        'qr-code-generator',
      ];

      const allActiveUtilities = await this.prisma.utility.findMany({
        where: { status: UtilityStatus.ACTIVE },
      });

      const sortedUtilities = allActiveUtilities.sort((a, b) => {
        const idxA = canonicalToolOrder.indexOf(a.slug);
        const idxB = canonicalToolOrder.indexOf(b.slug);
        return (idxA >= 0 ? idxA : 999) - (idxB >= 0 ? idxB : 999);
      }      // 1. Check and seed Home Page default targeting rules if none exist
      const existingHomeRulesCount = await this.prisma.adTargetingRule.count({
        where: {
          isActive: true,
          OR: [
            { utilitySlugs: { has: 'home' } },
            { utilitySlugs: { isEmpty: true }, categorySlugs: { isEmpty: true } },
          ],
        },
      });

      if (existingHomeRulesCount === 0) {
        this.logger.log('No existing Home Page targeting rules found. Seeding default Rocky11 Home Page rules...');
        const homeDesktopTheme = themeConfigs[0]; // Aviator
        const homeMobileTheme = themeConfigs[1];  // JetX
        const homeAltTheme = themeConfigs[2];     // Roulette

        const homeRulesToCreate = [
          // Home Header Banner - Desktop
          {
            campaignId: homeDesktopTheme.campaign.id,
            placementId: createdPlacements[PlacementCode.HEADER_BANNER].id,
            creativeId: homeDesktopTheme.desktopHeader.id,
            deviceTypes: [PrismaDeviceType.DESKTOP],
            utilitySlugs: ['home'],
            priorityOverride: 100,
            weight: 100,
            isActive: true,
          },
          // Home Header Banner - Mobile
          {
            campaignId: homeMobileTheme.campaign.id,
            placementId: createdPlacements[PlacementCode.HEADER_BANNER].id,
            creativeId: homeMobileTheme.mobileHeader.id,
            deviceTypes: [PrismaDeviceType.MOBILE, PrismaDeviceType.TABLET],
            utilitySlugs: ['home'],
            priorityOverride: 100,
            weight: 100,
            isActive: true,
          },
          // Home Top Content - Desktop
          {
            campaignId: homeDesktopTheme.campaign.id,
            placementId: createdPlacements[PlacementCode.TOP_CONTENT].id,
            creativeId: homeDesktopTheme.desktopHeader.id,
            deviceTypes: [PrismaDeviceType.DESKTOP],
            utilitySlugs: ['home'],
            priorityOverride: 100,
            weight: 100,
            isActive: true,
          },
          // Home Top Content - Mobile
          {
            campaignId: homeMobileTheme.campaign.id,
            placementId: createdPlacements[PlacementCode.TOP_CONTENT].id,
            creativeId: homeMobileTheme.mobileHeader.id,
            deviceTypes: [PrismaDeviceType.MOBILE, PrismaDeviceType.TABLET],
            utilitySlugs: ['home'],
            priorityOverride: 100,
            weight: 100,
            isActive: true,
          },
          // Home Mid Content - Desktop
          {
            campaignId: homeDesktopTheme.campaign.id,
            placementId: createdPlacements[PlacementCode.MID_CONTENT].id,
            creativeId: homeDesktopTheme.desktopAfterTool.id,
            deviceTypes: [PrismaDeviceType.DESKTOP],
            utilitySlugs: ['home'],
            priorityOverride: 100,
            weight: 100,
            isActive: true,
          },
          // Home Mid Content - Mobile
          {
            campaignId: homeMobileTheme.campaign.id,
            placementId: createdPlacements[PlacementCode.MID_CONTENT].id,
            creativeId: homeMobileTheme.mobileAfterTool.id,
            deviceTypes: [PrismaDeviceType.MOBILE, PrismaDeviceType.TABLET],
            utilitySlugs: ['home'],
            priorityOverride: 100,
            weight: 100,
            isActive: true,
          },
          // Home After Tool - Desktop
          {
            campaignId: homeAltTheme.campaign.id,
            placementId: createdPlacements[PlacementCode.AFTER_TOOL].id,
            creativeId: homeAltTheme.desktopAfterTool.id,
            deviceTypes: [PrismaDeviceType.DESKTOP],
            utilitySlugs: ['home'],
            priorityOverride: 100,
            weight: 100,
            isActive: true,
          },
          // Home After Tool - Mobile
          {
            campaignId: homeAltTheme.campaign.id,
            placementId: createdPlacements[PlacementCode.AFTER_TOOL].id,
            creativeId: homeAltTheme.mobileAfterTool.id,
            deviceTypes: [PrismaDeviceType.MOBILE, PrismaDeviceType.TABLET],
            utilitySlugs: ['home'],
            priorityOverride: 100,
            weight: 100,
            isActive: true,
          },
          // Home Bottom Content - Desktop
          {
            campaignId: homeDesktopTheme.campaign.id,
            placementId: createdPlacements[PlacementCode.BOTTOM_CONTENT].id,
            creativeId: homeDesktopTheme.desktopHeader.id,
            deviceTypes: [PrismaDeviceType.DESKTOP],
            utilitySlugs: ['home'],
            priorityOverride: 100,
            weight: 100,
            isActive: true,
          },
          // Home Bottom Content - Mobile
          {
            campaignId: homeMobileTheme.campaign.id,
            placementId: createdPlacements[PlacementCode.BOTTOM_CONTENT].id,
            creativeId: homeMobileTheme.mobileHeader.id,
            deviceTypes: [PrismaDeviceType.MOBILE, PrismaDeviceType.TABLET],
            utilitySlugs: ['home'],
            priorityOverride: 100,
            weight: 100,
            isActive: true,
          },
          // Home Mobile Sticky Footer
          {
            campaignId: homeAltTheme.campaign.id,
            placementId: createdPlacements[PlacementCode.MOBILE_STICKY].id,
            creativeId: homeAltTheme.mobileSticky.id,
            deviceTypes: [PrismaDeviceType.MOBILE, PrismaDeviceType.TABLET],
            utilitySlugs: ['home'],
            priorityOverride: 100,
            weight: 100,
            isActive: true,
          },
        ];

        await this.prisma.adTargetingRule.createMany({ data: homeRulesToCreate });
        this.logger.log(`Seeded ${homeRulesToCreate.length} default targeting rules for Home Page.`);
      } else {
        this.logger.log(`Existing Home Page targeting rules found (${existingHomeRulesCount} rules). Preserving custom configuration.`);
      }

      // 2. Check and seed missing tool targeting rules if any active tool has zero rules
      const toolRulesToCreate: any[] = [];
      for (let idx = 0; idx < sortedUtilities.length; idx++) {
        const u = sortedUtilities[idx];
        const existingToolRulesCount = await this.prisma.adTargetingRule.count({
          where: {
            isActive: true,
            utilitySlugs: { has: u.slug },
          },
        });

        if (existingToolRulesCount === 0) {
          const desktopTheme = themeConfigs[idx % 3];
          const mobileTheme = themeConfigs[(idx + 1) % 3];

          toolRulesToCreate.push(
            // 1. Desktop Header
            {
              campaignId: desktopTheme.campaign.id,
              placementId: createdPlacements[PlacementCode.HEADER_BANNER].id,
              creativeId: desktopTheme.desktopHeader.id,
              deviceTypes: [PrismaDeviceType.DESKTOP],
              utilitySlugs: [u.slug],
              priorityOverride: 100,
              weight: 100,
              isActive: true,
            },
            // 2. Mobile Header
            {
              campaignId: mobileTheme.campaign.id,
              placementId: createdPlacements[PlacementCode.HEADER_BANNER].id,
              creativeId: mobileTheme.mobileHeader.id,
              deviceTypes: [PrismaDeviceType.MOBILE, PrismaDeviceType.TABLET],
              utilitySlugs: [u.slug],
              priorityOverride: 100,
              weight: 100,
              isActive: true,
            },
            // 3. Desktop After Tool
            {
              campaignId: desktopTheme.campaign.id,
              placementId: createdPlacements[PlacementCode.AFTER_TOOL].id,
              creativeId: desktopTheme.desktopAfterTool.id,
              deviceTypes: [PrismaDeviceType.DESKTOP],
              utilitySlugs: [u.slug],
              priorityOverride: 100,
              weight: 100,
              isActive: true,
            },
            // 4. Mobile After Tool
            {
              campaignId: mobileTheme.campaign.id,
              placementId: createdPlacements[PlacementCode.AFTER_TOOL].id,
              creativeId: mobileTheme.mobileAfterTool.id,
              deviceTypes: [PrismaDeviceType.MOBILE, PrismaDeviceType.TABLET],
              utilitySlugs: [u.slug],
              priorityOverride: 100,
              weight: 100,
              isActive: true,
            },
            // 5. Desktop Sidebar
            {
              campaignId: desktopTheme.campaign.id,
              placementId: createdPlacements[PlacementCode.SIDEBAR].id,
              creativeId: desktopTheme.desktopSidebar.id,
              deviceTypes: [PrismaDeviceType.DESKTOP],
              utilitySlugs: [u.slug],
              priorityOverride: 100,
              weight: 100,
              isActive: true,
            },
            // 6. Mobile Sticky Footer
            {
              campaignId: mobileTheme.campaign.id,
              placementId: createdPlacements[PlacementCode.MOBILE_STICKY].id,
              creativeId: mobileTheme.mobileSticky.id,
              deviceTypes: [PrismaDeviceType.MOBILE, PrismaDeviceType.TABLET],
              utilitySlugs: [u.slug],
              priorityOverride: 100,
              weight: 100,
              isActive: true,
            },
          );
        }
      }

      if (toolRulesToCreate.length > 0) {
        await this.prisma.adTargetingRule.createMany({ data: toolRulesToCreate });
        this.logger.log(`Created default targeting rules for ${toolRulesToCreate.length / 6} newly active tools.`);
      }

      // Invalidate ad slot cache to reflect changes immediately
      await this.redisCache.invalidateCache('cache:adslot:*');
    } catch (err: any) {
      this.logger.error(`Error in ensureDefaultTargeting: ${err.message}`);
    }
  }

  /**
   * Primary Ad Selection Execution
   */
  async selectAd(
    request: AdSlotRequestDto,
    device: DeviceType,
    country?: string,
    sessionId = 'anonymous_session',
  ): Promise<AdSlotResponseDto> {
    const placementCode = request.placement as PlacementCode;
    const validPlacements = Object.values(PlacementCode);

    if (!validPlacements.includes(placementCode)) {
      return {
        hasAd: false,
        placement: request.placement,
        fallbackTier: 'TIER_5_NO_AD',
        sessionId,
      };
    }

    const now = new Date();
    const currentDayOfWeek = now.getUTCDay(); // 0 = Sunday
    const currentHourUtc = now.getUTCHours();

    try {
      // 1. Resolve categorySlug if utilitySlug is provided but categorySlug was omitted
      let categorySlug = request.categorySlug?.toLowerCase();
      if (request.utilitySlug && !categorySlug) {
        try {
          const utility = await this.prisma.utility.findUnique({
            where: { slug: request.utilitySlug.toLowerCase() },
            include: { category: true },
          });
          if (utility?.category?.slug) {
            categorySlug = utility.category.slug.toLowerCase();
          }
        } catch (err: any) {
          this.logger.warn(`Could not resolve category for utility ${request.utilitySlug}: ${err.message}`);
        }
      }

      // 2. Query active targeting rules matching placement & schedule
      const rules = await this.prisma.adTargetingRule.findMany({
        where: {
          isActive: true,
          placement: { code: placementCode },
          campaign: {
            status: CampaignStatus.ACTIVE,
            OR: [{ startDate: null }, { startDate: { lte: now } }],
            AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
          },
        },
        include: {
          campaign: {
            include: {
              schedules: true,
            },
          },
          creative: true,
          placement: true,
        },
      });

      // 3. Filter rules by schedule, device, geography, frequency cap, and utility assignment
      const eligibleCandidates: SelectedCandidate[] = [];

      for (const rule of rules) {
        // Step 3a. Schedule evaluation
        if (rule.campaign.schedules && rule.campaign.schedules.length > 0) {
          const isScheduleMatch = rule.campaign.schedules.some((s) => {
            if (s.dayOfWeek !== currentDayOfWeek) return false;
            return currentHourUtc >= s.startHour && currentHourUtc <= s.endHour;
          });
          if (!isScheduleMatch) continue;
        }

        // Step 3b. Device Match
        if (rule.deviceTypes && rule.deviceTypes.length > 0) {
          if (!rule.deviceTypes.includes(device as any)) {
            continue;
          }
        }

        // Step 3c. Country / Geographic Match
        if (rule.countries && rule.countries.length > 0) {
          if (!country || !rule.countries.map((c) => c.toUpperCase()).includes(country.toUpperCase())) {
            continue;
          }
        }

        // Step 3d. Frequency Cap check in Redis
        const isFreqAllowed = await this.redisCache.checkFrequencyCap(
          rule.campaignId,
          sessionId,
          rule.campaign.dailyImpressionCap,
          rule.campaign.totalImpressionCap,
        );
        if (!isFreqAllowed) {
          continue;
        }

        // Step 3e. Scope & Tier Specificity
        const isExactUtility = Boolean(
          request.utilitySlug &&
          rule.utilitySlugs &&
          rule.utilitySlugs.some((s) => s.toLowerCase() === request.utilitySlug?.toLowerCase())
        );

        const isCategoryMatch = Boolean(
          categorySlug &&
          rule.categorySlugs &&
          rule.categorySlugs.some((s) => s.toLowerCase() === categorySlug?.toLowerCase())
        );

        const isHomeRequest = request.utilitySlug?.toLowerCase() === 'home';
        const isGlobalRule = (!rule.utilitySlugs || rule.utilitySlugs.length === 0) &&
          (!rule.categorySlugs || rule.categorySlugs.length === 0);

        // STRICT TOOL ASSIGNMENT CHECK:
        if (isHomeRequest) {
          if (!isExactUtility && !isGlobalRule) {
            continue;
          }
        } else if (request.utilitySlug) {
          if (!isExactUtility && !isCategoryMatch) {
            continue;
          }
        } else {
          // If general / non-utility page, do not serve rules targeted exclusively to specific tools/categories
          if (rule.utilitySlugs && rule.utilitySlugs.length > 0 && !isExactUtility) {
            continue;
          }
          if (rule.categorySlugs && rule.categorySlugs.length > 0 && !isCategoryMatch) {
            continue;
          }
        }

        let fallbackTier = 'TIER_3_GLOBAL_PLACEMENT';
        if (isExactUtility) {
          fallbackTier = 'TIER_1_EXACT_UTILITY';
        } else if (isCategoryMatch) {
          fallbackTier = 'TIER_2_CATEGORY';
        } else if (isHomeRequest && isGlobalRule) {
          fallbackTier = 'TIER_1_EXACT_UTILITY';
        } else if (rule.creative.isGlobalFallback) {
          fallbackTier = 'TIER_4_GLOBAL_FALLBACK';
        }

        const effectivePriority = rule.priorityOverride ?? rule.campaign.priority ?? 50;

        eligibleCandidates.push({
          ruleId: rule.id,
          campaignId: rule.campaignId,
          creativeId: rule.creativeId,
          placementId: rule.placementId,
          placementCode: rule.placement.code as AdPlacement,
          effectivePriority,
          weight: Math.max(rule.weight || 100, 1),
          fallbackTier,
          creative: {
            id: rule.creative.id,
            name: rule.creative.name,
            type: rule.creative.type as CreativeType,
            mediaUrl: rule.creative.mediaUrl,
            targetUrl: rule.creative.targetUrl,
            width: rule.creative.width,
            height: rule.creative.height,
            altText: rule.creative.altText,
            customHtml: rule.creative.customHtml,
          },
        });
      }

      // 4. Evaluate Tier Candidates
      const tier1 = eligibleCandidates.filter((c) => c.fallbackTier === 'TIER_1_EXACT_UTILITY');
      const tier2 = eligibleCandidates.filter((c) => c.fallbackTier === 'TIER_2_CATEGORY');
      const tier3 = eligibleCandidates.filter((c) => c.fallbackTier === 'TIER_3_GLOBAL_PLACEMENT');
      const tier4 = eligibleCandidates.filter((c) => c.fallbackTier === 'TIER_4_GLOBAL_FALLBACK');

      let selectedPool: SelectedCandidate[] = [];

      if (request.utilitySlug) {
        // If request is for a utility tool or home page
        if (tier1.length > 0) {
          selectedPool = tier1;
        } else if (tier2.length > 0) {
          selectedPool = tier2;
        } else if (request.utilitySlug.toLowerCase() === 'home' && tier3.length > 0) {
          selectedPool = tier3;
        } else if (request.utilitySlug.toLowerCase() === 'home' && tier4.length > 0) {
          selectedPool = tier4;
        } else {
          // No ad assigned to this tool or category in admin panel -> strictly DO NOT show ad
          return {
            hasAd: false,
            placement: request.placement,
            fallbackTier: 'TIER_5_NO_AD',
            sessionId,
          };
        }
      } else {
        selectedPool =
          tier1.length > 0
            ? tier1
            : tier2.length > 0
              ? tier2
              : tier3.length > 0
                ? tier3
                : [];
      }

      if (selectedPool.length > 0) {
        // 5. Priority selection (highest priority first)
        const highestPriority = Math.max(...selectedPool.map((c) => c.effectivePriority));
        const topPriorityCandidates = selectedPool.filter((c) => c.effectivePriority === highestPriority);

        // 6. Weighted rotation among top priority candidates
        const chosen = this.weightedRandomSelect(topPriorityCandidates);

        // 7. Generate signed tracking token
        const trackingToken = this.trackingTokenService.generateToken({
          creativeId: chosen.creativeId,
          campaignId: chosen.campaignId,
          placementId: chosen.placementId,
          placementCode: chosen.placementCode,
          utilitySlug: request.utilitySlug,
          deviceType: device,
        });

        return {
          hasAd: true,
          placement: chosen.placementCode,
          fallbackTier: chosen.fallbackTier,
          sessionId,
          monetizationSource: 'INTERNAL',
          creative: {
            creativeId: chosen.creative.id,
            campaignId: chosen.campaignId,
            type: chosen.creative.type,
            mediaUrl: sanitizeMediaUrl(chosen.creative.mediaUrl) || undefined,
            targetUrl: chosen.creative.targetUrl || undefined,
            width: chosen.creative.width || undefined,
            height: chosen.creative.height || undefined,
            altText: chosen.creative.altText || undefined,
            customHtml: chosen.creative.customHtml || undefined,
            trackingToken,
            monetizationSource: 'INTERNAL',
          },
        };
      }

      // If utilitySlug is set and no assigned ads exist, immediately return NO_AD
      if (request.utilitySlug) {
        return {
          hasAd: false,
          placement: request.placement,
          fallbackTier: 'TIER_5_NO_AD',
          sessionId,
        };
      }

      // Tier B: External Ad Provider (only for general/global requests without utilitySlug)
      // Evaluated only when no internal campaign targeting rules match
      const externalAd = await this.externalAdNetwork.requestAd(request, {
        device,
        country,
        sessionId,
      });

      if (externalAd) {
        const providerName = this.externalAdNetwork.getProviderName();
        const trackingToken = this.trackingTokenService.generateToken({
          creativeId: externalAd.providerAdId,
          campaignId: `ext_campaign_${externalAd.providerAdId}`,
          placementId: `ext_placement_${request.placement}`,
          placementCode: request.placement,
          utilitySlug: request.utilitySlug,
          deviceType: device,
          provider: providerName,
          providerAdId: externalAd.providerAdId,
          externalTargetUrl: externalAd.targetUrl,
        });

        return {
          hasAd: true,
          placement: request.placement,
          fallbackTier: 'TIER_EXTERNAL_PROVIDER',
          sessionId,
          provider: providerName,
          providerRequestId: `req_${Date.now()}`,
          monetizationSource: 'EXTERNAL_NETWORK',
          creative: {
            creativeId: externalAd.providerAdId,
            campaignId: `ext_campaign_${externalAd.providerAdId}`,
            type: externalAd.creativeType,
            mediaUrl: externalAd.mediaUrl,
            targetUrl: externalAd.targetUrl,
            width: externalAd.width,
            height: externalAd.height,
            altText: externalAd.altText,
            customHtml: externalAd.customHtml,
            trackingToken,
            provider: providerName,
            providerAdId: externalAd.providerAdId,
            monetizationSource: 'EXTERNAL_NETWORK',
            revenueEligible: externalAd.revenueEligible,
            externalMetadata: externalAd.externalMetadata,
          },
        };
      }

      // Tier C: House / Global Fallback Creatives
      if (tier4.length > 0) {
        const chosen = this.weightedRandomSelect(tier4);
        const trackingToken = this.trackingTokenService.generateToken({
          creativeId: chosen.creativeId,
          campaignId: chosen.campaignId,
          placementId: chosen.placementId,
          placementCode: chosen.placementCode,
          utilitySlug: request.utilitySlug,
          deviceType: device,
        });

        let customHtml = chosen.creative.customHtml || undefined;
        let mediaUrl = chosen.creative.mediaUrl || FALLBACK_BANNER_IMAGE;

        // Upgrade text fallback creative to rich image banner
        if (!customHtml || customHtml.includes('Global Platform Sponsor') || chosen.creative.type === 'HTML') {
          customHtml = formatGlobalFallbackHtml(mediaUrl);
        }

        return {
          hasAd: true,
          placement: chosen.placementCode,
          fallbackTier: 'TIER_4_GLOBAL_FALLBACK',
          sessionId,
          monetizationSource: 'HOUSE_FALLBACK',
          creative: {
            creativeId: chosen.creative.id,
            campaignId: chosen.campaignId,
            type: chosen.creative.type,
            mediaUrl,
            targetUrl: chosen.creative.targetUrl || undefined,
            width: chosen.creative.width || 728,
            height: chosen.creative.height || 90,
            altText: chosen.creative.altText || 'Global Platform Sponsor • Fast Utilities',
            customHtml,
            trackingToken,
            monetizationSource: 'HOUSE_FALLBACK',
          },
        };
      }

      // If not in targeting rules, check unmapped global fallback creatives
      const globalFallbackCreative = await this.prisma.adCreative.findFirst({
        where: {
          isGlobalFallback: true,
          targetingRules: {
            some: {
              placement: { code: placementCode },
              deviceTypes: { has: device as any },
            },
          },
        },
        include: {
          targetingRules: {
            where: { placement: { code: placementCode } },
            include: { placement: true },
          },
        },
      });

      if (globalFallbackCreative && globalFallbackCreative.targetingRules.length > 0) {
        const rule = globalFallbackCreative.targetingRules[0];
        const trackingToken = this.trackingTokenService.generateToken({
          creativeId: globalFallbackCreative.id,
          campaignId: rule.campaignId,
          placementId: rule.placementId,
          placementCode: rule.placement.code as AdPlacement,
          utilitySlug: request.utilitySlug,
          deviceType: device,
        });

        let customHtml = globalFallbackCreative.customHtml || undefined;
        let mediaUrl = globalFallbackCreative.mediaUrl || FALLBACK_BANNER_IMAGE;

        if (!customHtml || customHtml.includes('Global Platform Sponsor') || globalFallbackCreative.type === 'HTML') {
          customHtml = formatGlobalFallbackHtml(mediaUrl);
        }

        return {
          hasAd: true,
          placement: rule.placement.code as AdPlacement,
          fallbackTier: 'TIER_4_GLOBAL_FALLBACK',
          sessionId,
          monetizationSource: 'HOUSE_FALLBACK',
          creative: {
            creativeId: globalFallbackCreative.id,
            campaignId: rule.campaignId,
            type: globalFallbackCreative.type as CreativeType,
            mediaUrl,
            targetUrl: globalFallbackCreative.targetUrl || undefined,
            width: globalFallbackCreative.width || 728,
            height: globalFallbackCreative.height || 90,
            altText: globalFallbackCreative.altText || 'Global Platform Sponsor • Fast Utilities',
            customHtml,
            trackingToken,
            monetizationSource: 'HOUSE_FALLBACK',
          },
        };
      }

      // Tier D: No Ad matched
      return {
        hasAd: false,
        placement: request.placement,
        fallbackTier: 'TIER_5_NO_AD',
        sessionId,
      };
    } catch (err: any) {
      this.logger.error(`Ad selection failure for placement ${request.placement}: ${err.message}`);
      return {
        hasAd: false,
        placement: request.placement,
        fallbackTier: 'TIER_5_NO_AD',
        sessionId,
      };
    }
  }

  /**
   * Deterministic Weighted Random Selection
   */
  private weightedRandomSelect(candidates: SelectedCandidate[]): SelectedCandidate {
    if (candidates.length === 1) {
      return candidates[0];
    }

    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
    let random = Math.random() * totalWeight;

    for (const candidate of candidates) {
      if (random < candidate.weight) {
        return candidate;
      }
      random -= candidate.weight;
    }

    return candidates[0];
  }
}
