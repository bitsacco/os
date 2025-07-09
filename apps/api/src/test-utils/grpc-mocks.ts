import { GrpcServiceWrapper, GrpcConnectionManager } from '@bitsacco/common';

export function createGrpcServiceWrapperMock(mockService: any) {
  return {
    createServiceProxy: () => mockService,
    call: (_serviceName: string, serviceCall: () => any) => serviceCall(),
    getService: () => mockService,
  };
}

export function createGrpcConnectionManagerMock() {
  return {
    registerConnection: () => {},
    recordError: () => {},
    recordSuccess: () => {},
    getConnectionHealth: () => new Map(),
    isServiceHealthy: () => true,
    getConnectionStats: () => new Map(),
  };
}

export function provideGrpcMocks(mockService: any) {
  return [
    {
      provide: GrpcServiceWrapper,
      useValue: createGrpcServiceWrapperMock(mockService),
    },
    {
      provide: GrpcConnectionManager,
      useValue: createGrpcConnectionManagerMock(),
    },
  ];
}
