import { IsNotEmpty, IsString} from 'class-validator';
export class LoginDto {
  @IsString()
  @IsNotEmpty({message: 'Tsy maintsy ampidirina ny identifier'})
  identifier:string;

  @IsString()
  @IsNotEmpty({message:'Tsy maintsy ampidirina ny password'})
  password: string;
}