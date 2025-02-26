import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model } from 'mongoose';
import { TokenRepository } from './token.repository';
import { TokenDocument } from './token.schema';

describe('TokenRepository', () => {
  let repository: TokenRepository;
  let tokenModel: Model<TokenDocument>;

  const mockTokenId = 'test-token-id';
  const mockUserId = 'test-user-id';

  const mockTokenDoc = {
    userId: mockUserId,
    tokenId: mockTokenId,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revoked: false,
  };

  beforeEach(async () => {
    // Create mock for TokenModel
    const mockTokenModel = {
      new: jest.fn().mockResolvedValue(mockTokenDoc),
      constructor: jest.fn().mockResolvedValue(mockTokenDoc),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      exec: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenRepository,
        {
          provide: getModelToken(TokenDocument.name),
          useValue: mockTokenModel,
        },
      ],
    }).compile();

    repository = module.get<TokenRepository>(TokenRepository);
    tokenModel = module.get<Model<TokenDocument>>(getModelToken(TokenDocument.name));
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findByTokenId', () => {
    it('should find a token by ID', async () => {
      // Mock the entire method chain
      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(mockTokenDoc);

      const result = await repository.findByTokenId(mockTokenId);
      
      expect(result).toEqual(mockTokenDoc);
      expect(repository.findOne).toHaveBeenCalledWith({ tokenId: mockTokenId });
    });
  });

  describe('revokeToken', () => {
    it('should revoke a token by ID', async () => {
      // Mock the findOneAndUpdate method
      jest.spyOn(repository, 'findOneAndUpdate').mockResolvedValueOnce(mockTokenDoc);

      const result = await repository.revokeToken(mockTokenId);
      
      expect(result).toBe(true);
      expect(repository.findOneAndUpdate).toHaveBeenCalledWith(
        { tokenId: mockTokenId },
        { revoked: true }
      );
    });

    it('should return false when token is not found', async () => {
      jest.spyOn(repository, 'findOneAndUpdate').mockResolvedValueOnce(null);

      const result = await repository.revokeToken(mockTokenId);
      
      expect(result).toBe(false);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all user tokens', async () => {
      jest.spyOn(tokenModel, 'updateMany').mockResolvedValueOnce({
        modifiedCount: 3,
      } as any);

      const result = await repository.revokeAllUserTokens(mockUserId);
      
      expect(result).toBe(true);
      expect(tokenModel.updateMany).toHaveBeenCalledWith(
        { userId: mockUserId, revoked: false },
        { revoked: true }
      );
    });

    it('should return false when no tokens are modified', async () => {
      jest.spyOn(tokenModel, 'updateMany').mockResolvedValueOnce({
        modifiedCount: 0,
      } as any);

      const result = await repository.revokeAllUserTokens(mockUserId);
      
      expect(result).toBe(false);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens', async () => {
      jest.spyOn(tokenModel, 'deleteMany').mockResolvedValueOnce({
        deletedCount: 5,
      } as any);

      const result = await repository.cleanupExpiredTokens();
      
      expect(result).toBe(5);
      expect(tokenModel.deleteMany).toHaveBeenCalledWith({
        expires: { $lt: expect.any(Date) },
      });
    });
  });
});