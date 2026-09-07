import {
  PrismaClient,
  RoleType,
  PlacementCode,
  CreativeType,
  UtilityExecutionMode,
  UtilityStatus,
  CampaignStatus,
  DeviceType,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting deterministic and idempotent database seed...');

  // 1. Seed Roles
  const roles = [
    { name: RoleType.SUPER_ADMIN, description: 'Full system control and user management' },
    { name: RoleType.ADMIN, description: 'Administrative access to ads, utilities, and settings' },
    { name: RoleType.EDITOR, description: 'Content and utility metadata management' },
    { name: RoleType.ANALYST, description: 'Read-only access to analytics, telemetry, and reporting' },
  ];

  const createdRoles: Record<string, any> = {};
  for (const r of roles) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: { name: r.name, description: r.description },
    });
    createdRoles[r.name] = role;
  }
  console.log('Roles seeded.');

  // 2. Seed Permissions
  const permissions = [
    { action: 'campaigns:create', description: 'Create ad campaigns' },
    { action: 'campaigns:read', description: 'View ad campaigns' },
    { action: 'campaigns:update', description: 'Update ad campaigns' },
    { action: 'campaigns:delete', description: 'Delete ad campaigns' },
    { action: 'creatives:create', description: 'Create ad creatives' },
    { action: 'creatives:read', description: 'View ad creatives' },
    { action: 'creatives:update', description: 'Update ad creatives' },
    { action: 'creatives:delete', description: 'Delete ad creatives' },
    { action: 'targeting:manage', description: 'Manage ad targeting rules' },
    { action: 'placements:read', description: 'View ad placements' },
    { action: 'placements:update', description: 'Update ad placements' },
    { action: 'utilities:create', description: 'Register new utilities' },
    { action: 'utilities:read', description: 'View utilities metadata' },
    { action: 'utilities:update', description: 'Update utilities metadata' },
    { action: 'utilities:publish', description: 'Publish or toggle utility status' },
    { action: 'categories:manage', description: 'Manage utility categories' },
    { action: 'analytics:read', description: 'View telemetry analytics' },
    { action: 'analytics:export', description: 'Export analytics data' },
    { action: 'ai:read', description: 'View AI usage and costs' },
    { action: 'ai:manage', description: 'Manage AI model settings' },
    { action: 'settings:read', description: 'View platform settings' },
    { action: 'settings:update', description: 'Update platform settings' },
    { action: 'users:manage', description: 'Manage admin user accounts' },
    { action: 'roles:manage', description: 'Manage roles and permissions' },
    { action: 'audit:read', description: 'View audit logs' },
  ];

  const createdPermissions: Record<string, any> = {};
  for (const p of permissions) {
    const perm = await prisma.permission.upsert({
      where: { action: p.action },
      update: { description: p.description },
      create: { action: p.action, description: p.description },
    });
    createdPermissions[p.action] = perm;
  }

  // Map Permissions to Roles
  for (const perm of Object.values(createdPermissions)) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: createdRoles[RoleType.SUPER_ADMIN].id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: createdRoles[RoleType.SUPER_ADMIN].id,
        permissionId: perm.id,
      },
    });
  }

  // 3. Seed Users
  const passwordHash = await bcrypt.hash('AdminSecurePassword123!', 10);
  const users = [
    { email: 'admin@adplatform.local', firstName: 'Super', lastName: 'Admin', role: RoleType.SUPER_ADMIN },
    { email: 'editor@adplatform.local', firstName: 'Content', lastName: 'Editor', role: RoleType.EDITOR },
    { email: 'analyst@adplatform.local', firstName: 'Data', lastName: 'Analyst', role: RoleType.ANALYST },
  ];

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { firstName: u.firstName, lastName: u.lastName, isActive: true },
      create: {
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        isActive: true,
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: createdRoles[u.role].id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: createdRoles[u.role].id,
      },
    });
  }

  // 4. Seed Utility Categories
  const categories = [
    { slug: 'image', name: 'Image Tools', description: 'Convert, compress, and resize images', icon: 'image', displayOrder: 1 },
    { slug: 'pdf', name: 'PDF Tools', description: 'Compress, merge, and convert PDF documents', icon: 'file-text', displayOrder: 2 },
    { slug: 'text', name: 'Text Tools', description: 'Format, count, and manipulate text strings', icon: 'type', displayOrder: 3 },
    { slug: 'developer', name: 'Developer Tools', description: 'Formatters, validators, and developer utilities', icon: 'code', displayOrder: 4 },
    { slug: 'ai', name: 'AI Utilities', description: 'AI-assisted writing, summarizing, and humanizing', icon: 'sparkles', displayOrder: 5 },
  ];

  const createdCategories: Record<string, any> = {};
  for (const c of categories) {
    const cat = await prisma.utilityCategory.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description, icon: c.icon, displayOrder: c.displayOrder },
      create: c,
    });
    createdCategories[c.slug] = cat;
  }

  // 5. Seed Utilities
  const utilities = [
    {
      slug: 'json-formatter',
      name: 'JSON Formatter & Validator',
      description: 'Format, prettify, and validate JSON data instantly in your browser.',
      categorySlug: 'developer',
      implementationMode: UtilityExecutionMode.LOCAL,
      status: UtilityStatus.ACTIVE,
      isFeatured: true,
      displayOrder: 1,
      seoTitle: 'Free Online JSON Formatter & Validator',
      seoDescription: 'Format, validate, and beautify your JSON data with instant syntax highlighting.',
      faqContent: [
        { question: 'Is my JSON data sent to any server?', answer: 'No, all JSON formatting occurs locally in your browser for 100% data privacy.' },
        { question: 'What is the maximum JSON file size supported?', answer: 'You can format JSON files up to 5MB in size smoothly.' },
      ],
      relatedSlugs: ['word-counter', 'text-hash'],
    },
    {
      slug: 'word-counter',
      name: 'Word & Character Counter',
      description: 'Accurately count words, characters, sentences, and estimated reading time.',
      categorySlug: 'text',
      implementationMode: UtilityExecutionMode.LOCAL,
      status: UtilityStatus.ACTIVE,
      isFeatured: true,
      displayOrder: 2,
      seoTitle: 'Free Online Word & Character Counter',
      seoDescription: 'Real-time word and character counter tool with reading time estimation.',
      faqContent: [
        { question: 'Does this tool count spaces?', answer: 'The counter provides separate metrics for characters with spaces and without spaces.' },
      ],
      relatedSlugs: ['json-formatter', 'ai-summarizer'],
    },
    {
      slug: 'text-hash',
      name: 'Cryptographic Text Hash Generator',
      description: 'Generate secure SHA-256 and SHA-512 cryptographic hashes.',
      categorySlug: 'developer',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
      isFeatured: false,
      displayOrder: 3,
      seoTitle: 'Online SHA-256 and SHA-512 Hash Generator',
      seoDescription: 'Generate secure SHA-256 cryptographic hashes for text strings.',
      faqContent: [
        { question: 'Which hash algorithms are supported?', answer: 'We currently support SHA-256 and SHA-512 algorithms.' },
      ],
      relatedSlugs: ['json-formatter'],
    },
    {
      slug: 'ai-summarizer',
      name: 'AI Text Summarizer',
      description: 'Summarize long articles, reports, and essays into clear key takeaways.',
      categorySlug: 'ai',
      implementationMode: UtilityExecutionMode.AI,
      status: UtilityStatus.ACTIVE,
      isFeatured: true,
      displayOrder: 4,
      seoTitle: 'Free AI Text Summarizer Tool',
      seoDescription: 'Summarize long texts, essays, and articles with advanced generative AI.',
      faqContent: [
        { question: 'How long can the input text be?', answer: 'You can submit up to 100KB of text per summary request.' },
      ],
      relatedSlugs: ['word-counter'],
    },
    {
      slug: 'pdf-compressor',
      name: 'PDF File Compressor',
      description: 'Reduce PDF file sizes while maintaining document clarity.',
      categorySlug: 'pdf',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.DRAFT,
      isFeatured: false,
      displayOrder: 5,
      seoTitle: 'Free Online PDF Compressor',
      seoDescription: 'Compress PDF documents easily without losing text or image quality.',
      faqContent: [],
      relatedSlugs: [],
    },
    {
      slug: 'disabled-tool',
      name: 'Disabled Test Tool',
      description: 'A tool in disabled state for testing lifecycle gates.',
      categorySlug: 'developer',
      implementationMode: UtilityExecutionMode.LOCAL,
      status: UtilityStatus.DISABLED,
      isFeatured: false,
      displayOrder: 99,
      seoTitle: 'Disabled Tool',
      seoDescription: 'Disabled tool description',
      faqContent: [],
      relatedSlugs: [],
    },
  ];

  for (const u of utilities) {
    await prisma.utility.upsert({
      where: { slug: u.slug },
      update: {
        name: u.name,
        description: u.description,
        categoryId: createdCategories[u.categorySlug].id,
        implementationMode: u.implementationMode,
        status: u.status,
        isFeatured: u.isFeatured,
        displayOrder: u.displayOrder,
        seoTitle: u.seoTitle,
        seoDescription: u.seoDescription,
        faqContent: u.faqContent as any,
        relatedSlugs: u.relatedSlugs,
      },
      create: {
        slug: u.slug,
        name: u.name,
        description: u.description,
        categoryId: createdCategories[u.categorySlug].id,
        implementationMode: u.implementationMode,
        status: u.status,
        isFeatured: u.isFeatured,
        displayOrder: u.displayOrder,
        seoTitle: u.seoTitle,
        seoDescription: u.seoDescription,
        faqContent: u.faqContent as any,
        relatedSlugs: u.relatedSlugs,
      },
    });
  }

  // 6. Seed Ad Placements
  const placements = [
    { code: PlacementCode.HEADER_BANNER, name: 'Header Banner', description: 'Top horizontal banner (728x90 desktop / 320x50 mobile)', supportedTypes: [CreativeType.IMAGE, CreativeType.HTML, CreativeType.IFRAME] },
    { code: PlacementCode.TOP_CONTENT, name: 'Top Content Banner', description: 'Banner displayed above the tool interface workspace', supportedTypes: [CreativeType.IMAGE, CreativeType.VIDEO, CreativeType.HTML, CreativeType.IFRAME] },
    { code: PlacementCode.AFTER_TOOL, name: 'After Tool Banner', description: 'Banner placed directly below the active tool interface', supportedTypes: [CreativeType.IMAGE, CreativeType.VIDEO, CreativeType.HTML, CreativeType.IFRAME] },
    { code: PlacementCode.MID_CONTENT, name: 'Mid Content Banner', description: 'Banner embedded inside the content / how-to documentation', supportedTypes: [CreativeType.IMAGE, CreativeType.HTML, CreativeType.IFRAME] },
    { code: PlacementCode.BOTTOM_CONTENT, name: 'Bottom Content Banner', description: 'Banner placed directly above the FAQ section', supportedTypes: [CreativeType.IMAGE, CreativeType.HTML, CreativeType.IFRAME] },
    { code: PlacementCode.SIDEBAR, name: 'Sidebar Banner', description: 'Vertical skyscraper banner on desktop viewports (300x250 / 160x600)', supportedTypes: [CreativeType.IMAGE, CreativeType.VIDEO, CreativeType.HTML, CreativeType.IFRAME] },
    { code: PlacementCode.MOBILE_STICKY, name: 'Mobile Sticky Footer', description: 'Sticky bottom banner overlay on mobile viewports', supportedTypes: [CreativeType.IMAGE, CreativeType.HTML] },
    { code: PlacementCode.DESKTOP_STICKY, name: 'Desktop Corner Sticky', description: 'Floating corner overlay on desktop viewports', supportedTypes: [CreativeType.IMAGE, CreativeType.HTML] },
  ];

  const createdPlacements: Record<string, any> = {};
  for (const p of placements) {
    const placement = await prisma.adPlacement.upsert({
      where: { code: p.code },
      update: { name: p.name, description: p.description, supportedTypes: p.supportedTypes },
      create: p,
    });
    createdPlacements[p.code] = placement;
  }

  // 7. Seed Ad Creatives
  const creatives = [
    {
      name: 'JSON Pro Mobile Banner',
      type: CreativeType.IMAGE,
      mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=320&h=50&fit=crop',
      targetUrl: 'https://example.com/json-pro-mobile',
      width: 320,
      height: 50,
      altText: 'JSON Pro for Mobile',
      isGlobalFallback: false,
    },
    {
      name: 'JSON Pro Tablet Banner',
      type: CreativeType.IMAGE,
      mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=468&h=60&fit=crop',
      targetUrl: 'https://example.com/json-pro-tablet',
      width: 468,
      height: 60,
      altText: 'JSON Pro for Tablet',
      isGlobalFallback: false,
    },
    {
      name: 'JSON Pro Desktop Leaderboard',
      type: CreativeType.IMAGE,
      mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=728&h=90&fit=crop',
      targetUrl: 'https://example.com/json-pro-desktop',
      width: 728,
      height: 90,
      altText: 'JSON Pro for Desktop',
      isGlobalFallback: false,
    },
    {
      name: 'Developer Tools Category Banner',
      type: CreativeType.IMAGE,
      mediaUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=728&h=90&fit=crop',
      targetUrl: 'https://example.com/dev-tools-sponsor',
      width: 728,
      height: 90,
      altText: 'Developer Tools Sponsor',
      isGlobalFallback: false,
    },
    {
      name: 'Platform Global Fallback Sponsor',
      type: CreativeType.HTML,
      customHtml: '<div style="background:#0f172a;color:#38bdf8;padding:16px;text-align:center;font-weight:bold;border-radius:8px;border:1px solid #1e293b;">⚡ Global Platform Sponsor &bull; Fast Utilities</div>',
      targetUrl: 'https://example.com/platform-sponsor',
      isGlobalFallback: true,
    },
  ];

  const createdCreatives: Record<string, any> = {};
  for (const c of creatives) {
    const creative = await prisma.adCreative.create({
      data: c,
    });
    createdCreatives[c.name] = creative;
  }

  // 8. Seed Campaigns
  const campaignJsonExact = await prisma.adCampaign.create({
    data: {
      name: 'JSON Formatter Device Targeting Campaign',
      status: CampaignStatus.ACTIVE,
      priority: 100,
      weight: 100,
      dailyImpressionCap: 100,
    },
  });

  const campaignDevCategory = await prisma.adCampaign.create({
    data: {
      name: 'Developer Tools Category Campaign',
      status: CampaignStatus.ACTIVE,
      priority: 70,
      weight: 100,
    },
  });

  const campaignGlobalFallback = await prisma.adCampaign.create({
    data: {
      name: 'Global Fallback Campaign',
      status: CampaignStatus.ACTIVE,
      priority: 10,
      weight: 100,
    },
  });

  // 9. Seed Targeting Rules (Verifying Mobile, Tablet, Desktop device-specific targeting)
  // Rule A: Mobile -> Creative A on /json-formatter TOP_CONTENT
  await prisma.adTargetingRule.create({
    data: {
      campaignId: campaignJsonExact.id,
      placementId: createdPlacements[PlacementCode.TOP_CONTENT].id,
      creativeId: createdCreatives['JSON Pro Mobile Banner'].id,
      deviceTypes: [DeviceType.MOBILE],
      utilitySlugs: ['json-formatter'],
      priorityOverride: 100,
      weight: 100,
      isActive: true,
    },
  });

  // Rule B: Tablet -> Creative B on /json-formatter TOP_CONTENT
  await prisma.adTargetingRule.create({
    data: {
      campaignId: campaignJsonExact.id,
      placementId: createdPlacements[PlacementCode.TOP_CONTENT].id,
      creativeId: createdCreatives['JSON Pro Tablet Banner'].id,
      deviceTypes: [DeviceType.TABLET],
      utilitySlugs: ['json-formatter'],
      priorityOverride: 100,
      weight: 100,
      isActive: true,
    },
  });

  // Rule C: Desktop -> Creative C on /json-formatter TOP_CONTENT
  await prisma.adTargetingRule.create({
    data: {
      campaignId: campaignJsonExact.id,
      placementId: createdPlacements[PlacementCode.TOP_CONTENT].id,
      creativeId: createdCreatives['JSON Pro Desktop Leaderboard'].id,
      deviceTypes: [DeviceType.DESKTOP],
      utilitySlugs: ['json-formatter'],
      priorityOverride: 100,
      weight: 100,
      isActive: true,
    },
  });

  // Rule D: Category level -> HEADER_BANNER for all 'developer' category tools
  await prisma.adTargetingRule.create({
    data: {
      campaignId: campaignDevCategory.id,
      placementId: createdPlacements[PlacementCode.HEADER_BANNER].id,
      creativeId: createdCreatives['Developer Tools Category Banner'].id,
      deviceTypes: [DeviceType.MOBILE, DeviceType.TABLET, DeviceType.DESKTOP],
      categorySlugs: ['developer'],
      priorityOverride: 70,
      weight: 100,
      isActive: true,
    },
  });

  // Rule E: Global Fallback on AFTER_TOOL placement
  await prisma.adTargetingRule.create({
    data: {
      campaignId: campaignGlobalFallback.id,
      placementId: createdPlacements[PlacementCode.AFTER_TOOL].id,
      creativeId: createdCreatives['Platform Global Fallback Sponsor'].id,
      deviceTypes: [DeviceType.MOBILE, DeviceType.TABLET, DeviceType.DESKTOP],
      priorityOverride: 10,
      weight: 100,
      isActive: true,
    },
  });

  // 10. Platform Settings
  const settings = [
    { key: 'platform.name', value: { text: 'Ad Utility Platform' }, category: 'general', description: 'Main platform title' },
    { key: 'ai.daily_token_limit', value: { limit: 1000000 }, category: 'ai', description: 'Global daily token limit' },
    { key: 'ads.default_priority', value: { priority: 50 }, category: 'ads', description: 'Default priority score' },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value, category: s.category, description: s.description },
      create: s,
    });
  }

  console.log('Database seed completed successfully with Phase 5 Ad campaigns and targeting rules.');
}

main()
  .catch((e) => {
    console.error('Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
