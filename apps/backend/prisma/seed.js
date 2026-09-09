"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Starting deterministic and idempotent database seed...');
    // 1. Seed Roles
    const roles = [
        { name: client_1.RoleType.SUPER_ADMIN, description: 'Full system control and user management' },
        { name: client_1.RoleType.ADMIN, description: 'Administrative access to ads, utilities, and settings' },
        { name: client_1.RoleType.EDITOR, description: 'Content and utility metadata management' },
        { name: client_1.RoleType.ANALYST, description: 'Read-only access to analytics, telemetry, and reporting' },
    ];
    const createdRoles = {};
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
        { action: 'billing:read', description: 'View billing overview and subscriptions' },
        { action: 'billing:manage', description: 'Manage plans, subscriptions, and billing configuration' },
    ];
    const createdPermissions = {};
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
                    roleId: createdRoles[client_1.RoleType.SUPER_ADMIN].id,
                    permissionId: perm.id,
                },
            },
            update: {},
            create: {
                roleId: createdRoles[client_1.RoleType.SUPER_ADMIN].id,
                permissionId: perm.id,
            },
        });
    }
    // 3. Seed Users
    const passwordHash = await bcrypt.hash('AdminSecurePassword123!', 10);
    const users = [
        { email: 'admin@adplatform.local', firstName: 'Super', lastName: 'Admin', role: client_1.RoleType.SUPER_ADMIN },
        { email: 'editor@adplatform.local', firstName: 'Content', lastName: 'Editor', role: client_1.RoleType.EDITOR },
        { email: 'analyst@adplatform.local', firstName: 'Data', lastName: 'Analyst', role: client_1.RoleType.ANALYST },
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
    const createdCategories = {};
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
            implementationMode: client_1.UtilityExecutionMode.LOCAL,
            status: client_1.UtilityStatus.ACTIVE,
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
            implementationMode: client_1.UtilityExecutionMode.LOCAL,
            status: client_1.UtilityStatus.ACTIVE,
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
            implementationMode: client_1.UtilityExecutionMode.SERVER,
            status: client_1.UtilityStatus.ACTIVE,
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
            implementationMode: client_1.UtilityExecutionMode.AI,
            status: client_1.UtilityStatus.ACTIVE,
            isFeatured: true,
            displayOrder: 4,
            seoTitle: 'Free AI Text Summarizer Tool',
            seoDescription: 'Summarize long texts, essays, and articles with advanced generative AI.',
            faqContent: [
                { question: 'How long can the input text be?', answer: 'You can submit up to 100KB of text per summary request.' },
            ],
            relatedSlugs: ['word-counter'],
        },
        // --- Phase 9 MVP Utilities: Image ---
        {
            slug: 'jpg-to-png',
            name: 'JPG to PNG Converter',
            description: 'Convert JPG and JPEG images to lossless PNG format with transparent alpha support.',
            categorySlug: 'image',
            implementationMode: client_1.UtilityExecutionMode.SERVER,
            status: client_1.UtilityStatus.ACTIVE,
            isFeatured: true,
            displayOrder: 5,
            seoTitle: 'Free JPG to PNG Converter Online - Lossless Quality',
            seoDescription: 'Convert JPG images to high quality PNG format instantly in your browser.',
            faqContent: [
                { question: 'Is the conversion lossless?', answer: 'Yes, the conversion preserves all pixel detail and encodes directly into PNG format.' },
                { question: 'What is the maximum image size?', answer: 'Images up to 15MB are supported for conversion.' },
            ],
            relatedSlugs: ['png-to-jpg', 'image-compressor'],
        },
        {
            slug: 'png-to-jpg',
            name: 'PNG to JPG Converter',
            description: 'Convert PNG images to compact JPEG format with configurable quality and deterministic background compositing.',
            categorySlug: 'image',
            implementationMode: client_1.UtilityExecutionMode.SERVER,
            status: client_1.UtilityStatus.ACTIVE,
            isFeatured: true,
            displayOrder: 6,
            seoTitle: 'Free PNG to JPG Converter Online - Fast & Secure',
            seoDescription: 'Convert transparent or standard PNG images to standard JPEG format.',
            faqContent: [
                { question: 'How is transparent background handled?', answer: 'Transparent pixels are automatically blended over a clean white background for a seamless JPEG result.' },
            ],
            relatedSlugs: ['jpg-to-png', 'image-compressor'],
        },
        {
            slug: 'image-compressor',
            name: 'Image Compressor',
            description: 'Compress JPEG and PNG images to reduce file sizes while maintaining high visual clarity.',
            categorySlug: 'image',
            implementationMode: client_1.UtilityExecutionMode.SERVER,
            status: client_1.UtilityStatus.ACTIVE,
            isFeatured: true,
            displayOrder: 7,
            seoTitle: 'Online Image Compressor - Reduce JPG and PNG Size',
            seoDescription: 'Compress images online without quality loss. Supports JPEG and PNG formats.',
            faqContent: [
                { question: 'What is the maximum upload size?', answer: 'You can compress images up to 15MB each.' },
            ],
            relatedSlugs: ['jpg-to-png', 'png-to-jpg'],
        },
        // --- Phase 9 MVP Utilities: PDF ---
        {
            slug: 'pdf-compressor',
            name: 'PDF Compressor',
            description: 'Compress and optimize PDF documents with stream compression to reduce file size.',
            categorySlug: 'pdf',
            implementationMode: client_1.UtilityExecutionMode.SERVER,
            status: client_1.UtilityStatus.ACTIVE,
            isFeatured: true,
            displayOrder: 8,
            seoTitle: 'Free Online PDF Compressor - Reduce PDF File Size',
            seoDescription: 'Shrink PDF file size while preserving text sharpness and document structure.',
            faqContent: [
                { question: 'Will my PDF formatting change?', answer: 'No, text fonts, layout, and document structure are preserved exactly.' },
            ],
            relatedSlugs: ['pdf-merge', 'pdf-split', 'pdf-to-jpg'],
        },
        {
            slug: 'pdf-merge',
            name: 'PDF Merge',
            description: 'Combine multiple PDF files into a single organized document.',
            categorySlug: 'pdf',
            implementationMode: client_1.UtilityExecutionMode.SERVER,
            status: client_1.UtilityStatus.ACTIVE,
            isFeatured: true,
            displayOrder: 9,
            seoTitle: 'Merge PDF Files Online - Combine Multiple PDFs',
            seoDescription: 'Easily merge multiple PDF files in any order into one single document.',
            faqContent: [
                { question: 'How many PDF files can I merge at once?', answer: 'You can merge up to 10 PDF files with a combined size of 50MB.' },
            ],
            relatedSlugs: ['pdf-compressor', 'pdf-split', 'pdf-to-jpg'],
        },
        {
            slug: 'pdf-split',
            name: 'PDF Split',
            description: 'Extract individual pages or specified page ranges from any PDF document.',
            categorySlug: 'pdf',
            implementationMode: client_1.UtilityExecutionMode.SERVER,
            status: client_1.UtilityStatus.ACTIVE,
            isFeatured: true,
            displayOrder: 10,
            seoTitle: 'Split PDF Online - Extract Pages from PDF Document',
            seoDescription: 'Extract pages and custom page ranges from your PDF quickly and securely.',
            faqContent: [
                { question: 'What page range formats are supported?', answer: 'You can enter single pages or ranges separated by commas, such as 1-3, 5, 8-10.' },
            ],
            relatedSlugs: ['pdf-merge', 'pdf-compressor', 'pdf-to-jpg'],
        },
        {
            slug: 'pdf-to-jpg',
            name: 'PDF to JPG Converter',
            description: 'Render and export PDF document pages into high-resolution JPG images.',
            categorySlug: 'pdf',
            implementationMode: client_1.UtilityExecutionMode.SERVER,
            status: client_1.UtilityStatus.ACTIVE,
            isFeatured: true,
            displayOrder: 11,
            seoTitle: 'Convert PDF to JPG Online - High Resolution Image Export',
            seoDescription: 'Convert PDF pages into clear JPG images online. Export single pages or download a ZIP archive.',
            faqContent: [
                { question: 'Can I convert all pages at once?', answer: 'Yes, all pages are rendered and bundled into a convenient ZIP archive for download.' },
            ],
            relatedSlugs: ['pdf-compressor', 'pdf-merge', 'jpg-to-png'],
        },
        // --- Phase 9 MVP Utilities: Text ---
        {
            slug: 'text-cleaner',
            name: 'Text Cleaner',
            description: 'Clean up messy text by normalizing whitespace, stripping excess blank lines, and fixing line endings.',
            categorySlug: 'text',
            implementationMode: client_1.UtilityExecutionMode.LOCAL,
            status: client_1.UtilityStatus.ACTIVE,
            isFeatured: true,
            displayOrder: 12,
            seoTitle: 'Free Online Text Cleaner - Remove Whitespace & Extra Lines',
            seoDescription: 'Instantly clean up and normalize unformatted or copied text strings.',
            faqContent: [
                { question: 'Does this tool send my text anywhere?', answer: 'No, text cleaning executes entirely in your browser for 100% data privacy.' },
            ],
            relatedSlugs: ['case-converter', 'word-counter'],
        },
        {
            slug: 'case-converter',
            name: 'Case Converter',
            description: 'Transform text case between UPPERCASE, lowercase, Title Case, Sentence case, camelCase, snake_case, and kebab-case.',
            categorySlug: 'text',
            implementationMode: client_1.UtilityExecutionMode.LOCAL,
            status: client_1.UtilityStatus.ACTIVE,
            isFeatured: true,
            displayOrder: 13,
            seoTitle: 'Online Case Converter - UPPERCASE, lowercase, Title Case',
            seoDescription: 'Easily switch text casing between uppercase, lowercase, sentence case, title case, and code formats.',
            faqContent: [
                { question: 'Which programming cases are supported?', answer: 'We support camelCase, snake_case, and kebab-case alongside standard writing cases.' },
            ],
            relatedSlugs: ['text-cleaner', 'word-counter'],
        },
        // --- Phase 9 MVP Utilities: AI ---
        {
            slug: 'ai-humanizer',
            name: 'AI Humanizer',
            description: 'Refine and improve AI-assisted text to read naturally with fluent human rhythm and phrasing.',
            categorySlug: 'ai',
            implementationMode: client_1.UtilityExecutionMode.AI,
            status: client_1.UtilityStatus.ACTIVE,
            isFeatured: true,
            displayOrder: 14,
            seoTitle: 'Free AI Humanizer - Improve Writing Naturalness & Flow',
            seoDescription: 'Refine drafts to sound more natural, expressive, and engaging with AI-guided phrasing.',
            faqContent: [
                { question: 'Does this guarantee bypass of AI detectors?', answer: 'No, this tool focuses on enhancing readability, natural cadence, and human tone rather than evading detection.' },
            ],
            relatedSlugs: ['ai-paraphraser', 'ai-grammar-checker'],
        },
        {
            slug: 'ai-paraphraser',
            name: 'AI Paraphraser',
            description: 'Rephrase sentences and rewrite paragraphs clearly while preserving essential meaning and factual details.',
            categorySlug: 'ai',
            implementationMode: client_1.UtilityExecutionMode.AI,
            status: client_1.UtilityStatus.ACTIVE,
            isFeatured: true,
            displayOrder: 15,
            seoTitle: 'Free AI Paraphraser Tool - Rewrite & Rephrase Text',
            seoDescription: 'Paraphrase any text in standard, fluent, creative, or concise writing styles.',
            faqContent: [
                { question: 'How much text can I paraphrase at once?', answer: 'You can submit up to 50,000 characters per paraphrasing request.' },
            ],
            relatedSlugs: ['ai-humanizer', 'ai-grammar-checker'],
        },
        {
            slug: 'ai-grammar-checker',
            name: 'AI Grammar Checker',
            description: 'Find and fix grammatical mistakes, punctuation errors, spelling typos, and stylistic awkwardness.',
            categorySlug: 'ai',
            implementationMode: client_1.UtilityExecutionMode.AI,
            status: client_1.UtilityStatus.ACTIVE,
            isFeatured: true,
            displayOrder: 16,
            seoTitle: 'Free AI Grammar Checker - Correct Spelling & Grammar Errors',
            seoDescription: 'Accurately detect and fix grammar, spelling, and punctuation issues with detailed explanations.',
            faqContent: [
                { question: 'Does it provide explanations for mistakes?', answer: 'Yes, each detected issue includes the original error, recommended correction, and an explanation.' },
            ],
            relatedSlugs: ['ai-humanizer', 'ai-paraphraser'],
        },
        // --- Lifecycle Test Utilities ---
        {
            slug: 'draft-tool',
            name: 'Draft Test Tool',
            description: 'A tool in draft state for testing lifecycle gates.',
            categorySlug: 'developer',
            implementationMode: client_1.UtilityExecutionMode.SERVER,
            status: client_1.UtilityStatus.DRAFT,
            isFeatured: false,
            displayOrder: 98,
            seoTitle: 'Draft Tool',
            seoDescription: 'Draft tool description',
            faqContent: [],
            relatedSlugs: [],
        },
        {
            slug: 'disabled-tool',
            name: 'Disabled Test Tool',
            description: 'A tool in disabled state for testing lifecycle gates.',
            categorySlug: 'developer',
            implementationMode: client_1.UtilityExecutionMode.LOCAL,
            status: client_1.UtilityStatus.DISABLED,
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
                faqContent: u.faqContent,
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
                faqContent: u.faqContent,
                relatedSlugs: u.relatedSlugs,
            },
        });
    }
    // 6. Seed Ad Placements
    const placements = [
        { code: client_1.PlacementCode.HEADER_BANNER, name: 'Header Banner', description: 'Top horizontal banner (728x90 desktop / 320x50 mobile)', supportedTypes: [client_1.CreativeType.IMAGE, client_1.CreativeType.HTML, client_1.CreativeType.IFRAME] },
        { code: client_1.PlacementCode.TOP_CONTENT, name: 'Top Content Banner', description: 'Banner displayed above the tool interface workspace', supportedTypes: [client_1.CreativeType.IMAGE, client_1.CreativeType.VIDEO, client_1.CreativeType.HTML, client_1.CreativeType.IFRAME] },
        { code: client_1.PlacementCode.AFTER_TOOL, name: 'After Tool Banner', description: 'Banner placed directly below the active tool interface', supportedTypes: [client_1.CreativeType.IMAGE, client_1.CreativeType.VIDEO, client_1.CreativeType.HTML, client_1.CreativeType.IFRAME] },
        { code: client_1.PlacementCode.MID_CONTENT, name: 'Mid Content Banner', description: 'Banner embedded inside the content / how-to documentation', supportedTypes: [client_1.CreativeType.IMAGE, client_1.CreativeType.HTML, client_1.CreativeType.IFRAME] },
        { code: client_1.PlacementCode.BOTTOM_CONTENT, name: 'Bottom Content Banner', description: 'Banner placed directly above the FAQ section', supportedTypes: [client_1.CreativeType.IMAGE, client_1.CreativeType.HTML, client_1.CreativeType.IFRAME] },
        { code: client_1.PlacementCode.SIDEBAR, name: 'Sidebar Banner', description: 'Vertical skyscraper banner on desktop viewports (300x250 / 160x600)', supportedTypes: [client_1.CreativeType.IMAGE, client_1.CreativeType.VIDEO, client_1.CreativeType.HTML, client_1.CreativeType.IFRAME] },
        { code: client_1.PlacementCode.MOBILE_STICKY, name: 'Mobile Sticky Footer', description: 'Sticky bottom banner overlay on mobile viewports', supportedTypes: [client_1.CreativeType.IMAGE, client_1.CreativeType.HTML] },
        { code: client_1.PlacementCode.DESKTOP_STICKY, name: 'Desktop Corner Sticky', description: 'Floating corner overlay on desktop viewports', supportedTypes: [client_1.CreativeType.IMAGE, client_1.CreativeType.HTML] },
    ];
    const createdPlacements = {};
    for (const p of placements) {
        const placement = await prisma.adPlacement.upsert({
            where: { code: p.code },
            update: { name: p.name, description: p.description, supportedTypes: p.supportedTypes },
            create: p,
        });
        createdPlacements[p.code] = placement;
    }
    // 7. Seed Ad Creatives (Clean up old targeting data for idempotency)
    await prisma.adClick.deleteMany();
    await prisma.adImpression.deleteMany();
    await prisma.adTargetingRule.deleteMany();
    await prisma.adSchedule.deleteMany();
    await prisma.adCampaign.deleteMany();
    await prisma.adCreative.deleteMany();
    const creatives = [
        {
            name: 'JSON Pro Mobile Banner',
            type: client_1.CreativeType.IMAGE,
            mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=320&h=50&fit=crop',
            targetUrl: 'https://example.com/json-pro-mobile',
            width: 320,
            height: 50,
            altText: 'JSON Pro for Mobile',
            isGlobalFallback: false,
        },
        {
            name: 'JSON Pro Tablet Banner',
            type: client_1.CreativeType.IMAGE,
            mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=468&h=60&fit=crop',
            targetUrl: 'https://example.com/json-pro-tablet',
            width: 468,
            height: 60,
            altText: 'JSON Pro for Tablet',
            isGlobalFallback: false,
        },
        {
            name: 'JSON Pro Desktop Leaderboard',
            type: client_1.CreativeType.IMAGE,
            mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=728&h=90&fit=crop',
            targetUrl: 'https://example.com/json-pro-desktop',
            width: 728,
            height: 90,
            altText: 'JSON Pro for Desktop',
            isGlobalFallback: false,
        },
        {
            name: 'Developer Tools Category Banner',
            type: client_1.CreativeType.IMAGE,
            mediaUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=728&h=90&fit=crop',
            targetUrl: 'https://example.com/dev-tools-sponsor',
            width: 728,
            height: 90,
            altText: 'Developer Tools Sponsor',
            isGlobalFallback: false,
        },
        {
            name: 'Platform Global Fallback Sponsor',
            type: client_1.CreativeType.HTML,
            mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&h=200&fit=crop&q=80',
            customHtml: '<div style="width:100%;max-width:728px;margin:0 auto;position:relative;overflow:hidden;border-radius:8px;border:1px solid #1e293b;background:#0f172a;display:flex;align-items:center;justify-content:center;cursor:pointer;"><img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&h=200&fit=crop&q=80" alt="⚡ Global Platform Sponsor • Fast Utilities" style="width:100%;max-height:100px;object-fit:cover;display:block;" /><div style="position:absolute;bottom:6px;left:10px;background:rgba(15,23,42,0.85);backdrop-filter:blur(4px);padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#38bdf8;border:1px solid rgba(56,189,248,0.25);display:flex;align-items:center;gap:4px;">⚡ Global Platform Sponsor &bull; Fast Utilities</div></div>',
            targetUrl: 'https://example.com/platform-sponsor',
            width: 728,
            height: 90,
            altText: 'Global Platform Sponsor • Fast Utilities',
            isGlobalFallback: true,
        },
    ];
    const createdCreatives = {};
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
            status: client_1.CampaignStatus.ACTIVE,
            priority: 100,
            weight: 100,
            dailyImpressionCap: 100,
        },
    });
    const campaignDevCategory = await prisma.adCampaign.create({
        data: {
            name: 'Developer Tools Category Campaign',
            status: client_1.CampaignStatus.ACTIVE,
            priority: 70,
            weight: 100,
        },
    });
    const campaignGlobalFallback = await prisma.adCampaign.create({
        data: {
            name: 'Global Fallback Campaign',
            status: client_1.CampaignStatus.ACTIVE,
            priority: 10,
            weight: 100,
        },
    });
    // 9. Seed Targeting Rules (Verifying Mobile, Tablet, Desktop device-specific targeting)
    // Rule A: Mobile -> Creative A on /json-formatter TOP_CONTENT
    await prisma.adTargetingRule.create({
        data: {
            campaignId: campaignJsonExact.id,
            placementId: createdPlacements[client_1.PlacementCode.TOP_CONTENT].id,
            creativeId: createdCreatives['JSON Pro Mobile Banner'].id,
            deviceTypes: [client_1.DeviceType.MOBILE],
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
            placementId: createdPlacements[client_1.PlacementCode.TOP_CONTENT].id,
            creativeId: createdCreatives['JSON Pro Tablet Banner'].id,
            deviceTypes: [client_1.DeviceType.TABLET],
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
            placementId: createdPlacements[client_1.PlacementCode.TOP_CONTENT].id,
            creativeId: createdCreatives['JSON Pro Desktop Leaderboard'].id,
            deviceTypes: [client_1.DeviceType.DESKTOP],
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
            placementId: createdPlacements[client_1.PlacementCode.HEADER_BANNER].id,
            creativeId: createdCreatives['Developer Tools Category Banner'].id,
            deviceTypes: [client_1.DeviceType.MOBILE, client_1.DeviceType.TABLET, client_1.DeviceType.DESKTOP],
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
            placementId: createdPlacements[client_1.PlacementCode.AFTER_TOOL].id,
            creativeId: createdCreatives['Platform Global Fallback Sponsor'].id,
            deviceTypes: [client_1.DeviceType.MOBILE, client_1.DeviceType.TABLET, client_1.DeviceType.DESKTOP],
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
    // 11. Seed Plans
    const plans = [
        {
            code: 'FREE',
            name: 'Free Plan',
            description: 'Standard access with advertisements and basic usage limits',
            active: true,
            displayOrder: 1,
            billingInterval: null,
            priceCents: 0,
            currency: 'USD',
            providerPriceId: null,
            entitlements: {
                allowedUtilities: ['ALL'],
                showAds: true,
                features: ['standard-utilities', 'community-support'],
            },
            usageLimits: {
                dailyAiRequests: 10,
                dailyConversions: 50,
            },
            metadata: {
                badge: 'Free Tier',
            },
        },
        {
            code: 'PREMIUM',
            name: 'Premium Plan',
            description: 'Ad-free experience, priority utility access, and high usage limits',
            active: true,
            displayOrder: 2,
            billingInterval: 'MONTHLY',
            priceCents: 999, // $9.99
            currency: 'USD',
            providerPriceId: 'price_premium_monthly_mock',
            entitlements: {
                allowedUtilities: ['ALL'],
                showAds: false,
                features: ['ad-free', 'priority-execution', 'high-limits', 'premium-support'],
            },
            usageLimits: {
                dailyAiRequests: 200,
                dailyConversions: 1000,
            },
            metadata: {
                badge: 'Most Popular',
            },
        },
    ];
    for (const p of plans) {
        await prisma.plan.upsert({
            where: { code: p.code },
            update: {
                name: p.name,
                description: p.description,
                active: p.active,
                displayOrder: p.displayOrder,
                billingInterval: p.billingInterval,
                priceCents: p.priceCents,
                currency: p.currency,
                providerPriceId: p.providerPriceId,
                entitlements: p.entitlements,
                usageLimits: p.usageLimits,
                metadata: p.metadata,
            },
            create: p,
        });
    }
    console.log('Plans seeded.');
    console.log('Database seed completed successfully with Phase 26 Billing & Subscriptions.');
}
main()
    .catch((e) => {
    console.error('Error during database seed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
