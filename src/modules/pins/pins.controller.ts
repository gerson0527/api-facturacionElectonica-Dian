import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PinsService } from './pins.service';

@Controller('auth/pin')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PinsController {
  constructor(private pins: PinsService) {}

  @Post('set')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async set(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { pin: string },
  ) {
    await this.pins.setPin(tenantId, user.sub, body.pin);
    return { ok: true };
  }

  @Post('verify')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async verify(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { pin: string; action?: string; resourceId?: string },
  ) {
    const ok = await this.pins.verifyPin(tenantId, user.sub, body.pin);
    // Log para auditoría
    console.log(`[PIN-AUDIT] user=${user.sub} action=${body.action} resource=${body.resourceId} result=${ok}`);
    return { ok };
  }
}
