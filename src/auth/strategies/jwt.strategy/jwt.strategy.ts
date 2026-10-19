import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '@prisma/client';

import { AuthenticatedUser } from '../../interfaces/authenticated-user.interface.js';
import { PrismaService } from '../../../prisma/prisma.service.js';

/**
 * Contenu du JWT émis à la connexion.
 *
 * Exporté pour que les tests puissent construire des jetons typés : sans
 * annotation explicite, un littéral comme `{ role: 'ADMIN' }` s'infère en
 * `string` et non en `Role`, ce que `tsc` refuse.
 */
export type JwtPayload = {
    sub: number;
    imatricule:string;
    email:string;
    role:Role;
    /** Incrémenté à chaque changement de mot de passe. */
    tokenVersion:number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly prisma: PrismaService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET!,
        });
    }

    /**
     * Le JWT est sans état : sans cette vérification, un jeton reste valide
     * jusqu'à expiration (8 h) même après un changement de mot de passe ou
     * une réinitialisation. Comparer `tokenVersion` à la base transforme ces
     * changements en déconnexion forcée de toutes les sessions ouvertes.
     *
     * On relit aussi `role` et `email` depuis la base : le rôle d'un jeton
     * étant figé à la connexion, un rétrogradage administratif ne prendrait
     * sinon effet qu'à l'expiration.
     */
    async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: {
                id: true,
                imatricule: true,
                email: true,
                role: true,
                tokenVersion: true,
            },
        });

        if (!user) {
            throw new UnauthorizedException('Compte introuvable ou supprimé');
        }

        if (payload.tokenVersion !== user.tokenVersion) {
            throw new UnauthorizedException(
                'Session révoquée : le mot de passe a été modifié',
            );
        }

        return {
            id: user.id,
            email: user.email,
            role: user.role,
            imatricule: user.imatricule,
        };
    };
}