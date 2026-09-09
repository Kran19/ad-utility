# Phase 27: Utility Catalog Expansion Documentation

## Overview
Phase 27 expands the platform's utility catalog with high-demand, organic search oriented utilities across Image, PDF, Video, Audio, and QR/Barcode categories.

---

## Catalog Breakdown

### 1. Image Tools
- **`image-to-pdf`**: Converts single or multiple JPG/PNG images into a clean PDF with custom page size (A4, Letter, Fit), orientation, and margins.
- **`image-resizer`**: Resizes JPG, PNG, WebP by dimensions or percentage scale with aspect ratio lock.
- **`image-cropper`**: Crops images to preset ratios (1:1, 4:3, 16:9) or custom bounding boxes with rotation support.
- **`webp-to-jpg`**: Converts WebP images to JPEG with configurable quality and background compositing.
- **`jpg-to-webp`**: Converts JPG images to WebP format with quality control.
- **`png-to-webp`**: Converts PNG images to WebP while preserving alpha channel transparency.

### 2. PDF Tools
- **`pdf-to-png`**: Renders PDF pages to high-resolution PNGs and packages multiple pages into a ZIP archive.
- **`pdf-to-text`**: Extracts selectable digital text per page with word and character statistics.
- **`pdf-page-extractor`**: Extracts specific page ranges (e.g. `1-3, 5, 8`) into a new PDF document.
- **`pdf-rotator`**: Rotates all or selected PDF pages permanently by 90°, 180°, or 270°.
- **`pdf-reorder-pages`**: Rearranges and organizes page order with visual precision.
- **`pdf-watermark`**: Stamps custom text watermarks across PDF pages with controllable opacity and angles.
- **`pdf-metadata-remover`**: Strips Author, Title, Subject, Keywords, Creator, and Producer document metadata.

### 3. Video & Audio Tools
- **`video-compressor`**: Compresses MP4 and WebM videos using FFmpeg with CRF and resolution control (Max 50MB, 30s timeout).
- **`mp4-to-mp3`**: Extracts crystal-clear audio tracks from MP4 video into MP3 format (128k - 320k).
- **`video-to-gif`**: Converts short video segments into lightweight animated GIFs with customizable FPS.
- **`video-trimmer`**: Cuts video clips with millisecond precision without quality degradation.
- **`audio-cutter`**: Cuts and trims audio tracks (MP3, WAV, OGG, M4A) with start/end timestamp controls.

### 4. QR & Barcode Tools
- **`qr-code-generator`**: Generates high-resolution QR codes locally for URLs, text, email, phone, and WiFi credentials.

---

## Security & Resource Limits
- **Execution Sandboxing**: FFmpeg invocations use `spawn` with argument arrays only, no shell interpretation.
- **Timeouts**: Image operations max 10–15s; Video/Audio max 25–30s.
- **Temporary Files**: Created with UUID filenames in `os.tmpdir()` and cleaned up in `finally` blocks.
- **Magic Bytes**: Enforced across JPEG, PNG, WebP, PDF payloads before processing.
