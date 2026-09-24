import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentCliente } from '../auth/current-cliente.decorator.js';
import { CriativosService } from './criativos.service.js';

class AnalisarCriativoDto {
  @IsString()
  objetivoCampanha: string;
}

const TAMANHO_MAXIMO_BYTES = 200 * 1024 * 1024; // 200MB

@Controller('criativos')
@UseGuards(JwtAuthGuard)
export class CriativosController {
  constructor(private readonly criativosService: CriativosService) {}

  @Get()
  listar(@CurrentCliente() cliente: { clienteId: string }) {
    return this.criativosService.listarPorCliente(cliente.clienteId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('arquivo', { limits: { fileSize: TAMANHO_MAXIMO_BYTES } }))
  upload(
    @CurrentCliente() cliente: { clienteId: string },
    @UploadedFile() arquivo?: Express.Multer.File,
  ) {
    if (!arquivo) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    return this.criativosService.upload(cliente.clienteId, arquivo);
  }

  @Post(':id/analisar')
  analisar(
    @CurrentCliente() cliente: { clienteId: string },
    @Param('id') criativoId: string,
    @Body() dto: AnalisarCriativoDto,
  ) {
    return this.criativosService.analisar(cliente.clienteId, criativoId, dto.objetivoCampanha);
  }
}
