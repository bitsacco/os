import { Logger } from '@nestjs/common';
import { fiatToBtc } from './currency';

// Note: These utilities were for gRPC communication.
// Since we're now in a single application, services should be injected directly
// rather than using these utilities.

export { fiatToBtc };
