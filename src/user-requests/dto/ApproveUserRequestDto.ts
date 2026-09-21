import { IsString, MinLength } from "class-validator";

export class ApproveUserRequestDto {
    @IsString()
    @MinLength(8)
    password:string;
}