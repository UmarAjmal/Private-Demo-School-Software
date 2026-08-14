/**
 * High-Performance Client-Side Stale-While-Revalidate (SWR) In-Memory Cache Engine
 * Provides 0ms instant tab switching and background live updates.
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

class ClientApiCache {
    private memoryCache = new Map<string, CacheEntry<any>>();

    /**
     * Get cached payload instantly from memory (0ms load time)
     */
    get<T = any>(key: string): T | null {
        const entry = this.memoryCache.get(key);
        if (!entry) return null;
        return entry.data as T;
    }

    /**
     * Set payload into memory cache & localStorage fallback
     */
    set<T = any>(key: string, data: T): void {
        this.memoryCache.set(key, { data, timestamp: Date.now() });
        try {
            if (typeof window !== 'undefined') {
                localStorage.setItem(`api_cache_${key}`, JSON.stringify({ data, timestamp: Date.now() }));
            }
        } catch (e) { }
    }

    /**
     * Smart Fetch with Stale-While-Revalidate:
     * 1. Returns cached memory data instantly (0ms) if available.
     * 2. Fetches background updates from API and silently calls onUpdate if data changed!
     */
    async fetchWithCache<T = any>(
        url: string,
        onImmediate: (data: T) => void,
        onUpdate?: (data: T) => void
    ): Promise<T | null> {
        const cacheKey = url;
        const cached = this.get<T>(cacheKey);

        // 1. Deliver instant memory cache if present
        if (cached) {
            onImmediate(cached);
        } else {
            // Check localStorage fallback
            try {
                if (typeof window !== 'undefined') {
                    const raw = localStorage.getItem(`api_cache_${cacheKey}`);
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        this.memoryCache.set(cacheKey, parsed);
                        onImmediate(parsed.data);
                    }
                }
            } catch (e) { }
        }

        // 2. Background Revalidation (Fetch fresh data silently without UI reload)
        try {
            const res = await fetch(url);
            if (res.ok) {
                const freshData: T = await res.json();
                const currentCachedStr = JSON.stringify(cached);
                const freshStr = JSON.stringify(freshData);

                // Update memory cache
                this.set(cacheKey, freshData);

                // If data changed or no previous cache existed, trigger state update!
                if (freshStr !== currentCachedStr) {
                    if (onUpdate) onUpdate(freshData);
                    else onImmediate(freshData);
                }
                return freshData;
            }
        } catch (err) {
            console.warn("Background revalidation failed (using cache):", err);
        }

        return cached;
    }

    /**
     * Invalidate specific key pattern (e.g. 'students_*')
     */
    invalidate(keyPattern: string): void {
        const regex = new RegExp('^' + keyPattern.replace(/\*/g, '.*') + '$');
        for (const key of this.memoryCache.keys()) {
            if (regex.test(key)) {
                this.memoryCache.delete(key);
                try { localStorage.removeItem(`api_cache_${key}`); } catch (e) { }
            }
        }
    }
}

export const apiCache = new ClientApiCache();
