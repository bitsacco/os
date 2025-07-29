import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Logger, NotFoundException } from '@nestjs/common';
import { AbstractRepository } from './abstract.repository';
import { AbstractDocument } from './abstract.schema';

class TestDocument extends AbstractDocument {
  name: string;
}

class TestRepository extends AbstractRepository<TestDocument> {
  protected readonly logger = new Logger(TestRepository.name);
}

describe('AbstractRepository', () => {
  let repository: TestRepository;
  let model: Model<TestDocument>;

  const mockModel = {
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findOneAndDelete: jest.fn(),
    aggregate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestRepository,
        {
          provide: getModelToken(TestDocument.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    repository = new TestRepository(mockModel as any);
    model = module.get<Model<TestDocument>>(getModelToken(TestDocument.name));

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('findOneAndUpdateWithVersion', () => {
    it('should update document when version matches', async () => {
      const mockDoc = {
        _id: 'test-id',
        name: 'test',
        __v: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockModel.findOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockDoc),
      });

      const result = await repository.findOneAndUpdateWithVersion(
        { _id: 'test-id' },
        { name: 'updated' },
        0,
      );

      expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'test-id', __v: 0 },
        expect.objectContaining({
          name: 'updated',
          $inc: { __v: 1 },
        }),
        { new: true },
      );
      expect(result).toEqual(mockDoc);
    });

    it('should throw NotFoundException when version does not match', async () => {
      mockModel.findOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await expect(
        repository.findOneAndUpdateWithVersion(
          { _id: 'test-id' },
          { name: 'updated' },
          5,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when document not found', async () => {
      mockModel.findOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await expect(
        repository.findOneAndUpdateWithVersion(
          { _id: 'non-existent' },
          { name: 'updated' },
          0,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneAndUpdate', () => {
    it('should increment version on update', async () => {
      const mockDoc = {
        _id: 'test-id',
        name: 'test',
        __v: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockModel.findOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockDoc),
      });

      await repository.findOneAndUpdate(
        { _id: 'test-id' },
        { name: 'updated' },
      );

      expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'test-id' },
        expect.objectContaining({
          name: 'updated',
          $inc: { __v: 1 },
        }),
        { new: true },
      );
    });
  });
});