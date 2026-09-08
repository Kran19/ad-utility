import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsArray,
  IsDateString,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { CampaignStatus, CreativeType, PlacementCode, DeviceType } from '@prisma/client';

export class AdminCreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus = CampaignStatus.DRAFT;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number = 50;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  weight?: number = 100;

  @IsOptional()
  @IsInt()
  @Min(1)
  dailyImpressionCap?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalImpressionCap?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class AdminUpdateCampaignDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  weight?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  dailyImpressionCap?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalImpressionCap?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class AdminCreateCreativeDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(CreativeType)
  type!: CreativeType;

  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\//i, { message: 'mediaUrl must use http:// or https:// protocol' })
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\//i, { message: 'targetUrl must use http:// or https:// protocol' })
  targetUrl?: string;

  @IsOptional()
  @IsInt()
  width?: number;

  @IsOptional()
  @IsInt()
  height?: number;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @IsString()
  customHtml?: string;

  @IsOptional()
  @IsBoolean()
  isGlobalFallback?: boolean = false;
}

export class AdminUpdateCreativeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(CreativeType)
  type?: CreativeType;

  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\//i, { message: 'mediaUrl must use http:// or https:// protocol' })
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\//i, { message: 'targetUrl must use http:// or https:// protocol' })
  targetUrl?: string;

  @IsOptional()
  @IsInt()
  width?: number;

  @IsOptional()
  @IsInt()
  height?: number;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @IsString()
  customHtml?: string;

  @IsOptional()
  @IsBoolean()
  isGlobalFallback?: boolean;
}

export class AdminUpdatePlacementDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(CreativeType, { each: true })
  supportedTypes?: CreativeType[];
}

export class AdminCreateTargetingRuleDto {
  @IsString()
  @IsNotEmpty()
  campaignId!: string;

  @IsString()
  @IsNotEmpty()
  placementId!: string;

  @IsString()
  @IsNotEmpty()
  creativeId!: string;

  @IsOptional()
  @IsArray()
  @IsEnum(DeviceType, { each: true })
  deviceTypes?: DeviceType[] = [DeviceType.MOBILE, DeviceType.TABLET, DeviceType.DESKTOP];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  utilitySlugs?: string[] = [];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categorySlugs?: string[] = [];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[] = [];

  @IsOptional()
  @IsInt()
  priorityOverride?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  weight?: number = 100;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class AdminUpdateTargetingRuleDto {
  @IsOptional()
  @IsString()
  creativeId?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(DeviceType, { each: true })
  deviceTypes?: DeviceType[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  utilitySlugs?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categorySlugs?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];

  @IsOptional()
  @IsInt()
  priorityOverride?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  weight?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminCreateScheduleDto {
  @IsString()
  @IsNotEmpty()
  campaignId!: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  startHour?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  endHour?: number = 23;

  @IsOptional()
  @IsString()
  timezone?: string = 'UTC';
}

export class AdminUpdateScheduleDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  startHour?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  endHour?: number;

  @IsOptional()
  @IsString()
  timezone?: string;
}
