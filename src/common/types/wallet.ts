export enum WalletType {
  STANDARD = 'STANDARD', // Regular savings wallet (default)
  TARGET = 'TARGET', // Goal-based savings
  LOCKED = 'LOCKED', // Time-locked savings
}

export interface WalletMeta {
  totalDeposits: number;
  totalWithdrawals: number;
  currentBalance: number;
}

export enum LockPeriod {
  ONE_MONTH = 'ONE_MONTH',
  THREE_MONTHS = 'THREE_MONTHS',
  SIX_MONTHS = 'SIX_MONTHS',
  ONE_YEAR = 'ONE_YEAR',
  CUSTOM = 'CUSTOM',
}

export enum ReminderFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  NEVER = 'NEVER',
}

export enum MilestoneType {
  PERCENTAGE_25 = 'PERCENTAGE_25',
  PERCENTAGE_50 = 'PERCENTAGE_50',
  PERCENTAGE_75 = 'PERCENTAGE_75',
  PERCENTAGE_100 = 'PERCENTAGE_100',
  AMOUNT_BASED = 'AMOUNT_BASED',
  TIME_BASED = 'TIME_BASED',
}

// Wallet configuration interfaces
export interface WalletConfig {
  walletType: WalletType;
  walletName?: string;
  tags?: string[];
  category?: string;
  notes?: string;
}

export interface TargetWalletConfig extends WalletConfig {
  walletType: WalletType.TARGET;
  targetAmountMsats?: number;
  targetAmountFiat?: number;
  targetDate?: Date;
}

export interface LockedWalletConfig extends WalletConfig {
  walletType: WalletType.LOCKED;
  lockPeriod: LockPeriod;
  lockEndDate?: Date;
  autoRenew?: boolean;
  penaltyRate?: number;
}

export interface WalletProgress {
  currentAmountMsats: number;
  currentAmountFiat?: number;
  targetAmountMsats?: number;
  targetAmountFiat?: number;
  progressPercentage: number;
  milestoneReached: Date[];
  projectedCompletionDate?: Date;
}

export interface LockInfo {
  lockPeriod: LockPeriod;
  lockEndDate: Date;
  isLocked: boolean;
  autoRenew: boolean;
  penaltyRate: number;
  canWithdrawEarly: boolean;
  daysRemaining: number;
}

export interface WalletAnalytics {
  totalBalance: number;
  totalSavings: number;
  totalLocked: number;
  totalTargets: number;
  averageMonthlyGrowth: number;
  goalCompletionRate: number;
  portfolioDistribution: {
    standard: number;
    target: number;
    locked: number;
  };
}
