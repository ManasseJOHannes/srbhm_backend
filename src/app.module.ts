import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UserRequestsModule } from './user-requests/user-requests.module.js';
import { SoaModule } from './soa/soa.module.js';
import { ExercicesModule } from './exercices/exercices.module.js';
@Module({
  imports: [PrismaModule, UsersModule, AuthModule, UserRequestsModule, SoaModule, ExercicesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
