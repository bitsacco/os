import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BaseRepository } from './base.repository';
import { AbstractDocument } from '@bitsacco/common/database';

// Test document interface
interface TestDocument extends AbstractDocument {
  name: string;
  email: string;
  status: string;
}

// Test repository implementation
class TestRepository extends BaseRepository<TestDocument> {}

describe('BaseRepository', () => {
  let repository: TestRepository;
  let mockModel: Partial<Model<TestDocument>>;

  beforeEach(async () => {
    mockModel = {
      findOne: jest.fn(),
      find: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      countDocuments: jest.fn(),
      save: jest.fn(),
      db: {
        startSession: jest.fn(),
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestRepository,
        {
          provide: getModelToken('Test'),
          useValue: mockModel,
        },
      ],
    }).compile();

    repository = new TestRepository(mockModel as Model<TestDocument>);
  });

  describe('create', () => {
    it('should create a new document', async () => {
      const documentData = {
        name: 'Test User',
        email: 'test@example.com',
        status: 'active',
      };

      const mockCreatedDoc = {
        ...documentData,
        _id: new Types.ObjectId(),
        save: jest.fn().mockResolvedValue({
          toJSON: () => ({ ...documentData, _id: 'test-id' }),
        }),
      };

      // Mock the model constructor
      (mockModel as any).mockImplementation = () => mockCreatedDoc;
      const TestModel = mockModel as any;
      TestModel.mockImplementation = () => mockCreatedDoc;

      // Create a new instance of the repository with the mocked model
      const testRepo = new (class extends BaseRepository<TestDocument> {
        constructor() {
          super({
            ...mockModel,
            constructor: TestModel,
          } as any);
        }

        async create(
          document: Omit<TestDocument, '_id'>,
        ): Promise<TestDocument> {
          const createdDocument = {
            ...document,
            _id: new Types.ObjectId(),
            save: mockCreatedDoc.save,
            toJSON: () => ({ ...document, _id: 'test-id' }),
          } as any;

          await createdDocument.save();
          return createdDocument.toJSON();
        }
      })();

      const result = await testRepo.create(documentData);

      expect(result).toEqual({
        ...documentData,
        _id: 'test-id',
      });
      expect(mockCreatedDoc.save).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should find a single document', async () => {
      const filterQuery = { email: 'test@example.com' };
      const expectedDoc = {
        _id: 'test-id',
        name: 'Test User',
        email: 'test@example.com',
      };

      (mockModel.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(expectedDoc),
      });

      const result = await repository.findOne(filterQuery);

      expect(mockModel.findOne).toHaveBeenCalledWith(
        filterQuery,
        {},
        undefined,
      );
      expect(result).toEqual(expectedDoc);
    });

    it('should return null when document not found', async () => {
      const filterQuery = { email: 'nonexistent@example.com' };

      (mockModel.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const result = await repository.findOne(filterQuery);

      expect(result).toBeNull();
    });
  });

  describe('find', () => {
    it('should find multiple documents', async () => {
      const filterQuery = { status: 'active' };
      const expectedDocs = [
        { _id: 'test-id-1', name: 'User 1', status: 'active' },
        { _id: 'test-id-2', name: 'User 2', status: 'active' },
      ];

      (mockModel.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(expectedDocs),
      });

      const result = await repository.find(filterQuery);

      expect(mockModel.find).toHaveBeenCalledWith(filterQuery, {}, undefined);
      expect(result).toEqual(expectedDocs);
    });
  });

  describe('findWithPagination', () => {
    it('should return paginated results', async () => {
      const filterQuery = { status: 'active' };
      const page = 2;
      const limit = 5;
      const expectedDocs = [
        { _id: 'test-id-6', name: 'User 6', status: 'active' },
        { _id: 'test-id-7', name: 'User 7', status: 'active' },
      ];
      const totalCount = 12;

      (mockModel.find as jest.Mock).mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(expectedDocs),
      });
      (mockModel.countDocuments as jest.Mock).mockResolvedValue(totalCount);

      const result = await repository.findWithPagination(
        filterQuery,
        page,
        limit,
      );

      expect(result).toEqual({
        documents: expectedDocs,
        total: totalCount,
        page,
        limit,
      });
    });
  });

  describe('findOneAndUpdate', () => {
    it('should update and return document', async () => {
      const filterQuery = { _id: 'test-id' };
      const updateQuery = { name: 'Updated Name' };
      const expectedDoc = {
        _id: 'test-id',
        name: 'Updated Name',
        email: 'test@example.com',
      };

      (mockModel.findOneAndUpdate as jest.Mock).mockResolvedValue(expectedDoc);

      const result = await repository.findOneAndUpdate(
        filterQuery,
        updateQuery,
      );

      expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
        filterQuery,
        updateQuery,
        { lean: true, new: true },
      );
      expect(result).toEqual(expectedDoc);
    });
  });

  describe('findOneAndDelete', () => {
    it('should delete and return document', async () => {
      const filterQuery = { _id: 'test-id' };
      const expectedDoc = {
        _id: 'test-id',
        name: 'Test User',
        email: 'test@example.com',
      };

      (mockModel.findOneAndDelete as jest.Mock).mockResolvedValue(expectedDoc);

      const result = await repository.findOneAndDelete(filterQuery);

      expect(mockModel.findOneAndDelete).toHaveBeenCalledWith(filterQuery, {
        lean: true,
      });
      expect(result).toEqual(expectedDoc);
    });
  });

  describe('deleteMany', () => {
    it('should delete multiple documents and return count', async () => {
      const filterQuery = { status: 'inactive' };
      const deletedCount = 3;

      (mockModel.deleteMany as jest.Mock).mockResolvedValue({ deletedCount });

      const result = await repository.deleteMany(filterQuery);

      expect(mockModel.deleteMany).toHaveBeenCalledWith(filterQuery, {
        session: undefined,
      });
      expect(result).toBe(deletedCount);
    });

    it('should return 0 when no documents deleted', async () => {
      const filterQuery = { status: 'nonexistent' };

      (mockModel.deleteMany as jest.Mock).mockResolvedValue({
        deletedCount: undefined,
      });

      const result = await repository.deleteMany(filterQuery);

      expect(result).toBe(0);
    });
  });

  describe('updateMany', () => {
    it('should update multiple documents and return count', async () => {
      const filterQuery = { status: 'pending' };
      const updateQuery = { status: 'active' };
      const modifiedCount = 5;

      (mockModel.updateMany as jest.Mock).mockResolvedValue({ modifiedCount });

      const result = await repository.updateMany(filterQuery, updateQuery);

      expect(mockModel.updateMany).toHaveBeenCalledWith(
        filterQuery,
        updateQuery,
        { session: undefined },
      );
      expect(result).toBe(modifiedCount);
    });
  });

  describe('exists', () => {
    it('should return true when document exists', async () => {
      const filterQuery = { email: 'test@example.com' };

      (mockModel.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({ _id: 'test-id' }),
      });

      const result = await repository.exists(filterQuery);

      expect(result).toBe(true);
    });

    it('should return false when document does not exist', async () => {
      const filterQuery = { email: 'nonexistent@example.com' };

      (mockModel.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      });

      const result = await repository.exists(filterQuery);

      expect(result).toBe(false);
    });
  });

  describe('executeInTransaction', () => {
    it('should execute operation within transaction', async () => {
      const mockSession = {
        withTransaction: jest.fn().mockImplementation((fn) => fn()),
        endSession: jest.fn(),
      };

      (mockModel.db!.startSession as jest.Mock).mockResolvedValue(mockSession);

      const operation = jest.fn().mockResolvedValue('test-result');
      const result = await repository.executeInTransaction(operation);

      expect(mockModel.db!.startSession).toHaveBeenCalled();
      expect(mockSession.withTransaction).toHaveBeenCalled();
      expect(operation).toHaveBeenCalledWith(mockSession);
      expect(mockSession.endSession).toHaveBeenCalled();
      expect(result).toBe('test-result');
    });

    it('should handle transaction errors properly', async () => {
      const mockSession = {
        withTransaction: jest
          .fn()
          .mockRejectedValue(new Error('Transaction failed')),
        endSession: jest.fn(),
      };

      (mockModel.db!.startSession as jest.Mock).mockResolvedValue(mockSession);

      const operation = jest.fn();

      await expect(repository.executeInTransaction(operation)).rejects.toThrow(
        'Transaction failed',
      );
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });
});
