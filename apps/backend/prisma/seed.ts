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
import * as bcryptModule from 'bcryptjs';
const bcrypt = (bcryptModule as any).default || bcryptModule;

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
    { action: 'billing:read', description: 'View billing overview and subscriptions' },
    { action: 'billing:manage', description: 'Manage plans, subscriptions, and billing configuration' },
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
  let passwordHash = '$2a$10$wE7UvL4oM67oPqV8kZ1i.e0rI5Z3W2N1bX.f9m8h7g6j5k4l3n2q1';
  try {
    const b = (bcryptModule as any)?.default || bcryptModule;
    if (b && typeof b.hash === 'function') {
      passwordHash = await b.hash('AdminPassword123!', 10);
    } else if (b && typeof b.hashSync === 'function') {
      passwordHash = b.hashSync('AdminPassword123!', 10);
    }
  } catch {
    // fallback to valid bcrypt hash
  }

  const users = [
    { email: 'admin@example.test', firstName: 'System', lastName: 'Admin', role: RoleType.SUPER_ADMIN },
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
    { slug: 'video', name: 'Video Tools', description: 'Compress, convert, and trim videos', icon: 'video', displayOrder: 6 },
    { slug: 'audio', name: 'Audio Tools', description: 'Extract, convert, and cut audio tracks', icon: 'music', displayOrder: 7 },
    { slug: 'qr-barcode', name: 'QR & Barcode', description: 'Generate and scan QR codes and barcodes', icon: 'qr-code', displayOrder: 8 },
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
    // --- Phase 9 MVP Utilities: Image ---
    {
      slug: 'jpg-to-png',
      name: 'JPG to PNG Converter',
      description: 'Convert JPG and JPEG images to lossless PNG format with transparent alpha support.',
      categorySlug: 'image',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
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
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
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
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
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
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
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
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
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
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
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
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
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
      implementationMode: UtilityExecutionMode.LOCAL,
      status: UtilityStatus.ACTIVE,
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
      implementationMode: UtilityExecutionMode.LOCAL,
      status: UtilityStatus.ACTIVE,
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
      implementationMode: UtilityExecutionMode.AI,
      status: UtilityStatus.ACTIVE,
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
      implementationMode: UtilityExecutionMode.AI,
      status: UtilityStatus.ACTIVE,
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
      implementationMode: UtilityExecutionMode.AI,
      status: UtilityStatus.ACTIVE,
      isFeatured: true,
      displayOrder: 16,
      seoTitle: 'Free AI Grammar Checker - Correct Spelling & Grammar Errors',
      seoDescription: 'Accurately detect and fix grammar, spelling, and punctuation issues with detailed explanations.',
      faqContent: [
        { question: 'Does it provide explanations for mistakes?', answer: 'Yes, each detected issue includes the original error, recommended correction, and an explanation.' },
      ],
      relatedSlugs: ['ai-humanizer', 'ai-paraphraser'],
    },
    // --- Phase 27 High-Demand Utilities: Image ---
    {
      slug: 'image-to-pdf',
      name: 'Image to PDF Converter',
      description: 'Convert single or multiple JPG and PNG images into a clean, combined PDF document with custom margins and orientations.',
      categorySlug: 'image',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
      isFeatured: true,
      displayOrder: 17,
      seoTitle: 'Free Image to PDF Converter Online - JPG & PNG to PDF',
      seoDescription: 'Convert and merge JPG and PNG photos into a single high-quality PDF document instantly.',
      faqContent: [
        { question: 'Can I combine multiple images into one PDF?', answer: 'Yes, you can upload and order multiple images to combine into a single PDF.' },
      ],
      relatedSlugs: ['jpg-to-png', 'pdf-merge'],
    },
    {
      slug: 'image-resizer',
      name: 'Image Resizer',
      description: 'Resize JPG, PNG, and WebP images by exact pixel dimensions or percentage while preserving crisp aspect ratios.',
      categorySlug: 'image',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
      isFeatured: true,
      displayOrder: 18,
      seoTitle: 'Free Online Image Resizer - Resize JPG, PNG & WebP',
      seoDescription: 'Quickly resize images to exact dimensions or percentage scale with high fidelity.',
      faqContent: [
        { question: 'Does resizing reduce image quality?', answer: 'Our resizer uses advanced interpolation to preserve image sharpness.' },
      ],
      relatedSlugs: ['image-compressor', 'image-cropper'],
    },
    {
      slug: 'image-cropper',
      name: 'Image Cropper',
      description: 'Crop images to standard aspect ratios (1:1, 4:3, 16:9) or custom bounding boxes with instant preview.',
      categorySlug: 'image',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
      isFeatured: true,
      displayOrder: 19,
      seoTitle: 'Free Online Image Cropper - Crop Photos & Pictures',
      seoDescription: 'Crop images easily to exact aspect ratios or custom pixel coordinates.',
      faqContent: [
        { question: 'Which aspect ratio presets are available?', answer: 'Presets include 1:1 Square, 4:3 Standard, 16:9 Widescreen, and Free Crop.' },
      ],
      relatedSlugs: ['image-resizer', 'jpg-to-png'],
    },
    {
      slug: 'webp-to-jpg',
      name: 'WebP to JPG Converter',
      description: 'Convert modern WebP images to universal JPEG format with controllable quality and clean background compositing.',
      categorySlug: 'image',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
      isFeatured: false,
      displayOrder: 20,
      seoTitle: 'Free WebP to JPG Converter Online - Fast & High Quality',
      seoDescription: 'Convert WebP images to JPG format for universal compatibility across devices.',
      faqContent: [
        { question: 'How are transparent WebP images handled?', answer: 'Transparent areas are smoothly composited over a clean white background.' },
      ],
      relatedSlugs: ['jpg-to-webp', 'png-to-jpg'],
    },
    {
      slug: 'jpg-to-webp',
      name: 'JPG to WebP Converter',
      description: 'Convert JPG images to modern WebP format for faster web page loading and smaller file sizes.',
      categorySlug: 'image',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
      isFeatured: false,
      displayOrder: 21,
      seoTitle: 'Free JPG to WebP Converter - Compress & Convert Images',
      seoDescription: 'Convert JPG images to WebP format to reduce file sizes by up to 30% without quality loss.',
      faqContent: [
        { question: 'Why convert JPG to WebP?', answer: 'WebP provides superior compression and faster website load times.' },
      ],
      relatedSlugs: ['webp-to-jpg', 'image-compressor'],
    },
    {
      slug: 'png-to-webp',
      name: 'PNG to WebP Converter',
      description: 'Convert PNG images to WebP format while preserving transparent alpha channels and high fidelity.',
      categorySlug: 'image',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
      isFeatured: false,
      displayOrder: 22,
      seoTitle: 'Free PNG to WebP Converter - Transparent Alpha Preserved',
      seoDescription: 'Convert transparent PNG images to lightweight WebP files with full transparency support.',
      faqContent: [
        { question: 'Is transparency preserved?', answer: 'Yes, alpha channel transparency is fully preserved in the resulting WebP file.' },
      ],
      relatedSlugs: ['jpg-to-webp', 'jpg-to-png'],
    },
    // --- Phase 27 High-Demand Utilities: PDF ---
    {
      slug: 'pdf-to-png',
      name: 'PDF to PNG Converter',
      description: 'Convert PDF document pages to crisp, high-resolution PNG images with transparent background support.',
      categorySlug: 'pdf',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
      isFeatured: true,
      displayOrder: 23,
      seoTitle: 'Free PDF to PNG Converter Online - High Resolution Image Export',
      seoDescription: 'Convert PDF pages into clear PNG images. Export single pages or download a ZIP archive.',
      faqContent: [
        { question: 'Are multiple pages supported?', answer: 'Yes, multiple pages are rendered and bundled into a ZIP archive.' },
      ],
      relatedSlugs: ['pdf-to-jpg', 'pdf-compressor'],
    },
    {
      slug: 'pdf-to-text',
      name: 'PDF to Text Extractor',
      description: 'Extract digital selectable text from PDF documents with clean formatting and paragraph preservation.',
      categorySlug: 'pdf',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
      isFeatured: true,
      displayOrder: 24,
      seoTitle: 'Free PDF to Text Extractor Online - Extract Plain Text from PDF',
      seoDescription: 'Extract selectable text from PDF documents cleanly into a UTF-8 text file.',
      faqContent: [
        { question: 'Does this perform OCR on scanned pages?', answer: 'This tool extracts digital selectable text. Scanned images without text layers require OCR.' },
      ],
      relatedSlugs: ['pdf-to-png', 'word-counter'],
    },
    {
      slug: 'pdf-page-extractor',
      name: 'PDF Page Extractor',
      description: 'Extract specific pages or custom page ranges (e.g. 1-3, 5, 8) into a new standalone PDF document.',
      categorySlug: 'pdf',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
      isFeatured: true,
      displayOrder: 25,
      seoTitle: 'Free PDF Page Extractor - Extract Pages from PDF Document',
      seoDescription: 'Select and extract specific pages from your PDF file into a new document.',
      faqContent: [
        { question: 'How do I specify page ranges?', answer: 'You can enter single pages or ranges separated by commas, such as "1-3, 5, 8".' },
      ],
      relatedSlugs: ['pdf-split', 'pdf-merge'],
    },
    {
      slug: 'pdf-rotator',
      name: 'PDF Rotator',
      description: 'Rotate PDF pages permanently by 90°, 180°, or 270° with complete layout and font preservation.',
      categorySlug: 'pdf',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
      isFeatured: false,
      displayOrder: 26,
      seoTitle: 'Free PDF Rotator Online - Rotate PDF Pages Permanently',
      seoDescription: 'Rotate individual or all pages of a PDF document by 90, 180, or 270 degrees.',
      faqContent: [
        { question: 'Is the rotation saved permanently?', answer: 'Yes, the downloaded PDF retains the new page orientation permanently.' },
      ],
      relatedSlugs: ['pdf-reorder-pages', 'pdf-page-extractor'],
    },
    {
      slug: 'pdf-reorder-pages',
      name: 'PDF Reorder Pages',
      description: 'Rearrange, sort, and organize PDF pages visually to create a customized document sequence.',
      categorySlug: 'pdf',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
      isFeatured: false,
      displayOrder: 27,
      seoTitle: 'Free PDF Page Organizer - Reorder & Sort PDF Pages',
      seoDescription: 'Easily rearrange and reorder pages in your PDF file with precision.',
      faqContent: [
        { question: 'Can I remove unwanted pages while reordering?', answer: 'Yes, simply omit page numbers you do not want in the final document.' },
      ],
      relatedSlugs: ['pdf-rotator', 'pdf-merge'],
    },
    {
      slug: 'pdf-watermark',
      name: 'PDF Watermark',
      description: 'Add custom text watermarks, confidential stamps, or copyright notices across PDF document pages.',
      categorySlug: 'pdf',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
      isFeatured: false,
      displayOrder: 28,
      seoTitle: 'Free PDF Watermark Tool - Stamp & Watermark PDF Pages',
      seoDescription: 'Add custom diagonal or centered text watermarks with transparency to your PDF.',
      faqContent: [
        { question: 'Can I adjust watermark transparency?', answer: 'Yes, opacity and angle can be customized to ensure readability of underlying text.' },
      ],
      relatedSlugs: ['pdf-metadata-remover', 'pdf-compressor'],
    },
    {
      slug: 'pdf-metadata-remover',
      name: 'PDF Metadata Remover',
      description: 'Strip document metadata (Author, Title, Subject, Producer, Creation Date) from PDF files for privacy.',
      categorySlug: 'pdf',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
      isFeatured: false,
      displayOrder: 29,
      seoTitle: 'Free PDF Metadata Remover - Sanitize Document Properties',
      seoDescription: 'Remove hidden author names, timestamps, and metadata from PDF files before sharing.',
      faqContent: [
        { question: 'Which metadata fields are removed?', answer: 'Fields including Title, Author, Subject, Keywords, Creator, and Producer are cleared.' },
      ],
      relatedSlugs: ['pdf-watermark', 'pdf-compressor'],
    },
    // --- Phase 27 High-Demand Utilities: Video ---
    {
      slug: 'video-compressor',
      name: 'Video Compressor',
      description: 'Compress MP4 and WebM videos to reduce file size significantly for easy sharing on email and social media.',
      categorySlug: 'video',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
      isFeatured: true,
      displayOrder: 30,
      seoTitle: 'Free Online Video Compressor - Reduce MP4 & WebM File Size',
      seoDescription: 'Compress large videos online without visible quality loss. Fast, secure, and private.',
      faqContent: [
        { question: 'What is the maximum video size supported?', answer: 'You can upload and compress videos up to 50MB in size.' },
      ],
      relatedSlugs: ['video-trimmer', 'mp4-to-mp3'],
    },
    {
      slug: 'mp4-to-mp3',
      name: 'MP4 to MP3 Converter',
      description: 'Extract high-fidelity audio tracks from MP4 video files into standalone MP3 format.',
      categorySlug: 'video',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
      isFeatured: true,
      displayOrder: 31,
      seoTitle: 'Free MP4 to MP3 Converter Online - Extract Audio from Video',
      seoDescription: 'Quickly extract crystal-clear MP3 audio tracks from any MP4 video file.',
      faqContent: [
        { question: 'Can I choose audio bitrate quality?', answer: 'Yes, bitrates from 128 kbps to 320 kbps high fidelity are supported.' },
      ],
      relatedSlugs: ['video-compressor', 'audio-cutter'],
    },
    {
      slug: 'video-to-gif',
      name: 'Video to GIF Converter',
      description: 'Convert short video clips into lightweight, animated GIF animations with customizable FPS and dimensions.',
      categorySlug: 'video',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
      isFeatured: true,
      displayOrder: 32,
      seoTitle: 'Free Video to GIF Converter Online - Make Animated GIFs',
      seoDescription: 'Turn video clips into smooth animated GIFs with custom speed and resolution.',
      faqContent: [
        { question: 'What is the recommended clip duration?', answer: 'Short clips between 2 to 10 seconds produce the smoothest and smallest GIF files.' },
      ],
      relatedSlugs: ['video-trimmer', 'video-compressor'],
    },
    {
      slug: 'video-trimmer',
      name: 'Video Trimmer',
      description: 'Cut and trim video segments with millisecond precision without losing audio or video quality.',
      categorySlug: 'video',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
      isFeatured: false,
      displayOrder: 33,
      seoTitle: 'Free Online Video Trimmer - Cut & Trim Videos Easily',
      seoDescription: 'Trim unwanted portions from the start or end of your video files online.',
      faqContent: [
        { question: 'Does trimming re-encode the whole video?', answer: 'Trimming extracts the exact segment with fast rendering and audio synchronization.' },
      ],
      relatedSlugs: ['video-compressor', 'mp4-to-mp3'],
    },
    // --- Phase 27 High-Demand Utilities: Audio ---
    {
      slug: 'audio-cutter',
      name: 'Audio Cutter',
      description: 'Cut and trim MP3 and audio tracks with precision to create ringtones, clips, and soundbites.',
      categorySlug: 'audio',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.ACTIVE,
      isFeatured: true,
      displayOrder: 34,
      seoTitle: 'Free Online Audio Cutter - Cut & Trim MP3 Audio Tracks',
      seoDescription: 'Trim audio files and create custom MP3 sound clips with precise start and end times.',
      faqContent: [
        { question: 'Which audio formats can I trim?', answer: 'We support MP3, WAV, OGG, and M4A audio files up to 30MB.' },
      ],
      relatedSlugs: ['mp4-to-mp3', 'video-trimmer'],
    },
    // --- Phase 27 High-Demand Utilities: QR & Barcode ---
    {
      slug: 'qr-code-generator',
      name: 'QR Code Generator',
      description: 'Generate high-resolution QR codes for websites, text, WiFi credentials, email, and contact cards instantly.',
      categorySlug: 'qr-barcode',
      implementationMode: UtilityExecutionMode.LOCAL,
      status: UtilityStatus.ACTIVE,
      isFeatured: true,
      displayOrder: 35,
      seoTitle: 'Free Online QR Code Generator - Custom QR Codes with Colors',
      seoDescription: 'Create custom QR codes for URLs, WiFi networks, and contacts with instant PNG download.',
      faqContent: [
        { question: 'Do generated QR codes expire?', answer: 'No, static QR codes encode data directly and never expire.' },
      ],
      relatedSlugs: ['json-formatter', 'word-counter'],
    },
    // --- Lifecycle Test Utilities ---
    {
      slug: 'draft-tool',
      name: 'Draft Test Tool',
      description: 'A tool in draft state for testing lifecycle gates.',
      categorySlug: 'developer',
      implementationMode: UtilityExecutionMode.SERVER,
      status: UtilityStatus.DRAFT,
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

  // 7. Seed Ad Creatives (Clean up old targeting data for idempotency)
  await prisma.adClick.deleteMany();
  await prisma.adImpression.deleteMany();
  await prisma.adTargetingRule.deleteMany();
  await prisma.adSchedule.deleteMany();
  await prisma.adCampaign.deleteMany();
  await prisma.adCreative.deleteMany();

  const DEFAULT_TARGET_URL = 'https://rocky11.club/?refercode=SEO';

  const creativesData = [
    // Aviator Creatives
    {
      name: 'Aviator Desktop Leaderboard (728x90)',
      type: CreativeType.IMAGE,
      mediaUrl: '/media/promos/aviator-top.jpg',
      targetUrl: DEFAULT_TARGET_URL,
      width: 728,
      height: 90,
      altText: 'Play Aviator Game Online',
      isGlobalFallback: false,
    },
    {
      name: 'Aviator Medium Banner (300x250)',
      type: CreativeType.IMAGE,
      mediaUrl: '/media/promos/aviator-mid.jpg',
      targetUrl: DEFAULT_TARGET_URL,
      width: 300,
      height: 250,
      altText: 'Aviator Online Multiplier',
      isGlobalFallback: false,
    },
    {
      name: 'Aviator Sidebar Skyscraper (300x600)',
      type: CreativeType.IMAGE,
      mediaUrl: '/media/promos/aviator-side.jpg',
      targetUrl: DEFAULT_TARGET_URL,
      width: 300,
      height: 600,
      altText: 'Aviator Crash Game Bonus',
      isGlobalFallback: false,
    },
    {
      name: 'Aviator Mobile Badge (125x125)',
      type: CreativeType.IMAGE,
      mediaUrl: '/media/promos/aviator-badge.jpg',
      targetUrl: DEFAULT_TARGET_URL,
      width: 125,
      height: 125,
      altText: 'Aviator Quick Play',
      isGlobalFallback: false,
    },
    {
      name: 'Aviator Skyscraper (160x600)',
      type: CreativeType.IMAGE,
      mediaUrl: '/media/promos/aviator-tall.jpg',
      targetUrl: DEFAULT_TARGET_URL,
      width: 160,
      height: 600,
      altText: 'Aviator Crash Game',
      isGlobalFallback: false,
    },

    // JetX Creatives
    {
      name: 'JetX Desktop Leaderboard (728x90)',
      type: CreativeType.IMAGE,
      mediaUrl: '/media/promos/jetx-top.jpg',
      targetUrl: DEFAULT_TARGET_URL,
      width: 728,
      height: 90,
      altText: 'Play JetX Game Online',
      isGlobalFallback: false,
    },
    {
      name: 'JetX Medium Banner (300x250)',
      type: CreativeType.IMAGE,
      mediaUrl: '/media/promos/jetx-mid.jpg',
      targetUrl: DEFAULT_TARGET_URL,
      width: 300,
      height: 250,
      altText: 'JetX Online Multiplier',
      isGlobalFallback: false,
    },
    {
      name: 'JetX Sidebar Skyscraper (300x600)',
      type: CreativeType.IMAGE,
      mediaUrl: '/media/promos/jetx-side.jpg',
      targetUrl: DEFAULT_TARGET_URL,
      width: 300,
      height: 600,
      altText: 'JetX Rocket Game Bonus',
      isGlobalFallback: false,
    },
    {
      name: 'JetX Mobile Badge (125x125)',
      type: CreativeType.IMAGE,
      mediaUrl: '/media/promos/jetx-badge.jpg',
      targetUrl: DEFAULT_TARGET_URL,
      width: 125,
      height: 125,
      altText: 'JetX Quick Play',
      isGlobalFallback: false,
    },
    {
      name: 'JetX Skyscraper (160x600)',
      type: CreativeType.IMAGE,
      mediaUrl: '/media/promos/jetx-tall.jpg',
      targetUrl: DEFAULT_TARGET_URL,
      width: 160,
      height: 600,
      altText: 'JetX Crash Game',
      isGlobalFallback: false,
    },

    // Roulette Creatives
    {
      name: 'Roulette Desktop Leaderboard (728x90)',
      type: CreativeType.IMAGE,
      mediaUrl: '/media/promos/roulette-top.jpg',
      targetUrl: DEFAULT_TARGET_URL,
      width: 728,
      height: 90,
      altText: 'Play Roulette Online Casino',
      isGlobalFallback: false,
    },
    {
      name: 'Roulette Medium Banner (300x250)',
      type: CreativeType.IMAGE,
      mediaUrl: '/media/promos/roulette-mid.jpg',
      targetUrl: DEFAULT_TARGET_URL,
      width: 300,
      height: 250,
      altText: 'Roulette Classic Casino',
      isGlobalFallback: false,
    },
    {
      name: 'Roulette Sidebar Skyscraper (300x600)',
      type: CreativeType.IMAGE,
      mediaUrl: '/media/promos/roulette-side.jpg',
      targetUrl: DEFAULT_TARGET_URL,
      width: 300,
      height: 600,
      altText: 'Roulette Live Wheel Bonus',
      isGlobalFallback: false,
    },
    {
      name: 'Roulette Mobile Badge (125x125)',
      type: CreativeType.IMAGE,
      mediaUrl: '/media/promos/roulette-badge.jpg',
      targetUrl: DEFAULT_TARGET_URL,
      width: 125,
      height: 125,
      altText: 'Roulette Quick Play',
      isGlobalFallback: false,
    },
    {
      name: 'Roulette Skyscraper (160x600)',
      type: CreativeType.IMAGE,
      mediaUrl: '/media/promos/roulette-tall.jpg',
      targetUrl: DEFAULT_TARGET_URL,
      width: 160,
      height: 600,
      altText: 'Roulette Classic Game',
      isGlobalFallback: false,
    },

    // Global Fallback Sponsor
    {
      name: 'Platform Global Fallback Sponsor',
      type: CreativeType.HTML,
      mediaUrl: '/ads/aviator-728x90.jpg',
      customHtml: '<div style="width:100%;max-width:728px;margin:0 auto;position:relative;overflow:hidden;border-radius:8px;border:1px solid #1e293b;background:#0f172a;display:flex;align-items:center;justify-content:center;cursor:pointer;"><img src="/ads/aviator-728x90.jpg" alt="⚡ Rocky11 • Official Sponsor" style="width:100%;max-height:90px;object-fit:cover;display:block;" /></div>',
      targetUrl: DEFAULT_TARGET_URL,
      width: 728,
      height: 90,
      altText: 'Rocky11 Official Sponsor',
      isGlobalFallback: true,
    },
  ];

  const createdCreatives: Record<string, any> = {};
  for (const c of creativesData) {
    const creative = await prisma.adCreative.create({
      data: c,
    });
    createdCreatives[c.name] = creative;
  }

  // 8. Seed Campaigns
  const campaignAviator = await prisma.adCampaign.create({
    data: {
      name: 'Aviator Game Campaign',
      status: CampaignStatus.ACTIVE,
      priority: 100,
      weight: 100,
    },
  });

  const campaignJetX = await prisma.adCampaign.create({
    data: {
      name: 'JetX Game Campaign',
      status: CampaignStatus.ACTIVE,
      priority: 100,
      weight: 100,
    },
  });

  const campaignRoulette = await prisma.adCampaign.create({
    data: {
      name: 'Roulette Game Campaign',
      status: CampaignStatus.ACTIVE,
      priority: 100,
      weight: 100,
    },
  });

  // 9. Seed Zig-Zag Targeting Rules across all active tools
  // Group configs:
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

  // Canonical tool list order (Image -> PDF -> Text -> Developer -> AI -> Video -> Audio -> QR)
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

  // Filter and sort active utilities according to canonical catalog order
  const activeUtilities = utilities
    .filter((u) => u.status === UtilityStatus.ACTIVE)
    .sort((a, b) => {
      const idxA = canonicalToolOrder.indexOf(a.slug);
      const idxB = canonicalToolOrder.indexOf(b.slug);
      return (idxA >= 0 ? idxA : 999) - (idxB >= 0 ? idxB : 999);
    });

    // 0. Seed Home Page Default Targeting Rules
    const homeDesktopTheme = themeConfigs[0];
    const homeMobileTheme = themeConfigs[1];
    const homeAltTheme = themeConfigs[2];

    const homeRules = [
      { campaignId: homeDesktopTheme.campaign.id, placementId: createdPlacements[PlacementCode.HEADER_BANNER].id, creativeId: homeDesktopTheme.desktopHeader.id, deviceTypes: [DeviceType.DESKTOP], utilitySlugs: ['home'], priorityOverride: 100, weight: 100, isActive: true },
      { campaignId: homeMobileTheme.campaign.id, placementId: createdPlacements[PlacementCode.HEADER_BANNER].id, creativeId: homeMobileTheme.mobileHeader.id, deviceTypes: [DeviceType.MOBILE, DeviceType.TABLET], utilitySlugs: ['home'], priorityOverride: 100, weight: 100, isActive: true },
      { campaignId: homeDesktopTheme.campaign.id, placementId: createdPlacements[PlacementCode.TOP_CONTENT].id, creativeId: homeDesktopTheme.desktopHeader.id, deviceTypes: [DeviceType.DESKTOP], utilitySlugs: ['home'], priorityOverride: 100, weight: 100, isActive: true },
      { campaignId: homeMobileTheme.campaign.id, placementId: createdPlacements[PlacementCode.TOP_CONTENT].id, creativeId: homeMobileTheme.mobileHeader.id, deviceTypes: [DeviceType.MOBILE, DeviceType.TABLET], utilitySlugs: ['home'], priorityOverride: 100, weight: 100, isActive: true },
      { campaignId: homeDesktopTheme.campaign.id, placementId: createdPlacements[PlacementCode.MID_CONTENT].id, creativeId: homeDesktopTheme.desktopAfterTool.id, deviceTypes: [DeviceType.DESKTOP], utilitySlugs: ['home'], priorityOverride: 100, weight: 100, isActive: true },
      { campaignId: homeMobileTheme.campaign.id, placementId: createdPlacements[PlacementCode.MID_CONTENT].id, creativeId: homeMobileTheme.mobileAfterTool.id, deviceTypes: [DeviceType.MOBILE, DeviceType.TABLET], utilitySlugs: ['home'], priorityOverride: 100, weight: 100, isActive: true },
      { campaignId: homeAltTheme.campaign.id, placementId: createdPlacements[PlacementCode.AFTER_TOOL].id, creativeId: homeAltTheme.desktopAfterTool.id, deviceTypes: [DeviceType.DESKTOP], utilitySlugs: ['home'], priorityOverride: 100, weight: 100, isActive: true },
      { campaignId: homeAltTheme.campaign.id, placementId: createdPlacements[PlacementCode.AFTER_TOOL].id, creativeId: homeAltTheme.mobileAfterTool.id, deviceTypes: [DeviceType.MOBILE, DeviceType.TABLET], utilitySlugs: ['home'], priorityOverride: 100, weight: 100, isActive: true },
      { campaignId: homeDesktopTheme.campaign.id, placementId: createdPlacements[PlacementCode.BOTTOM_CONTENT].id, creativeId: homeDesktopTheme.desktopHeader.id, deviceTypes: [DeviceType.DESKTOP], utilitySlugs: ['home'], priorityOverride: 100, weight: 100, isActive: true },
      { campaignId: homeMobileTheme.campaign.id, placementId: createdPlacements[PlacementCode.BOTTOM_CONTENT].id, creativeId: homeMobileTheme.mobileHeader.id, deviceTypes: [DeviceType.MOBILE, DeviceType.TABLET], utilitySlugs: ['home'], priorityOverride: 100, weight: 100, isActive: true },
      { campaignId: homeAltTheme.campaign.id, placementId: createdPlacements[PlacementCode.MOBILE_STICKY].id, creativeId: homeAltTheme.mobileSticky.id, deviceTypes: [DeviceType.MOBILE, DeviceType.TABLET], utilitySlugs: ['home'], priorityOverride: 100, weight: 100, isActive: true },
    ];

    for (const hr of homeRules) {
      await prisma.adTargetingRule.create({ data: hr });
    }

    for (let idx = 0; idx < activeUtilities.length; idx++) {
      const u = activeUtilities[idx];
      const desktopTheme = themeConfigs[idx % 3];
      const mobileTheme = themeConfigs[(idx + 1) % 3];

      // Rule 1: Header Banner - Desktop (Desktop Theme)
      await prisma.adTargetingRule.create({
      data: {
        campaignId: desktopTheme.campaign.id,
        placementId: createdPlacements[PlacementCode.HEADER_BANNER].id,
        creativeId: desktopTheme.desktopHeader.id,
        deviceTypes: [DeviceType.DESKTOP],
        utilitySlugs: [u.slug],
        priorityOverride: 100,
        weight: 100,
        isActive: true,
      },
    });

    // Rule 2: Header Banner - Mobile & Tablet (Mobile Theme - Different Game)
    await prisma.adTargetingRule.create({
      data: {
        campaignId: mobileTheme.campaign.id,
        placementId: createdPlacements[PlacementCode.HEADER_BANNER].id,
        creativeId: mobileTheme.mobileHeader.id,
        deviceTypes: [DeviceType.MOBILE, DeviceType.TABLET],
        utilitySlugs: [u.slug],
        priorityOverride: 100,
        weight: 100,
        isActive: true,
      },
    });

    // Rule 3: After Tool - Desktop (Desktop Theme)
    await prisma.adTargetingRule.create({
      data: {
        campaignId: desktopTheme.campaign.id,
        placementId: createdPlacements[PlacementCode.AFTER_TOOL].id,
        creativeId: desktopTheme.desktopAfterTool.id,
        deviceTypes: [DeviceType.DESKTOP],
        utilitySlugs: [u.slug],
        priorityOverride: 100,
        weight: 100,
        isActive: true,
      },
    });

    // Rule 4: After Tool - Mobile & Tablet (Mobile Theme - Different Game)
    await prisma.adTargetingRule.create({
      data: {
        campaignId: mobileTheme.campaign.id,
        placementId: createdPlacements[PlacementCode.AFTER_TOOL].id,
        creativeId: mobileTheme.mobileAfterTool.id,
        deviceTypes: [DeviceType.MOBILE, DeviceType.TABLET],
        utilitySlugs: [u.slug],
        priorityOverride: 100,
        weight: 100,
        isActive: true,
      },
    });

    // Rule 5: Sidebar - Desktop (Desktop Theme)
    await prisma.adTargetingRule.create({
      data: {
        campaignId: desktopTheme.campaign.id,
        placementId: createdPlacements[PlacementCode.SIDEBAR].id,
        creativeId: desktopTheme.desktopSidebar.id,
        deviceTypes: [DeviceType.DESKTOP],
        utilitySlugs: [u.slug],
        priorityOverride: 100,
        weight: 100,
        isActive: true,
      },
    });

    // Rule 6: Mobile Sticky - Mobile & Tablet (Mobile Theme - Different Game)
    await prisma.adTargetingRule.create({
      data: {
        campaignId: mobileTheme.campaign.id,
        placementId: createdPlacements[PlacementCode.MOBILE_STICKY].id,
        creativeId: mobileTheme.mobileSticky.id,
        deviceTypes: [DeviceType.MOBILE, DeviceType.TABLET],
        utilitySlugs: [u.slug],
        priorityOverride: 100,
        weight: 100,
        isActive: true,
      },
    });
  }

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
