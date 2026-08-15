/**
 * Offline Data Caching Engine for Capacitor Mobile App & Web App
 * Allows seamless offline app usage even when WiFi / Mobile Data is disconnected.
 */

export const OfflineStorage = {
    /**
     * Save data payload into Mobile LocalStorage
     */
    set: (key: string, value: any): void => {
        try {
            if (typeof window === 'undefined') return;
            const payload = {
                timestamp: Date.now(),
                data: value
            };
            localStorage.setItem(`sms_offline_${key}`, JSON.stringify(payload));
        } catch (err) {
            console.warn("OfflineStorage save error:", err);
        }
    },

    /**
     * Retrieve cached data payload from Mobile LocalStorage
     */
    get: <T = any>(key: string): T | null => {
        try {
            if (typeof window === 'undefined') return null;
            const raw = localStorage.getItem(`sms_offline_${key}`);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed.data as T;
        } catch (err) {
            console.warn("OfflineStorage read error:", err);
            return null;
        }
    },

    /**
     * Remove specific cached item
     */
    remove: (key: string): void => {
        try {
            if (typeof window === 'undefined') return;
            localStorage.removeItem(`sms_offline_${key}`);
        } catch (err) { }
    },

    /**
     * Check if device is currently online
     */
    isOnline: (): boolean => {
        if (typeof window === 'undefined') return true;
        return navigator.onLine;
    }
};
