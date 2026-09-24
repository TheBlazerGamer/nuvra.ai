import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('saude')
  saude() {
    return { status: 'ok' };
  }
}
