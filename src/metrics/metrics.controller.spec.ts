import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import * as promClient from 'prom-client';

// Mock Express Response
const mockResponse = () => {
  const res: any = {};
  res.set = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  return res;
};

describe('MetricsController', () => {
  let controller: MetricsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);

    // Clear Prometheus registry between tests
    promClient.register.clear();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMetrics', () => {
    it('should return metrics with correct content type', async () => {
      const res = mockResponse();
      const mockMetrics = 'test_metric{label="value"} 1';

      jest.spyOn(promClient.register, 'metrics').mockResolvedValue(mockMetrics);

      await controller.getMetrics(res);

      expect(res.set).toHaveBeenCalledWith(
        'Content-Type',
        promClient.register.contentType,
      );
      expect(res.send).toHaveBeenCalledWith(mockMetrics);
    });

    it('should handle errors gracefully', async () => {
      const res = mockResponse();
      const error = new Error('Metrics error');

      jest.spyOn(promClient.register, 'metrics').mockRejectedValue(error);
      jest.spyOn(console, 'error').mockImplementation();

      await controller.getMetrics(res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Error fetching metrics');
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching metrics:',
        error,
      );
    });
  });
});
