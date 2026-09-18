import { Injectable } from '@nestjs/common';
import { CreateUserRequestDto } from './dto/create-user-request.dto.js';
import { UpdateUserRequestDto } from './dto/update-user-request.dto.js';

@Injectable()
export class UserRequestsService {
  create(createUserRequestDto: CreateUserRequestDto) {
    return 'This action adds a new userRequest';
  }

  findAll() {
    return `This action returns all userRequests`;
  }

  findOne(id: number) {
    return `This action returns a #${id} userRequest`;
  }

  update(id: number, updateUserRequestDto: UpdateUserRequestDto) {
    return `This action updates a #${id} userRequest`;
  }

  remove(id: number) {
    return `This action removes a #${id} userRequest`;
  }
}
