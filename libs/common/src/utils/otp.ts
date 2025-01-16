import { randomBytes } from 'crypto';

export const generateOTP = (): string => {
  const buf = randomBytes(3);
  const decimal = buf.readUIntBE(0, 3);
  const truncateDecimal = decimal.toString().slice(0, 6);
  const otp = parseInt(truncateDecimal);

  const r = /^\d{6}$/;

  if (!otp || !r.test(otp.toString())) {
    return generateOTP();
  }

  return otp.toString();
};
