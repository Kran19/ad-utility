-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'EDITOR', 'ANALYST');

-- CreateEnum
CREATE TYPE "UtilityExecutionMode" AS ENUM ('LOCAL', 'SERVER', 'AI');

-- CreateEnum
CREATE TYPE "UtilityStatus" AS ENUM ('ACTIVE', 'DRAFT', 'DISABLED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CreativeType" AS ENUM ('IMAGE', 'VIDEO', 'HTML', 'IFRAME');

-- CreateEnum
CREATE TYPE "PlacementCode" AS ENUM ('HEADER_BANNER', 'TOP_CONTENT', 'AFTER_TOOL', 'MID_CONTENT', 'BOTTOM_CONTENT', 'SIDEBAR', 'MOBILE_STICKY', 'DESKTOP_STICKY');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('MOBILE', 'TABLET', 'DESKTOP');

-- CreateEnum
CREATE TYPE "AiRequestStatus" AS ENUM ('SUCCESS', 'FAILED', 'RATE_LIMITED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" "RoleType" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "actorIp" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utility_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "utility_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilities" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "implementationMode" "UtilityExecutionMode" NOT NULL DEFAULT 'LOCAL',
    "status" "UtilityStatus" NOT NULL DEFAULT 'ACTIVE',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "seoTitle" TEXT NOT NULL,
    "seoDescription" TEXT NOT NULL,
    "canonicalUrl" TEXT,
    "faqContent" JSONB DEFAULT '[]',
    "relatedSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "config" JSONB DEFAULT '{}',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "utilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "weight" INTEGER NOT NULL DEFAULT 100,
    "dailyImpressionCap" INTEGER,
    "totalImpressionCap" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_creatives" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CreativeType" NOT NULL DEFAULT 'IMAGE',
    "mediaUrl" TEXT,
    "targetUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "altText" TEXT,
    "customHtml" TEXT,
    "isGlobalFallback" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_creatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_placements" (
    "id" TEXT NOT NULL,
    "code" "PlacementCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "supportedTypes" "CreativeType"[] DEFAULT ARRAY['IMAGE', 'VIDEO', 'HTML', 'IFRAME']::"CreativeType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_targeting_rules" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "deviceTypes" "DeviceType"[] DEFAULT ARRAY['MOBILE', 'TABLET', 'DESKTOP']::"DeviceType"[],
    "utilitySlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categorySlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priorityOverride" INTEGER,
    "weight" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_targeting_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_schedules" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startHour" INTEGER NOT NULL DEFAULT 0,
    "endHour" INTEGER NOT NULL DEFAULT 23,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_impressions" (
    "id" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "utilitySlug" TEXT,
    "deviceType" "DeviceType" NOT NULL DEFAULT 'DESKTOP',
    "country" TEXT,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "sessionToken" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_impressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_clicks" (
    "id" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "utilitySlug" TEXT,
    "deviceType" "DeviceType" NOT NULL DEFAULT 'DESKTOP',
    "country" TEXT,
    "ipHash" TEXT,
    "sessionToken" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_requests" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "utilitySlug" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTemplate" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "status" "AiRequestStatus" NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "ipHash" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "utilitySlug" TEXT,
    "placementCode" TEXT,
    "creativeId" TEXT,
    "sessionToken" TEXT,
    "anonymousId" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "description" TEXT,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_action_key" ON "permissions"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_idx" ON "audit_logs"("actorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "utility_categories_slug_key" ON "utility_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "utilities_slug_key" ON "utilities"("slug");

-- CreateIndex
CREATE INDEX "utilities_status_displayOrder_idx" ON "utilities"("status", "displayOrder");

-- CreateIndex
CREATE INDEX "utilities_categoryId_idx" ON "utilities"("categoryId");

-- CreateIndex
CREATE INDEX "ad_campaigns_status_startDate_endDate_idx" ON "ad_campaigns"("status", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "ad_campaigns_priority_idx" ON "ad_campaigns"("priority");

-- CreateIndex
CREATE INDEX "ad_creatives_type_idx" ON "ad_creatives"("type");

-- CreateIndex
CREATE INDEX "ad_creatives_isGlobalFallback_idx" ON "ad_creatives"("isGlobalFallback");

-- CreateIndex
CREATE UNIQUE INDEX "ad_placements_code_key" ON "ad_placements"("code");

-- CreateIndex
CREATE INDEX "ad_targeting_rules_placementId_isActive_idx" ON "ad_targeting_rules"("placementId", "isActive");

-- CreateIndex
CREATE INDEX "ad_targeting_rules_campaignId_idx" ON "ad_targeting_rules"("campaignId");

-- CreateIndex
CREATE INDEX "ad_targeting_rules_creativeId_idx" ON "ad_targeting_rules"("creativeId");

-- CreateIndex
CREATE INDEX "ad_schedules_campaignId_dayOfWeek_idx" ON "ad_schedules"("campaignId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "ad_impressions_timestamp_idx" ON "ad_impressions"("timestamp");

-- CreateIndex
CREATE INDEX "ad_impressions_campaignId_timestamp_idx" ON "ad_impressions"("campaignId", "timestamp");

-- CreateIndex
CREATE INDEX "ad_impressions_creativeId_timestamp_idx" ON "ad_impressions"("creativeId", "timestamp");

-- CreateIndex
CREATE INDEX "ad_impressions_utilitySlug_timestamp_idx" ON "ad_impressions"("utilitySlug", "timestamp");

-- CreateIndex
CREATE INDEX "ad_clicks_timestamp_idx" ON "ad_clicks"("timestamp");

-- CreateIndex
CREATE INDEX "ad_clicks_campaignId_timestamp_idx" ON "ad_clicks"("campaignId", "timestamp");

-- CreateIndex
CREATE INDEX "ad_clicks_creativeId_timestamp_idx" ON "ad_clicks"("creativeId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ai_requests_requestId_key" ON "ai_requests"("requestId");

-- CreateIndex
CREATE INDEX "ai_requests_timestamp_idx" ON "ai_requests"("timestamp");

-- CreateIndex
CREATE INDEX "ai_requests_utilitySlug_timestamp_idx" ON "ai_requests"("utilitySlug", "timestamp");

-- CreateIndex
CREATE INDEX "ai_requests_status_idx" ON "ai_requests"("status");

-- CreateIndex
CREATE INDEX "analytics_events_timestamp_idx" ON "analytics_events"("timestamp");

-- CreateIndex
CREATE INDEX "analytics_events_eventType_timestamp_idx" ON "analytics_events"("eventType", "timestamp");

-- CreateIndex
CREATE INDEX "analytics_events_utilitySlug_timestamp_idx" ON "analytics_events"("utilitySlug", "timestamp");

-- CreateIndex
CREATE INDEX "analytics_events_sessionToken_idx" ON "analytics_events"("sessionToken");

-- CreateIndex
CREATE INDEX "settings_category_idx" ON "settings"("category");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilities" ADD CONSTRAINT "utilities_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "utility_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_targeting_rules" ADD CONSTRAINT "ad_targeting_rules_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_targeting_rules" ADD CONSTRAINT "ad_targeting_rules_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "ad_placements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_targeting_rules" ADD CONSTRAINT "ad_targeting_rules_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "ad_creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_schedules" ADD CONSTRAINT "ad_schedules_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_impressions" ADD CONSTRAINT "ad_impressions_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "ad_creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_impressions" ADD CONSTRAINT "ad_impressions_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_impressions" ADD CONSTRAINT "ad_impressions_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "ad_placements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_clicks" ADD CONSTRAINT "ad_clicks_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "ad_creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_clicks" ADD CONSTRAINT "ad_clicks_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_clicks" ADD CONSTRAINT "ad_clicks_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "ad_placements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
