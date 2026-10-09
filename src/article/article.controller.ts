import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  UseGuards,
  Req
} from '@nestjs/common';
import { ArticleService } from './article.service.js';
import { CreateArticleDto } from './dto/create-article.dto.js';
import { UpdateArticleDto } from './dto/update-article.dto.js';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { AuthGuard } from '@nestjs/passport';

@Controller('article')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Post()
  create(@Body() createArticleDto: CreateArticleDto) {
    return this.articleService.create(createArticleDto);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    Role.DEPOSITEUR_COMPTABLE,
    Role.COMPTABLE,
  )
  @Get()
  findAll() {
    return this.articleService.findAll();
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    Role.DEPOSITEUR_COMPTABLE,
    Role.COMPTABLE,
  )
  @Get('disponibles-sortie/:exerciceId')
  findArticlesDisponiblesSortie(
    @Param('exerciceId') exerciceId: string,
    @Req() req: any,
  ) {
    return this.articleService.findArticlesDisponiblesSortie(
      +exerciceId,
      req.user,
    );
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    Role.DEPOSITEUR_COMPTABLE,
    Role.COMPTABLE,
  )
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articleService.findOne(+id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.DEPOSITEUR_COMPTABLE,
    Role.COMPTABLE
  )
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateArticleDto: UpdateArticleDto,
  ) {
    return this.articleService.update(+id, updateArticleDto);
  }



  // @UseGuards(AuthGuard('jwt'), RolesGuard)
  // @Roles(Role.DEPOSITEUR_COMPTABLE)
  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.articleService.remove(+id);
  // }
}
