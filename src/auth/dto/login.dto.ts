import { IsNotEmpty, IsString, MinLength} from 'class-validator';
export class LoginDto {
  @IsString()
  @IsNotEmpty({message: 'Tsy maintsy ampidirina ny identifier'})
  identifier:string;

  @IsString()
  @IsNotEmpty({message:'Tsy maintsy ampidirina ny password'})
  @MinLength(8)
  password: string;
}