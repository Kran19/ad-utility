# SEO Architecture Specification

## 1. Overview
Search Engine Optimization is built into the utility registry and page dynamic metadata generators. Every single utility page dynamically outputs complete Open Graph tags, Twitter Cards, Canonical URLs, and JSON-LD structured schemas.

---

## 2. Dynamic Metadata & Schemas
- **Title Tag**: `{Utility Name} - Free Online Tool | PlatformName`
- **Meta Description**: Configurable per utility in `UtilityRegistry`.
- **Canonical Link**: `https://{domain}/{utility-slug}`
- **JSON-LD Schema**:
  - `WebApplication` schema with feature capabilities.
  - `FAQPage` schema automatically populated from utility FAQ definitions.
  - `BreadcrumbList` schema (`Home` > `{Category}` > `{Utility Name}`).

---

## 3. Dynamic Sitemap & Robots.txt
- Next.js dynamic route `app/sitemap.ts` queries `UtilityRegistry` and dynamic blog posts to output `sitemap.xml`.
- Dynamic `robots.txt` allowing crawler indexation of tool pages while disallowing `/admin` and `/api` endpoints.
