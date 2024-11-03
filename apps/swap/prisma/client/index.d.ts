/**
 * Client
 **/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types; // general types
import $Public = runtime.Types.Public;
import $Utils = runtime.Types.Utils;
import $Extensions = runtime.Types.Extensions;
import $Result = runtime.Types.Result;

export type PrismaPromise<T> = $Public.PrismaPromise<T>;

/**
 * Model MpesaOnrampSwap
 *
 */
export type MpesaOnrampSwap =
  $Result.DefaultSelection<Prisma.$MpesaOnrampSwapPayload>;
/**
 * Model MpesaOfframpSwap
 *
 */
export type MpesaOfframpSwap =
  $Result.DefaultSelection<Prisma.$MpesaOfframpSwapPayload>;
/**
 * Model IntasendMpesaTransaction
 *
 */
export type IntasendMpesaTransaction =
  $Result.DefaultSelection<Prisma.$IntasendMpesaTransactionPayload>;

/**
 * Enums
 */
export namespace $Enums {
  export const SwapTransactionState: {
    PENDING: 'PENDING';
    PROCESSING: 'PROCESSING';
    FAILED: 'FAILED';
    COMPLETE: 'COMPLETE';
    RETRY: 'RETRY';
  };

  export type SwapTransactionState =
    (typeof SwapTransactionState)[keyof typeof SwapTransactionState];
}

export type SwapTransactionState = $Enums.SwapTransactionState;

