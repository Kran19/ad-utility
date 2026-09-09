import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, IsInt, IsArray } from 'class-validator';
import { UtilityExecutionMode, UtilityStatus } from '@prisma/client';
import { AdminPaginationQueryDto } from './admin-query.dto';

export class AdminListUtilitiesQueryDto extends AdminPaginationQueryDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(UtilityStatus)
  status?: UtilityStatus;
}

export class AdminCreateUtilityDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsOptional()
  @IsEnum(UtilityExecutionMode)
  implementationMode?: UtilityExecutionMode = UtilityExecutionMode.LOCAL;

  @IsOptional()
  @IsEnum(UtilityStatus)
  status?: UtilityStatus = UtilityStatus.DRAFT;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean = false;

  @IsOptional()
  @IsInt()
  displayOrder?: number = 0;

  @IsString()
  @IsNotEmpty()
  seoTitle!: string;

  @IsString()
  @IsNotEmpty()
  seoDescription!: string;

  @IsOptional()
  @IsString()
  canonicalUrl?: string;

  @IsOptional()
  faqContent?: any[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedSlugs?: string[];

  @IsOptional()
  config?: Record<string, any>;

  @IsOptional()
  @IsString()
  version?: string;
}

export class AdminUpdateUtilityDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(UtilityExecutionMode)
  implementationMode?: UtilityExecutionMode;

  @IsOptional()
  @IsEnum(UtilityStatus)
  status?: UtilityStatus;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsString()
  seoTitle?: string;

  @IsOptional()
  @IsString()
  seoDescription?: string;

  @IsOptional()
  @IsString()
  canonicalUrl?: string;

  @IsOptional()
  faqContent?: any[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedSlugs?: string[];

  @IsOptional()
  config?: Record<string, any>;

  @IsOptional()
  @IsString()
  version?: string;
}

export class AdminCreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number = 0;
}

export class AdminUpdateCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;
}
