import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Request Mobile OS Native Push & Local Notification Permissions
 */
export async function requestMobileNotificationPermissions() {
    try {
        if (typeof window !== 'undefined') {
            // 1. Web / PWA Notification permission
            if ('Notification' in window && Notification.permission !== 'granted') {
                await Notification.requestPermission();
            }

            // 2. Capacitor Android Native permission
            try {
                const perm = await LocalNotifications.checkPermissions();
                if (perm.display !== 'granted') {
                    await LocalNotifications.requestPermissions();
                }
            } catch (capErr) {
                // Non-Capacitor / pure browser fallback
            }
        }
    } catch (err) {
        console.warn("Mobile notification permission request warning:", err);
    }
}

/**
 * Triggers a Mobile OS Native Device Notification on top of phone screen / status bar
 */
export async function triggerNativeDeviceNotification(id: number, title: string, message: string, link?: string) {
    try {
        if (typeof window === 'undefined') return;

        let scheduledCapacitor = false;

        // A. Capacitor Android Native Device Notification
        try {
            await LocalNotifications.schedule({
                notifications: [
                    {
                        title: title,
                        body: message,
                        id: Math.floor(Math.abs(id)) || Math.floor(Math.random() * 100000),
                        schedule: { at: new Date(Date.now() + 500) },
                        sound: undefined,
                        attachments: undefined,
                        actionTypeId: '',
                        extra: { link: link || '/dashboard' }
                    }
                ]
            });
            scheduledCapacitor = true;
        } catch (capErr) {
            // Non-Capacitor environment
        }

        // B. Fallback to Browser / Web Notification API
        if (!scheduledCapacitor && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: message,
                icon: '/icon.png',
                badge: '/icon.png',
                tag: `notif-${id}`
            });
        }
    } catch (err) {
        console.warn("Native notification trigger error:", err);
    }
}
