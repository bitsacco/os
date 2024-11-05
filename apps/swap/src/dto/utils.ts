import { Transform } from 'class-transformer';
import { MpesaPaymentUpdateDto } from './mpesa-payment-update.dto';
import { MpesaCollectionUpdateDto } from './mpesa-collection-update.dto';

export function NormalizePhoneNumber() {
  return Transform((params) => {
    const { value } = params;
    if (typeof value !== 'string') {
      return value;
    }

    let normalized = value.replace(/\D/g, '');

    if (normalized.length === 9) {
      normalized = '254' + normalized;
    } else if (normalized.startsWith('0')) {
      normalized = '254' + normalized.slice(1);
    } else if (!normalized.startsWith('254')) {
      normalized = '254' + normalized;
    }

    if (normalized.length !== 12) {
      throw new Error('Invalid phone number format');
    }

    return normalized;
  });
}

export const isMpesaCollectionUpdate = (
  update: MpesaCollectionUpdateDto | MpesaPaymentUpdateDto,
): update is MpesaCollectionUpdateDto => {
  return 'invoice_id' in update;
};

export const isMpesaPaymentUpdate = (
  update: MpesaCollectionUpdateDto | MpesaPaymentUpdateDto,
): update is MpesaPaymentUpdateDto => {
  return 'file_id' in update;
};
