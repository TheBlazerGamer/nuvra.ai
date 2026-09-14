import { Controller, Get } from '@nestjs/common';
import { PlanosService } from './planos.service.js';

@Controller('planos')
export class PlanosController {
  constructor(private readonly planosService: PlanosService) {}

  @Get()
  findAll() {
    return this.planosService.findAll();
  }
}
