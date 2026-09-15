export interface ToolCatalogItem {
  slug: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  description: string;
  keywords: string[];
}

/**
 * Verified list of all active tools that exist in the system.
 */
export const ALL_TOOLS_CATALOG: ToolCatalogItem[] = [
  // 1. Image Tools (9 tools)
  {
    slug: 'jpg-to-png',
    name: 'JPG to PNG Converter',
    categorySlug: 'image',
    categoryName: 'Image Tools',
    description: 'Convert JPEG images to lossless PNG format with transparent alpha support.',
    keywords: ['jpg', 'jpeg', 'png', 'convert', 'image', 'picture', 'photo', 'transparency'],
  },
  {
    slug: 'png-to-jpg',
    name: 'PNG to JPG Converter',
    categorySlug: 'image',
    categoryName: 'Image Tools',
    description: 'Convert transparent PNG images to compact, high-quality JPG files.',
    keywords: ['png', 'jpg', 'jpeg', 'convert', 'image', 'photo', 'picture', 'compress'],
  },
  {
    slug: 'image-compressor',
    name: 'Image Compressor',
    categorySlug: 'image',
    categoryName: 'Image Tools',
    description: 'Compress JPEG, PNG, and WebP images to reduce file sizes while maintaining high visual clarity.',
    keywords: ['compress', 'reduce size', 'optimize', 'shrink', 'image', 'jpg', 'png', 'photo', 'file size'],
  },
  {
    slug: 'image-to-pdf',
    name: 'Image to PDF Converter',
    categorySlug: 'image',
    categoryName: 'Image Tools',
    description: 'Convert single or multiple JPG and PNG images into a clean, combined PDF document.',
    keywords: ['image to pdf', 'jpg to pdf', 'png to pdf', 'convert', 'pdf', 'document'],
  },
  {
    slug: 'image-resizer',
    name: 'Image Resizer',
    categorySlug: 'image',
    categoryName: 'Image Tools',
    description: 'Resize JPG, PNG, and WebP images by exact pixel dimensions or percentage.',
    keywords: ['resize', 'dimensions', 'width', 'height', 'scale', 'image', 'pixels', 'photo'],
  },
  {
    slug: 'image-cropper',
    name: 'Image Cropper',
    categorySlug: 'image',
    categoryName: 'Image Tools',
    description: 'Crop images to standard aspect ratios (1:1, 4:3, 16:9) or custom bounding boxes.',
    keywords: ['crop', 'cut', 'aspect ratio', 'square', 'instagram', 'image', 'photo'],
  },
  {
    slug: 'webp-to-jpg',
    name: 'WebP to JPG Converter',
    categorySlug: 'image',
    categoryName: 'Image Tools',
    description: 'Convert modern WebP images to universal JPEG format with clean white background blending.',
    keywords: ['webp', 'jpg', 'jpeg', 'convert', 'image', 'google webp', 'photo'],
  },
  {
    slug: 'jpg-to-webp',
    name: 'JPG to WebP Converter',
    categorySlug: 'image',
    categoryName: 'Image Tools',
    description: 'Convert JPG images to modern WebP format for faster web page loading and smaller file sizes.',
    keywords: ['jpg', 'jpeg', 'webp', 'convert', 'image', 'optimize', 'speed'],
  },
  {
    slug: 'png-to-webp',
    name: 'PNG to WebP Converter',
    categorySlug: 'image',
    categoryName: 'Image Tools',
    description: 'Convert PNG graphics into compressed, modern WebP format while preserving transparency.',
    keywords: ['png', 'webp', 'convert', 'image', 'graphics', 'optimize', 'transparency'],
  },

  // 2. PDF Tools (11 tools)
  {
    slug: 'pdf-compressor',
    name: 'PDF Compressor',
    categorySlug: 'pdf',
    categoryName: 'PDF Tools',
    description: 'Compress and optimize PDF documents with stream compression to reduce file size.',
    keywords: ['pdf compress', 'shrink pdf', 'reduce pdf size', 'pdf optimize', 'document size'],
  },
  {
    slug: 'pdf-merge',
    name: 'PDF Merge',
    categorySlug: 'pdf',
    categoryName: 'PDF Tools',
    description: 'Combine multiple PDF files into a single organized document.',
    keywords: ['merge pdf', 'combine pdf', 'join pdf', 'attach pdf', 'pdf files'],
  },
  {
    slug: 'pdf-split',
    name: 'PDF Split',
    categorySlug: 'pdf',
    categoryName: 'PDF Tools',
    description: 'Extract individual pages or specified page ranges from any PDF document.',
    keywords: ['split pdf', 'cut pdf', 'separate pdf', 'extract pdf pages'],
  },
  {
    slug: 'pdf-to-jpg',
    name: 'PDF to JPG Converter',
    categorySlug: 'pdf',
    categoryName: 'PDF Tools',
    description: 'Render and export PDF document pages into high-resolution JPG images.',
    keywords: ['pdf to jpg', 'pdf to image', 'convert pdf', 'pdf export'],
  },
  {
    slug: 'pdf-to-png',
    name: 'PDF to PNG Converter',
    categorySlug: 'pdf',
    categoryName: 'PDF Tools',
    description: 'Convert PDF document pages to crisp, high-resolution PNG images with transparency support.',
    keywords: ['pdf to png', 'pdf to image', 'convert pdf', 'export png'],
  },
  {
    slug: 'pdf-to-text',
    name: 'PDF to Text Extractor',
    categorySlug: 'pdf',
    categoryName: 'PDF Tools',
    description: 'Extract digital selectable text from PDF documents cleanly into a text file.',
    keywords: ['pdf to text', 'extract text from pdf', 'pdf reader', 'copy pdf text'],
  },
  {
    slug: 'pdf-page-extractor',
    name: 'PDF Page Extractor',
    categorySlug: 'pdf',
    categoryName: 'PDF Tools',
    description: 'Extract specific pages or custom page ranges into a new standalone PDF document.',
    keywords: ['extract pdf pages', 'save pdf pages', 'select pdf pages'],
  },
  {
    slug: 'pdf-rotator',
    name: 'PDF Rotator',
    categorySlug: 'pdf',
    categoryName: 'PDF Tools',
    description: 'Rotate PDF pages permanently by 90°, 180°, or 270° with layout preservation.',
    keywords: ['rotate pdf', 'turn pdf', 'fix orientation', 'portrait to landscape'],
  },
  {
    slug: 'pdf-reorder-pages',
    name: 'PDF Reorder Pages',
    categorySlug: 'pdf',
    categoryName: 'PDF Tools',
    description: 'Rearrange, sort, and organize PDF pages visually to create a customized document sequence.',
    keywords: ['reorder pdf', 'sort pdf pages', 'rearrange pdf', 'organize pdf'],
  },
  {
    slug: 'pdf-watermark',
    name: 'PDF Watermark',
    categorySlug: 'pdf',
    categoryName: 'PDF Tools',
    description: 'Add custom text watermarks, confidential stamps, or copyright notices across PDF pages.',
    keywords: ['watermark pdf', 'stamp pdf', 'protect pdf', 'add text to pdf'],
  },
  {
    slug: 'pdf-metadata-remover',
    name: 'PDF Metadata Remover',
    categorySlug: 'pdf',
    categoryName: 'PDF Tools',
    description: 'Strip document author names, timestamps, and metadata from PDF files for privacy.',
    keywords: ['remove pdf metadata', 'sanitize pdf', 'clear author', 'pdf privacy'],
  },

  // 3. Text Tools (3 tools)
  {
    slug: 'word-counter',
    name: 'Word & Character Counter',
    categorySlug: 'text',
    categoryName: 'Text Tools',
    description: 'Accurately count words, characters, sentences, and estimated reading time.',
    keywords: ['word counter', 'character counter', 'word count', 'reading time', 'text length'],
  },
  {
    slug: 'text-cleaner',
    name: 'Text Cleaner',
    categorySlug: 'text',
    categoryName: 'Text Tools',
    description: 'Clean up messy text by normalizing whitespace, stripping blank lines, and fixing line breaks.',
    keywords: ['clean text', 'remove spaces', 'remove extra lines', 'format text'],
  },
  {
    slug: 'case-converter',
    name: 'Case Converter',
    categorySlug: 'text',
    categoryName: 'Text Tools',
    description: 'Convert text between UPPERCASE, lowercase, Title Case, camelCase, snake_case, and kebab-case.',
    keywords: ['case converter', 'uppercase', 'lowercase', 'title case', 'camelcase', 'snake case', 'kebab case'],
  },

  // 4. Developer Tools (2 tools)
  {
    slug: 'json-formatter',
    name: 'JSON Formatter & Validator',
    categorySlug: 'developer',
    categoryName: 'Developer Tools',
    description: 'Format, prettify, and validate JSON data instantly in your browser.',
    keywords: ['json formatter', 'json validator', 'beautify json', 'prettify json', 'json lint'],
  },
  {
    slug: 'text-hash',
    name: 'Cryptographic Text Hash Generator',
    categorySlug: 'developer',
    categoryName: 'Developer Tools',
    description: 'Generate secure SHA-256 and SHA-512 cryptographic hashes for text strings.',
    keywords: ['hash generator', 'sha256', 'sha512', 'hash string', 'cryptography', 'md5'],
  },

  // 5. AI Utilities (4 tools)
  {
    slug: 'ai-summarizer',
    name: 'AI Text Summarizer',
    categorySlug: 'ai',
    categoryName: 'AI Utilities',
    description: 'Summarize long articles, reports, and essays into clear key takeaways.',
    keywords: ['ai summarize', 'article summary', 'tldr', 'bullet points', 'ai summary'],
  },
  {
    slug: 'ai-humanizer',
    name: 'AI Humanizer',
    categorySlug: 'ai',
    categoryName: 'AI Utilities',
    description: 'Refine and improve AI-assisted text to read naturally with fluent human rhythm and phrasing.',
    keywords: ['ai humanizer', 'humanize ai text', 'natural writing', 'human tone', 'ai rewrite'],
  },
  {
    slug: 'ai-paraphraser',
    name: 'AI Paraphraser',
    categorySlug: 'ai',
    categoryName: 'AI Utilities',
    description: 'Rephrase sentences and rewrite paragraphs clearly while preserving essential meaning.',
    keywords: ['ai paraphrase', 'rephrase text', 'rewrite sentence', 'word spinner', 'paraphrase'],
  },
  {
    slug: 'ai-grammar-checker',
    name: 'AI Grammar Checker',
    categorySlug: 'ai',
    categoryName: 'AI Utilities',
    description: 'Find and fix grammatical mistakes, punctuation errors, spelling typos, and stylistic issues.',
    keywords: ['grammar checker', 'spell check', 'fix grammar', 'proofreading', 'typos'],
  },

  // 6. Video Tools (4 tools)
  {
    slug: 'video-compressor',
    name: 'Video Compressor',
    categorySlug: 'video',
    categoryName: 'Video Tools',
    description: 'Compress MP4 and WebM videos to reduce file size significantly for easy sharing.',
    keywords: ['video compress', 'reduce video size', 'mp4 compressor', 'shrink video'],
  },
  {
    slug: 'mp4-to-mp3',
    name: 'MP4 to MP3 Converter',
    categorySlug: 'video',
    categoryName: 'Video Tools',
    description: 'Extract high-fidelity audio tracks from MP4 video files into standalone MP3 format.',
    keywords: ['mp4 to mp3', 'extract audio', 'video to audio', 'save mp3', 'audio extractor'],
  },
  {
    slug: 'video-to-gif',
    name: 'Video to GIF Converter',
    categorySlug: 'video',
    categoryName: 'Video Tools',
    description: 'Convert video clips into lightweight, animated GIF animations with customizable speed.',
    keywords: ['video to gif', 'make gif', 'animated gif', 'mp4 to gif'],
  },
  {
    slug: 'video-trimmer',
    name: 'Video Trimmer',
    categorySlug: 'video',
    categoryName: 'Video Tools',
    description: 'Cut and trim video segments with millisecond precision without losing quality.',
    keywords: ['trim video', 'cut video', 'shorten video', 'clip video'],
  },

  // 7. Audio Tools (1 tool)
  {
    slug: 'audio-cutter',
    name: 'Audio Cutter',
    categorySlug: 'audio',
    categoryName: 'Audio Tools',
    description: 'Cut and trim MP3 and audio tracks with precision to create ringtones, clips, and soundbites.',
    keywords: ['cut audio', 'trim audio', 'make ringtone', 'mp3 cutter', 'song cutter', 'audio trimmer'],
  },

  // 8. QR & Barcode (1 tool)
  {
    slug: 'qr-code-generator',
    name: 'QR Code Generator',
    categorySlug: 'qr-barcode',
    categoryName: 'QR & Barcode',
    description: 'Generate high-resolution QR codes for websites, WiFi networks, text, email, and vCards.',
    keywords: ['qr code', 'generate qr', 'custom qr', 'wifi qr', 'barcode', 'scan'],
  },
];

export function searchToolsCatalog(query: string, maxResults: number = 8): ToolCatalogItem[] {
  const clean = query.toLowerCase().trim();
  if (!clean) return [];

  return ALL_TOOLS_CATALOG.filter((item) => {
    // 1. Direct name or slug match
    if (item.name.toLowerCase().includes(clean) || item.slug.toLowerCase().includes(clean)) {
      return true;
    }
    // 2. Category match
    if (item.categoryName.toLowerCase().includes(clean) || item.categorySlug.toLowerCase().includes(clean)) {
      return true;
    }
    // 3. Keywords match
    if (item.keywords.some((kw) => kw.toLowerCase().includes(clean))) {
      return true;
    }
    // 4. Description match
    if (item.description.toLowerCase().includes(clean)) {
      return true;
    }
    return false;
  }).slice(0, maxResults);
}
