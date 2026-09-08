# Search Engine Launch & Indexing Checklist

**Version:** 1.0.0  
**Phase:** 13 (Production Launch & Monetization Readiness)  
**Status:** READY FOR OPERATIONAL EXECUTION  
**Verification Disclaimer:** Search engine indexing and ranking cannot be executed autonomously inside code repositories. This document details the verified technical foundations and the human operator step-by-step checklist required upon production DNS and domain activation. Do not claim indexing success until verified in external webmaster consoles.

---

## 1. Verified In-Repository Technical Foundations

The following technical SEO assets are implemented and verified in the application code:

| Asset | Implementation Path | Production URL Route | Verification Status |
| :--- | :--- | :--- | :--- |
| **Robots Exclusion** | `apps/frontend/src/app/robots.ts` | `/robots.txt` | **VERIFIED** (Automated Smoke Test #4) |
| **XML Sitemap** | `apps/frontend/src/app/sitemap.ts` | `/sitemap.xml` | **VERIFIED** (Automated Smoke Test #5) |
| **Canonical Links** | `apps/frontend/src/components/seo/JsonLd.tsx`, Root Layout | All public routes | **VERIFIED** (Smoke Test #1) |
| **Schema.org JSON-LD** | `WebApplication`, `BreadcrumbList`, `FAQPage` | Public category & utility routes | **VERIFIED** (Phase 10 SEO Test Suite) |
| **Admin Disallow** | `robots.ts` (`Disallow: /admin`) | `/admin/*` | **VERIFIED** (Prevents private crawling) |
| **Favicon & Manifest** | `apps/frontend/public/` | `/favicon.ico`, `/site.webmanifest` | **VERIFIED** |

---

## 2. Pre-Launch Technical Verification (Pre-Flight)

Before submitting URLs to external search engines, run the following commands:

```bash
# 1. Verify robots.txt renders cleanly and disallows /admin
curl -i https://YOUR_PRODUCTION_DOMAIN/robots.txt

# Expected response:
# User-Agent: *
# Allow: /
# Disallow: /admin
# Disallow: /api/
# Sitemap: https://YOUR_PRODUCTION_DOMAIN/sitemap.xml

# 2. Verify XML sitemap contains all 19 public static routes
curl -i https://YOUR_PRODUCTION_DOMAIN/sitemap.xml

# 3. Verify security headers (X-Robots-Tag, Canonical, etc.)
curl -sI https://YOUR_PRODUCTION_DOMAIN/json-formatter | grep -E "(canonical|x-robots-tag)"
```

---

## 3. Step-by-Step Operator Checklist

### Step 1 — Domain Property Verification
- [ ] **Google Search Console (GSC):**
  1. Navigate to [Google Search Console](https://search.google.com/search-console).
  2. Add **Domain property** (recommended over URL-prefix property).
  3. Copy the provided `TXT` DNS record and paste it into your DNS registrar (e.g., Cloudflare, Route53, Namecheap).
  4. Wait for DNS propagation and click **Verify**.
- [ ] **Bing Webmaster Tools (BWT):**
  1. Navigate to [Bing Webmaster Tools](https://www.bing.com/webmasters).
  2. Choose **Import from Google Search Console** for instant verification, or verify via DNS TXT record.

### Step 2 — XML Sitemap Submission
- [ ] **Submit Sitemap in GSC:**
  1. Go to **Sitemaps** in the left navigation.
  2. Enter `sitemap.xml` under *Add a new sitemap*.
  3. Click **Submit**.
  4. Verify that status displays green `Success` and that 19 discovered URLs are registered.
- [ ] **Submit Sitemap in BWT:**
  1. Go to **Sitemaps** in Bing Webmaster Tools.
  2. Enter `https://YOUR_PRODUCTION_DOMAIN/sitemap.xml` and click **Submit**.

### Step 3 — URL Inspection & Live Test (First 5 Priority Pages)
Perform live inspection in GSC on the core landing and highest-traffic utility routes:
1. `https://YOUR_PRODUCTION_DOMAIN/` (Homepage)
2. `https://YOUR_PRODUCTION_DOMAIN/json-formatter` (Developer Category)
3. `https://YOUR_PRODUCTION_DOMAIN/image-compressor` (Image Category)
4. `https://YOUR_PRODUCTION_DOMAIN/pdf-split` (PDF Category)
5. `https://YOUR_PRODUCTION_DOMAIN/word-counter` (Text Category)

- [ ] Click **Test Live URL**.
- [ ] Confirm:
  - Page is indexable (Status: `URL is available to Google`).
  - Mobile usability passes (no elements too close, viewport set).
  - Structured data (`WebApplication`, `Breadcrumbs`) detected without errors.
- [ ] Click **Request Indexing**.

### Step 4 — Open Graph & Social Card Crawl Verification
- [ ] Test Homepage and representative tool on [Twitter / X Card Validator](https://cards-dev.twitter.com/validator).
- [ ] Test on [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) to verify `og:image`, `og:title`, and `og:description`.
- [ ] Confirm social preview cards generate without truncation.

### Step 5 — Broken Link & Noindex Audit
- [ ] Run a crawling audit using Screaming Frog SEO Spider or open-source crawler:
  ```bash
  npx broken-link-checker https://YOUR_PRODUCTION_DOMAIN -ro
  ```
- [ ] Verify 0 broken internal links (0 `404 Not Found`).
- [ ] Verify no public utility pages have unintentional `noindex` meta tags.
- [ ] Verify `/admin` returns `401` or `noindex` headers.

---

## 4. Post-Launch Monitoring (Day 1 – Day 30)

| Cadence | Metric / Action | Expected Benchmark |
| :--- | :--- | :--- |
| **Day 1** | Check GSC Coverage / Index Status | URLs transitioned to "Discovered - currently not indexed" |
| **Day 3** | Index Verification Search: `site:YOUR_PRODUCTION_DOMAIN` | Homepage and top utilities appear in search results |
| **Day 7** | GSC Core Web Vitals Report | LCP < 2.5s, FID/INP < 200ms, CLS < 0.1 |
| **Day 14** | Impressions & Queries Report | Review search queries triggering impressions |
| **Day 30** | Rich Snippet Check | Verify FAQ and breadcrumb rich snippets in SERPs |

---

## 5. Explicit Constraints & Policy

> [!CAUTION]
> - Do NOT purchase spam backlink packages or link farm directory submissions.
> - Do NOT attempt to cloaking or serve different HTML content to Googlebot than to regular users.
> - All 12 MVP utilities must provide genuine client-side utility value before ads are triggered.
