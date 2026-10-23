import { Injectable, NotFoundException, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { UpdateMeDto } from './dto/update-me.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { MailService } from '../mail/mail.service.js';

/** Durée de validité d'un lien de réinitialisation. */
export const DUREE_JETON_RESET_MINUTES = 30;

/** Réponse volontairement identique, que le compte existe ou non. */
const REPONSE_NEUTRE =
    'Si un compte correspond à cet identifiant, un email vient d\'être envoyé.';

/** Projection commune à `me`, `updateMe` : jamais le hash de mot de passe. */
const PROFIL_ME = {
    id: true,
    imatricule: true,
    nom: true,
    prenom: true,
    cin: true,
    telephone: true,
    adresse: true,
    civilite: true,
    qualite: true,
    email: true,
    role: true,
    soa: { select: { id: true, code: true, libelle: true } },
    createdAt: true,
    updatedAt: true,
} as const;

/** Hash SHA-256 d'un jeton opaque, en hexadécimal. */
function hacherJeton(jeton: string): string {
    return createHash('sha256').update(jeton).digest('hex');
}

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly mailService: MailService,
    ) {}

    /**
     * Invalide toutes les sessions ouvertes de l'utilisateur.
     *
     * Le JWT est sans état : sans cet incrément, un jeton émis avant le
     * changement de mot de passe resterait valide jusqu'à son expiration.
     */
    private async incrementerTokenVersion(userId: number) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { tokenVersion: { increment: 1 } },
        });
    }

    async validateUser(loginDto: LoginDto) {
        const user = await this.prisma.user.findFirst({
            where: { 
              OR: [
                { email: loginDto.identifier },
                { imatricule: loginDto.identifier }
              ]
            },
        });
        if (!user) {
            throw new UnauthorizedException('Email ou matricule ou mot de passe incorrect');
        }

        const passwordValid = await bcrypt.compare(loginDto.password, user.password);
        if (!passwordValid) {
            throw new UnauthorizedException('Email ou matricule ou mot de passe incorrect');
        }
        return {
            id: user.id,
            imatricule: user.imatricule,
            email: user.email,
            nom: user.nom,
            role: user.role,
            tokenVersion: user.tokenVersion,
        }
    }
    async login(LoginDto: LoginDto) {
        const user = await this.validateUser(LoginDto);
        const payload = {
            sub: user.id,
            role: user.role,
            imatricule: user.imatricule,
            email: user.email,
            // Copié dans le jeton : permet de révoquer les sessions ouvertes.
            tokenVersion: user.tokenVersion,
        };

        const accesstoken = await this.jwtService.signAsync(
            payload,
        );
        return {
            accesstoken: accesstoken,
            user,
        };
    }

    /** Profil complet de l'utilisateur authentifié (GET /auth/me). */
    async me(userId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: PROFIL_ME,
        });
        if (!user) {
            throw new NotFoundException('Utilisateur introuvable');
        }
        return user;
    }

    /**
     * Auto-modification limitée aux coordonnées de contact et aux mentions
     * d'identité utilisées dans les exports (PATCH /auth/me).
     *
     * Le whitelist est un littéral : seuls email / telephone / adresse /
     * civilite / qualite proviennent du corps de la requête. Rôle, SOA,
     * matricule, CIN, nom et prénom ne peuvent donc pas être modifiés par
     * l'intéressé, même si la validation DTO était contournée. Survit à une
     * régression de la configuration du ValidationPipe global.
     */
    async updateMe(userId: number, dto: UpdateMeDto) {
        await this.me(userId); // 404 si l'utilisateur n'existe plus

        const data: {
            email?: string;
            telephone?: string;
            adresse?: string;
            civilite?: string | null;
            qualite?: string | null;
        } = {};

        if (dto.email !== undefined) {
            const autre = await this.prisma.user.findUnique({
                where: { email: dto.email },
                select: { id: true },
            });
            if (autre && autre.id !== userId) {
                throw new ConflictException(
                    `L'adresse email ${dto.email} est déjà utilisée par un autre utilisateur`,
                );
            }
            data.email = dto.email;
        }

        if (dto.telephone !== undefined) {
            const autre = await this.prisma.user.findUnique({
                where: { telephone: dto.telephone },
                select: { id: true },
            });
            if (autre && autre.id !== userId) {
                throw new ConflictException(
                    `Le numéro de téléphone ${dto.telephone} est déjà utilisé par un autre utilisateur`,
                );
            }
            data.telephone = dto.telephone;
        }

        if (dto.adresse !== undefined) {
            data.adresse = dto.adresse;
        }

        if (dto.civilite !== undefined) {
            data.civilite = dto.civilite?.trim() || null;
        }

        if (dto.qualite !== undefined) {
            data.qualite = dto.qualite?.trim() || null;
        }

        if (Object.keys(data).length > 0) {
            await this.prisma.user.update({ where: { id: userId }, data });
        }

        return this.me(userId);
    }

    /**
     * Changement de son propre mot de passe (PATCH /auth/me/password).
     * Le mot de passe actuel est vérifié avant toute écriture.
     */
    async changePassword(userId: number, dto: ChangePasswordDto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { password: true },
        });
        if (!user) {
            throw new NotFoundException('Utilisateur introuvable');
        }

        const actuelValide = await bcrypt.compare(dto.currentPassword, user.password);
        if (!actuelValide) {
            throw new UnauthorizedException('Mot de passe actuel incorrect');
        }

        const identique = await bcrypt.compare(dto.newPassword, user.password);
        if (identique) {
            throw new ConflictException(
                "Le nouveau mot de passe doit être différent de l'ancien",
            );
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: { password: await bcrypt.hash(dto.newPassword, 10) },
        });

        // Déconnecte toutes les sessions ouvertes, y compris celles d'un
        // eventual interieur qui aurait obtenu le mot de passe.
        await this.incrementerTokenVersion(userId);

        return { message: 'Mot de passe modifié avec succès' };
    }

    /**
     * Demande de réinitialisation (POST /auth/mdp-oublie).
     *
     * La réponse est identique que le compte existe ou non : sans cela, un
     * attaquant pourrait tester des matricules et apprendre quels agents
     * ont un compte. Aucun compte en base de démonstration n'ayant d'email,
     * ce cas se comporte comme un compte inexistant.
     */
    async demanderReinitialisation(dto: ForgotPasswordDto) {
        const identifiant = dto.identifier.trim();

        const user = await this.prisma.user.findFirst({
            where: {
                OR: [{ imatricule: identifiant }, { email: identifiant }],
            },
            select: { id: true, email: true, nom: true, prenom: true, imatricule: true },
        });

        if (user?.email) {
            const jeton = randomBytes(32).toString('hex');
            const expiresAt = new Date(
                Date.now() + DUREE_JETON_RESET_MINUTES * 60 * 1000,
            );

            // Usage unique strict : une seule demande active par compte.
            await this.prisma.passwordResetToken.deleteMany({
                where: { userId: user.id, usedAt: null },
            });

            await this.prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    // Seule la racine est stockée : la base ne contient
                    // jamais le jeton utilisable.
                    tokenHash: hacherJeton(jeton),
                    expiresAt,
                },
            });

            await this.mailService.sendPasswordResetNotification({
                email: user.email,
                nom: user.nom,
                prenom: user.prenom,
                token: jeton,
                expiresInMinutes: DUREE_JETON_RESET_MINUTES,
            });
        }

        return { message: REPONSE_NEUTRE };
    }

    /** État d'un jeton, pour afficher un message clair avant le formulaire. */
    async verifierJetonReinitialisation(jeton: string) {
        const enregistrement = await this.trouverJetonValide(jeton);
        return {
            valide: enregistrement !== null,
            // Ne précise pas *pourquoi* : n'informe pas sur l'état interne.
            message: enregistrement
                ? 'Jeton valide.'
                : 'Jeton invalide ou expiré.',
        };
    }

    /**
     * Consommation du jeton (POST /auth/reinitialiser-mdp).
     *
     * Après changement du mot de passe, le jeton est marqué `usedAt` et
     * `tokenVersion` est incrémenté : le lien ne sert plus et toutes les
     * sessions ouvertes tombent.
     */
    async reinitialiserMotDePasse(dto: ResetPasswordDto) {
        const enregistrement = await this.trouverJetonValide(dto.token);
        if (!enregistrement) {
            throw new BadRequestException(
                'Ce lien est invalide ou a expiré. Veuillez recommencer.',
            );
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: enregistrement.userId },
                data: {
                    password: await bcrypt.hash(dto.newPassword, 10),
                    // Invalide aussi le lien : un seul usage.
                    tokenVersion: { increment: 1 },
                },
            });
            await tx.passwordResetToken.update({
                where: { id: enregistrement.id },
                data: { usedAt: new Date() },
            });
        });

        return { message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' };
    }

    /**
     * Retrouve un jeton valide : existant, non utilisé, non expiré.
     * Toute erreur d'exécution est traduite en null, jamais exposée.
     */
    private async trouverJetonValide(jeton: string) {
        if (typeof jeton !== 'string' || jeton.length === 0) return null;

        const enregistrement = await this.prisma.passwordResetToken.findUnique({
            where: { tokenHash: hacherJeton(jeton) },
        });

        if (!enregistrement) return null;
        if (enregistrement.usedAt !== null) return null;
        if (enregistrement.expiresAt.getTime() < Date.now()) return null;

        return enregistrement;
    }
}
