import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

export async function createTestingModuleWithValidation(metadata: any) {
  const app: TestingModule = await Test.createTestingModule(metadata).compile();
  await app.createNestApplication().useGlobalPipes(new ValidationPipe()).init();
  return app;
}
