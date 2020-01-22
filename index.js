class Cache {
  constructor(redis, _) {
    this.redis = redis;
    this._ = _;
  }

  get(key) {
    return this.redis.get(key);
  }

  set(key, value, life = 0) {
    if (!life) return this.redis.set(key, value);
    return this.redis.setex(key, life, value);
  }

  del(key) {
    return this.redis.del(key);
  }

  caching(fn, life, getKey) {
    if (!this._.isFunction(fn)) throw Error('The first argument must be a function');
    if (!this._.isNumber(life)) throw Error('The second argument must be a number and great than 0');
    if (!this._.isFunction(getKey)) throw Error('The third argument must be a function');

    return async(...args) => {
      const key = getKey(...args);

      const data = await this.redis.get(key);

      if (data) return JSON.parse(data);

      const res = await fn(...args);

      this.set(key, JSON.stringify(res), life);

      return res;
    }
  }
}

module.exports = Cache;