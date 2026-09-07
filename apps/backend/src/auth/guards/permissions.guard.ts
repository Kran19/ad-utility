import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from '@ad-utility/shared';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user) {
      throw new ForbiddenException('Access denied: unauthenticated context');
    }

    // SUPER_ADMIN has access to all permission-guarded resources
    if (user.roles && user.roles.includes('SUPER_ADMIN')) {
      return true;
    }

    if (!user.permissions || user.permissions.length === 0) {
      throw new ForbiddenException('Access denied: user has no assigned permissions');
    }

    const hasAllPermissions = requiredPermissions.every((perm) =>
      user.permissions.includes(perm),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        `Access denied: missing required permission(s) [${requiredPermissions.join(', ')}]`,
      );
    }

    return true;
  }
}
