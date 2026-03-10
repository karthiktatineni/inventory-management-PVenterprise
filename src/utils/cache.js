/**
 * Simple in-memory cache with TTL support.
 * Reduces redundant Firestore reads by caching data locally in the browser session.
 * 
 * Products are cached for 2 minutes — real-time listeners still push updates.
 * Settings are cached for 10 minutes.
 * Bills are cached for 1 minute.
 */

const cache = new Map();

/**
 * Get value from cache if it hasn't expired.
 * @param {string} key
 * @returns {any|null} cached value or null
 */
export const getCache = (key) => {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    return entry.value;
};

/**
 * Set a value in the cache.
 * @param {string} key
 * @param {any} value
 * @param {number} ttlMs - time to live in milliseconds
 */
export const setCache = (key, value, ttlMs = 120000) => {
    cache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
    });
};

/**
 * Invalidate (delete) a specific cache entry.
 * Call this whenever you write data that should refresh the cache.
 * @param {string} key
 */
export const invalidateCache = (key) => {
    cache.delete(key);
};

/**
 * Clear all entries with keys that start with a given prefix.
 * Useful for clearing related entries (e.g. all product caches).
 * @param {string} prefix
 */
export const invalidateCacheByPrefix = (prefix) => {
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) cache.delete(key);
    }
};

// TTL Constants (in milliseconds) — tune these for your needs
export const TTL = {
    PRODUCTS: 2 * 60 * 1000,    // 2 minutes
    SETTINGS: 10 * 60 * 1000,   // 10 minutes
    BILLS: 1 * 60 * 1000,       // 1 minute
    WORKERS: 5 * 60 * 1000,     // 5 minutes
};
