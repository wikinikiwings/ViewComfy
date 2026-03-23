/**
 * Global in-memory image cache.
 * Once an image URL is fetched, it's stored as a blob URL that displays instantly
 * without any network request or decode delay on subsequent views.
 */

const blobCache = new Map<string, string>();
const pendingLoads = new Map<string, Promise<string | null>>();

/**
 * Get the cached blob URL for a given image URL, or null if not cached.
 */
export function getCachedUrl(url: string): string | null {
    return blobCache.get(url) ?? null;
}

/**
 * Preload an image URL into the blob cache in the background.
 * Returns the blob URL on success, or null on failure.
 * Multiple calls with the same URL deduplicate automatically.
 */
export function preloadImage(url: string): Promise<string | null> {
    // Already cached
    if (blobCache.has(url)) {
        return Promise.resolve(blobCache.get(url)!);
    }

    // Already loading
    if (pendingLoads.has(url)) {
        return pendingLoads.get(url)!;
    }

    const promise = fetch(url)
        .then(res => {
            if (!res.ok) return null;
            return res.blob();
        })
        .then(blob => {
            if (!blob) return null;
            const blobUrl = URL.createObjectURL(blob);
            blobCache.set(url, blobUrl);
            return blobUrl;
        })
        .catch(() => null)
        .finally(() => {
            pendingLoads.delete(url);
        });

    pendingLoads.set(url, promise);
    return promise;
}

/**
 * Preload with fallback: tries the primary URL first, falls back to secondary on failure.
 * Returns whichever blob URL succeeded, mapped to the primary key.
 */
export async function preloadWithFallback(primaryUrl: string, fallbackUrl: string): Promise<string | null> {
    const result = await preloadImage(primaryUrl);
    if (result) return result;
    // Primary failed — cache fallback under the primary key too
    const fallbackResult = await preloadImage(fallbackUrl);
    if (fallbackResult) {
        blobCache.set(primaryUrl, fallbackResult);
    }
    return fallbackResult;
}

/**
 * Get cached URL or return the original URL as-is (for use in src attributes).
 */
export function resolveUrl(url: string): string {
    return blobCache.get(url) ?? url;
}
