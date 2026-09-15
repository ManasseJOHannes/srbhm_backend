import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Role } from "@prisma/client";
import { AuthenticatedUser } from "../../interfaces/authenticated-user.interface.js";

type JwtPayload = {
    sub: number;
    imatricule:string;
    email:string;
    role:Role;
}
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET!,
        });
}
async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    return { 
        id: payload.sub, 
        email: payload.email, 
        role: payload.role,
        imatricule: payload.imatricule
     };
 };
}
