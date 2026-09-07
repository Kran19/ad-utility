import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { RefreshTokenRequestDto } from '@ad-utility/shared';

export class RefreshTokenDto implements RefreshTokenRequestDto {
  @ApiProperty({ description: 'Valid JWT refresh token' })
  @IsString({ message: 'Refresh token must be a string' })
  @IsNotEmpty({ message: 'Refresh token is required' })
  refreshToken: string;
}
