import { IsEmail, IsString, IsNotEmpty, MinLength, IsOptional, IsBoolean, IsArray, IsEnum } from 'class-validator';
import { RoleType } from '@prisma/client';

export class AdminCreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password!: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsArray()
  @IsEnum(RoleType, { each: true })
  @IsNotEmpty()
  roles!: RoleType[];
}

export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(RoleType, { each: true })
  roles?: RoleType[];
}
