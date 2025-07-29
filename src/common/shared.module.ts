import { Global, Module } from '@nestjs/common';
import { JwtConfigModule } from './jwt-config.module';
import { LoggerModule } from './logger/logger.module';
import { DatabaseModule } from './database/database.module';

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
  ],
  exports: [JwtConfigModule, LoggerModule, DatabaseModule],
})
export class SharedModule {}
