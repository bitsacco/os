import { Injectable, Logger } from '@nestjs/common';

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
  resetTimeout: ReturnType<typeof setTimeout> | null;
}

@Injectable()
export class ApiKeyCircuitBreakerService {
  private readonly logger = new Logger(ApiKeyCircuitBreakerService.name);
  private readonly state: CircuitBreakerState = {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
    resetTimeout: null,
  };
  
  // Configuration
  private readonly FAILURE_THRESHOLD = 5; // Number of failures before opening circuit
  private readonly RESET_TIMEOUT_MS = 30000; // Time to wait before trying again (30s)
  
  constructor() {}
  
  isCircuitOpen(): boolean {
    return this.state.isOpen;
  }
  
  recordSuccess(): void {
    // Reset failures on success if circuit is closed
    if (!this.state.isOpen) {
      this.state.failures = 0;
    }
  }
  
  recordFailure(): boolean {
    this.state.failures++;
    this.state.lastFailure = Date.now();
    
    // Check if we should open the circuit
    if (this.state.failures >= this.FAILURE_THRESHOLD && !this.state.isOpen) {
      this.openCircuit();
      return true;
    }
    
    return false;
  }
  
  private openCircuit(): void {
    this.logger.warn('Opening API key validation circuit breaker');
    this.state.isOpen = true;
    
    // Schedule reset
    if (this.state.resetTimeout) {
      clearTimeout(this.state.resetTimeout);
    }
    
    this.state.resetTimeout = setTimeout(() => {
      this.attemptReset();
    }, this.RESET_TIMEOUT_MS);
  }
  
  private attemptReset(): void {
    this.logger.log('Attempting to reset API key circuit breaker');
    this.state.isOpen = false;
    this.state.failures = 0;
  }
}