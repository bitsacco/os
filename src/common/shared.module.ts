import { Global, Module } from '@nestjs/common';
import { JwtConfigModule } from './jwt-config.module';
import { LoggerModule } from './logger/logger.module';
import { DatabaseModule } from './database/database.module';
import { TimeoutConfigService } from './services';
import { FedimintModule } from './fedimint';

/**
 * SharedModule provides common modules that are used across the application.
 * This module is marked as @Global to make its exports available everywhere.
 * Note: ConfigModule and EventEmitterModule are already configured as global in ApiModule,
 * so they don't need to be re-imported here.
 */
@Global()
@Module({
  imports: [
    // JwtConfigModule with default configuration
    JwtConfigModule.forRoot(),

    // Common modules
    LoggerModule,
    DatabaseModule,
    FedimintModule,
  ],
  providers: [TimeoutConfigService],
  exports: [
    JwtConfigModule,
    LoggerModule,
    DatabaseModule,
    TimeoutConfigService,
    FedimintModule,
  ],
})
export class SharedModule {}
