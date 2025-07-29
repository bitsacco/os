export interface ConfigureNostrRelaysRequest {
  relays: NostrRelay[];
}

export interface NostrDirectMessageRequest {
  message: string;
  recipient: NostrRecipient | undefined;
  retry: boolean;
}

export interface NostrRecipient {
  npub?: string | undefined;
  pubkey?: string | undefined;
}

export interface NostrRelay {
  socket: string;
  read: boolean;
  write: boolean;
}
