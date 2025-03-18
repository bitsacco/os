import { TestingModule } from '@nestjs/testing';
import { UsersService } from '@bitsacco/common';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { ChamaMessageService } from './chamas.messaging';
import { ChamasService } from './chamas.service';
import { ChamasRepository } from './db';

describe('ChamasService', () => {
  let chamaService: ChamasService;
  let chamasRepository: ChamasRepository;
  let messageService: ChamaMessageService;
  let usersService: UsersService;

  beforeEach(async () => {
    messageService = {
      sendChamaInvites: jest.fn(),
    } as unknown as ChamaMessageService;

    chamasRepository = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
    } as unknown as ChamasRepository;

    usersService = {
      validateUser: jest.fn(),
      registerUser: jest.fn(),
      findUser: jest.fn(),
      verifyUser: jest.fn(),
      updateUser: jest.fn(),
      listUsers: jest.fn(),
      findUsersById: jest.fn(),
    } as unknown as UsersService;

    const module: TestingModule = await createTestingModuleWithValidation({
      providers: [
        {
          provide: ChamasRepository,
          useValue: chamasRepository,
        },
        {
          provide: ChamasService,
          useFactory: () => {
            return new ChamasService(
              chamasRepository,
              messageService,
              usersService,
            );
          },
        },
      ],
    });

    chamaService = module.get<ChamasService>(ChamasService);
  });

  it('should be defined', () => {
    expect(chamaService).toBeDefined();
  });

  describe('updateChama', () => {
    it('should update member roles', async () => {
      const mockChamaId = 'chama-123';
      const mockUserId = 'user-123';
      const mockChamaDoc = {
        _id: mockChamaId,
        name: 'Test Chama',
        members: [
          {
            userId: mockUserId,
            roles: [0], // Member role
          },
        ],
        createdBy: 'creator-123',
      };

      const mockUpdateRequest = {
        chamaId: mockChamaId,
        updates: {
          updateMembers: [
            {
              userId: mockUserId,
              roles: [0, 1], // Member and Admin roles
            },
          ],
        },
      };

      // Mock findOne to return our test chama
      jest.spyOn(chamasRepository, 'findOne').mockResolvedValue(mockChamaDoc);

      // Mock findUsersById to return the user
      jest
        .spyOn(usersService, 'findUsersById')
        .mockResolvedValue([{ id: mockUserId }]);

      // Mock findOneAndUpdate to return our updated chama
      const updatedChamaDoc = {
        ...mockChamaDoc,
        members: [
          {
            userId: mockUserId,
            roles: [0, 1], // Member and Admin roles
          },
        ],
      };
      jest
        .spyOn(chamasRepository, 'findOneAndUpdate')
        .mockResolvedValue(updatedChamaDoc);

      const result = await chamaService.updateChama(mockUpdateRequest);

      // Verify the service called the repository methods with correct parameters
      expect(chamasRepository.findOne).toHaveBeenCalledWith({
        _id: mockChamaId,
      });
      expect(chamasRepository.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: mockChamaId },
        expect.objectContaining({
          members: expect.arrayContaining([
            expect.objectContaining({
              userId: mockUserId,
              roles: [0, 1],
            }),
          ]),
        }),
      );

      // Verify the result
      expect(result).toEqual({
        id: mockChamaId,
        name: 'Test Chama',
        members: [
          {
            userId: mockUserId,
            roles: [0, 1],
          },
        ],
        createdBy: 'creator-123',
      });
    });
  });
});
