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
import { AdminUsersService } from '../services/admin-users.service';
import { AdminPaginationQueryDto } from '../dto/admin-query.dto';
import { AdminCreateUserDto, AdminUpdateUserDto } from '../dto/admin-users.dto';
import { ApiResponse, JwtPayload } from '@ad-utility/shared';
import { Request } from 'express';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  @Get()
  @RequirePermissions('users:manage')
  async listUsers(@Query() query: AdminPaginationQueryDto): Promise<ApiResponse<any>> {
    const data = await this.usersService.listUsers(query);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get('roles')
  @RequirePermissions('roles:manage')
  async listRoles(): Promise<ApiResponse<any>> {
    const data = await this.usersService.listRoles();
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get(':id')
  @RequirePermissions('users:manage')
  async getUserById(@Param('id') id: string): Promise<ApiResponse<any>> {
    const data = await this.usersService.getUserById(id);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post()
  @RequirePermissions('users:manage')
  async createUser(
    @Body() dto: AdminCreateUserDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const data = await this.usersService.createUser(dto, user, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Patch(':id')
  @RequirePermissions('users:manage')
  async updateUser(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const data = await this.usersService.updateUser(id, dto, user, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }
}
