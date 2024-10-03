// src/app/lib/cache.ts
export class Cache<T> {
    private static instance: Cache<any>;
    private cache: Map<string, { data: T; timestamp: number }> = new Map();
  
    private constructor() {}
  
    static getInstance<U>(): Cache<U> {
      if (!Cache.instance) {
        Cache.instance = new Cache<U>();
      }
      return Cache.instance as Cache<U>;
    }
  
    set(key: string, value: T, ttl: number = 60000): void {
      this.cache.set(key, { data: value, timestamp: Date.now() + ttl });
    }
  
    get(key: string): T | null {
      const item = this.cache.get(key);
      if (item && item.timestamp > Date.now()) {
        return item.data;
      }
      this.cache.delete(key);
      return null;
    }
  
    delete(key: string): void {
      this.cache.delete(key);
    }
  
    clear(): void {
      this.cache.clear();
    }

    findAll(): string[] {
      return Array.from(this.cache.keys());
    }

    findByPk(key: string): { data: T; timestamp: number } | undefined {
      return this.cache.get(key);
    }

    destroy(options: { where: { key: string } }): void {
      this.cache.delete(options.where.key);
    }
}
  
export const cacheInstance = Cache.getInstance<any>();