import apn from '@parse/node-apn';
import { db } from '@db';
import { deviceRegistrations, pushNotificationLog } from '@db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

/**
 * Apple Push Notification Service (APNs) integration
 * Sends push notifications to Apple Wallet to trigger pass updates
 */
class APNsService {
  private provider: apn.Provider | null = null;

  constructor() {
    this.initializeProvider();
  }

  /**
   * Initialize the APNs provider with token-based authentication
   * Tries to read from .p8 file first, then falls back to environment variable
   * Requires environment variables: APPLE_APNS_KEY_ID, APPLE_TEAM_ID
   */
  private initializeProvider() {
    if (!process.env.APPLE_APNS_KEY_ID || !process.env.APPLE_TEAM_ID) {
      console.warn('⚠️ APNs credentials not configured. Push notifications will be disabled.');
      console.warn('Set APPLE_APNS_KEY_ID and APPLE_TEAM_ID to enable push notifications.');
      return;
    }

    try {
      let apnsKey: string | undefined;

      // Try to read from .p8 file first (more reliable for multiline keys)
      const p8FilePath = path.join(process.cwd(), `AuthKey_${process.env.APPLE_APNS_KEY_ID}.p8`);
      if (fs.existsSync(p8FilePath)) {
        console.log(`📄 Reading APNs key from file: ${p8FilePath}`);
        apnsKey = fs.readFileSync(p8FilePath, 'utf8');
      } else if (process.env.APPLE_APNS_KEY) {
        console.log('📄 Reading APNs key from environment variable');
        apnsKey = process.env.APPLE_APNS_KEY;
      } else {
        console.warn('⚠️ APNs key not found. Upload AuthKey_XXXXX.p8 file or set APPLE_APNS_KEY.');
        return;
      }

      const options: apn.ProviderOptions = {
        token: {
          key: apnsKey,
          keyId: process.env.APPLE_APNS_KEY_ID,
          teamId: process.env.APPLE_TEAM_ID,
        },
        production: process.env.APPLE_APNS_ENVIRONMENT === 'production',
      };

      this.provider = new apn.Provider(options);
      console.log(`✅ APNs provider initialized successfully (${process.env.APPLE_APNS_ENVIRONMENT || 'sandbox'} mode)`);
    } catch (error: any) {
      console.error('❌ Failed to initialize APNs provider:', error.message);
      this.provider = null;
    }
  }

  /**
   * Send push notification to all devices that have the pass installed
   * Apple Wallet will then fetch the updated pass from our web service
   *
   * @param serialNumber - The serial number of the pass that was updated
   */
  async sendPassUpdateNotification(serialNumber: string): Promise<void> {
    if (!this.provider) {
      console.warn('⚠️ APNs provider not initialized. Skipping push notification for pass:', serialNumber);
      return;
    }

    try {
      // Find all devices registered for this pass
      const devices = await db.query.deviceRegistrations.findMany({
        where: eq(deviceRegistrations.serialNumber, serialNumber),
      });

      if (devices.length === 0) {
        console.log(`ℹ️ No devices registered for serial number: ${serialNumber}`);
        return;
      }

      console.log(`📤 Sending push notifications to ${devices.length} device(s) for pass: ${serialNumber}`);

      // Send push notification to each device
      for (const device of devices) {
        try {
          const notification = new apn.Notification();

          // Empty payload - Apple Wallet doesn't need content
          // The push is just a signal to check for updates
          notification.payload = {};

          // Topic must be the pass type identifier
          notification.topic = process.env.APPLE_PASS_TYPE_ID!;

          const result = await this.provider.send(notification, device.pushToken);

          // Check for failures
          if (result.failed.length > 0) {
            const failure = result.failed[0];
            const reason = failure.response?.reason || 'Unknown error';

            console.error(`❌ Push failed for device ${device.deviceLibraryIdentifier}: ${reason}`);

            // Log the failure
            await db.insert(pushNotificationLog).values({
              serialNumber,
              pushToken: device.pushToken,
              status: 'failed',
              errorMessage: reason,
            });

            // If token is invalid, remove the device registration
            if (reason === 'BadDeviceToken' || reason === 'Unregistered') {
              console.log(`🧹 Removing invalid device registration: ${device.id}`);
              await db.delete(deviceRegistrations)
                .where(eq(deviceRegistrations.id, device.id));
            }
          } else {
            // Log success
            await db.insert(pushNotificationLog).values({
              serialNumber,
              pushToken: device.pushToken,
              status: 'sent',
            });

            console.log(`✅ Push notification sent successfully to device: ${device.deviceLibraryIdentifier}`);
          }
        } catch (error: any) {
          console.error(`❌ Failed to send push to device ${device.id}:`, error.message);

          // Log the error
          await db.insert(pushNotificationLog).values({
            serialNumber,
            pushToken: device.pushToken,
            status: 'failed',
            errorMessage: error.message,
          });
        }
      }
    } catch (error: any) {
      console.error('❌ Error sending pass update notifications:', error.message);
      throw error;
    }
  }

  /**
   * Gracefully shutdown the APNs provider
   * Call this when shutting down the server
   */
  async shutdown(): Promise<void> {
    if (this.provider) {
      await this.provider.shutdown();
      console.log('APNs provider shut down');
    }
  }
}

// Export a singleton instance
export const apnsService = new APNsService();
