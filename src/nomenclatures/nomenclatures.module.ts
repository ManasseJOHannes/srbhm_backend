import { Module } from '@nestjs/common';
import { NomenclaturesService } from './nomenclatures.service.js';
import { NomenclaturesController } from './nomenclatures.controller.js';

@Module({
  controllers: [NomenclaturesController],
  providers: [NomenclaturesService],
})
export class NomenclaturesModule {}
