/**
 * Creates a mock function with basic Jest-like API for Bun tests
 */
export function createMockFunction() {
  const mockFn = async (..._args: any[]) => mockFn.mockReturnValue;
  mockFn.mockReturnValue = undefined as any;
  mockFn.mockResolvedValue = (value: any) => {
    mockFn.mockReturnValue = Promise.resolve(value);
    return mockFn;
  };
  mockFn.mockRejectedValue = (value: any) => {
    mockFn.mockReturnValue = Promise.reject(value);
    return mockFn;
  };
  mockFn.calls = [] as any[][];
  const originalFn = mockFn;
  const wrappedFn = (...args: any[]) => {
    wrappedFn.calls.push(args);
    return originalFn(...args);
  };
  wrappedFn.mockReturnValue = originalFn.mockReturnValue;
  wrappedFn.mockResolvedValue = originalFn.mockResolvedValue;
  wrappedFn.mockRejectedValue = originalFn.mockRejectedValue;
  wrappedFn.calls = originalFn.calls;
  return wrappedFn;
}

/**
 * Creates common mock services for LNURL controllers
 */
export function createCommonMocks() {
  return {
    reflector: {
      get: createMockFunction().mockResolvedValue(true),
      getAll: createMockFunction().mockResolvedValue([]),
      getAllAndMerge: createMockFunction().mockResolvedValue([]),
      getAllAndOverride: createMockFunction().mockResolvedValue([]),
    },
    jwtService: {
      sign: createMockFunction().mockResolvedValue('test-token'),
      verify: createMockFunction().mockResolvedValue({ sub: 'test-user-id' }),
      decode: createMockFunction().mockResolvedValue({ sub: 'test-user-id' }),
    },
  };
}

/**
 * Creates a mock user object for testing
 */
export function createMockUser(overrides: any = {}) {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    username: 'testuser',
    ...overrides,
  };
}
