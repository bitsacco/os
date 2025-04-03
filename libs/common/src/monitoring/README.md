# Metrics Collection for Bitsacco OS

This module provides standardized metrics collection for Bitsacco OS services using OpenTelemetry.

## Components

- **HttpMetricsInterceptor**: Automatically collects metrics for HTTP requests
- **GrpcMetricsInterceptor**: Automatically collects metrics for gRPC requests
- **DatabaseMetricsMiddleware**: Collects metrics for database operations
- **MetricsIntegration**: Helper functions to integrate metrics collection

## Usage

### HTTP Metrics

Add the HTTP metrics interceptor to your NestJS application:

```typescript
import { NestFactory } from '@nestjs/core';
import { CoreMetricsService, HttpMetricsInterceptor } from '@bitsacco/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const metricsService = app.get(CoreMetricsService);
  
  // Apply HTTP metrics interceptor
  app.useGlobalInterceptors(new HttpMetricsInterceptor(metricsService));
  
  await app.listen(3000);
}
bootstrap();
```

Or use the integration helper:

```typescript
import { NestFactory } from '@nestjs/core';
import { CoreMetricsService, MetricsIntegration } from '@bitsacco/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const metricsService = app.get(CoreMetricsService);
  
  // Apply HTTP metrics interceptor
  MetricsIntegration.applyHttpMetricsInterceptor(app, metricsService);
  
  await app.listen(3000);
}
bootstrap();
```

### gRPC Metrics

Add the gRPC metrics interceptor to your NestJS microservice:

```typescript
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { CoreMetricsService, GrpcMetricsInterceptor } from '@bitsacco/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const metricsService = app.get(CoreMetricsService);
  
  // Connect microservice
  const microservice = app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'auth',
      protoPath: 'path/to/proto',
    },
  });
  
  // Apply gRPC metrics interceptor
  app.useGlobalInterceptors(new GrpcMetricsInterceptor(metricsService));
  
  await app.startAllMicroservices();
}
bootstrap();
```

### Database Metrics

Apply the database metrics middleware to your Mongoose schemas:

```typescript
import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { Prop } from '@nestjs/mongoose';
import { AbstractDocument } from '@bitsacco/common';
import { DatabaseMetricsMiddleware } from '@bitsacco/common';

@Schema({ collection: 'users' })
export class User extends AbstractDocument {
  @Prop({ required: true })
  name: string;
  
  @Prop({ required: true })
  email: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Apply database metrics middleware
export function applyMetricsMiddleware(middleware: DatabaseMetricsMiddleware) {
  middleware.applyMiddleware(UserSchema, 'users');
}
```

Then in your module:

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema, applyMetricsMiddleware } from './schemas/user.schema';
import { DatabaseMetricsMiddleware, CoreMetricsService } from '@bitsacco/common';

@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: User.name,
        useFactory: (databaseMetricsMiddleware: DatabaseMetricsMiddleware) => {
          applyMetricsMiddleware(databaseMetricsMiddleware);
          return UserSchema;
        },
        inject: [DatabaseMetricsMiddleware],
      },
    ]),
  ],
  providers: [CoreMetricsService, DatabaseMetricsMiddleware],
})
export class UsersModule {}
```

### Apply All Metrics Interceptors

To apply all metrics interceptors at once:

```typescript
import { NestFactory } from '@nestjs/core';
import { CoreMetricsService, MetricsIntegration } from '@bitsacco/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const metricsService = app.get(CoreMetricsService);
  
  // Apply all metrics interceptors
  MetricsIntegration.applyAllMetricsInterceptors(app, metricsService);
  
  await app.listen(3000);
}
bootstrap();
```

## Metrics Schema

The metrics follow a standardized naming convention:

- HTTP: `core.api.*` (requests, duration, errors)
- gRPC: `core.grpc.*` (requests, duration, errors)
- Database: `core.database.*` (operations, duration, errors)

Each metric includes relevant labels such as:

- HTTP: method, path, statusCode, success
- gRPC: service, method, success, errorType
- Database: operation, collection, success, errorType