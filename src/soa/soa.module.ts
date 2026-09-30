import { Module } from '@nestjs/common';
import { SoaService } from './soa.service.js';
import { SoaController } from './soa.controller.js';

@Module({
  controllers: [SoaController],
  providers: [SoaService],
})
export class SoaModule {}
