import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface FuncionarioJwtPayload {
  sub: string;
  email: string;
  tipo: 'funcionario';
}

@Injectable()
export class FuncionarioJwtStrategy extends PassportStrategy(Strategy, 'jwt-funcionario') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('STAFF_JWT_SECRET'),
    });
  }

  validate(payload: FuncionarioJwtPayload) {
    if (payload.tipo !== 'funcionario') {
      throw new UnauthorizedException('Token inválido para este contexto.');
    }
    return { funcionarioId: payload.sub, email: payload.email };
  }
}
