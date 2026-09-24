import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class FuncionarioAuthGuard extends AuthGuard('jwt-funcionario') {}
