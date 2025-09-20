// Content missing for src/shared/utils.ts
export function formatUrl(url: string): string {
    try {
    const { hostname } = new URL(url);
    return hostname;
    } catch {
    return url;
    }
}