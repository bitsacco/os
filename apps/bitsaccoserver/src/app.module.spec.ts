import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';

describe('AppModule', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('SWAP_SERVICE')
      .useValue({
        getService: () => ({
          createSwap: jest.fn(),
          getSwap: jest.fn(),
          listSwaps: jest.fn(),
          getExchangeRate: jest.fn(),
          cancelSwap: jest.fn(),
        }),
      })
      .compile();
  });

  it('should be defined', () => {
    expect(app).toBeDefined();
  });

  afterAll(async () => {
    await app.close();
  });
});
