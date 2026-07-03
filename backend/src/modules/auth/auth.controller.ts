import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './auth.types';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';

@ApiTags('auth')
@ApiStandardErrors()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Create a new organization + owner account and sign in' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    return new ApiResponse(await this.authService.register(dto, req), 'Account created');
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Authenticate and receive access + refresh tokens' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return new ApiResponse(await this.authService.login(dto, req), 'Logged in');
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate a refresh token for a new token pair' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return new ApiResponse(await this.authService.refresh(dto, req), 'Token refreshed');
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revoke the current session (or all sessions)' })
  async logout(@Body() dto: LogoutDto, @CurrentUser() user: AuthenticatedUser) {
    await this.authService.logout(user, dto);
    return new ApiResponse({ success: true }, 'Logged out');
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password-reset token' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const result = await this.authService.forgotPassword(dto);
    return new ApiResponse(result, result.message);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset a password using a reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return new ApiResponse({ success: true }, 'Password reset');
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Change your own password' })
  async changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: AuthenticatedUser) {
    await this.authService.changePassword(user, dto);
    return new ApiResponse({ success: true }, 'Password changed');
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user profile + effective permissions' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.usersService.getProfile(user.id);
    return new ApiResponse({
      id: user.id,
      email: user.email,
      firstName: profile?.firstName,
      lastName: profile?.lastName,
      organizationId: user.organizationId,
      departmentId: user.departmentId,
      roles: user.roles,
      permissions: user.permissions,
      isSuperAdmin: user.isSuperAdmin,
    });
  }
}
