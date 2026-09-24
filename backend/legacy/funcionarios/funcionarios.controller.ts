import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { FuncionariosService } from './funcionarios.service.js';
import { LoginFuncionarioDto } from './dto/login-funcionario.dto.js';

@Controller('funcionarios')
export class FuncionariosController {
  constructor(private readonly funcionariosService: FuncionariosService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginFuncionarioDto) {
    return this.funcionariosService.login(dto);
  }
}
