import { Body, Controller, Post, UseGuards, Get } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthGuard } from '@nestjs/passport';
import { LoginDto } from './dto/login.dto.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface.js';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}
    @Post('login')
    async login(@Body() LoginDto: LoginDto) {
        return this.authService.login(LoginDto);
    }
    @UseGuards(AuthGuard('jwt'))
    @Get('me')
    getMe(@CurrentUser() user: AuthenticatedUser) {
        return user;
    }
}
