import {Role} from '@prisma/client'

export interface AuthenticatedUser {
    id: number;
    imatricule:string,
    /** L'email est optionnel en base (aucun des comptes de démo n'en a). */
    email: string | null;
    role: Role;
}