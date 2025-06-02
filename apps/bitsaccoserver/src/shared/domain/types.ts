export class DomainEvent {
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  payload: any;
  timestamp: Date;
  version: number;
  userId?: string;

  constructor(data: {
    eventType: string;
    aggregateId: string;
    aggregateType: string;
    payload: any;
    timestamp: Date;
    version: number;
    userId?: string;
  }) {
    this.eventType = data.eventType;
    this.aggregateId = data.aggregateId;
    this.aggregateType = data.aggregateType;
    this.payload = data.payload;
    this.timestamp = data.timestamp;
    this.version = data.version;
    this.userId = data.userId;
  }
}
