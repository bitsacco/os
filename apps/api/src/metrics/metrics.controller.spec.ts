import axios from 'axios';
import { register } from 'prom-client';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';

describe('MetricsController', () => {
  let controller: MetricsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
    // Remove configService usage as it's never used
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMetrics', () => {
    it('should return metrics when all services are available', async () => {
      // Create a basic test that doesn't rely on mocking
      jest.spyOn(register, 'metrics').mockResolvedValue('api_metrics');
      jest
        .spyOn(axios, 'get')
        .mockResolvedValue({ status: 200, data: 'service_metrics' });

      const result = await controller.getMetrics();

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});
