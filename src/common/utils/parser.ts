import { Logger } from '@nestjs/common';
import { FmLightning, TransactionType } from '../types';

export function parseFmLightning(ln: string, logger: Logger): FmLightning {
  try {
    return JSON.parse(ln);
  } catch (error) {
    logger.warn('Error parsing lightning invoice', error);
    return {};
  }
}

export function parseTransactionType(
  type: string,
  logger: Logger,
): TransactionType {
  try {
    return Number(type) as TransactionType;
  } catch (error) {
    logger.warn('Error parsing transaction type', error);
    return TransactionType.UNRECOGNIZED;
  }
}

export function parseTransactionStatus<T>(
  status: string,
  fallback: T,
  logger: Logger,
): T {
  try {
    return Number(status) as T;
  } catch (error) {
    logger.warn(`Error parsing transaction status ${error}`);
    return fallback;
  }
}
