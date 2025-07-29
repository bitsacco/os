import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../common';
import { ChamaMessageService } from './chamas.messaging';
import { ChamasService } from './chamas.service';
import { ChamasRepository } from './db';
import { ChamaMetricsService } from './chama.metrics';

describe('ChamasService', () => {
  let chamaService: ChamasService;
  let chamasRepository: ChamasRepository;
  let messageService: ChamaMessageService;
  let usersService: UsersService;
  let metricsService: ChamaMetricsService;

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

    metricsService = {
      recordChamaCreationMetric: jest.fn(),
      recordMembershipMetric: jest.fn(),
    } as unknown as ChamaMetricsService;

    const module: TestingModule = await Test.createTestingModule({
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
              metricsService,
            );
          },
        },
      ],
    }).compile();

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

  describe('getMemberProfiles', () => {
    it('should return member profiles for a chama', async () => {
      const mockChamaId = 'chama-123';
      const mockUserIds = ['user-1', 'user-2'];
      const mockChamaDoc = {
        _id: mockChamaId,
        name: 'Test Chama',
        members: [
          {
            userId: mockUserIds[0],
            roles: [0, 1], // Member and Admin roles
          },
          {
            userId: mockUserIds[1],
            roles: [0], // Member role
          },
        ],
        createdBy: 'creator-123',
      };

      // Mock the user profiles
      const mockUsers = [
        {
          id: mockUserIds[0],
          profile: {
            name: 'John Doe',
            avatarUrl: 'https://example.com/avatar1.jpg',
          },
          phone: {
            number: '+1234567890',
          },
          nostr: {
            npub: 'npub123456789',
          },
        },
        {
          id: mockUserIds[1],
          profile: {
            name: 'Jane Smith',
          },
          phone: {
            number: '+0987654321',
          },
        },
      ];

      // Mock findOne to return our test chama
      jest.spyOn(chamasRepository, 'findOne').mockResolvedValue(mockChamaDoc);

      // Mock findUsersById to return the users
      jest.spyOn(usersService, 'findUsersById').mockResolvedValue(mockUsers);

      // Call the service method
      const result = await chamaService.getMemberProfiles({
        chamaId: mockChamaId,
      });

      // Verify the service called the repository and user service methods with correct parameters
      expect(chamasRepository.findOne).toHaveBeenCalledWith({
        _id: mockChamaId,
      });
      expect(usersService.findUsersById).toHaveBeenCalledWith(
        new Set(mockUserIds),
      );

      // Verify the result contains the expected member profiles
      expect(result).toEqual({
        members: [
          {
            userId: mockUserIds[0],
            roles: [0, 1],
            name: 'John Doe',
            avatarUrl: 'https://example.com/avatar1.jpg',
            phoneNumber: '+1234567890',
            nostrNpub: 'npub123456789',
          },
          {
            userId: mockUserIds[1],
            roles: [0],
            name: 'Jane Smith',
            phoneNumber: '+0987654321',
            nostrNpub: undefined,
          },
        ],
      });
    });

    it('should throw an error if the chama is not found', async () => {
      const mockChamaId = 'non-existent-chama';

      // Mock findOne to return null (chama not found)
      jest.spyOn(chamasRepository, 'findOne').mockResolvedValue(null);

      // Call the service method and expect it to throw
      await expect(
        chamaService.getMemberProfiles({ chamaId: mockChamaId }),
      ).rejects.toThrow(`Chama with ID ${mockChamaId} not found`);
    });
  });
});
