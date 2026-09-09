import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AdminUtilitiesService } from '../services/admin-utilities.service';
import { AdminPaginationQueryDto } from '../dto/admin-query.dto';
import {
  AdminCreateUtilityDto,
  AdminUpdateUtilityDto,
  AdminCreateCategoryDto,
  AdminUpdateCategoryDto,
  AdminListUtilitiesQueryDto,
} from '../dto/admin-utilities.dto';
import { ApiResponse, JwtPayload } from '@ad-utility/shared';
import { Request } from 'express';

@Controller('admin/utilities')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminUtilitiesController {
  constructor(private readonly utilitiesService: AdminUtilitiesService) {}

  @Get()
  @RequirePermissions('utilities:read')
  async listUtilities(
    @Query() query: AdminListUtilitiesQueryDto,
  ): Promise<ApiResponse<any>> {
    const data = await this.utilitiesService.listUtilities(query);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get('categories')
  @RequirePermissions('utilities:read')
  async listCategories(): Promise<ApiResponse<any>> {
    const data = await this.utilitiesService.listCategories();
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post('categories')
  @RequirePermissions('categories:manage')
  async createCategory(
    @Body() dto: AdminCreateCategoryDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const data = await this.utilitiesService.createCategory(dto, user, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Patch('categories/:id')
  @RequirePermissions('categories:manage')
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: AdminUpdateCategoryDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const data = await this.utilitiesService.updateCategory(id, dto, user, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get(':id')
  @RequirePermissions('utilities:read')
  async getUtilityById(@Param('id') id: string): Promise<ApiResponse<any>> {
    const data = await this.utilitiesService.getUtilityById(id);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post()
  @RequirePermissions('utilities:create')
  async createUtility(
    @Body() dto: AdminCreateUtilityDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const data = await this.utilitiesService.createUtility(dto, user, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Patch(':id')
  @RequirePermissions('utilities:update')
  async updateUtility(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUtilityDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const data = await this.utilitiesService.updateUtility(id, dto, user, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }
}
