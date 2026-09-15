import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Reflector } from "@nestjs/core";
import { AuthenticatedUser } from "../interfaces/authenticated-user.interface.js";

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector){}

    canActivate(context: ExecutionContext): boolean  {
        const requiredRoles = this.reflector.getAllAndOverride<Role[]>(
            'roles',
            [context.getHandler(), context.getClass()]
        );
        if (!requiredRoles){
            return true;
        }

        const request = context
            .switchToHttp()
            .getRequest<{ user: AuthenticatedUser}>();
        const user = request.user;

        if(!user){
            return false;
        }

        return requiredRoles.includes(user.role)

    }
}