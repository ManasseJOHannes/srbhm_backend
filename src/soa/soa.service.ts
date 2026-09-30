import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateSoaDto } from './dto/create-soa.dto.js';
import { UpdateSoaDto } from './dto/update-soa.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SoaService {
  constructor(private readonly prisma: PrismaService) {}
  async create(createSoaDto: CreateSoaDto) {
    const existingSoa = await this.prisma.sOA.findUnique({
      where: {
        code: createSoaDto.code,
      }
    })
    if (existingSoa) {
      throw new ConflictException(
        `Le code SOA ${createSoaDto.code} existe déjà`
      )
    }
    return this.prisma.sOA.create({
      data: {
        code: createSoaDto.code,
        libelle: createSoaDto.libelle,
        description: createSoaDto.description,
        actif: createSoaDto.actif ?? true
      }
    });
  }

  findAll() {
    return this.prisma.sOA.findMany({
      orderBy: {
        code: 'asc'
      }
    });
  }

  async findOne(id: number) {
    const soa = await this.prisma.sOA.findUnique({
      where: {
        id,
      }
    })
    if (!soa) {
      throw new NotFoundException(
        `SOA avec l'id ${id} introuvable`
      )
    }
    return soa;
  }

  async update(id: number, updateSoaDto: UpdateSoaDto) {
    await this.findOne(id)
    if (updateSoaDto.code){
      const existingSoa = await this.prisma.sOA.findFirst({
        where:{
          code:updateSoaDto.code,
          NOT: {
            id,
          }
        }
      })
      if (existingSoa){
        throw new ConflictException(
          `Le code SOA ${updateSoaDto.code} existe déjà`
        )
      }
    }
    return this.prisma.sOA.update({
      where: {
        id,
      },
      data: updateSoaDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id)
    return this.prisma.sOA.delete({
      where:{
        id
      }
    });
  }
}
