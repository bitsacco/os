// Code generated by protoc-gen-ts_proto. DO NOT EDIT.
// versions:
//   protoc-gen-ts_proto  v2.2.7
//   protoc               v3.21.12
// source: solowallet.proto

/* eslint-disable */
import { GrpcMethod, GrpcStreamMethod } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { TransactionStatus } from './lib';
import { OnrampSwapRequest } from './swap';

export interface DepositFundsRequest {
  userId: string;
  fiatDeposit?: OnrampSwapRequest | undefined;
}

export interface SolowalletDepositTransaction {
  id: string;
  userId: string;
  amountMsats: number;
  status: TransactionStatus;
  reference: string;
  createdAt: string;
  updatedAt?: string | undefined;
}

export interface SolowalletServiceClient {
  depositFunds(
    request: DepositFundsRequest,
  ): Observable<SolowalletDepositTransaction>;
}

export interface SolowalletServiceController {
  depositFunds(
    request: DepositFundsRequest,
  ):
    | Promise<SolowalletDepositTransaction>
    | Observable<SolowalletDepositTransaction>
    | SolowalletDepositTransaction;
}

export function SolowalletServiceControllerMethods() {
  return function (constructor: Function) {
    const grpcMethods: string[] = ['depositFunds'];
    for (const method of grpcMethods) {
      const descriptor: any = Reflect.getOwnPropertyDescriptor(
        constructor.prototype,
        method,
      );
      GrpcMethod('SolowalletService', method)(
        constructor.prototype[method],
        method,
        descriptor,
      );
    }
    const grpcStreamMethods: string[] = [];
    for (const method of grpcStreamMethods) {
      const descriptor: any = Reflect.getOwnPropertyDescriptor(
        constructor.prototype,
        method,
      );
      GrpcStreamMethod('SolowalletService', method)(
        constructor.prototype[method],
        method,
        descriptor,
      );
    }
  };
}

export const SOLOWALLET_SERVICE_NAME = 'SolowalletService';
