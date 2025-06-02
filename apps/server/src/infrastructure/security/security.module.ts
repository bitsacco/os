import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Services
import { SecurityService } from './security.service';
import { CsrfService } from './csrf.service';
import { EncryptionService } from './encryption.service';

// Middleware
import { SecurityHeadersMiddleware } from './middleware/security-headers.middleware';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    SecurityService,
    CsrfService,
    EncryptionService,
    SecurityHeadersMiddleware,
    RateLimitMiddleware,
  ],
  exports: [
    SecurityService,
    CsrfService,
    EncryptionService,
    SecurityHeadersMiddleware,
    RateLimitMiddleware,
  ],
})
export class SecurityModule {}
