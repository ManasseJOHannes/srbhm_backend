import { IsString, MinLength } from "class-validator";

export class RejectUserRequestDto {
    @IsString()
    @MinLength(3)
    reason:string
}