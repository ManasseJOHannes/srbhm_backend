import {Role} from '@prisma/client'

export interface AuthenticatedUser {
    id: number;
    imatricule:string,
    email: string;
    role: Role;
}