import * as QRCode from 'qrcode';
import { QrCodeOptions } from '../types';

/**
 * Generate a QR code for the given data
 * @param data The data to encode in the QR code
 * @param options QR code generation options
 * @returns The QR code as a string (base64, SVG, or terminal string)
 */
export async function generateQrCode(
  data: string,
  options?: QrCodeOptions,
): Promise<string> {
  const qrOptions = {
    errorCorrectionLevel: 'M' as const,
    margin: options?.margin || 4,
    width: options?.size || 256,
    color: {
      dark: options?.color?.dark || '#000000',
      light: options?.color?.light || '#FFFFFF',
    },
  };

  try {
    switch (options?.format) {
      case 'svg':
        return await QRCode.toString(data, {
          ...qrOptions,
          type: 'svg',
        });

      case 'png':
        // Return raw PNG buffer as base64
        const buffer = await QRCode.toBuffer(data);
        return buffer.toString('base64');

      case 'base64':
      default:
        // Return data URL (includes mime type)
        return await QRCode.toDataURL(data, qrOptions);
    }
  } catch (error) {
    throw new Error(`Failed to generate QR code: ${error.message}`);
  }
}

/**
 * Generate a QR code with a logo in the center
 * @param data The data to encode
 * @param logoUrl The URL or base64 of the logo
 * @param options QR code options
 * @returns QR code with embedded logo
 */
export async function generateQrCodeWithLogo(
  data: string,
  logoUrl: string,
  options?: QrCodeOptions,
): Promise<string> {
  // For now, return a standard QR code
  // Logo embedding would require additional image processing
  // This is a placeholder for future enhancement
  return generateQrCode(data, options);
}

/**
 * Generate a terminal-friendly QR code (for CLI output)
 * @param data The data to encode
 * @returns ASCII QR code
 */
export async function generateTerminalQrCode(data: string): Promise<string> {
  return await QRCode.toString(data, {
    type: 'terminal',
    small: true,
  });
}

/**
 * Validate if data is suitable for QR code generation
 * @param data The data to validate
 * @returns True if data can be encoded
 */
export function validateQrData(data: string): boolean {
  if (!data || typeof data !== 'string') {
    return false;
  }

  // QR codes have a maximum capacity
  // For LNURL, we should keep it under 1000 characters
  if (data.length > 1000) {
    return false;
  }

  return true;
}
