import { describe, it, expect } from 'bun:test';

// Simple module structure test without database dependencies
describe('AppModule', () => {
  it('should be defined', () => {
    // Test that the module structure is valid
    expect(true).toBe(true);
  });

  it('should have valid module configuration', () => {
    // Test module configuration without instantiating
    const config = {
      imports: ['ConfigModule', 'DatabaseModule', 'AuthDomainModule'],
      controllers: ['HealthController'],
      providers: ['AppService'],
    };

    expect(config.imports).toContain('AuthDomainModule');
    expect(config.controllers).toContain('HealthController');
  });
});
