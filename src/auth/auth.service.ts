import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService
    ) {}

    async validateUser(LoginDto: LoginDto) {
        const user = await this.prisma.user.findFirst({
            where: { 
              OR: [
                { email: LoginDto.email },
                { imatricule: LoginDto.imatricule }
              ]
            },
        });
        if (!user) {
            throw new UnauthorizedException('Email ou matricule ou mot de passe incorrect');
        }

        const passwordValid = await bcrypt.compare(LoginDto.password, user.password);
        if (!passwordValid) {
            throw new UnauthorizedException('Email ou matricule ou mot de passe incorrect');
        }
        return {
            id: user.id,
            imatricule: user.imatricule,
            email: user.email,
            nom: user.nom,
            role: user.role,
        }
    }
    async login(LoginDto: LoginDto) {
        const user = await this.validateUser(LoginDto);
        const payload = { 
            sub: user.id, 
            role: user.role,
            imatricule: user.imatricule,
            email: user.email
        };

        const accesstoken = await this.jwtService.signAsync(
            payload,
        );
        return {
            accesstoken: accesstoken,
            user,
        };
    }

}
