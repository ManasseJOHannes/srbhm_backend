import { Module } from '@nestjs/common';
import { UserRequestsService } from './user-requests.service.js';
import { UserRequestsController } from './user-requests.controller.js';

@Module({
  controllers: [UserRequestsController],
  providers: [UserRequestsService],
})
export class UserRequestsModule {}
