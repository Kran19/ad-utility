import { IsNotEmpty, IsObject } from 'class-validator';

export class AdminUpdateSettingDto {
  @IsObject()
  @IsNotEmpty()
  value!: Record<string, any>;
}
