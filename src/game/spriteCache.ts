/** Small LRU caches: evict cold sprites instead of discarding a whole hot scene. */
export function cacheGet<K, V>(cache: Map<K, V>, key: K): V | undefined {
  const value = cache.get(key);
  if (value !== undefined) {
    cache.delete(key);
    cache.set(key, value);
  }
  return value;
}
export function cacheSet<K, V>(cache: Map<K, V>, key: K, value: V, limit: number): V {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > limit) cache.delete(cache.keys().next().value as K);
  return value;
}
