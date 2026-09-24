import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentFuncionario = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as { funcionarioId: string; email: string };
  },
);