export const SwapTransactionState: typeof $Enums.SwapTransactionState;

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more MpesaOnrampSwaps
 * const mpesaOnrampSwaps = await prisma.mpesaOnrampSwap.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions
    ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition>
      ? Prisma.GetEvents<ClientOptions['log']>
      : never
    : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] };

  /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more MpesaOnrampSwaps
   * const mpesaOnrampSwaps = await prisma.mpesaOnrampSwap.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(
    optionsArg?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>,
  );
  $on<V extends U>(
    eventType: V,
    callback: (
      event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent,
    ) => void,
  ): void;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void;

  /**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: any[]
  ): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(
    query: string,
    ...values: any[]
  ): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: any[]
  ): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(
    query: string,
    ...values: any[]
  ): Prisma.PrismaPromise<T>;

  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(
    arg: [...P],
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>;

  $transaction<R>(
    fn: (
      prisma: Omit<PrismaClient, runtime.ITXClientDenyList>,
    ) => $Utils.JsPromise<R>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ): $Utils.JsPromise<R>;

  $extends: $Extensions.ExtendsHook<'extends', Prisma.TypeMapCb, ExtArgs>;

  /**
   * `prisma.mpesaOnrampSwap`: Exposes CRUD operations for the **MpesaOnrampSwap** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more MpesaOnrampSwaps
   * const mpesaOnrampSwaps = await prisma.mpesaOnrampSwap.findMany()
   * ```
   */
  get mpesaOnrampSwap(): Prisma.MpesaOnrampSwapDelegate<ExtArgs>;

  /**
   * `prisma.mpesaOfframpSwap`: Exposes CRUD operations for the **MpesaOfframpSwap** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more MpesaOfframpSwaps
   * const mpesaOfframpSwaps = await prisma.mpesaOfframpSwap.findMany()
   * ```
   */
  get mpesaOfframpSwap(): Prisma.MpesaOfframpSwapDelegate<ExtArgs>;

  /**
   * `prisma.intasendMpesaTransaction`: Exposes CRUD operations for the **IntasendMpesaTransaction** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more IntasendMpesaTransactions
   * const intasendMpesaTransactions = await prisma.intasendMpesaTransaction.findMany()
   * ```
   */
  get intasendMpesaTransaction(): Prisma.IntasendMpesaTransactionDelegate<ExtArgs>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF;

  export type PrismaPromise<T> = $Public.PrismaPromise<T>;

  /**
   * Validator
   */
  export import validator = runtime.Public.validator;

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError;
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError;
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError;
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError;
  export import PrismaClientValidationError = runtime.PrismaClientValidationError;
  export import NotFoundError = runtime.NotFoundError;

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag;
  export import empty = runtime.empty;
  export import join = runtime.join;
  export import raw = runtime.raw;
  export import Sql = runtime.Sql;

  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal;

  export type DecimalJsLike = runtime.DecimalJsLike;

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics;
  export type Metric<T> = runtime.Metric<T>;
  export type MetricHistogram = runtime.MetricHistogram;
  export type MetricHistogramBucket = runtime.MetricHistogramBucket;

  /**
   * Extensions
   */
  export import Extension = $Extensions.UserArgs;
  export import getExtensionContext = runtime.Extensions.getExtensionContext;
  export import Args = $Public.Args;
  export import Payload = $Public.Payload;
  export import Result = $Public.Result;
  export import Exact = $Public.Exact;

  /**
   * Prisma Client JS version: 5.21.1
   * Query Engine version: bf0e5e8a04cada8225617067eaa03d041e2bba36
   */
  export type PrismaVersion = {
    client: string;
  };

  export const prismaVersion: PrismaVersion;

  /**
   * Utility Types
   */

  export import JsonObject = runtime.JsonObject;
  export import JsonArray = runtime.JsonArray;
  export import JsonValue = runtime.JsonValue;
  export import InputJsonObject = runtime.InputJsonObject;
  export import InputJsonArray = runtime.InputJsonArray;
  export import InputJsonValue = runtime.InputJsonValue;

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
     * Type of `Prisma.DbNull`.
     *
     * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
     *
     * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
     */
    class DbNull {
      private DbNull: never;
      private constructor();
    }

    /**
     * Type of `Prisma.JsonNull`.
     *
     * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
     *
     * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
     */
    class JsonNull {
      private JsonNull: never;
      private constructor();
    }

    /**
     * Type of `Prisma.AnyNull`.
     *
     * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
     *
     * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
     */
    class AnyNull {
      private AnyNull: never;
      private constructor();
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull;

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull;

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull;

  type SelectAndInclude = {
    select: any;
    include: any;
  };

  type SelectAndOmit = {
    select: any;
    omit: any;
  };

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> =
    T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<
    T extends (...args: any) => $Utils.JsPromise<any>,
  > = PromiseType<ReturnType<T>>;

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
    [P in K]: T[P];
  };

  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K;
  }[keyof T];

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K;
  };

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>;

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  } & (T extends SelectAndInclude
    ? 'Please either choose `select` or `include`.'
    : T extends SelectAndOmit
      ? 'Please either choose `select` or `omit`.'
      : {});

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  } & K;

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> = T extends object
    ? U extends object
      ? (Without<T, U> & U) | (Without<U, T> & T)
      : U
    : T;

  /**
   * Is T a Record?
   */
  type IsObject<T extends any> =
    T extends Array<any>
      ? False
      : T extends Date
        ? False
        : T extends Uint8Array
          ? False
          : T extends BigInt
            ? False
            : T extends object
              ? True
              : False;

  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T;

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O>; // With K possibilities
    }[K];

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>;

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<
    __Either<O, K>
  >;

  type _Either<O extends object, K extends Key, strict extends Boolean> = {
    1: EitherStrict<O, K>;
    0: EitherLoose<O, K>;
  }[strict];

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1,
  > = O extends unknown ? _Either<O, K, strict> : never;

  export type Union = any;

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K];
  } & {};

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never;

  export type Overwrite<O extends object, O1 extends object> = {
    [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<
    Overwrite<
      U,
      {
        [K in keyof U]-?: At<U, K>;
      }
    >
  >;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O
    ? O[K]
    : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown
    ? AtStrict<O, K>
    : never;
  export type At<
    O extends object,
    K extends Key,
    strict extends Boolean = 1,
  > = {
    1: AtStrict<O, K>;
    0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function
    ? A
    : {
        [K in keyof A]: A[K];
      } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
      ?
          | (K extends keyof O ? { [P in K]: O[P] } & O : O)
          | ({ [P in keyof O as P extends K ? K : never]-?: O[P] } & O)
      : never
  >;

  type _Strict<U, _U = U> = U extends unknown
    ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>>
    : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False;

  // /**
  // 1
  // */
  export type True = 1;

  /**
  0
  */
  export type False = 0;

  export type Not<B extends Boolean> = {
    0: 1;
    1: 0;
  }[B];

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
      ? 1
      : 0;

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >;

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0;
      1: 1;
    };
    1: {
      0: 1;
      1: 1;
    };
  }[B1][B2];

  export type Keys<U extends Union> = U extends unknown ? keyof U : never;

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;

  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object
    ? {
        [P in keyof T]: P extends keyof O ? O[P] : never;
      }
    : never;

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>,
  > = IsObject<T> extends True ? U : T;

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<
            UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never
          >
        : never
      : {} extends FieldPaths<T[K]>
        ? never
        : K;
  }[keyof T];

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never;
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>;
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T;

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<
    T,
    K extends Enumerable<keyof T> | keyof T,
  > = Prisma__Pick<T, MaybeTupleToUnion<K>>;

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}`
    ? never
    : T;

  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>;

  type FieldRefInputType<Model, FieldType> = Model extends never
    ? never
    : FieldRef<Model, FieldType>;

  export const ModelName: {
    MpesaOnrampSwap: 'MpesaOnrampSwap';
    MpesaOfframpSwap: 'MpesaOfframpSwap';
    IntasendMpesaTransaction: 'IntasendMpesaTransaction';
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName];

  export type Datasources = {
    db?: Datasource;
  };

  interface TypeMapCb
    extends $Utils.Fn<
      { extArgs: $Extensions.InternalArgs; clientOptions: PrismaClientOptions },
      $Utils.Record<string, any>
    > {
    returns: Prisma.TypeMap<
      this['params']['extArgs'],
      this['params']['clientOptions']
    >;
  }

  export type TypeMap<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    ClientOptions = {},
  > = {
    meta: {
      modelProps:
        | 'mpesaOnrampSwap'
        | 'mpesaOfframpSwap'
        | 'intasendMpesaTransaction';
      txIsolationLevel: Prisma.TransactionIsolationLevel;
    };
    model: {
      MpesaOnrampSwap: {
        payload: Prisma.$MpesaOnrampSwapPayload<ExtArgs>;
        fields: Prisma.MpesaOnrampSwapFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.MpesaOnrampSwapFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MpesaOnrampSwapPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.MpesaOnrampSwapFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MpesaOnrampSwapPayload>;
          };
          findFirst: {
            args: Prisma.MpesaOnrampSwapFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MpesaOnrampSwapPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.MpesaOnrampSwapFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MpesaOnrampSwapPayload>;
          };
          findMany: {
            args: Prisma.MpesaOnrampSwapFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MpesaOnrampSwapPayload>[];
          };
          create: {
            args: Prisma.MpesaOnrampSwapCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MpesaOnrampSwapPayload>;
          };
          createMany: {
            args: Prisma.MpesaOnrampSwapCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.MpesaOnrampSwapCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MpesaOnrampSwapPayload>[];
          };
          delete: {
            args: Prisma.MpesaOnrampSwapDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MpesaOnrampSwapPayload>;
          };
          update: {
            args: Prisma.MpesaOnrampSwapUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MpesaOnrampSwapPayload>;
          };
          deleteMany: {
            args: Prisma.MpesaOnrampSwapDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.MpesaOnrampSwapUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          upsert: {
            args: Prisma.MpesaOnrampSwapUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MpesaOnrampSwapPayload>;
          };
          aggregate: {
            args: Prisma.MpesaOnrampSwapAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateMpesaOnrampSwap>;
          };
          groupBy: {
            args: Prisma.MpesaOnrampSwapGroupByArgs<ExtArgs>;
            result: $Utils.Optional<MpesaOnrampSwapGroupByOutputType>[];
          };
          count: {
            args: Prisma.MpesaOnrampSwapCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<MpesaOnrampSwapCountAggregateOutputType>
              | number;
          };
        };
      };
      MpesaOfframpSwap: {
        payload: Prisma.$MpesaOfframpSwapPayload<ExtArgs>;
        fields: Prisma.MpesaOfframpSwapFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.MpesaOfframpSwapFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MpesaOfframpSwapPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.MpesaOfframpSwapFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MpesaOfframpSwapPayload>;
          };
          findFirst: {
            args: Prisma.MpesaOfframpSwapFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MpesaOfframpSwapPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.MpesaOfframpSwapFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MpesaOfframpSwapPayload>;
          };
          findMany: {
            args: Prisma.MpesaOfframpSwapFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MpesaOfframpSwapPayload>[];
          };
          create: {
            args: Prisma.MpesaOfframpSwapCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MpesaOfframpSwapPayload>;
          };
          createMany: {
            args: Prisma.MpesaOfframpSwapCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.MpesaOfframpSwapCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MpesaOfframpSwapPayload>[];
          };
          delete: {
            args: Prisma.MpesaOfframpSwapDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MpesaOfframpSwapPayload>;
          };
          update: {
            args: Prisma.MpesaOfframpSwapUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MpesaOfframpSwapPayload>;
          };
          deleteMany: {
            args: Prisma.MpesaOfframpSwapDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.MpesaOfframpSwapUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          upsert: {
            args: Prisma.MpesaOfframpSwapUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MpesaOfframpSwapPayload>;
          };
          aggregate: {
            args: Prisma.MpesaOfframpSwapAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateMpesaOfframpSwap>;
          };
          groupBy: {
            args: Prisma.MpesaOfframpSwapGroupByArgs<ExtArgs>;
            result: $Utils.Optional<MpesaOfframpSwapGroupByOutputType>[];
          };
          count: {
            args: Prisma.MpesaOfframpSwapCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<MpesaOfframpSwapCountAggregateOutputType>
              | number;
          };
        };
      };
      IntasendMpesaTransaction: {
        payload: Prisma.$IntasendMpesaTransactionPayload<ExtArgs>;
        fields: Prisma.IntasendMpesaTransactionFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.IntasendMpesaTransactionFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$IntasendMpesaTransactionPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.IntasendMpesaTransactionFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$IntasendMpesaTransactionPayload>;
          };
          findFirst: {
            args: Prisma.IntasendMpesaTransactionFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$IntasendMpesaTransactionPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.IntasendMpesaTransactionFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$IntasendMpesaTransactionPayload>;
          };
          findMany: {
            args: Prisma.IntasendMpesaTransactionFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$IntasendMpesaTransactionPayload>[];
          };
          create: {
            args: Prisma.IntasendMpesaTransactionCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$IntasendMpesaTransactionPayload>;
          };
          createMany: {
            args: Prisma.IntasendMpesaTransactionCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.IntasendMpesaTransactionCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$IntasendMpesaTransactionPayload>[];
          };
          delete: {
            args: Prisma.IntasendMpesaTransactionDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$IntasendMpesaTransactionPayload>;
          };
          update: {
            args: Prisma.IntasendMpesaTransactionUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$IntasendMpesaTransactionPayload>;
          };
          deleteMany: {
            args: Prisma.IntasendMpesaTransactionDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.IntasendMpesaTransactionUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          upsert: {
            args: Prisma.IntasendMpesaTransactionUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$IntasendMpesaTransactionPayload>;
          };
          aggregate: {
            args: Prisma.IntasendMpesaTransactionAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateIntasendMpesaTransaction>;
          };
          groupBy: {
            args: Prisma.IntasendMpesaTransactionGroupByArgs<ExtArgs>;
            result: $Utils.Optional<IntasendMpesaTransactionGroupByOutputType>[];
          };
          count: {
            args: Prisma.IntasendMpesaTransactionCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<IntasendMpesaTransactionCountAggregateOutputType>
              | number;
          };
        };
      };
    };
  } & {
    other: {
      payload: any;
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]];
          result: any;
        };
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]];
          result: any;
        };
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]];
          result: any;
        };
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]];
          result: any;
        };
      };
    };
  };
  export const defineExtension: $Extensions.ExtendsHook<
    'define',
    Prisma.TypeMapCb,
    $Extensions.DefaultArgs
  >;
  export type DefaultPrismaClient = PrismaClient;
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal';
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources;
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string;
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat;
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     *
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[];
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    };
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error';
  export type LogDefinition = {
    level: LogLevel;
    emit: 'stdout' | 'event';
  };

  export type GetLogType<T extends LogLevel | LogDefinition> =
    T extends LogDefinition
      ? T['emit'] extends 'event'
        ? T['level']
        : never
      : never;
  export type GetEvents<T extends any> =
    T extends Array<LogLevel | LogDefinition>
      ?
          | GetLogType<T[0]>
          | GetLogType<T[1]>
          | GetLogType<T[2]>
          | GetLogType<T[3]>
      : never;

  export type QueryEvent = {
    timestamp: Date;
    query: string;
    params: string;
    duration: number;
    target: string;
  };

  export type LogEvent = {
    timestamp: Date;
    message: string;
    target: string;
  };
  /* End Types for Logging */

  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy';

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName;
    action: PrismaAction;
    args: any;
    dataPath: string[];
    runInTransaction: boolean;
  };

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>;

  // tested in getLogLevel.test.ts
  export function getLogLevel(
    log: Array<LogLevel | LogDefinition>,
  ): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<
    Prisma.DefaultPrismaClient,
    runtime.ITXClientDenyList
  >;

  export type Datasource = {
    url?: string;
  };

  /**
   * Count Types
   */

  /**
   * Models
   */

  /**
   * Model MpesaOnrampSwap
   */

  export type AggregateMpesaOnrampSwap = {
    _count: MpesaOnrampSwapCountAggregateOutputType | null;
    _avg: MpesaOnrampSwapAvgAggregateOutputType | null;
    _sum: MpesaOnrampSwapSumAggregateOutputType | null;
    _min: MpesaOnrampSwapMinAggregateOutputType | null;
    _max: MpesaOnrampSwapMaxAggregateOutputType | null;
  };

  export type MpesaOnrampSwapAvgAggregateOutputType = {
    retryCount: number | null;
  };

  export type MpesaOnrampSwapSumAggregateOutputType = {
    retryCount: number | null;
  };

  export type MpesaOnrampSwapMinAggregateOutputType = {
    id: string | null;
    state: $Enums.SwapTransactionState | null;
    userId: string | null;
    mpesaId: string | null;
    lightning: string | null;
    rate: string | null;
    retryCount: number | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  };

  export type MpesaOnrampSwapMaxAggregateOutputType = {
    id: string | null;
    state: $Enums.SwapTransactionState | null;
    userId: string | null;
    mpesaId: string | null;
    lightning: string | null;
    rate: string | null;
    retryCount: number | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  };

  export type MpesaOnrampSwapCountAggregateOutputType = {
    id: number;
    state: number;
    userId: number;
    mpesaId: number;
    lightning: number;
    rate: number;
    retryCount: number;
    createdAt: number;
    updatedAt: number;
    _all: number;
  };

  export type MpesaOnrampSwapAvgAggregateInputType = {
    retryCount?: true;
  };

  export type MpesaOnrampSwapSumAggregateInputType = {
    retryCount?: true;
  };

  export type MpesaOnrampSwapMinAggregateInputType = {
    id?: true;
    state?: true;
    userId?: true;
    mpesaId?: true;
    lightning?: true;
    rate?: true;
    retryCount?: true;
    createdAt?: true;
    updatedAt?: true;
  };

  export type MpesaOnrampSwapMaxAggregateInputType = {
    id?: true;
    state?: true;
    userId?: true;
    mpesaId?: true;
    lightning?: true;
    rate?: true;
    retryCount?: true;
    createdAt?: true;
    updatedAt?: true;
  };

  export type MpesaOnrampSwapCountAggregateInputType = {
    id?: true;
    state?: true;
    userId?: true;
    mpesaId?: true;
    lightning?: true;
    rate?: true;
    retryCount?: true;
    createdAt?: true;
    updatedAt?: true;
    _all?: true;
  };

  export type MpesaOnrampSwapAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which MpesaOnrampSwap to aggregate.
     */
    where?: MpesaOnrampSwapWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MpesaOnrampSwaps to fetch.
     */
    orderBy?:
      | MpesaOnrampSwapOrderByWithRelationInput
      | MpesaOnrampSwapOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: MpesaOnrampSwapWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MpesaOnrampSwaps from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MpesaOnrampSwaps.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned MpesaOnrampSwaps
     **/
    _count?: true | MpesaOnrampSwapCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: MpesaOnrampSwapAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: MpesaOnrampSwapSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: MpesaOnrampSwapMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: MpesaOnrampSwapMaxAggregateInputType;
  };

  export type GetMpesaOnrampSwapAggregateType<
    T extends MpesaOnrampSwapAggregateArgs,
  > = {
    [P in keyof T & keyof AggregateMpesaOnrampSwap]: P extends
      | '_count'
      | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMpesaOnrampSwap[P]>
      : GetScalarType<T[P], AggregateMpesaOnrampSwap[P]>;
  };

  export type MpesaOnrampSwapGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: MpesaOnrampSwapWhereInput;
    orderBy?:
      | MpesaOnrampSwapOrderByWithAggregationInput
      | MpesaOnrampSwapOrderByWithAggregationInput[];
    by: MpesaOnrampSwapScalarFieldEnum[] | MpesaOnrampSwapScalarFieldEnum;
    having?: MpesaOnrampSwapScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: MpesaOnrampSwapCountAggregateInputType | true;
    _avg?: MpesaOnrampSwapAvgAggregateInputType;
    _sum?: MpesaOnrampSwapSumAggregateInputType;
    _min?: MpesaOnrampSwapMinAggregateInputType;
    _max?: MpesaOnrampSwapMaxAggregateInputType;
  };

  export type MpesaOnrampSwapGroupByOutputType = {
    id: string;
    state: $Enums.SwapTransactionState;
    userId: string;
    mpesaId: string;
    lightning: string;
    rate: string;
    retryCount: number;
    createdAt: Date;
    updatedAt: Date;
    _count: MpesaOnrampSwapCountAggregateOutputType | null;
    _avg: MpesaOnrampSwapAvgAggregateOutputType | null;
    _sum: MpesaOnrampSwapSumAggregateOutputType | null;
    _min: MpesaOnrampSwapMinAggregateOutputType | null;
    _max: MpesaOnrampSwapMaxAggregateOutputType | null;
  };

  type GetMpesaOnrampSwapGroupByPayload<T extends MpesaOnrampSwapGroupByArgs> =
    Prisma.PrismaPromise<
      Array<
        PickEnumerable<MpesaOnrampSwapGroupByOutputType, T['by']> & {
          [P in keyof T &
            keyof MpesaOnrampSwapGroupByOutputType]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MpesaOnrampSwapGroupByOutputType[P]>
            : GetScalarType<T[P], MpesaOnrampSwapGroupByOutputType[P]>;
        }
      >
    >;

  export type MpesaOnrampSwapSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      state?: boolean;
      userId?: boolean;
      mpesaId?: boolean;
      lightning?: boolean;
      rate?: boolean;
      retryCount?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
    },
    ExtArgs['result']['mpesaOnrampSwap']
  >;

  export type MpesaOnrampSwapSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      state?: boolean;
      userId?: boolean;
      mpesaId?: boolean;
      lightning?: boolean;
      rate?: boolean;
      retryCount?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
    },
    ExtArgs['result']['mpesaOnrampSwap']
  >;

  export type MpesaOnrampSwapSelectScalar = {
    id?: boolean;
    state?: boolean;
    userId?: boolean;
    mpesaId?: boolean;
    lightning?: boolean;
    rate?: boolean;
    retryCount?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
  };

  export type $MpesaOnrampSwapPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: 'MpesaOnrampSwap';
    objects: {};
    scalars: $Extensions.GetPayloadResult<
      {
        /**
         * Unique identifier for the swap
         */
        id: string;
        /**
         * Tracks progress of the swap
         */
        state: $Enums.SwapTransactionState;
        /**
         * References the user who made the transaction.
         */
        userId: string;
        /**
         * References the onramp Mpesa transaction ID.
         */
        mpesaId: string;
        /**
         * Lightning invoice to pay.
         */
        lightning: string;
        /**
         * Fx Rate
         */
        rate: string;
        /**
         * Retry count tracker
         */
        retryCount: number;
        /**
         * Timestamps
         */
        createdAt: Date;
        updatedAt: Date;
      },
      ExtArgs['result']['mpesaOnrampSwap']
    >;
    composites: {};
  };

  type MpesaOnrampSwapGetPayload<
    S extends boolean | null | undefined | MpesaOnrampSwapDefaultArgs,
  > = $Result.GetResult<Prisma.$MpesaOnrampSwapPayload, S>;

  type MpesaOnrampSwapCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<MpesaOnrampSwapFindManyArgs, 'select' | 'include' | 'distinct'> & {
    select?: MpesaOnrampSwapCountAggregateInputType | true;
  };

  export interface MpesaOnrampSwapDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>['model']['MpesaOnrampSwap'];
      meta: { name: 'MpesaOnrampSwap' };
    };
    /**
     * Find zero or one MpesaOnrampSwap that matches the filter.
     * @param {MpesaOnrampSwapFindUniqueArgs} args - Arguments to find a MpesaOnrampSwap
     * @example
     * // Get one MpesaOnrampSwap
     * const mpesaOnrampSwap = await prisma.mpesaOnrampSwap.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MpesaOnrampSwapFindUniqueArgs>(
      args: SelectSubset<T, MpesaOnrampSwapFindUniqueArgs<ExtArgs>>,
    ): Prisma__MpesaOnrampSwapClient<
      $Result.GetResult<
        Prisma.$MpesaOnrampSwapPayload<ExtArgs>,
        T,
        'findUnique'
      > | null,
      null,
      ExtArgs
    >;

    /**
     * Find one MpesaOnrampSwap that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {MpesaOnrampSwapFindUniqueOrThrowArgs} args - Arguments to find a MpesaOnrampSwap
     * @example
     * // Get one MpesaOnrampSwap
     * const mpesaOnrampSwap = await prisma.mpesaOnrampSwap.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MpesaOnrampSwapFindUniqueOrThrowArgs>(
      args: SelectSubset<T, MpesaOnrampSwapFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__MpesaOnrampSwapClient<
      $Result.GetResult<
        Prisma.$MpesaOnrampSwapPayload<ExtArgs>,
        T,
        'findUniqueOrThrow'
      >,
      never,
      ExtArgs
    >;

    /**
     * Find the first MpesaOnrampSwap that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MpesaOnrampSwapFindFirstArgs} args - Arguments to find a MpesaOnrampSwap
     * @example
     * // Get one MpesaOnrampSwap
     * const mpesaOnrampSwap = await prisma.mpesaOnrampSwap.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MpesaOnrampSwapFindFirstArgs>(
      args?: SelectSubset<T, MpesaOnrampSwapFindFirstArgs<ExtArgs>>,
    ): Prisma__MpesaOnrampSwapClient<
      $Result.GetResult<
        Prisma.$MpesaOnrampSwapPayload<ExtArgs>,
        T,
        'findFirst'
      > | null,
      null,
      ExtArgs
    >;

    /**
     * Find the first MpesaOnrampSwap that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MpesaOnrampSwapFindFirstOrThrowArgs} args - Arguments to find a MpesaOnrampSwap
     * @example
     * // Get one MpesaOnrampSwap
     * const mpesaOnrampSwap = await prisma.mpesaOnrampSwap.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MpesaOnrampSwapFindFirstOrThrowArgs>(
      args?: SelectSubset<T, MpesaOnrampSwapFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__MpesaOnrampSwapClient<
      $Result.GetResult<
        Prisma.$MpesaOnrampSwapPayload<ExtArgs>,
        T,
        'findFirstOrThrow'
      >,
      never,
      ExtArgs
    >;

    /**
     * Find zero or more MpesaOnrampSwaps that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MpesaOnrampSwapFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MpesaOnrampSwaps
     * const mpesaOnrampSwaps = await prisma.mpesaOnrampSwap.findMany()
     *
     * // Get first 10 MpesaOnrampSwaps
     * const mpesaOnrampSwaps = await prisma.mpesaOnrampSwap.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const mpesaOnrampSwapWithIdOnly = await prisma.mpesaOnrampSwap.findMany({ select: { id: true } })
     *
     */
    findMany<T extends MpesaOnrampSwapFindManyArgs>(
      args?: SelectSubset<T, MpesaOnrampSwapFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<Prisma.$MpesaOnrampSwapPayload<ExtArgs>, T, 'findMany'>
    >;

    /**
     * Create a MpesaOnrampSwap.
     * @param {MpesaOnrampSwapCreateArgs} args - Arguments to create a MpesaOnrampSwap.
     * @example
     * // Create one MpesaOnrampSwap
     * const MpesaOnrampSwap = await prisma.mpesaOnrampSwap.create({
     *   data: {
     *     // ... data to create a MpesaOnrampSwap
     *   }
     * })
     *
     */
    create<T extends MpesaOnrampSwapCreateArgs>(
      args: SelectSubset<T, MpesaOnrampSwapCreateArgs<ExtArgs>>,
    ): Prisma__MpesaOnrampSwapClient<
      $Result.GetResult<Prisma.$MpesaOnrampSwapPayload<ExtArgs>, T, 'create'>,
      never,
      ExtArgs
    >;

    /**
     * Create many MpesaOnrampSwaps.
     * @param {MpesaOnrampSwapCreateManyArgs} args - Arguments to create many MpesaOnrampSwaps.
     * @example
     * // Create many MpesaOnrampSwaps
     * const mpesaOnrampSwap = await prisma.mpesaOnrampSwap.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends MpesaOnrampSwapCreateManyArgs>(
      args?: SelectSubset<T, MpesaOnrampSwapCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many MpesaOnrampSwaps and returns the data saved in the database.
     * @param {MpesaOnrampSwapCreateManyAndReturnArgs} args - Arguments to create many MpesaOnrampSwaps.
     * @example
     * // Create many MpesaOnrampSwaps
     * const mpesaOnrampSwap = await prisma.mpesaOnrampSwap.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many MpesaOnrampSwaps and only return the `id`
     * const mpesaOnrampSwapWithIdOnly = await prisma.mpesaOnrampSwap.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends MpesaOnrampSwapCreateManyAndReturnArgs>(
      args?: SelectSubset<T, MpesaOnrampSwapCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$MpesaOnrampSwapPayload<ExtArgs>,
        T,
        'createManyAndReturn'
      >
    >;

    /**
     * Delete a MpesaOnrampSwap.
     * @param {MpesaOnrampSwapDeleteArgs} args - Arguments to delete one MpesaOnrampSwap.
     * @example
     * // Delete one MpesaOnrampSwap
     * const MpesaOnrampSwap = await prisma.mpesaOnrampSwap.delete({
     *   where: {
     *     // ... filter to delete one MpesaOnrampSwap
     *   }
     * })
     *
     */
    delete<T extends MpesaOnrampSwapDeleteArgs>(
      args: SelectSubset<T, MpesaOnrampSwapDeleteArgs<ExtArgs>>,
    ): Prisma__MpesaOnrampSwapClient<
      $Result.GetResult<Prisma.$MpesaOnrampSwapPayload<ExtArgs>, T, 'delete'>,
      never,
      ExtArgs
    >;

    /**
     * Update one MpesaOnrampSwap.
     * @param {MpesaOnrampSwapUpdateArgs} args - Arguments to update one MpesaOnrampSwap.
     * @example
     * // Update one MpesaOnrampSwap
     * const mpesaOnrampSwap = await prisma.mpesaOnrampSwap.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends MpesaOnrampSwapUpdateArgs>(
      args: SelectSubset<T, MpesaOnrampSwapUpdateArgs<ExtArgs>>,
    ): Prisma__MpesaOnrampSwapClient<
      $Result.GetResult<Prisma.$MpesaOnrampSwapPayload<ExtArgs>, T, 'update'>,
      never,
      ExtArgs
    >;

    /**
     * Delete zero or more MpesaOnrampSwaps.
     * @param {MpesaOnrampSwapDeleteManyArgs} args - Arguments to filter MpesaOnrampSwaps to delete.
     * @example
     * // Delete a few MpesaOnrampSwaps
     * const { count } = await prisma.mpesaOnrampSwap.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends MpesaOnrampSwapDeleteManyArgs>(
      args?: SelectSubset<T, MpesaOnrampSwapDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more MpesaOnrampSwaps.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MpesaOnrampSwapUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MpesaOnrampSwaps
     * const mpesaOnrampSwap = await prisma.mpesaOnrampSwap.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends MpesaOnrampSwapUpdateManyArgs>(
      args: SelectSubset<T, MpesaOnrampSwapUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create or update one MpesaOnrampSwap.
     * @param {MpesaOnrampSwapUpsertArgs} args - Arguments to update or create a MpesaOnrampSwap.
     * @example
     * // Update or create a MpesaOnrampSwap
     * const mpesaOnrampSwap = await prisma.mpesaOnrampSwap.upsert({
     *   create: {
     *     // ... data to create a MpesaOnrampSwap
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MpesaOnrampSwap we want to update
     *   }
     * })
     */
    upsert<T extends MpesaOnrampSwapUpsertArgs>(
      args: SelectSubset<T, MpesaOnrampSwapUpsertArgs<ExtArgs>>,
    ): Prisma__MpesaOnrampSwapClient<
      $Result.GetResult<Prisma.$MpesaOnrampSwapPayload<ExtArgs>, T, 'upsert'>,
      never,
      ExtArgs
    >;

    /**
     * Count the number of MpesaOnrampSwaps.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MpesaOnrampSwapCountArgs} args - Arguments to filter MpesaOnrampSwaps to count.
     * @example
     * // Count the number of MpesaOnrampSwaps
     * const count = await prisma.mpesaOnrampSwap.count({
     *   where: {
     *     // ... the filter for the MpesaOnrampSwaps we want to count
     *   }
     * })
     **/
    count<T extends MpesaOnrampSwapCountArgs>(
      args?: Subset<T, MpesaOnrampSwapCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MpesaOnrampSwapCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a MpesaOnrampSwap.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MpesaOnrampSwapAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends MpesaOnrampSwapAggregateArgs>(
      args: Subset<T, MpesaOnrampSwapAggregateArgs>,
    ): Prisma.PrismaPromise<GetMpesaOnrampSwapAggregateType<T>>;

    /**
     * Group by MpesaOnrampSwap.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MpesaOnrampSwapGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends MpesaOnrampSwapGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MpesaOnrampSwapGroupByArgs['orderBy'] }
        : { orderBy?: MpesaOnrampSwapGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<
        Keys<MaybeTupleToUnion<T['orderBy']>>
      >,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [
                      Error,
                      'Field ',
                      P,
                      ` in "having" needs to be provided in "by"`,
                    ];
            }[HavingFields]
          : 'take' extends Keys<T>
            ? 'orderBy' extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : 'skip' extends Keys<T>
              ? 'orderBy' extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields
                        ? never
                        : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, MpesaOnrampSwapGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetMpesaOnrampSwapGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the MpesaOnrampSwap model
     */
    readonly fields: MpesaOnrampSwapFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for MpesaOnrampSwap.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MpesaOnrampSwapClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | undefined
        | null,
      onrejected?:
        | ((reason: any) => TResult2 | PromiseLike<TResult2>)
        | undefined
        | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(
      onrejected?:
        | ((reason: any) => TResult | PromiseLike<TResult>)
        | undefined
        | null,
    ): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the MpesaOnrampSwap model
   */
  interface MpesaOnrampSwapFieldRefs {
    readonly id: FieldRef<'MpesaOnrampSwap', 'String'>;
    readonly state: FieldRef<'MpesaOnrampSwap', 'SwapTransactionState'>;
    readonly userId: FieldRef<'MpesaOnrampSwap', 'String'>;
    readonly mpesaId: FieldRef<'MpesaOnrampSwap', 'String'>;
    readonly lightning: FieldRef<'MpesaOnrampSwap', 'String'>;
    readonly rate: FieldRef<'MpesaOnrampSwap', 'String'>;
    readonly retryCount: FieldRef<'MpesaOnrampSwap', 'Int'>;
    readonly createdAt: FieldRef<'MpesaOnrampSwap', 'DateTime'>;
    readonly updatedAt: FieldRef<'MpesaOnrampSwap', 'DateTime'>;
  }

  // Custom InputTypes
  /**
   * MpesaOnrampSwap findUnique
   */
  export type MpesaOnrampSwapFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOnrampSwap
     */
    select?: MpesaOnrampSwapSelect<ExtArgs> | null;
    /**
     * Filter, which MpesaOnrampSwap to fetch.
     */
    where: MpesaOnrampSwapWhereUniqueInput;
  };

  /**
   * MpesaOnrampSwap findUniqueOrThrow
   */
  export type MpesaOnrampSwapFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOnrampSwap
     */
    select?: MpesaOnrampSwapSelect<ExtArgs> | null;
    /**
     * Filter, which MpesaOnrampSwap to fetch.
     */
    where: MpesaOnrampSwapWhereUniqueInput;
  };

  /**
   * MpesaOnrampSwap findFirst
   */
  export type MpesaOnrampSwapFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOnrampSwap
     */
    select?: MpesaOnrampSwapSelect<ExtArgs> | null;
    /**
     * Filter, which MpesaOnrampSwap to fetch.
     */
    where?: MpesaOnrampSwapWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MpesaOnrampSwaps to fetch.
     */
    orderBy?:
      | MpesaOnrampSwapOrderByWithRelationInput
      | MpesaOnrampSwapOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for MpesaOnrampSwaps.
     */
    cursor?: MpesaOnrampSwapWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MpesaOnrampSwaps from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MpesaOnrampSwaps.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of MpesaOnrampSwaps.
     */
    distinct?:
      | MpesaOnrampSwapScalarFieldEnum
      | MpesaOnrampSwapScalarFieldEnum[];
  };

  /**
   * MpesaOnrampSwap findFirstOrThrow
   */
  export type MpesaOnrampSwapFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOnrampSwap
     */
    select?: MpesaOnrampSwapSelect<ExtArgs> | null;
    /**
     * Filter, which MpesaOnrampSwap to fetch.
     */
    where?: MpesaOnrampSwapWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MpesaOnrampSwaps to fetch.
     */
    orderBy?:
      | MpesaOnrampSwapOrderByWithRelationInput
      | MpesaOnrampSwapOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for MpesaOnrampSwaps.
     */
    cursor?: MpesaOnrampSwapWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MpesaOnrampSwaps from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MpesaOnrampSwaps.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of MpesaOnrampSwaps.
     */
    distinct?:
      | MpesaOnrampSwapScalarFieldEnum
      | MpesaOnrampSwapScalarFieldEnum[];
  };

  /**
   * MpesaOnrampSwap findMany
   */
  export type MpesaOnrampSwapFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOnrampSwap
     */
    select?: MpesaOnrampSwapSelect<ExtArgs> | null;
    /**
     * Filter, which MpesaOnrampSwaps to fetch.
     */
    where?: MpesaOnrampSwapWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MpesaOnrampSwaps to fetch.
     */
    orderBy?:
      | MpesaOnrampSwapOrderByWithRelationInput
      | MpesaOnrampSwapOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing MpesaOnrampSwaps.
     */
    cursor?: MpesaOnrampSwapWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MpesaOnrampSwaps from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MpesaOnrampSwaps.
     */
    skip?: number;
    distinct?:
      | MpesaOnrampSwapScalarFieldEnum
      | MpesaOnrampSwapScalarFieldEnum[];
  };

  /**
   * MpesaOnrampSwap create
   */
  export type MpesaOnrampSwapCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOnrampSwap
     */
    select?: MpesaOnrampSwapSelect<ExtArgs> | null;
    /**
     * The data needed to create a MpesaOnrampSwap.
     */
    data: XOR<MpesaOnrampSwapCreateInput, MpesaOnrampSwapUncheckedCreateInput>;
  };

  /**
   * MpesaOnrampSwap createMany
   */
  export type MpesaOnrampSwapCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many MpesaOnrampSwaps.
     */
    data: MpesaOnrampSwapCreateManyInput | MpesaOnrampSwapCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * MpesaOnrampSwap createManyAndReturn
   */
  export type MpesaOnrampSwapCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOnrampSwap
     */
    select?: MpesaOnrampSwapSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * The data used to create many MpesaOnrampSwaps.
     */
    data: MpesaOnrampSwapCreateManyInput | MpesaOnrampSwapCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * MpesaOnrampSwap update
   */
  export type MpesaOnrampSwapUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOnrampSwap
     */
    select?: MpesaOnrampSwapSelect<ExtArgs> | null;
    /**
     * The data needed to update a MpesaOnrampSwap.
     */
    data: XOR<MpesaOnrampSwapUpdateInput, MpesaOnrampSwapUncheckedUpdateInput>;
    /**
     * Choose, which MpesaOnrampSwap to update.
     */
    where: MpesaOnrampSwapWhereUniqueInput;
  };

  /**
   * MpesaOnrampSwap updateMany
   */
  export type MpesaOnrampSwapUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update MpesaOnrampSwaps.
     */
    data: XOR<
      MpesaOnrampSwapUpdateManyMutationInput,
      MpesaOnrampSwapUncheckedUpdateManyInput
    >;
    /**
     * Filter which MpesaOnrampSwaps to update
     */
    where?: MpesaOnrampSwapWhereInput;
  };

  /**
   * MpesaOnrampSwap upsert
   */
  export type MpesaOnrampSwapUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOnrampSwap
     */
    select?: MpesaOnrampSwapSelect<ExtArgs> | null;
    /**
     * The filter to search for the MpesaOnrampSwap to update in case it exists.
     */
    where: MpesaOnrampSwapWhereUniqueInput;
    /**
     * In case the MpesaOnrampSwap found by the `where` argument doesn't exist, create a new MpesaOnrampSwap with this data.
     */
    create: XOR<
      MpesaOnrampSwapCreateInput,
      MpesaOnrampSwapUncheckedCreateInput
    >;
    /**
     * In case the MpesaOnrampSwap was found with the provided `where` argument, update it with this data.
     */
    update: XOR<
      MpesaOnrampSwapUpdateInput,
      MpesaOnrampSwapUncheckedUpdateInput
    >;
  };

  /**
   * MpesaOnrampSwap delete
   */
  export type MpesaOnrampSwapDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOnrampSwap
     */
    select?: MpesaOnrampSwapSelect<ExtArgs> | null;
    /**
     * Filter which MpesaOnrampSwap to delete.
     */
    where: MpesaOnrampSwapWhereUniqueInput;
  };

  /**
   * MpesaOnrampSwap deleteMany
   */
  export type MpesaOnrampSwapDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which MpesaOnrampSwaps to delete
     */
    where?: MpesaOnrampSwapWhereInput;
  };

  /**
   * MpesaOnrampSwap without action
   */
  export type MpesaOnrampSwapDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOnrampSwap
     */
    select?: MpesaOnrampSwapSelect<ExtArgs> | null;
  };

  /**
   * Model MpesaOfframpSwap
   */

  export type AggregateMpesaOfframpSwap = {
    _count: MpesaOfframpSwapCountAggregateOutputType | null;
    _avg: MpesaOfframpSwapAvgAggregateOutputType | null;
    _sum: MpesaOfframpSwapSumAggregateOutputType | null;
    _min: MpesaOfframpSwapMinAggregateOutputType | null;
    _max: MpesaOfframpSwapMaxAggregateOutputType | null;
  };

  export type MpesaOfframpSwapAvgAggregateOutputType = {
    retryCount: number | null;
  };

  export type MpesaOfframpSwapSumAggregateOutputType = {
    retryCount: number | null;
  };

  export type MpesaOfframpSwapMinAggregateOutputType = {
    id: string | null;
    state: $Enums.SwapTransactionState | null;
    userId: string | null;
    mpesaId: string | null;
    lightning: string | null;
    rate: string | null;
    retryCount: number | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  };

  export type MpesaOfframpSwapMaxAggregateOutputType = {
    id: string | null;
    state: $Enums.SwapTransactionState | null;
    userId: string | null;
    mpesaId: string | null;
    lightning: string | null;
    rate: string | null;
    retryCount: number | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  };

  export type MpesaOfframpSwapCountAggregateOutputType = {
    id: number;
    state: number;
    userId: number;
    mpesaId: number;
    lightning: number;
    rate: number;
    retryCount: number;
    createdAt: number;
    updatedAt: number;
    _all: number;
  };

  export type MpesaOfframpSwapAvgAggregateInputType = {
    retryCount?: true;
  };

  export type MpesaOfframpSwapSumAggregateInputType = {
    retryCount?: true;
  };

  export type MpesaOfframpSwapMinAggregateInputType = {
    id?: true;
    state?: true;
    userId?: true;
    mpesaId?: true;
    lightning?: true;
    rate?: true;
    retryCount?: true;
    createdAt?: true;
    updatedAt?: true;
  };

  export type MpesaOfframpSwapMaxAggregateInputType = {
    id?: true;
    state?: true;
    userId?: true;
    mpesaId?: true;
    lightning?: true;
    rate?: true;
    retryCount?: true;
    createdAt?: true;
    updatedAt?: true;
  };

  export type MpesaOfframpSwapCountAggregateInputType = {
    id?: true;
    state?: true;
    userId?: true;
    mpesaId?: true;
    lightning?: true;
    rate?: true;
    retryCount?: true;
    createdAt?: true;
    updatedAt?: true;
    _all?: true;
  };

  export type MpesaOfframpSwapAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which MpesaOfframpSwap to aggregate.
     */
    where?: MpesaOfframpSwapWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MpesaOfframpSwaps to fetch.
     */
    orderBy?:
      | MpesaOfframpSwapOrderByWithRelationInput
      | MpesaOfframpSwapOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: MpesaOfframpSwapWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MpesaOfframpSwaps from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MpesaOfframpSwaps.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned MpesaOfframpSwaps
     **/
    _count?: true | MpesaOfframpSwapCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: MpesaOfframpSwapAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: MpesaOfframpSwapSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: MpesaOfframpSwapMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: MpesaOfframpSwapMaxAggregateInputType;
  };

  export type GetMpesaOfframpSwapAggregateType<
    T extends MpesaOfframpSwapAggregateArgs,
  > = {
    [P in keyof T & keyof AggregateMpesaOfframpSwap]: P extends
      | '_count'
      | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMpesaOfframpSwap[P]>
      : GetScalarType<T[P], AggregateMpesaOfframpSwap[P]>;
  };

  export type MpesaOfframpSwapGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: MpesaOfframpSwapWhereInput;
    orderBy?:
      | MpesaOfframpSwapOrderByWithAggregationInput
      | MpesaOfframpSwapOrderByWithAggregationInput[];
    by: MpesaOfframpSwapScalarFieldEnum[] | MpesaOfframpSwapScalarFieldEnum;
    having?: MpesaOfframpSwapScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: MpesaOfframpSwapCountAggregateInputType | true;
    _avg?: MpesaOfframpSwapAvgAggregateInputType;
    _sum?: MpesaOfframpSwapSumAggregateInputType;
    _min?: MpesaOfframpSwapMinAggregateInputType;
    _max?: MpesaOfframpSwapMaxAggregateInputType;
  };

  export type MpesaOfframpSwapGroupByOutputType = {
    id: string;
    state: $Enums.SwapTransactionState;
    userId: string;
    mpesaId: string | null;
    lightning: string;
    rate: string;
    retryCount: number;
    createdAt: Date;
    updatedAt: Date;
    _count: MpesaOfframpSwapCountAggregateOutputType | null;
    _avg: MpesaOfframpSwapAvgAggregateOutputType | null;
    _sum: MpesaOfframpSwapSumAggregateOutputType | null;
    _min: MpesaOfframpSwapMinAggregateOutputType | null;
    _max: MpesaOfframpSwapMaxAggregateOutputType | null;
  };

  type GetMpesaOfframpSwapGroupByPayload<
    T extends MpesaOfframpSwapGroupByArgs,
  > = Prisma.PrismaPromise<
    Array<
      PickEnumerable<MpesaOfframpSwapGroupByOutputType, T['by']> & {
        [P in keyof T &
          keyof MpesaOfframpSwapGroupByOutputType]: P extends '_count'
          ? T[P] extends boolean
            ? number
            : GetScalarType<T[P], MpesaOfframpSwapGroupByOutputType[P]>
          : GetScalarType<T[P], MpesaOfframpSwapGroupByOutputType[P]>;
      }
    >
  >;

  export type MpesaOfframpSwapSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      state?: boolean;
      userId?: boolean;
      mpesaId?: boolean;
      lightning?: boolean;
      rate?: boolean;
      retryCount?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
    },
    ExtArgs['result']['mpesaOfframpSwap']
  >;

  export type MpesaOfframpSwapSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      state?: boolean;
      userId?: boolean;
      mpesaId?: boolean;
      lightning?: boolean;
      rate?: boolean;
      retryCount?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
    },
    ExtArgs['result']['mpesaOfframpSwap']
  >;

  export type MpesaOfframpSwapSelectScalar = {
    id?: boolean;
    state?: boolean;
    userId?: boolean;
    mpesaId?: boolean;
    lightning?: boolean;
    rate?: boolean;
    retryCount?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
  };

  export type $MpesaOfframpSwapPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: 'MpesaOfframpSwap';
    objects: {};
    scalars: $Extensions.GetPayloadResult<
      {
        /**
         * Unique identifier for the swap
         */
        id: string;
        /**
         * Tracks progress of the swap
         */
        state: $Enums.SwapTransactionState;
        /**
         * References the user who made the transaction.
         */
        userId: string;
        /**
         * References the offramp Mpesa transaction ID.
         */
        mpesaId: string | null;
        /**
         * Lightning invoice to be paid before invoice can proceed.
         */
        lightning: string;
        /**
         * Fx Rate
         */
        rate: string;
        /**
         * Retry count tracker
         */
        retryCount: number;
        /**
         * Timestamps
         */
        createdAt: Date;
        updatedAt: Date;
      },
      ExtArgs['result']['mpesaOfframpSwap']
    >;
    composites: {};
  };

  type MpesaOfframpSwapGetPayload<
    S extends boolean | null | undefined | MpesaOfframpSwapDefaultArgs,
  > = $Result.GetResult<Prisma.$MpesaOfframpSwapPayload, S>;

  type MpesaOfframpSwapCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<MpesaOfframpSwapFindManyArgs, 'select' | 'include' | 'distinct'> & {
    select?: MpesaOfframpSwapCountAggregateInputType | true;
  };

  export interface MpesaOfframpSwapDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>['model']['MpesaOfframpSwap'];
      meta: { name: 'MpesaOfframpSwap' };
    };
    /**
     * Find zero or one MpesaOfframpSwap that matches the filter.
     * @param {MpesaOfframpSwapFindUniqueArgs} args - Arguments to find a MpesaOfframpSwap
     * @example
     * // Get one MpesaOfframpSwap
     * const mpesaOfframpSwap = await prisma.mpesaOfframpSwap.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MpesaOfframpSwapFindUniqueArgs>(
      args: SelectSubset<T, MpesaOfframpSwapFindUniqueArgs<ExtArgs>>,
    ): Prisma__MpesaOfframpSwapClient<
      $Result.GetResult<
        Prisma.$MpesaOfframpSwapPayload<ExtArgs>,
        T,
        'findUnique'
      > | null,
      null,
      ExtArgs
    >;

    /**
     * Find one MpesaOfframpSwap that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {MpesaOfframpSwapFindUniqueOrThrowArgs} args - Arguments to find a MpesaOfframpSwap
     * @example
     * // Get one MpesaOfframpSwap
     * const mpesaOfframpSwap = await prisma.mpesaOfframpSwap.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MpesaOfframpSwapFindUniqueOrThrowArgs>(
      args: SelectSubset<T, MpesaOfframpSwapFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__MpesaOfframpSwapClient<
      $Result.GetResult<
        Prisma.$MpesaOfframpSwapPayload<ExtArgs>,
        T,
        'findUniqueOrThrow'
      >,
      never,
      ExtArgs
    >;

    /**
     * Find the first MpesaOfframpSwap that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MpesaOfframpSwapFindFirstArgs} args - Arguments to find a MpesaOfframpSwap
     * @example
     * // Get one MpesaOfframpSwap
     * const mpesaOfframpSwap = await prisma.mpesaOfframpSwap.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MpesaOfframpSwapFindFirstArgs>(
      args?: SelectSubset<T, MpesaOfframpSwapFindFirstArgs<ExtArgs>>,
    ): Prisma__MpesaOfframpSwapClient<
      $Result.GetResult<
        Prisma.$MpesaOfframpSwapPayload<ExtArgs>,
        T,
        'findFirst'
      > | null,
      null,
      ExtArgs
    >;

    /**
     * Find the first MpesaOfframpSwap that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MpesaOfframpSwapFindFirstOrThrowArgs} args - Arguments to find a MpesaOfframpSwap
     * @example
     * // Get one MpesaOfframpSwap
     * const mpesaOfframpSwap = await prisma.mpesaOfframpSwap.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MpesaOfframpSwapFindFirstOrThrowArgs>(
      args?: SelectSubset<T, MpesaOfframpSwapFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__MpesaOfframpSwapClient<
      $Result.GetResult<
        Prisma.$MpesaOfframpSwapPayload<ExtArgs>,
        T,
        'findFirstOrThrow'
      >,
      never,
      ExtArgs
    >;

    /**
     * Find zero or more MpesaOfframpSwaps that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MpesaOfframpSwapFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MpesaOfframpSwaps
     * const mpesaOfframpSwaps = await prisma.mpesaOfframpSwap.findMany()
     *
     * // Get first 10 MpesaOfframpSwaps
     * const mpesaOfframpSwaps = await prisma.mpesaOfframpSwap.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const mpesaOfframpSwapWithIdOnly = await prisma.mpesaOfframpSwap.findMany({ select: { id: true } })
     *
     */
    findMany<T extends MpesaOfframpSwapFindManyArgs>(
      args?: SelectSubset<T, MpesaOfframpSwapFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<Prisma.$MpesaOfframpSwapPayload<ExtArgs>, T, 'findMany'>
    >;

    /**
     * Create a MpesaOfframpSwap.
     * @param {MpesaOfframpSwapCreateArgs} args - Arguments to create a MpesaOfframpSwap.
     * @example
     * // Create one MpesaOfframpSwap
     * const MpesaOfframpSwap = await prisma.mpesaOfframpSwap.create({
     *   data: {
     *     // ... data to create a MpesaOfframpSwap
     *   }
     * })
     *
     */
    create<T extends MpesaOfframpSwapCreateArgs>(
      args: SelectSubset<T, MpesaOfframpSwapCreateArgs<ExtArgs>>,
    ): Prisma__MpesaOfframpSwapClient<
      $Result.GetResult<Prisma.$MpesaOfframpSwapPayload<ExtArgs>, T, 'create'>,
      never,
      ExtArgs
    >;

    /**
     * Create many MpesaOfframpSwaps.
     * @param {MpesaOfframpSwapCreateManyArgs} args - Arguments to create many MpesaOfframpSwaps.
     * @example
     * // Create many MpesaOfframpSwaps
     * const mpesaOfframpSwap = await prisma.mpesaOfframpSwap.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends MpesaOfframpSwapCreateManyArgs>(
      args?: SelectSubset<T, MpesaOfframpSwapCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many MpesaOfframpSwaps and returns the data saved in the database.
     * @param {MpesaOfframpSwapCreateManyAndReturnArgs} args - Arguments to create many MpesaOfframpSwaps.
     * @example
     * // Create many MpesaOfframpSwaps
     * const mpesaOfframpSwap = await prisma.mpesaOfframpSwap.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many MpesaOfframpSwaps and only return the `id`
     * const mpesaOfframpSwapWithIdOnly = await prisma.mpesaOfframpSwap.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends MpesaOfframpSwapCreateManyAndReturnArgs>(
      args?: SelectSubset<T, MpesaOfframpSwapCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$MpesaOfframpSwapPayload<ExtArgs>,
        T,
        'createManyAndReturn'
      >
    >;

    /**
     * Delete a MpesaOfframpSwap.
     * @param {MpesaOfframpSwapDeleteArgs} args - Arguments to delete one MpesaOfframpSwap.
     * @example
     * // Delete one MpesaOfframpSwap
     * const MpesaOfframpSwap = await prisma.mpesaOfframpSwap.delete({
     *   where: {
     *     // ... filter to delete one MpesaOfframpSwap
     *   }
     * })
     *
     */
    delete<T extends MpesaOfframpSwapDeleteArgs>(
      args: SelectSubset<T, MpesaOfframpSwapDeleteArgs<ExtArgs>>,
    ): Prisma__MpesaOfframpSwapClient<
      $Result.GetResult<Prisma.$MpesaOfframpSwapPayload<ExtArgs>, T, 'delete'>,
      never,
      ExtArgs
    >;

    /**
     * Update one MpesaOfframpSwap.
     * @param {MpesaOfframpSwapUpdateArgs} args - Arguments to update one MpesaOfframpSwap.
     * @example
     * // Update one MpesaOfframpSwap
     * const mpesaOfframpSwap = await prisma.mpesaOfframpSwap.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends MpesaOfframpSwapUpdateArgs>(
      args: SelectSubset<T, MpesaOfframpSwapUpdateArgs<ExtArgs>>,
    ): Prisma__MpesaOfframpSwapClient<
      $Result.GetResult<Prisma.$MpesaOfframpSwapPayload<ExtArgs>, T, 'update'>,
      never,
      ExtArgs
    >;

    /**
     * Delete zero or more MpesaOfframpSwaps.
     * @param {MpesaOfframpSwapDeleteManyArgs} args - Arguments to filter MpesaOfframpSwaps to delete.
     * @example
     * // Delete a few MpesaOfframpSwaps
     * const { count } = await prisma.mpesaOfframpSwap.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends MpesaOfframpSwapDeleteManyArgs>(
      args?: SelectSubset<T, MpesaOfframpSwapDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more MpesaOfframpSwaps.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MpesaOfframpSwapUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MpesaOfframpSwaps
     * const mpesaOfframpSwap = await prisma.mpesaOfframpSwap.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends MpesaOfframpSwapUpdateManyArgs>(
      args: SelectSubset<T, MpesaOfframpSwapUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create or update one MpesaOfframpSwap.
     * @param {MpesaOfframpSwapUpsertArgs} args - Arguments to update or create a MpesaOfframpSwap.
     * @example
     * // Update or create a MpesaOfframpSwap
     * const mpesaOfframpSwap = await prisma.mpesaOfframpSwap.upsert({
     *   create: {
     *     // ... data to create a MpesaOfframpSwap
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MpesaOfframpSwap we want to update
     *   }
     * })
     */
    upsert<T extends MpesaOfframpSwapUpsertArgs>(
      args: SelectSubset<T, MpesaOfframpSwapUpsertArgs<ExtArgs>>,
    ): Prisma__MpesaOfframpSwapClient<
      $Result.GetResult<Prisma.$MpesaOfframpSwapPayload<ExtArgs>, T, 'upsert'>,
      never,
      ExtArgs
    >;

    /**
     * Count the number of MpesaOfframpSwaps.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MpesaOfframpSwapCountArgs} args - Arguments to filter MpesaOfframpSwaps to count.
     * @example
     * // Count the number of MpesaOfframpSwaps
     * const count = await prisma.mpesaOfframpSwap.count({
     *   where: {
     *     // ... the filter for the MpesaOfframpSwaps we want to count
     *   }
     * })
     **/
    count<T extends MpesaOfframpSwapCountArgs>(
      args?: Subset<T, MpesaOfframpSwapCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MpesaOfframpSwapCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a MpesaOfframpSwap.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MpesaOfframpSwapAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends MpesaOfframpSwapAggregateArgs>(
      args: Subset<T, MpesaOfframpSwapAggregateArgs>,
    ): Prisma.PrismaPromise<GetMpesaOfframpSwapAggregateType<T>>;

    /**
     * Group by MpesaOfframpSwap.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MpesaOfframpSwapGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends MpesaOfframpSwapGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MpesaOfframpSwapGroupByArgs['orderBy'] }
        : { orderBy?: MpesaOfframpSwapGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<
        Keys<MaybeTupleToUnion<T['orderBy']>>
      >,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [
                      Error,
                      'Field ',
                      P,
                      ` in "having" needs to be provided in "by"`,
                    ];
            }[HavingFields]
          : 'take' extends Keys<T>
            ? 'orderBy' extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : 'skip' extends Keys<T>
              ? 'orderBy' extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields
                        ? never
                        : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, MpesaOfframpSwapGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetMpesaOfframpSwapGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the MpesaOfframpSwap model
     */
    readonly fields: MpesaOfframpSwapFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for MpesaOfframpSwap.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MpesaOfframpSwapClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | undefined
        | null,
      onrejected?:
        | ((reason: any) => TResult2 | PromiseLike<TResult2>)
        | undefined
        | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(
      onrejected?:
        | ((reason: any) => TResult | PromiseLike<TResult>)
        | undefined
        | null,
    ): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the MpesaOfframpSwap model
   */
  interface MpesaOfframpSwapFieldRefs {
    readonly id: FieldRef<'MpesaOfframpSwap', 'String'>;
    readonly state: FieldRef<'MpesaOfframpSwap', 'SwapTransactionState'>;
    readonly userId: FieldRef<'MpesaOfframpSwap', 'String'>;
    readonly mpesaId: FieldRef<'MpesaOfframpSwap', 'String'>;
    readonly lightning: FieldRef<'MpesaOfframpSwap', 'String'>;
    readonly rate: FieldRef<'MpesaOfframpSwap', 'String'>;
    readonly retryCount: FieldRef<'MpesaOfframpSwap', 'Int'>;
    readonly createdAt: FieldRef<'MpesaOfframpSwap', 'DateTime'>;
    readonly updatedAt: FieldRef<'MpesaOfframpSwap', 'DateTime'>;
  }

  // Custom InputTypes
  /**
   * MpesaOfframpSwap findUnique
   */
  export type MpesaOfframpSwapFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOfframpSwap
     */
    select?: MpesaOfframpSwapSelect<ExtArgs> | null;
    /**
     * Filter, which MpesaOfframpSwap to fetch.
     */
    where: MpesaOfframpSwapWhereUniqueInput;
  };

  /**
   * MpesaOfframpSwap findUniqueOrThrow
   */
  export type MpesaOfframpSwapFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOfframpSwap
     */
    select?: MpesaOfframpSwapSelect<ExtArgs> | null;
    /**
     * Filter, which MpesaOfframpSwap to fetch.
     */
    where: MpesaOfframpSwapWhereUniqueInput;
  };

  /**
   * MpesaOfframpSwap findFirst
   */
  export type MpesaOfframpSwapFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOfframpSwap
     */
    select?: MpesaOfframpSwapSelect<ExtArgs> | null;
    /**
     * Filter, which MpesaOfframpSwap to fetch.
     */
    where?: MpesaOfframpSwapWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MpesaOfframpSwaps to fetch.
     */
    orderBy?:
      | MpesaOfframpSwapOrderByWithRelationInput
      | MpesaOfframpSwapOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for MpesaOfframpSwaps.
     */
    cursor?: MpesaOfframpSwapWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MpesaOfframpSwaps from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MpesaOfframpSwaps.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of MpesaOfframpSwaps.
     */
    distinct?:
      | MpesaOfframpSwapScalarFieldEnum
      | MpesaOfframpSwapScalarFieldEnum[];
  };

  /**
   * MpesaOfframpSwap findFirstOrThrow
   */
  export type MpesaOfframpSwapFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOfframpSwap
     */
    select?: MpesaOfframpSwapSelect<ExtArgs> | null;
    /**
     * Filter, which MpesaOfframpSwap to fetch.
     */
    where?: MpesaOfframpSwapWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MpesaOfframpSwaps to fetch.
     */
    orderBy?:
      | MpesaOfframpSwapOrderByWithRelationInput
      | MpesaOfframpSwapOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for MpesaOfframpSwaps.
     */
    cursor?: MpesaOfframpSwapWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MpesaOfframpSwaps from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MpesaOfframpSwaps.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of MpesaOfframpSwaps.
     */
    distinct?:
      | MpesaOfframpSwapScalarFieldEnum
      | MpesaOfframpSwapScalarFieldEnum[];
  };

  /**
   * MpesaOfframpSwap findMany
   */
  export type MpesaOfframpSwapFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOfframpSwap
     */
    select?: MpesaOfframpSwapSelect<ExtArgs> | null;
    /**
     * Filter, which MpesaOfframpSwaps to fetch.
     */
    where?: MpesaOfframpSwapWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MpesaOfframpSwaps to fetch.
     */
    orderBy?:
      | MpesaOfframpSwapOrderByWithRelationInput
      | MpesaOfframpSwapOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing MpesaOfframpSwaps.
     */
    cursor?: MpesaOfframpSwapWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MpesaOfframpSwaps from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MpesaOfframpSwaps.
     */
    skip?: number;
    distinct?:
      | MpesaOfframpSwapScalarFieldEnum
      | MpesaOfframpSwapScalarFieldEnum[];
  };

  /**
   * MpesaOfframpSwap create
   */
  export type MpesaOfframpSwapCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOfframpSwap
     */
    select?: MpesaOfframpSwapSelect<ExtArgs> | null;
    /**
     * The data needed to create a MpesaOfframpSwap.
     */
    data: XOR<
      MpesaOfframpSwapCreateInput,
      MpesaOfframpSwapUncheckedCreateInput
    >;
  };

  /**
   * MpesaOfframpSwap createMany
   */
  export type MpesaOfframpSwapCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many MpesaOfframpSwaps.
     */
    data: MpesaOfframpSwapCreateManyInput | MpesaOfframpSwapCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * MpesaOfframpSwap createManyAndReturn
   */
  export type MpesaOfframpSwapCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOfframpSwap
     */
    select?: MpesaOfframpSwapSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * The data used to create many MpesaOfframpSwaps.
     */
    data: MpesaOfframpSwapCreateManyInput | MpesaOfframpSwapCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * MpesaOfframpSwap update
   */
  export type MpesaOfframpSwapUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOfframpSwap
     */
    select?: MpesaOfframpSwapSelect<ExtArgs> | null;
    /**
     * The data needed to update a MpesaOfframpSwap.
     */
    data: XOR<
      MpesaOfframpSwapUpdateInput,
      MpesaOfframpSwapUncheckedUpdateInput
    >;
    /**
     * Choose, which MpesaOfframpSwap to update.
     */
    where: MpesaOfframpSwapWhereUniqueInput;
  };

  /**
   * MpesaOfframpSwap updateMany
   */
  export type MpesaOfframpSwapUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update MpesaOfframpSwaps.
     */
    data: XOR<
      MpesaOfframpSwapUpdateManyMutationInput,
      MpesaOfframpSwapUncheckedUpdateManyInput
    >;
    /**
     * Filter which MpesaOfframpSwaps to update
     */
    where?: MpesaOfframpSwapWhereInput;
  };

  /**
   * MpesaOfframpSwap upsert
   */
  export type MpesaOfframpSwapUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOfframpSwap
     */
    select?: MpesaOfframpSwapSelect<ExtArgs> | null;
    /**
     * The filter to search for the MpesaOfframpSwap to update in case it exists.
     */
    where: MpesaOfframpSwapWhereUniqueInput;
    /**
     * In case the MpesaOfframpSwap found by the `where` argument doesn't exist, create a new MpesaOfframpSwap with this data.
     */
    create: XOR<
      MpesaOfframpSwapCreateInput,
      MpesaOfframpSwapUncheckedCreateInput
    >;
    /**
     * In case the MpesaOfframpSwap was found with the provided `where` argument, update it with this data.
     */
    update: XOR<
      MpesaOfframpSwapUpdateInput,
      MpesaOfframpSwapUncheckedUpdateInput
    >;
  };

  /**
   * MpesaOfframpSwap delete
   */
  export type MpesaOfframpSwapDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOfframpSwap
     */
    select?: MpesaOfframpSwapSelect<ExtArgs> | null;
    /**
     * Filter which MpesaOfframpSwap to delete.
     */
    where: MpesaOfframpSwapWhereUniqueInput;
  };

  /**
   * MpesaOfframpSwap deleteMany
   */
  export type MpesaOfframpSwapDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which MpesaOfframpSwaps to delete
     */
    where?: MpesaOfframpSwapWhereInput;
  };

  /**
   * MpesaOfframpSwap without action
   */
  export type MpesaOfframpSwapDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MpesaOfframpSwap
     */
    select?: MpesaOfframpSwapSelect<ExtArgs> | null;
  };

  /**
   * Model IntasendMpesaTransaction
   */

  export type AggregateIntasendMpesaTransaction = {
    _count: IntasendMpesaTransactionCountAggregateOutputType | null;
    _avg: IntasendMpesaTransactionAvgAggregateOutputType | null;
    _sum: IntasendMpesaTransactionSumAggregateOutputType | null;
    _min: IntasendMpesaTransactionMinAggregateOutputType | null;
    _max: IntasendMpesaTransactionMaxAggregateOutputType | null;
  };

  export type IntasendMpesaTransactionAvgAggregateOutputType = {
    retryCount: number | null;
  };

  export type IntasendMpesaTransactionSumAggregateOutputType = {
    retryCount: number | null;
  };

  export type IntasendMpesaTransactionMinAggregateOutputType = {
    id: string | null;
    state: $Enums.SwapTransactionState | null;
    apiRef: string | null;
    value: string | null;
    charges: string | null;
    netAmount: string | null;
    currency: string | null;
    account: string | null;
    retryCount: number | null;
    createdAt: string | null;
    updatedAt: string | null;
  };

  export type IntasendMpesaTransactionMaxAggregateOutputType = {
    id: string | null;
    state: $Enums.SwapTransactionState | null;
    apiRef: string | null;
    value: string | null;
    charges: string | null;
    netAmount: string | null;
    currency: string | null;
    account: string | null;
    retryCount: number | null;
    createdAt: string | null;
    updatedAt: string | null;
  };

  export type IntasendMpesaTransactionCountAggregateOutputType = {
    id: number;
    state: number;
    apiRef: number;
    value: number;
    charges: number;
    netAmount: number;
    currency: number;
    account: number;
    retryCount: number;
    createdAt: number;
    updatedAt: number;
    _all: number;
  };

  export type IntasendMpesaTransactionAvgAggregateInputType = {
    retryCount?: true;
  };

  export type IntasendMpesaTransactionSumAggregateInputType = {
    retryCount?: true;
  };

  export type IntasendMpesaTransactionMinAggregateInputType = {
    id?: true;
    state?: true;
    apiRef?: true;
    value?: true;
    charges?: true;
    netAmount?: true;
    currency?: true;
    account?: true;
    retryCount?: true;
    createdAt?: true;
    updatedAt?: true;
  };

  export type IntasendMpesaTransactionMaxAggregateInputType = {
    id?: true;
    state?: true;
    apiRef?: true;
    value?: true;
    charges?: true;
    netAmount?: true;
    currency?: true;
    account?: true;
    retryCount?: true;
    createdAt?: true;
    updatedAt?: true;
  };

  export type IntasendMpesaTransactionCountAggregateInputType = {
    id?: true;
    state?: true;
    apiRef?: true;
    value?: true;
    charges?: true;
    netAmount?: true;
    currency?: true;
    account?: true;
    retryCount?: true;
    createdAt?: true;
    updatedAt?: true;
    _all?: true;
  };

  export type IntasendMpesaTransactionAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which IntasendMpesaTransaction to aggregate.
     */
    where?: IntasendMpesaTransactionWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of IntasendMpesaTransactions to fetch.
     */
    orderBy?:
      | IntasendMpesaTransactionOrderByWithRelationInput
      | IntasendMpesaTransactionOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: IntasendMpesaTransactionWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` IntasendMpesaTransactions from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` IntasendMpesaTransactions.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned IntasendMpesaTransactions
     **/
    _count?: true | IntasendMpesaTransactionCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: IntasendMpesaTransactionAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: IntasendMpesaTransactionSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: IntasendMpesaTransactionMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: IntasendMpesaTransactionMaxAggregateInputType;
  };

  export type GetIntasendMpesaTransactionAggregateType<
    T extends IntasendMpesaTransactionAggregateArgs,
  > = {
    [P in keyof T & keyof AggregateIntasendMpesaTransaction]: P extends
      | '_count'
      | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateIntasendMpesaTransaction[P]>
      : GetScalarType<T[P], AggregateIntasendMpesaTransaction[P]>;
  };

  export type IntasendMpesaTransactionGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: IntasendMpesaTransactionWhereInput;
    orderBy?:
      | IntasendMpesaTransactionOrderByWithAggregationInput
      | IntasendMpesaTransactionOrderByWithAggregationInput[];
    by:
      | IntasendMpesaTransactionScalarFieldEnum[]
      | IntasendMpesaTransactionScalarFieldEnum;
    having?: IntasendMpesaTransactionScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: IntasendMpesaTransactionCountAggregateInputType | true;
    _avg?: IntasendMpesaTransactionAvgAggregateInputType;
    _sum?: IntasendMpesaTransactionSumAggregateInputType;
    _min?: IntasendMpesaTransactionMinAggregateInputType;
    _max?: IntasendMpesaTransactionMaxAggregateInputType;
  };

  export type IntasendMpesaTransactionGroupByOutputType = {
    id: string;
    state: $Enums.SwapTransactionState;
    apiRef: string;
    value: string;
    charges: string;
    netAmount: string;
    currency: string;
    account: string;
    retryCount: number;
    createdAt: string;
    updatedAt: string;
    _count: IntasendMpesaTransactionCountAggregateOutputType | null;
    _avg: IntasendMpesaTransactionAvgAggregateOutputType | null;
    _sum: IntasendMpesaTransactionSumAggregateOutputType | null;
    _min: IntasendMpesaTransactionMinAggregateOutputType | null;
    _max: IntasendMpesaTransactionMaxAggregateOutputType | null;
  };

  type GetIntasendMpesaTransactionGroupByPayload<
    T extends IntasendMpesaTransactionGroupByArgs,
  > = Prisma.PrismaPromise<
    Array<
      PickEnumerable<IntasendMpesaTransactionGroupByOutputType, T['by']> & {
        [P in keyof T &
          keyof IntasendMpesaTransactionGroupByOutputType]: P extends '_count'
          ? T[P] extends boolean
            ? number
            : GetScalarType<T[P], IntasendMpesaTransactionGroupByOutputType[P]>
          : GetScalarType<T[P], IntasendMpesaTransactionGroupByOutputType[P]>;
      }
    >
  >;

  export type IntasendMpesaTransactionSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      state?: boolean;
      apiRef?: boolean;
      value?: boolean;
      charges?: boolean;
      netAmount?: boolean;
      currency?: boolean;
      account?: boolean;
      retryCount?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
    },
    ExtArgs['result']['intasendMpesaTransaction']
  >;

  export type IntasendMpesaTransactionSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      state?: boolean;
      apiRef?: boolean;
      value?: boolean;
      charges?: boolean;
      netAmount?: boolean;
      currency?: boolean;
      account?: boolean;
      retryCount?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
    },
    ExtArgs['result']['intasendMpesaTransaction']
  >;

  export type IntasendMpesaTransactionSelectScalar = {
    id?: boolean;
    state?: boolean;
    apiRef?: boolean;
    value?: boolean;
    charges?: boolean;
    netAmount?: boolean;
    currency?: boolean;
    account?: boolean;
    retryCount?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
  };

  export type $IntasendMpesaTransactionPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: 'IntasendMpesaTransaction';
    objects: {};
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        state: $Enums.SwapTransactionState;
        apiRef: string;
        value: string;
        charges: string;
        netAmount: string;
        currency: string;
        account: string;
        retryCount: number;
        createdAt: string;
        updatedAt: string;
      },
      ExtArgs['result']['intasendMpesaTransaction']
    >;
    composites: {};
  };

  type IntasendMpesaTransactionGetPayload<
    S extends boolean | null | undefined | IntasendMpesaTransactionDefaultArgs,
  > = $Result.GetResult<Prisma.$IntasendMpesaTransactionPayload, S>;

  type IntasendMpesaTransactionCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<
    IntasendMpesaTransactionFindManyArgs,
    'select' | 'include' | 'distinct'
  > & {
    select?: IntasendMpesaTransactionCountAggregateInputType | true;
  };

  export interface IntasendMpesaTransactionDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>['model']['IntasendMpesaTransaction'];
      meta: { name: 'IntasendMpesaTransaction' };
    };
    /**
     * Find zero or one IntasendMpesaTransaction that matches the filter.
     * @param {IntasendMpesaTransactionFindUniqueArgs} args - Arguments to find a IntasendMpesaTransaction
     * @example
     * // Get one IntasendMpesaTransaction
     * const intasendMpesaTransaction = await prisma.intasendMpesaTransaction.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends IntasendMpesaTransactionFindUniqueArgs>(
      args: SelectSubset<T, IntasendMpesaTransactionFindUniqueArgs<ExtArgs>>,
    ): Prisma__IntasendMpesaTransactionClient<
      $Result.GetResult<
        Prisma.$IntasendMpesaTransactionPayload<ExtArgs>,
        T,
        'findUnique'
      > | null,
      null,
      ExtArgs
    >;

    /**
     * Find one IntasendMpesaTransaction that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {IntasendMpesaTransactionFindUniqueOrThrowArgs} args - Arguments to find a IntasendMpesaTransaction
     * @example
     * // Get one IntasendMpesaTransaction
     * const intasendMpesaTransaction = await prisma.intasendMpesaTransaction.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends IntasendMpesaTransactionFindUniqueOrThrowArgs>(
      args: SelectSubset<
        T,
        IntasendMpesaTransactionFindUniqueOrThrowArgs<ExtArgs>
      >,
    ): Prisma__IntasendMpesaTransactionClient<
      $Result.GetResult<
        Prisma.$IntasendMpesaTransactionPayload<ExtArgs>,
        T,
        'findUniqueOrThrow'
      >,
      never,
      ExtArgs
    >;

    /**
     * Find the first IntasendMpesaTransaction that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {IntasendMpesaTransactionFindFirstArgs} args - Arguments to find a IntasendMpesaTransaction
     * @example
     * // Get one IntasendMpesaTransaction
     * const intasendMpesaTransaction = await prisma.intasendMpesaTransaction.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends IntasendMpesaTransactionFindFirstArgs>(
      args?: SelectSubset<T, IntasendMpesaTransactionFindFirstArgs<ExtArgs>>,
    ): Prisma__IntasendMpesaTransactionClient<
      $Result.GetResult<
        Prisma.$IntasendMpesaTransactionPayload<ExtArgs>,
        T,
        'findFirst'
      > | null,
      null,
      ExtArgs
    >;

    /**
     * Find the first IntasendMpesaTransaction that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {IntasendMpesaTransactionFindFirstOrThrowArgs} args - Arguments to find a IntasendMpesaTransaction
     * @example
     * // Get one IntasendMpesaTransaction
     * const intasendMpesaTransaction = await prisma.intasendMpesaTransaction.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends IntasendMpesaTransactionFindFirstOrThrowArgs>(
      args?: SelectSubset<
        T,
        IntasendMpesaTransactionFindFirstOrThrowArgs<ExtArgs>
      >,
    ): Prisma__IntasendMpesaTransactionClient<
      $Result.GetResult<
        Prisma.$IntasendMpesaTransactionPayload<ExtArgs>,
        T,
        'findFirstOrThrow'
      >,
      never,
      ExtArgs
    >;

    /**
     * Find zero or more IntasendMpesaTransactions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {IntasendMpesaTransactionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all IntasendMpesaTransactions
     * const intasendMpesaTransactions = await prisma.intasendMpesaTransaction.findMany()
     *
     * // Get first 10 IntasendMpesaTransactions
     * const intasendMpesaTransactions = await prisma.intasendMpesaTransaction.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const intasendMpesaTransactionWithIdOnly = await prisma.intasendMpesaTransaction.findMany({ select: { id: true } })
     *
     */
    findMany<T extends IntasendMpesaTransactionFindManyArgs>(
      args?: SelectSubset<T, IntasendMpesaTransactionFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$IntasendMpesaTransactionPayload<ExtArgs>,
        T,
        'findMany'
      >
    >;

    /**
     * Create a IntasendMpesaTransaction.
     * @param {IntasendMpesaTransactionCreateArgs} args - Arguments to create a IntasendMpesaTransaction.
     * @example
     * // Create one IntasendMpesaTransaction
     * const IntasendMpesaTransaction = await prisma.intasendMpesaTransaction.create({
     *   data: {
     *     // ... data to create a IntasendMpesaTransaction
     *   }
     * })
     *
     */
    create<T extends IntasendMpesaTransactionCreateArgs>(
      args: SelectSubset<T, IntasendMpesaTransactionCreateArgs<ExtArgs>>,
    ): Prisma__IntasendMpesaTransactionClient<
      $Result.GetResult<
        Prisma.$IntasendMpesaTransactionPayload<ExtArgs>,
        T,
        'create'
      >,
      never,
      ExtArgs
    >;

    /**
     * Create many IntasendMpesaTransactions.
     * @param {IntasendMpesaTransactionCreateManyArgs} args - Arguments to create many IntasendMpesaTransactions.
     * @example
     * // Create many IntasendMpesaTransactions
     * const intasendMpesaTransaction = await prisma.intasendMpesaTransaction.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends IntasendMpesaTransactionCreateManyArgs>(
      args?: SelectSubset<T, IntasendMpesaTransactionCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many IntasendMpesaTransactions and returns the data saved in the database.
     * @param {IntasendMpesaTransactionCreateManyAndReturnArgs} args - Arguments to create many IntasendMpesaTransactions.
     * @example
     * // Create many IntasendMpesaTransactions
     * const intasendMpesaTransaction = await prisma.intasendMpesaTransaction.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many IntasendMpesaTransactions and only return the `id`
     * const intasendMpesaTransactionWithIdOnly = await prisma.intasendMpesaTransaction.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<
      T extends IntasendMpesaTransactionCreateManyAndReturnArgs,
    >(
      args?: SelectSubset<
        T,
        IntasendMpesaTransactionCreateManyAndReturnArgs<ExtArgs>
      >,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$IntasendMpesaTransactionPayload<ExtArgs>,
        T,
        'createManyAndReturn'
      >
    >;

    /**
     * Delete a IntasendMpesaTransaction.
     * @param {IntasendMpesaTransactionDeleteArgs} args - Arguments to delete one IntasendMpesaTransaction.
     * @example
     * // Delete one IntasendMpesaTransaction
     * const IntasendMpesaTransaction = await prisma.intasendMpesaTransaction.delete({
     *   where: {
     *     // ... filter to delete one IntasendMpesaTransaction
     *   }
     * })
     *
     */
    delete<T extends IntasendMpesaTransactionDeleteArgs>(
      args: SelectSubset<T, IntasendMpesaTransactionDeleteArgs<ExtArgs>>,
    ): Prisma__IntasendMpesaTransactionClient<
      $Result.GetResult<
        Prisma.$IntasendMpesaTransactionPayload<ExtArgs>,
        T,
        'delete'
      >,
      never,
      ExtArgs
    >;

    /**
     * Update one IntasendMpesaTransaction.
     * @param {IntasendMpesaTransactionUpdateArgs} args - Arguments to update one IntasendMpesaTransaction.
     * @example
     * // Update one IntasendMpesaTransaction
     * const intasendMpesaTransaction = await prisma.intasendMpesaTransaction.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends IntasendMpesaTransactionUpdateArgs>(
      args: SelectSubset<T, IntasendMpesaTransactionUpdateArgs<ExtArgs>>,
    ): Prisma__IntasendMpesaTransactionClient<
      $Result.GetResult<
        Prisma.$IntasendMpesaTransactionPayload<ExtArgs>,
        T,
        'update'
      >,
      never,
      ExtArgs
    >;

    /**
     * Delete zero or more IntasendMpesaTransactions.
     * @param {IntasendMpesaTransactionDeleteManyArgs} args - Arguments to filter IntasendMpesaTransactions to delete.
     * @example
     * // Delete a few IntasendMpesaTransactions
     * const { count } = await prisma.intasendMpesaTransaction.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends IntasendMpesaTransactionDeleteManyArgs>(
      args?: SelectSubset<T, IntasendMpesaTransactionDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more IntasendMpesaTransactions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {IntasendMpesaTransactionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many IntasendMpesaTransactions
     * const intasendMpesaTransaction = await prisma.intasendMpesaTransaction.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends IntasendMpesaTransactionUpdateManyArgs>(
      args: SelectSubset<T, IntasendMpesaTransactionUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create or update one IntasendMpesaTransaction.
     * @param {IntasendMpesaTransactionUpsertArgs} args - Arguments to update or create a IntasendMpesaTransaction.
     * @example
     * // Update or create a IntasendMpesaTransaction
     * const intasendMpesaTransaction = await prisma.intasendMpesaTransaction.upsert({
     *   create: {
     *     // ... data to create a IntasendMpesaTransaction
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the IntasendMpesaTransaction we want to update
     *   }
     * })
     */
    upsert<T extends IntasendMpesaTransactionUpsertArgs>(
      args: SelectSubset<T, IntasendMpesaTransactionUpsertArgs<ExtArgs>>,
    ): Prisma__IntasendMpesaTransactionClient<
      $Result.GetResult<
        Prisma.$IntasendMpesaTransactionPayload<ExtArgs>,
        T,
        'upsert'
      >,
      never,
      ExtArgs
    >;

    /**
     * Count the number of IntasendMpesaTransactions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {IntasendMpesaTransactionCountArgs} args - Arguments to filter IntasendMpesaTransactions to count.
     * @example
     * // Count the number of IntasendMpesaTransactions
     * const count = await prisma.intasendMpesaTransaction.count({
     *   where: {
     *     // ... the filter for the IntasendMpesaTransactions we want to count
     *   }
     * })
     **/
    count<T extends IntasendMpesaTransactionCountArgs>(
      args?: Subset<T, IntasendMpesaTransactionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<
              T['select'],
              IntasendMpesaTransactionCountAggregateOutputType
            >
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a IntasendMpesaTransaction.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {IntasendMpesaTransactionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends IntasendMpesaTransactionAggregateArgs>(
      args: Subset<T, IntasendMpesaTransactionAggregateArgs>,
    ): Prisma.PrismaPromise<GetIntasendMpesaTransactionAggregateType<T>>;

    /**
     * Group by IntasendMpesaTransaction.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {IntasendMpesaTransactionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends IntasendMpesaTransactionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: IntasendMpesaTransactionGroupByArgs['orderBy'] }
        : { orderBy?: IntasendMpesaTransactionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<
        Keys<MaybeTupleToUnion<T['orderBy']>>
      >,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [
                      Error,
                      'Field ',
                      P,
                      ` in "having" needs to be provided in "by"`,
                    ];
            }[HavingFields]
          : 'take' extends Keys<T>
            ? 'orderBy' extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : 'skip' extends Keys<T>
              ? 'orderBy' extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields
                        ? never
                        : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<
        T,
        IntasendMpesaTransactionGroupByArgs,
        OrderByArg
      > &
        InputErrors,
    ): {} extends InputErrors
      ? GetIntasendMpesaTransactionGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the IntasendMpesaTransaction model
     */
    readonly fields: IntasendMpesaTransactionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for IntasendMpesaTransaction.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__IntasendMpesaTransactionClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | undefined
        | null,
      onrejected?:
        | ((reason: any) => TResult2 | PromiseLike<TResult2>)
        | undefined
        | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(
      onrejected?:
        | ((reason: any) => TResult | PromiseLike<TResult>)
        | undefined
        | null,
    ): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the IntasendMpesaTransaction model
   */
  interface IntasendMpesaTransactionFieldRefs {
    readonly id: FieldRef<'IntasendMpesaTransaction', 'String'>;
    readonly state: FieldRef<
      'IntasendMpesaTransaction',
      'SwapTransactionState'
    >;
    readonly apiRef: FieldRef<'IntasendMpesaTransaction', 'String'>;
    readonly value: FieldRef<'IntasendMpesaTransaction', 'String'>;
    readonly charges: FieldRef<'IntasendMpesaTransaction', 'String'>;
    readonly netAmount: FieldRef<'IntasendMpesaTransaction', 'String'>;
    readonly currency: FieldRef<'IntasendMpesaTransaction', 'String'>;
    readonly account: FieldRef<'IntasendMpesaTransaction', 'String'>;
    readonly retryCount: FieldRef<'IntasendMpesaTransaction', 'Int'>;
    readonly createdAt: FieldRef<'IntasendMpesaTransaction', 'String'>;
    readonly updatedAt: FieldRef<'IntasendMpesaTransaction', 'String'>;
  }

  // Custom InputTypes
  /**
   * IntasendMpesaTransaction findUnique
   */
  export type IntasendMpesaTransactionFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the IntasendMpesaTransaction
     */
    select?: IntasendMpesaTransactionSelect<ExtArgs> | null;
    /**
     * Filter, which IntasendMpesaTransaction to fetch.
     */
    where: IntasendMpesaTransactionWhereUniqueInput;
  };

  /**
   * IntasendMpesaTransaction findUniqueOrThrow
   */
  export type IntasendMpesaTransactionFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the IntasendMpesaTransaction
     */
    select?: IntasendMpesaTransactionSelect<ExtArgs> | null;
    /**
     * Filter, which IntasendMpesaTransaction to fetch.
     */
    where: IntasendMpesaTransactionWhereUniqueInput;
  };

  /**
   * IntasendMpesaTransaction findFirst
   */
  export type IntasendMpesaTransactionFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the IntasendMpesaTransaction
     */
    select?: IntasendMpesaTransactionSelect<ExtArgs> | null;
    /**
     * Filter, which IntasendMpesaTransaction to fetch.
     */
    where?: IntasendMpesaTransactionWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of IntasendMpesaTransactions to fetch.
     */
    orderBy?:
      | IntasendMpesaTransactionOrderByWithRelationInput
      | IntasendMpesaTransactionOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for IntasendMpesaTransactions.
     */
    cursor?: IntasendMpesaTransactionWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` IntasendMpesaTransactions from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` IntasendMpesaTransactions.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of IntasendMpesaTransactions.
     */
    distinct?:
      | IntasendMpesaTransactionScalarFieldEnum
      | IntasendMpesaTransactionScalarFieldEnum[];
  };

  /**
   * IntasendMpesaTransaction findFirstOrThrow
   */
  export type IntasendMpesaTransactionFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the IntasendMpesaTransaction
     */
    select?: IntasendMpesaTransactionSelect<ExtArgs> | null;
    /**
     * Filter, which IntasendMpesaTransaction to fetch.
     */
    where?: IntasendMpesaTransactionWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of IntasendMpesaTransactions to fetch.
     */
    orderBy?:
      | IntasendMpesaTransactionOrderByWithRelationInput
      | IntasendMpesaTransactionOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for IntasendMpesaTransactions.
     */
    cursor?: IntasendMpesaTransactionWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` IntasendMpesaTransactions from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` IntasendMpesaTransactions.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of IntasendMpesaTransactions.
     */
    distinct?:
      | IntasendMpesaTransactionScalarFieldEnum
      | IntasendMpesaTransactionScalarFieldEnum[];
  };

  /**
   * IntasendMpesaTransaction findMany
   */
  export type IntasendMpesaTransactionFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the IntasendMpesaTransaction
     */
    select?: IntasendMpesaTransactionSelect<ExtArgs> | null;
    /**
     * Filter, which IntasendMpesaTransactions to fetch.
     */
    where?: IntasendMpesaTransactionWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of IntasendMpesaTransactions to fetch.
     */
    orderBy?:
      | IntasendMpesaTransactionOrderByWithRelationInput
      | IntasendMpesaTransactionOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing IntasendMpesaTransactions.
     */
    cursor?: IntasendMpesaTransactionWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` IntasendMpesaTransactions from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` IntasendMpesaTransactions.
     */
    skip?: number;
    distinct?:
      | IntasendMpesaTransactionScalarFieldEnum
      | IntasendMpesaTransactionScalarFieldEnum[];
  };

  /**
   * IntasendMpesaTransaction create
   */
  export type IntasendMpesaTransactionCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the IntasendMpesaTransaction
     */
    select?: IntasendMpesaTransactionSelect<ExtArgs> | null;
    /**
     * The data needed to create a IntasendMpesaTransaction.
     */
    data: XOR<
      IntasendMpesaTransactionCreateInput,
      IntasendMpesaTransactionUncheckedCreateInput
    >;
  };

  /**
   * IntasendMpesaTransaction createMany
   */
  export type IntasendMpesaTransactionCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many IntasendMpesaTransactions.
     */
    data:
      | IntasendMpesaTransactionCreateManyInput
      | IntasendMpesaTransactionCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * IntasendMpesaTransaction createManyAndReturn
   */
  export type IntasendMpesaTransactionCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the IntasendMpesaTransaction
     */
    select?: IntasendMpesaTransactionSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * The data used to create many IntasendMpesaTransactions.
     */
    data:
      | IntasendMpesaTransactionCreateManyInput
      | IntasendMpesaTransactionCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * IntasendMpesaTransaction update
   */
  export type IntasendMpesaTransactionUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the IntasendMpesaTransaction
     */
    select?: IntasendMpesaTransactionSelect<ExtArgs> | null;
    /**
     * The data needed to update a IntasendMpesaTransaction.
     */
    data: XOR<
      IntasendMpesaTransactionUpdateInput,
      IntasendMpesaTransactionUncheckedUpdateInput
    >;
    /**
     * Choose, which IntasendMpesaTransaction to update.
     */
    where: IntasendMpesaTransactionWhereUniqueInput;
  };

  /**
   * IntasendMpesaTransaction updateMany
   */
  export type IntasendMpesaTransactionUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update IntasendMpesaTransactions.
     */
    data: XOR<
      IntasendMpesaTransactionUpdateManyMutationInput,
      IntasendMpesaTransactionUncheckedUpdateManyInput
    >;
    /**
     * Filter which IntasendMpesaTransactions to update
     */
    where?: IntasendMpesaTransactionWhereInput;
  };

  /**
   * IntasendMpesaTransaction upsert
   */
  export type IntasendMpesaTransactionUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the IntasendMpesaTransaction
     */
    select?: IntasendMpesaTransactionSelect<ExtArgs> | null;
    /**
     * The filter to search for the IntasendMpesaTransaction to update in case it exists.
     */
    where: IntasendMpesaTransactionWhereUniqueInput;
    /**
     * In case the IntasendMpesaTransaction found by the `where` argument doesn't exist, create a new IntasendMpesaTransaction with this data.
     */
    create: XOR<
      IntasendMpesaTransactionCreateInput,
      IntasendMpesaTransactionUncheckedCreateInput
    >;
    /**
     * In case the IntasendMpesaTransaction was found with the provided `where` argument, update it with this data.
     */
    update: XOR<
      IntasendMpesaTransactionUpdateInput,
      IntasendMpesaTransactionUncheckedUpdateInput
    >;
  };

  /**
   * IntasendMpesaTransaction delete
   */
  export type IntasendMpesaTransactionDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the IntasendMpesaTransaction
     */
    select?: IntasendMpesaTransactionSelect<ExtArgs> | null;
    /**
     * Filter which IntasendMpesaTransaction to delete.
     */
    where: IntasendMpesaTransactionWhereUniqueInput;
  };

  /**
   * IntasendMpesaTransaction deleteMany
   */
  export type IntasendMpesaTransactionDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which IntasendMpesaTransactions to delete
     */
    where?: IntasendMpesaTransactionWhereInput;
  };

  /**
   * IntasendMpesaTransaction without action
   */
  export type IntasendMpesaTransactionDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the IntasendMpesaTransaction
     */
    select?: IntasendMpesaTransactionSelect<ExtArgs> | null;
  };

  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted';
    ReadCommitted: 'ReadCommitted';
    RepeatableRead: 'RepeatableRead';
    Serializable: 'Serializable';
  };

  export type TransactionIsolationLevel =
    (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel];

  export const MpesaOnrampSwapScalarFieldEnum: {
    id: 'id';
    state: 'state';
    userId: 'userId';
    mpesaId: 'mpesaId';
    lightning: 'lightning';
    rate: 'rate';
    retryCount: 'retryCount';
    createdAt: 'createdAt';
    updatedAt: 'updatedAt';
  };

  export type MpesaOnrampSwapScalarFieldEnum =
    (typeof MpesaOnrampSwapScalarFieldEnum)[keyof typeof MpesaOnrampSwapScalarFieldEnum];

  export const MpesaOfframpSwapScalarFieldEnum: {
    id: 'id';
    state: 'state';
    userId: 'userId';
    mpesaId: 'mpesaId';
    lightning: 'lightning';
    rate: 'rate';
    retryCount: 'retryCount';
    createdAt: 'createdAt';
    updatedAt: 'updatedAt';
  };

  export type MpesaOfframpSwapScalarFieldEnum =
    (typeof MpesaOfframpSwapScalarFieldEnum)[keyof typeof MpesaOfframpSwapScalarFieldEnum];

  export const IntasendMpesaTransactionScalarFieldEnum: {
    id: 'id';
    state: 'state';
    apiRef: 'apiRef';
    value: 'value';
    charges: 'charges';
    netAmount: 'netAmount';
    currency: 'currency';
    account: 'account';
    retryCount: 'retryCount';
    createdAt: 'createdAt';
    updatedAt: 'updatedAt';
  };

  export type IntasendMpesaTransactionScalarFieldEnum =
    (typeof IntasendMpesaTransactionScalarFieldEnum)[keyof typeof IntasendMpesaTransactionScalarFieldEnum];

  export const SortOrder: {
    asc: 'asc';
    desc: 'desc';
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

  export const QueryMode: {
    default: 'default';
    insensitive: 'insensitive';
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode];

  export const NullsOrder: {
    first: 'first';
    last: 'last';
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder];

  /**
   * Field references
   */

  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'String'
  >;

  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'String[]'
  >;

  /**
   * Reference to a field of type 'SwapTransactionState'
   */
  export type EnumSwapTransactionStateFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, 'SwapTransactionState'>;

  /**
   * Reference to a field of type 'SwapTransactionState[]'
   */
  export type ListEnumSwapTransactionStateFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, 'SwapTransactionState[]'>;

  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'Int'
  >;

  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'Int[]'
  >;

  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'DateTime'
  >;

  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'DateTime[]'
  >;

  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'Float'
  >;

  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'Float[]'
  >;

  /**
   * Deep Input Types
   */

  export type MpesaOnrampSwapWhereInput = {
    AND?: MpesaOnrampSwapWhereInput | MpesaOnrampSwapWhereInput[];
    OR?: MpesaOnrampSwapWhereInput[];
    NOT?: MpesaOnrampSwapWhereInput | MpesaOnrampSwapWhereInput[];
    id?: StringFilter<'MpesaOnrampSwap'> | string;
    state?:
      | EnumSwapTransactionStateFilter<'MpesaOnrampSwap'>
      | $Enums.SwapTransactionState;
    userId?: StringFilter<'MpesaOnrampSwap'> | string;
    mpesaId?: StringFilter<'MpesaOnrampSwap'> | string;
    lightning?: StringFilter<'MpesaOnrampSwap'> | string;
    rate?: StringFilter<'MpesaOnrampSwap'> | string;
    retryCount?: IntFilter<'MpesaOnrampSwap'> | number;
    createdAt?: DateTimeFilter<'MpesaOnrampSwap'> | Date | string;
    updatedAt?: DateTimeFilter<'MpesaOnrampSwap'> | Date | string;
  };

  export type MpesaOnrampSwapOrderByWithRelationInput = {
    id?: SortOrder;
    state?: SortOrder;
    userId?: SortOrder;
    mpesaId?: SortOrder;
    lightning?: SortOrder;
    rate?: SortOrder;
    retryCount?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type MpesaOnrampSwapWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      mpesaId?: string;
      AND?: MpesaOnrampSwapWhereInput | MpesaOnrampSwapWhereInput[];
      OR?: MpesaOnrampSwapWhereInput[];
      NOT?: MpesaOnrampSwapWhereInput | MpesaOnrampSwapWhereInput[];
      state?:
        | EnumSwapTransactionStateFilter<'MpesaOnrampSwap'>
        | $Enums.SwapTransactionState;
      userId?: StringFilter<'MpesaOnrampSwap'> | string;
      lightning?: StringFilter<'MpesaOnrampSwap'> | string;
      rate?: StringFilter<'MpesaOnrampSwap'> | string;
      retryCount?: IntFilter<'MpesaOnrampSwap'> | number;
      createdAt?: DateTimeFilter<'MpesaOnrampSwap'> | Date | string;
      updatedAt?: DateTimeFilter<'MpesaOnrampSwap'> | Date | string;
    },
    'id' | 'mpesaId'
  >;

  export type MpesaOnrampSwapOrderByWithAggregationInput = {
    id?: SortOrder;
    state?: SortOrder;
    userId?: SortOrder;
    mpesaId?: SortOrder;
    lightning?: SortOrder;
    rate?: SortOrder;
    retryCount?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    _count?: MpesaOnrampSwapCountOrderByAggregateInput;
    _avg?: MpesaOnrampSwapAvgOrderByAggregateInput;
    _max?: MpesaOnrampSwapMaxOrderByAggregateInput;
    _min?: MpesaOnrampSwapMinOrderByAggregateInput;
    _sum?: MpesaOnrampSwapSumOrderByAggregateInput;
  };

  export type MpesaOnrampSwapScalarWhereWithAggregatesInput = {
    AND?:
      | MpesaOnrampSwapScalarWhereWithAggregatesInput
      | MpesaOnrampSwapScalarWhereWithAggregatesInput[];
    OR?: MpesaOnrampSwapScalarWhereWithAggregatesInput[];
    NOT?:
      | MpesaOnrampSwapScalarWhereWithAggregatesInput
      | MpesaOnrampSwapScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<'MpesaOnrampSwap'> | string;
    state?:
      | EnumSwapTransactionStateWithAggregatesFilter<'MpesaOnrampSwap'>
      | $Enums.SwapTransactionState;
    userId?: StringWithAggregatesFilter<'MpesaOnrampSwap'> | string;
    mpesaId?: StringWithAggregatesFilter<'MpesaOnrampSwap'> | string;
    lightning?: StringWithAggregatesFilter<'MpesaOnrampSwap'> | string;
    rate?: StringWithAggregatesFilter<'MpesaOnrampSwap'> | string;
    retryCount?: IntWithAggregatesFilter<'MpesaOnrampSwap'> | number;
    createdAt?: DateTimeWithAggregatesFilter<'MpesaOnrampSwap'> | Date | string;
    updatedAt?: DateTimeWithAggregatesFilter<'MpesaOnrampSwap'> | Date | string;
  };

  export type MpesaOfframpSwapWhereInput = {
    AND?: MpesaOfframpSwapWhereInput | MpesaOfframpSwapWhereInput[];
    OR?: MpesaOfframpSwapWhereInput[];
    NOT?: MpesaOfframpSwapWhereInput | MpesaOfframpSwapWhereInput[];
    id?: StringFilter<'MpesaOfframpSwap'> | string;
    state?:
      | EnumSwapTransactionStateFilter<'MpesaOfframpSwap'>
      | $Enums.SwapTransactionState;
    userId?: StringFilter<'MpesaOfframpSwap'> | string;
    mpesaId?: StringNullableFilter<'MpesaOfframpSwap'> | string | null;
    lightning?: StringFilter<'MpesaOfframpSwap'> | string;
    rate?: StringFilter<'MpesaOfframpSwap'> | string;
    retryCount?: IntFilter<'MpesaOfframpSwap'> | number;
    createdAt?: DateTimeFilter<'MpesaOfframpSwap'> | Date | string;
    updatedAt?: DateTimeFilter<'MpesaOfframpSwap'> | Date | string;
  };

  export type MpesaOfframpSwapOrderByWithRelationInput = {
    id?: SortOrder;
    state?: SortOrder;
    userId?: SortOrder;
    mpesaId?: SortOrderInput | SortOrder;
    lightning?: SortOrder;
    rate?: SortOrder;
    retryCount?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type MpesaOfframpSwapWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      mpesaId?: string;
      AND?: MpesaOfframpSwapWhereInput | MpesaOfframpSwapWhereInput[];
      OR?: MpesaOfframpSwapWhereInput[];
      NOT?: MpesaOfframpSwapWhereInput | MpesaOfframpSwapWhereInput[];
      state?:
        | EnumSwapTransactionStateFilter<'MpesaOfframpSwap'>
        | $Enums.SwapTransactionState;
      userId?: StringFilter<'MpesaOfframpSwap'> | string;
      lightning?: StringFilter<'MpesaOfframpSwap'> | string;
      rate?: StringFilter<'MpesaOfframpSwap'> | string;
      retryCount?: IntFilter<'MpesaOfframpSwap'> | number;
      createdAt?: DateTimeFilter<'MpesaOfframpSwap'> | Date | string;
      updatedAt?: DateTimeFilter<'MpesaOfframpSwap'> | Date | string;
    },
    'id' | 'mpesaId'
  >;

  export type MpesaOfframpSwapOrderByWithAggregationInput = {
    id?: SortOrder;
    state?: SortOrder;
    userId?: SortOrder;
    mpesaId?: SortOrderInput | SortOrder;
    lightning?: SortOrder;
    rate?: SortOrder;
    retryCount?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    _count?: MpesaOfframpSwapCountOrderByAggregateInput;
    _avg?: MpesaOfframpSwapAvgOrderByAggregateInput;
    _max?: MpesaOfframpSwapMaxOrderByAggregateInput;
    _min?: MpesaOfframpSwapMinOrderByAggregateInput;
    _sum?: MpesaOfframpSwapSumOrderByAggregateInput;
  };

  export type MpesaOfframpSwapScalarWhereWithAggregatesInput = {
    AND?:
      | MpesaOfframpSwapScalarWhereWithAggregatesInput
      | MpesaOfframpSwapScalarWhereWithAggregatesInput[];
    OR?: MpesaOfframpSwapScalarWhereWithAggregatesInput[];
    NOT?:
      | MpesaOfframpSwapScalarWhereWithAggregatesInput
      | MpesaOfframpSwapScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<'MpesaOfframpSwap'> | string;
    state?:
      | EnumSwapTransactionStateWithAggregatesFilter<'MpesaOfframpSwap'>
      | $Enums.SwapTransactionState;
    userId?: StringWithAggregatesFilter<'MpesaOfframpSwap'> | string;
    mpesaId?:
      | StringNullableWithAggregatesFilter<'MpesaOfframpSwap'>
      | string
      | null;
    lightning?: StringWithAggregatesFilter<'MpesaOfframpSwap'> | string;
    rate?: StringWithAggregatesFilter<'MpesaOfframpSwap'> | string;
    retryCount?: IntWithAggregatesFilter<'MpesaOfframpSwap'> | number;
    createdAt?:
      | DateTimeWithAggregatesFilter<'MpesaOfframpSwap'>
      | Date
      | string;
    updatedAt?:
      | DateTimeWithAggregatesFilter<'MpesaOfframpSwap'>
      | Date
      | string;
  };

  export type IntasendMpesaTransactionWhereInput = {
    AND?:
      | IntasendMpesaTransactionWhereInput
      | IntasendMpesaTransactionWhereInput[];
    OR?: IntasendMpesaTransactionWhereInput[];
    NOT?:
      | IntasendMpesaTransactionWhereInput
      | IntasendMpesaTransactionWhereInput[];
    id?: StringFilter<'IntasendMpesaTransaction'> | string;
    state?:
      | EnumSwapTransactionStateFilter<'IntasendMpesaTransaction'>
      | $Enums.SwapTransactionState;
    apiRef?: StringFilter<'IntasendMpesaTransaction'> | string;
    value?: StringFilter<'IntasendMpesaTransaction'> | string;
    charges?: StringFilter<'IntasendMpesaTransaction'> | string;
    netAmount?: StringFilter<'IntasendMpesaTransaction'> | string;
    currency?: StringFilter<'IntasendMpesaTransaction'> | string;
    account?: StringFilter<'IntasendMpesaTransaction'> | string;
    retryCount?: IntFilter<'IntasendMpesaTransaction'> | number;
    createdAt?: StringFilter<'IntasendMpesaTransaction'> | string;
    updatedAt?: StringFilter<'IntasendMpesaTransaction'> | string;
  };

  export type IntasendMpesaTransactionOrderByWithRelationInput = {
    id?: SortOrder;
    state?: SortOrder;
    apiRef?: SortOrder;
    value?: SortOrder;
    charges?: SortOrder;
    netAmount?: SortOrder;
    currency?: SortOrder;
    account?: SortOrder;
    retryCount?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type IntasendMpesaTransactionWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      AND?:
        | IntasendMpesaTransactionWhereInput
        | IntasendMpesaTransactionWhereInput[];
      OR?: IntasendMpesaTransactionWhereInput[];
      NOT?:
        | IntasendMpesaTransactionWhereInput
        | IntasendMpesaTransactionWhereInput[];
      state?:
        | EnumSwapTransactionStateFilter<'IntasendMpesaTransaction'>
        | $Enums.SwapTransactionState;
      apiRef?: StringFilter<'IntasendMpesaTransaction'> | string;
      value?: StringFilter<'IntasendMpesaTransaction'> | string;
      charges?: StringFilter<'IntasendMpesaTransaction'> | string;
      netAmount?: StringFilter<'IntasendMpesaTransaction'> | string;
      currency?: StringFilter<'IntasendMpesaTransaction'> | string;
      account?: StringFilter<'IntasendMpesaTransaction'> | string;
      retryCount?: IntFilter<'IntasendMpesaTransaction'> | number;
      createdAt?: StringFilter<'IntasendMpesaTransaction'> | string;
      updatedAt?: StringFilter<'IntasendMpesaTransaction'> | string;
    },
    'id'
  >;

  export type IntasendMpesaTransactionOrderByWithAggregationInput = {
    id?: SortOrder;
    state?: SortOrder;
    apiRef?: SortOrder;
    value?: SortOrder;
    charges?: SortOrder;
    netAmount?: SortOrder;
    currency?: SortOrder;
    account?: SortOrder;
    retryCount?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    _count?: IntasendMpesaTransactionCountOrderByAggregateInput;
    _avg?: IntasendMpesaTransactionAvgOrderByAggregateInput;
    _max?: IntasendMpesaTransactionMaxOrderByAggregateInput;
    _min?: IntasendMpesaTransactionMinOrderByAggregateInput;
    _sum?: IntasendMpesaTransactionSumOrderByAggregateInput;
  };

  export type IntasendMpesaTransactionScalarWhereWithAggregatesInput = {
    AND?:
      | IntasendMpesaTransactionScalarWhereWithAggregatesInput
      | IntasendMpesaTransactionScalarWhereWithAggregatesInput[];
    OR?: IntasendMpesaTransactionScalarWhereWithAggregatesInput[];
    NOT?:
      | IntasendMpesaTransactionScalarWhereWithAggregatesInput
      | IntasendMpesaTransactionScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<'IntasendMpesaTransaction'> | string;
    state?:
      | EnumSwapTransactionStateWithAggregatesFilter<'IntasendMpesaTransaction'>
      | $Enums.SwapTransactionState;
    apiRef?: StringWithAggregatesFilter<'IntasendMpesaTransaction'> | string;
    value?: StringWithAggregatesFilter<'IntasendMpesaTransaction'> | string;
    charges?: StringWithAggregatesFilter<'IntasendMpesaTransaction'> | string;
    netAmount?: StringWithAggregatesFilter<'IntasendMpesaTransaction'> | string;
    currency?: StringWithAggregatesFilter<'IntasendMpesaTransaction'> | string;
    account?: StringWithAggregatesFilter<'IntasendMpesaTransaction'> | string;
    retryCount?: IntWithAggregatesFilter<'IntasendMpesaTransaction'> | number;
    createdAt?: StringWithAggregatesFilter<'IntasendMpesaTransaction'> | string;
    updatedAt?: StringWithAggregatesFilter<'IntasendMpesaTransaction'> | string;
  };

  export type MpesaOnrampSwapCreateInput = {
    id?: string;
    state: $Enums.SwapTransactionState;
    userId: string;
    mpesaId: string;
    lightning: string;
    rate: string;
    retryCount: number;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type MpesaOnrampSwapUncheckedCreateInput = {
    id?: string;
    state: $Enums.SwapTransactionState;
    userId: string;
    mpesaId: string;
    lightning: string;
    rate: string;
    retryCount: number;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type MpesaOnrampSwapUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    state?:
      | EnumSwapTransactionStateFieldUpdateOperationsInput
      | $Enums.SwapTransactionState;
    userId?: StringFieldUpdateOperationsInput | string;
    mpesaId?: StringFieldUpdateOperationsInput | string;
    lightning?: StringFieldUpdateOperationsInput | string;
    rate?: StringFieldUpdateOperationsInput | string;
    retryCount?: IntFieldUpdateOperationsInput | number;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type MpesaOnrampSwapUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    state?:
      | EnumSwapTransactionStateFieldUpdateOperationsInput
      | $Enums.SwapTransactionState;
    userId?: StringFieldUpdateOperationsInput | string;
    mpesaId?: StringFieldUpdateOperationsInput | string;
    lightning?: StringFieldUpdateOperationsInput | string;
    rate?: StringFieldUpdateOperationsInput | string;
    retryCount?: IntFieldUpdateOperationsInput | number;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type MpesaOnrampSwapCreateManyInput = {
    id?: string;
    state: $Enums.SwapTransactionState;
    userId: string;
    mpesaId: string;
    lightning: string;
    rate: string;
    retryCount: number;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type MpesaOnrampSwapUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    state?:
      | EnumSwapTransactionStateFieldUpdateOperationsInput
      | $Enums.SwapTransactionState;
    userId?: StringFieldUpdateOperationsInput | string;
    mpesaId?: StringFieldUpdateOperationsInput | string;
    lightning?: StringFieldUpdateOperationsInput | string;
    rate?: StringFieldUpdateOperationsInput | string;
    retryCount?: IntFieldUpdateOperationsInput | number;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type MpesaOnrampSwapUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    state?:
      | EnumSwapTransactionStateFieldUpdateOperationsInput
      | $Enums.SwapTransactionState;
    userId?: StringFieldUpdateOperationsInput | string;
    mpesaId?: StringFieldUpdateOperationsInput | string;
    lightning?: StringFieldUpdateOperationsInput | string;
    rate?: StringFieldUpdateOperationsInput | string;
    retryCount?: IntFieldUpdateOperationsInput | number;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type MpesaOfframpSwapCreateInput = {
    id: string;
    state: $Enums.SwapTransactionState;
    userId: string;
    mpesaId?: string | null;
    lightning: string;
    rate: string;
    retryCount: number;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type MpesaOfframpSwapUncheckedCreateInput = {
    id: string;
    state: $Enums.SwapTransactionState;
    userId: string;
    mpesaId?: string | null;
    lightning: string;
    rate: string;
    retryCount: number;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type MpesaOfframpSwapUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    state?:
      | EnumSwapTransactionStateFieldUpdateOperationsInput
      | $Enums.SwapTransactionState;
    userId?: StringFieldUpdateOperationsInput | string;
    mpesaId?: NullableStringFieldUpdateOperationsInput | string | null;
    lightning?: StringFieldUpdateOperationsInput | string;
    rate?: StringFieldUpdateOperationsInput | string;
    retryCount?: IntFieldUpdateOperationsInput | number;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type MpesaOfframpSwapUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    state?:
      | EnumSwapTransactionStateFieldUpdateOperationsInput
      | $Enums.SwapTransactionState;
    userId?: StringFieldUpdateOperationsInput | string;
    mpesaId?: NullableStringFieldUpdateOperationsInput | string | null;
    lightning?: StringFieldUpdateOperationsInput | string;
    rate?: StringFieldUpdateOperationsInput | string;
    retryCount?: IntFieldUpdateOperationsInput | number;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type MpesaOfframpSwapCreateManyInput = {
    id: string;
    state: $Enums.SwapTransactionState;
    userId: string;
    mpesaId?: string | null;
    lightning: string;
    rate: string;
    retryCount: number;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type MpesaOfframpSwapUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    state?:
      | EnumSwapTransactionStateFieldUpdateOperationsInput
      | $Enums.SwapTransactionState;
    userId?: StringFieldUpdateOperationsInput | string;
    mpesaId?: NullableStringFieldUpdateOperationsInput | string | null;
    lightning?: StringFieldUpdateOperationsInput | string;
    rate?: StringFieldUpdateOperationsInput | string;
    retryCount?: IntFieldUpdateOperationsInput | number;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type MpesaOfframpSwapUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    state?:
      | EnumSwapTransactionStateFieldUpdateOperationsInput
      | $Enums.SwapTransactionState;
    userId?: StringFieldUpdateOperationsInput | string;
    mpesaId?: NullableStringFieldUpdateOperationsInput | string | null;
    lightning?: StringFieldUpdateOperationsInput | string;
    rate?: StringFieldUpdateOperationsInput | string;
    retryCount?: IntFieldUpdateOperationsInput | number;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type IntasendMpesaTransactionCreateInput = {
    id?: string;
    state: $Enums.SwapTransactionState;
    apiRef: string;
    value: string;
    charges: string;
    netAmount: string;
    currency: string;
    account: string;
    retryCount: number;
    createdAt: string;
    updatedAt: string;
  };

  export type IntasendMpesaTransactionUncheckedCreateInput = {
    id?: string;
    state: $Enums.SwapTransactionState;
    apiRef: string;
    value: string;
    charges: string;
    netAmount: string;
    currency: string;
    account: string;
    retryCount: number;
    createdAt: string;
    updatedAt: string;
  };

  export type IntasendMpesaTransactionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    state?:
      | EnumSwapTransactionStateFieldUpdateOperationsInput
      | $Enums.SwapTransactionState;
    apiRef?: StringFieldUpdateOperationsInput | string;
    value?: StringFieldUpdateOperationsInput | string;
    charges?: StringFieldUpdateOperationsInput | string;
    netAmount?: StringFieldUpdateOperationsInput | string;
    currency?: StringFieldUpdateOperationsInput | string;
    account?: StringFieldUpdateOperationsInput | string;
    retryCount?: IntFieldUpdateOperationsInput | number;
    createdAt?: StringFieldUpdateOperationsInput | string;
    updatedAt?: StringFieldUpdateOperationsInput | string;
  };

  export type IntasendMpesaTransactionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    state?:
      | EnumSwapTransactionStateFieldUpdateOperationsInput
      | $Enums.SwapTransactionState;
    apiRef?: StringFieldUpdateOperationsInput | string;
    value?: StringFieldUpdateOperationsInput | string;
    charges?: StringFieldUpdateOperationsInput | string;
    netAmount?: StringFieldUpdateOperationsInput | string;
    currency?: StringFieldUpdateOperationsInput | string;
    account?: StringFieldUpdateOperationsInput | string;
    retryCount?: IntFieldUpdateOperationsInput | number;
    createdAt?: StringFieldUpdateOperationsInput | string;
    updatedAt?: StringFieldUpdateOperationsInput | string;
  };

  export type IntasendMpesaTransactionCreateManyInput = {
    id?: string;
    state: $Enums.SwapTransactionState;
    apiRef: string;
    value: string;
    charges: string;
    netAmount: string;
    currency: string;
    account: string;
    retryCount: number;
    createdAt: string;
    updatedAt: string;
  };

  export type IntasendMpesaTransactionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    state?:
      | EnumSwapTransactionStateFieldUpdateOperationsInput
      | $Enums.SwapTransactionState;
    apiRef?: StringFieldUpdateOperationsInput | string;
    value?: StringFieldUpdateOperationsInput | string;
    charges?: StringFieldUpdateOperationsInput | string;
    netAmount?: StringFieldUpdateOperationsInput | string;
    currency?: StringFieldUpdateOperationsInput | string;
    account?: StringFieldUpdateOperationsInput | string;
    retryCount?: IntFieldUpdateOperationsInput | number;
    createdAt?: StringFieldUpdateOperationsInput | string;
    updatedAt?: StringFieldUpdateOperationsInput | string;
  };

  export type IntasendMpesaTransactionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    state?:
      | EnumSwapTransactionStateFieldUpdateOperationsInput
      | $Enums.SwapTransactionState;
    apiRef?: StringFieldUpdateOperationsInput | string;
    value?: StringFieldUpdateOperationsInput | string;
    charges?: StringFieldUpdateOperationsInput | string;
    netAmount?: StringFieldUpdateOperationsInput | string;
    currency?: StringFieldUpdateOperationsInput | string;
    account?: StringFieldUpdateOperationsInput | string;
    retryCount?: IntFieldUpdateOperationsInput | number;
    createdAt?: StringFieldUpdateOperationsInput | string;
    updatedAt?: StringFieldUpdateOperationsInput | string;
  };

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>;
    in?: string[] | ListStringFieldRefInput<$PrismaModel>;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    mode?: QueryMode;
    not?: NestedStringFilter<$PrismaModel> | string;
  };

  export type EnumSwapTransactionStateFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.SwapTransactionState
      | EnumSwapTransactionStateFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.SwapTransactionState[]
      | ListEnumSwapTransactionStateFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.SwapTransactionState[]
      | ListEnumSwapTransactionStateFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumSwapTransactionStateFilter<$PrismaModel>
      | $Enums.SwapTransactionState;
  };

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>;
    in?: number[] | ListIntFieldRefInput<$PrismaModel>;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntFilter<$PrismaModel> | number;
  };

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string;
  };

  export type MpesaOnrampSwapCountOrderByAggregateInput = {
    id?: SortOrder;
    state?: SortOrder;
    userId?: SortOrder;
    mpesaId?: SortOrder;
    lightning?: SortOrder;
    rate?: SortOrder;
    retryCount?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type MpesaOnrampSwapAvgOrderByAggregateInput = {
    retryCount?: SortOrder;
  };

  export type MpesaOnrampSwapMaxOrderByAggregateInput = {
    id?: SortOrder;
    state?: SortOrder;
    userId?: SortOrder;
    mpesaId?: SortOrder;
    lightning?: SortOrder;
    rate?: SortOrder;
    retryCount?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type MpesaOnrampSwapMinOrderByAggregateInput = {
    id?: SortOrder;
    state?: SortOrder;
    userId?: SortOrder;
    mpesaId?: SortOrder;
    lightning?: SortOrder;
    rate?: SortOrder;
    retryCount?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type MpesaOnrampSwapSumOrderByAggregateInput = {
    retryCount?: SortOrder;
  };

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>;
    in?: string[] | ListStringFieldRefInput<$PrismaModel>;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    mode?: QueryMode;
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedStringFilter<$PrismaModel>;
    _max?: NestedStringFilter<$PrismaModel>;
  };

  export type EnumSwapTransactionStateWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.SwapTransactionState
      | EnumSwapTransactionStateFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.SwapTransactionState[]
      | ListEnumSwapTransactionStateFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.SwapTransactionState[]
      | ListEnumSwapTransactionStateFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumSwapTransactionStateWithAggregatesFilter<$PrismaModel>
      | $Enums.SwapTransactionState;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumSwapTransactionStateFilter<$PrismaModel>;
    _max?: NestedEnumSwapTransactionStateFilter<$PrismaModel>;
  };

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>;
    in?: number[] | ListIntFieldRefInput<$PrismaModel>;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number;
    _count?: NestedIntFilter<$PrismaModel>;
    _avg?: NestedFloatFilter<$PrismaModel>;
    _sum?: NestedIntFilter<$PrismaModel>;
    _min?: NestedIntFilter<$PrismaModel>;
    _max?: NestedIntFilter<$PrismaModel>;
  };

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedDateTimeFilter<$PrismaModel>;
    _max?: NestedDateTimeFilter<$PrismaModel>;
  };

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null;
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    mode?: QueryMode;
    not?: NestedStringNullableFilter<$PrismaModel> | string | null;
  };

  export type SortOrderInput = {
    sort: SortOrder;
    nulls?: NullsOrder;
  };

  export type MpesaOfframpSwapCountOrderByAggregateInput = {
    id?: SortOrder;
    state?: SortOrder;
    userId?: SortOrder;
    mpesaId?: SortOrder;
    lightning?: SortOrder;
    rate?: SortOrder;
    retryCount?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type MpesaOfframpSwapAvgOrderByAggregateInput = {
    retryCount?: SortOrder;
  };

  export type MpesaOfframpSwapMaxOrderByAggregateInput = {
    id?: SortOrder;
    state?: SortOrder;
    userId?: SortOrder;
    mpesaId?: SortOrder;
    lightning?: SortOrder;
    rate?: SortOrder;
    retryCount?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type MpesaOfframpSwapMinOrderByAggregateInput = {
    id?: SortOrder;
    state?: SortOrder;
    userId?: SortOrder;
    mpesaId?: SortOrder;
    lightning?: SortOrder;
    rate?: SortOrder;
    retryCount?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type MpesaOfframpSwapSumOrderByAggregateInput = {
    retryCount?: SortOrder;
  };

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null;
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    mode?: QueryMode;
    not?:
      | NestedStringNullableWithAggregatesFilter<$PrismaModel>
      | string
      | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedStringNullableFilter<$PrismaModel>;
    _max?: NestedStringNullableFilter<$PrismaModel>;
  };

  export type IntasendMpesaTransactionCountOrderByAggregateInput = {
    id?: SortOrder;
    state?: SortOrder;
    apiRef?: SortOrder;
    value?: SortOrder;
    charges?: SortOrder;
    netAmount?: SortOrder;
    currency?: SortOrder;
    account?: SortOrder;
    retryCount?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type IntasendMpesaTransactionAvgOrderByAggregateInput = {
    retryCount?: SortOrder;
  };

  export type IntasendMpesaTransactionMaxOrderByAggregateInput = {
    id?: SortOrder;
    state?: SortOrder;
    apiRef?: SortOrder;
    value?: SortOrder;
    charges?: SortOrder;
    netAmount?: SortOrder;
    currency?: SortOrder;
    account?: SortOrder;
    retryCount?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type IntasendMpesaTransactionMinOrderByAggregateInput = {
    id?: SortOrder;
    state?: SortOrder;
    apiRef?: SortOrder;
    value?: SortOrder;
    charges?: SortOrder;
    netAmount?: SortOrder;
    currency?: SortOrder;
    account?: SortOrder;
    retryCount?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type IntasendMpesaTransactionSumOrderByAggregateInput = {
    retryCount?: SortOrder;
  };

  export type StringFieldUpdateOperationsInput = {
    set?: string;
  };

  export type EnumSwapTransactionStateFieldUpdateOperationsInput = {
    set?: $Enums.SwapTransactionState;
  };

  export type IntFieldUpdateOperationsInput = {
    set?: number;
    increment?: number;
    decrement?: number;
    multiply?: number;
    divide?: number;
  };

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string;
  };

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null;
  };

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>;
    in?: string[] | ListStringFieldRefInput<$PrismaModel>;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?: NestedStringFilter<$PrismaModel> | string;
  };

  export type NestedEnumSwapTransactionStateFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.SwapTransactionState
      | EnumSwapTransactionStateFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.SwapTransactionState[]
      | ListEnumSwapTransactionStateFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.SwapTransactionState[]
      | ListEnumSwapTransactionStateFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumSwapTransactionStateFilter<$PrismaModel>
      | $Enums.SwapTransactionState;
  };

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>;
    in?: number[] | ListIntFieldRefInput<$PrismaModel>;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntFilter<$PrismaModel> | number;
  };

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string;
  };

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>;
    in?: string[] | ListStringFieldRefInput<$PrismaModel>;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedStringFilter<$PrismaModel>;
    _max?: NestedStringFilter<$PrismaModel>;
  };

  export type NestedEnumSwapTransactionStateWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.SwapTransactionState
      | EnumSwapTransactionStateFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.SwapTransactionState[]
      | ListEnumSwapTransactionStateFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.SwapTransactionState[]
      | ListEnumSwapTransactionStateFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumSwapTransactionStateWithAggregatesFilter<$PrismaModel>
      | $Enums.SwapTransactionState;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumSwapTransactionStateFilter<$PrismaModel>;
    _max?: NestedEnumSwapTransactionStateFilter<$PrismaModel>;
  };

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>;
    in?: number[] | ListIntFieldRefInput<$PrismaModel>;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number;
    _count?: NestedIntFilter<$PrismaModel>;
    _avg?: NestedFloatFilter<$PrismaModel>;
    _sum?: NestedIntFilter<$PrismaModel>;
    _min?: NestedIntFilter<$PrismaModel>;
    _max?: NestedIntFilter<$PrismaModel>;
  };

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>;
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>;
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>;
    lt?: number | FloatFieldRefInput<$PrismaModel>;
    lte?: number | FloatFieldRefInput<$PrismaModel>;
    gt?: number | FloatFieldRefInput<$PrismaModel>;
    gte?: number | FloatFieldRefInput<$PrismaModel>;
    not?: NestedFloatFilter<$PrismaModel> | number;
  };

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedDateTimeFilter<$PrismaModel>;
    _max?: NestedDateTimeFilter<$PrismaModel>;
  };

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null;
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?: NestedStringNullableFilter<$PrismaModel> | string | null;
  };

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null;
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?:
      | NestedStringNullableWithAggregatesFilter<$PrismaModel>
      | string
      | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedStringNullableFilter<$PrismaModel>;
    _max?: NestedStringNullableFilter<$PrismaModel>;
  };

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null;
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntNullableFilter<$PrismaModel> | number | null;
  };

  /**
   * Aliases for legacy arg types
   */
  /**
   * @deprecated Use MpesaOnrampSwapDefaultArgs instead
   */
  export type MpesaOnrampSwapArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = MpesaOnrampSwapDefaultArgs<ExtArgs>;
  /**
   * @deprecated Use MpesaOfframpSwapDefaultArgs instead
   */
  export type MpesaOfframpSwapArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = MpesaOfframpSwapDefaultArgs<ExtArgs>;
  /**
   * @deprecated Use IntasendMpesaTransactionDefaultArgs instead
   */
  export type IntasendMpesaTransactionArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = IntasendMpesaTransactionDefaultArgs<ExtArgs>;

  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number;
  };

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF;
}
