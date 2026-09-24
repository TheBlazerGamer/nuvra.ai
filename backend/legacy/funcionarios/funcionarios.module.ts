import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FuncionariosController } from './funcionarios.controller.js';
import { FuncionariosService } from './funcionarios.service.js';
import { FuncionarioJwtStrategy } from '../auth/funcionario-jwt.strategy.js';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('STAFF_JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('STAFF_JWT_EXPIRES_IN', '12h') as unknown as number,
        },
      }),
    }),
  ],
  controllers: [FuncionariosController],
  providers: [FuncionariosService, FuncionarioJwtStrategy],
})
export class FuncionariosModule {}
