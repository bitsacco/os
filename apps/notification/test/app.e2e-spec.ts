// import { join } from 'path';
// import { lastValueFrom } from 'rxjs';
// import { ConfigModule } from '@nestjs/config';
// import { Test, TestingModule } from '@nestjs/testing';
// import { ClientsModule, Transport, ClientGrpc } from '@nestjs/microservices';
// import {
//   NotificationChannel,
//   NotificationImportance,
//   NotificationTopic,
// } from '@bitsacco/common';
// import { NotificationModule } from '../src/notification.module';

import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationModule } from '../src/notification.module';

describe('SharesController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [NotificationModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});

// describe('Notification Service (e2e)', () => {
//   let app;
//   let client: ClientGrpc;
//   let grpcService: any;

//   beforeEach(async () => {
//     const moduleFixture: TestingModule = await Test.createTestingModule({
//       imports: [
//         ConfigModule.forRoot(),
//         ClientsModule.register([
//           {
//             name: 'NOTIFICATION_PACKAGE',
//             transport: Transport.GRPC,
//             options: {
//               url: process.env.NOTIFICATION_GRPC_URL || 'localhost:5000',
//               package: 'notification',
//               protoPath: join(__dirname, '../../.../proto/notification.proto'),
//             },
//           },
//         ]),
//         NotificationModule,
//       ],
//     }).compile();

//     app = moduleFixture.createNestApplication();
//     app.connectMicroservice({
//       transport: Transport.GRPC,
//       options: {
//         url: process.env.NOTIFICATION_GRPC_URL || 'localhost:5000',
//         package: 'notification',
//         protoPath: join(__dirname, '../../.../proto/notification.proto'),
//       },
//     });

//     client = app.get<ClientGrpc>('NOTIFICATION_PACKAGE');
//     await app.startAllMicroservices();
//     await app.init();

//     grpcService = client.getService<any>('NotificationService');
//   });

//   afterEach(async () => {
//     await app.close();
//   });

//   // These tests are placeholders for actual e2e tests
//   // They would need to be modified to use a test database and proper setup/teardown
//   it('should create and retrieve a notification', async () => {
//     // Create a notification
//     const createResult = await lastValueFrom(
//       grpcService.sendNotification({
//         userId: 'test-user',
//         title: 'Test Notification',
//         body: 'This is a test notification',
//         topic: NotificationTopic.SYSTEM,
//         importance: NotificationImportance.MEDIUM,
//         channels: [NotificationChannel.IN_APP],
//       }),
//     );

//     expect(createResult.notificationId).toBeDefined();
//     expect(createResult.deliveredTo).toContain(NotificationChannel.IN_APP);

//     // Get notifications
//     const getResult = await lastValueFrom(
//       grpcService.getNotifications({
//         userId: 'test-user',
//         unreadOnly: false,
//         pagination: { page: 0, size: 10 },
//       }),
//     );

//     expect(getResult.notifications.length).toBeGreaterThan(0);
//     expect(getResult.notifications[0].title).toBe('Test Notification');
//     expect(getResult.notifications[0].body).toBe('This is a test notification');
//   });

//   it('should mark notifications as read', async () => {
//     // First create a notification
//     const createResult = await lastValueFrom(
//       grpcService.sendNotification({
//         userId: 'test-user',
//         title: 'Test Notification for Reading',
//         body: 'This notification will be marked as read',
//         topic: NotificationTopic.SYSTEM,
//         importance: NotificationImportance.MEDIUM,
//         channels: [NotificationChannel.IN_APP],
//       }),
//     );

//     // Mark it as read
//     await lastValueFrom(
//       grpcService.markAsRead({
//         userId: 'test-user',
//         notificationIds: [createResult.notificationId],
//       }),
//     );

//     // Get the notification and verify it's read
//     const getResult = await lastValueFrom(
//       grpcService.getNotifications({
//         userId: 'test-user',
//         unreadOnly: false,
//         pagination: { page: 0, size: 10 },
//       }),
//     );

//     const notification = getResult.notifications.find(
//       (n) => n.id === createResult.notificationId,
//     );
//     expect(notification.read).toBe(true);
//   });

//   it('should update user preferences', async () => {
//     // Update preferences
//     await lastValueFrom(
//       grpcService.updatePreferences({
//         userId: 'test-user',
//         channels: [
//           { channel: NotificationChannel.SMS, enabled: false },
//           { channel: NotificationChannel.NOSTR, enabled: true },
//         ],
//         topics: [
//           {
//             topic: NotificationTopic.TRANSACTION,
//             enabled: true,
//             channels: [NotificationChannel.NOSTR],
//           },
//         ],
//       }),
//     );

//     // Get preferences and verify
//     const prefResult = await lastValueFrom(
//       grpcService.getPreferences({
//         userId: 'test-user',
//       }),
//     );

//     // Find SMS channel preference
//     const smsChannel = prefResult.channels.find(
//       (c) => c.channel === NotificationChannel.SMS,
//     );
//     expect(smsChannel.enabled).toBe(false);

//     // Find NOSTR channel preference
//     const nostrChannel = prefResult.channels.find(
//       (c) => c.channel === NotificationChannel.NOSTR,
//     );
//     expect(nostrChannel.enabled).toBe(true);

//     // Find TRANSACTION topic preference
//     const txTopic = prefResult.topics.find(
//       (t) => t.topic === NotificationTopic.TRANSACTION,
//     );
//     expect(txTopic.enabled).toBe(true);
//     expect(txTopic.channels).toContain(NotificationChannel.NOSTR);
//     expect(txTopic.channels).not.toContain(NotificationChannel.SMS);
//   });
// });
