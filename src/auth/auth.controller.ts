import { Body, Controller, Post, UseGuards, Get, Patch, Query, Req, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthGuard } from '@nestjs/passport';
import { LoginDto } from './dto/login.dto.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface.js';
import { UpdateMeDto } from './dto/update-me.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { JournalAuditService } from '../journal-audit/journal-audit.service.js';
import { ACTIONS_AUDIT } from '../journal-audit/journal-audit.constants.js';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly journalAuditService: JournalAuditService,
    ) {}
    @Post('login')
    async login(@Body() LoginDto: LoginDto, @Req() req: any) {
        try {
            const result = await this.authService.login(LoginDto);
            await this.journalAuditService.enregistrer({
                action: ACTIONS_AUDIT.CONNEXION,
                auteurId: result.user.id,
                details: `Connexion réussie (${LoginDto.identifier})`,
                ip: req.ip,
            });
            return result;
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                await this.journalAuditService.enregistrer({
                    action: ACTIONS_AUDIT.CONNEXION_ECHOUEE,
                    details: `Tentative avec l'identifiant « ${LoginDto.identifier} »`,
                    ip: req.ip,
                });
            }
            throw error;
        }
    }

    /**
     * Profil de l'utilisateur authentifié.
     *
     * Renvoie l'enregistrement complet en base plutôt que le payload du JWT
     * (qui ne contient que id / imatricule / email / role).
     */
    @UseGuards(AuthGuard('jwt'))
    @Get('me')
    getMe(@CurrentUser() user: AuthenticatedUser) {
        return this.authService.me(user.id);
    }

    /**
     * Auto-modification des coordonnées de contact.
     *
     * Aucun @Roles : c'est du self-service, ouvert à tout utilisateur
     * authentifié. Le RolesGuard laisse passer quand aucun rôle n'est exigé.
     * Le service n'accepte que email / telephone / adresse.
     */
    @UseGuards(AuthGuard('jwt'))
    @Patch('me')
    updateMe(
        @CurrentUser() user: AuthenticatedUser,
        @Body() updateMeDto: UpdateMeDto,
    ) {
        return this.authService.updateMe(user.id, updateMeDto);
    }

    /** Changement de son propre mot de passe (mot de passe actuel exigé). */
    @UseGuards(AuthGuard('jwt'))
    @Patch('me/password')
    changePassword(
        @CurrentUser() user: AuthenticatedUser,
        @Body() changePasswordDto: ChangePasswordDto,
    ) {
        return this.authService.changePassword(user.id, changePasswordDto);
    }

    /**
     * Demande de réinitialisation (POST /auth/mdp-oublie).
     *
     * Publique : c'est précisément le cas d'usage d'un utilisateur déconnecté.
     * Réponse volontairement identique que le compte existe ou non, pour ne
     * pas révéler quels matricules sont enregistrés.
     */
    @Post('mdp-oublie')
    motDePasseOublie(@Body() forgotPasswordDto: ForgotPasswordDto) {
        return this.authService.demanderReinitialisation(forgotPasswordDto);
    }

    /** État d'un jeton de réinitialisation, pour piloter le formulaire. */
    @Get('mdp-oublie/verifier')
    verifierJeton(@Query('token') token: string) {
        return this.authService.verifierJetonReinitialisation(token);
    }

    /**
     * Consommation du jeton : nouveau mot de passe choisi par l'utilisateur.
     * Marque le jeton utilisé et révoque toutes les sessions ouvertes.
     */
    @Post('reinitialiser-mdp')
    reinitialiserMotDePasse(@Body() resetPasswordDto: ResetPasswordDto) {
        return this.authService.reinitialiserMotDePasse(resetPasswordDto);
    }
}