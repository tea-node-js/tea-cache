const assert = require('assert');
const Cache = require("../");

/* global describe it */
describe("Cached", () => {
  it('get', async () => {
    const data = {
      name: 'Jason bai',
      age: 31,
    };

    const redis = {
      async get(name) {
        assert.equal(name, 'cachekey');
        return JSON.stringify(data);
      }
    };

    const _ = {};

    const cache = new Cache(redis, _);

    const str = await cache.get('cachekey');

    const actual = JSON.parse(str);

    assert.deepEqual(actual, data)
  });

  it('set', async () => {
    const redis = {
      async set(key, value) {
        assert.equal(key, 'cachekey');
        assert.equal(value, 'value');
      },
      async setex(key, life, value) {
        assert.equal(key, 'cachekey');
        assert.equal(life, 300);
        assert.equal(value, 'value');
      }
    };
    const _ = {};
    const cache = new Cache(redis, _);
    await cache.set("cachekey", "value");
    await cache.set("cachekey", "value", 300);
  });

  it('del', async () => {
    const redis = {
      async del(key) {
        assert.equal(key, 'cachekey');
      }
    };
    const _ = {};
    const cache = new Cache(redis, _);
    await cache.del("cachekey");
  });

  it('caching', async () => {
    const data = {
      name: "Jason bai",
      age: 31
    };

    const redis = {
      async setex(key, life, value) {
        assert.equal(key, 'key: name:age');

        assert.equal(life, 300);

        const parsedValue = JSON.parse(value);

        assert.deepEqual(parsedValue, { arg1: "name", arg2: "age", data });
      }
    };

    redis.get = async key => {
      assert.equal(key, 'key: name:age');

      redis.get = async k => {
        assert.equal(k, 'key: name:age');
        return JSON.stringify({ arg1: "name", arg2: "age", data });
      };

      return Promise.resolve(null);
    };

    const _ = {
      isFunction(fn) {
        return fn instanceof Function;
      },
      isNumber(n) {
        return Number.isInteger(n) && 0 < n;
      }
    };

    const cache = new Cache(redis, _);

    let times = 0;

    const fn = (arg1, arg2) => {
      times += 1;
      return Promise.resolve({ arg1, arg2, data });
    };

    const cached = cache.caching(
      fn,
      300,
      (arg1, arg2) => `key: ${arg1}:${arg2}`
    );

    let res = await cached("name", "age");
    assert.deepEqual(res, { arg1: "name", arg2: "age", data });
    assert.equal(times, 1);
    
    res = await cached('name', 'age');
    assert.deepEqual(res, { arg1: "name", arg2: "age", data });
    assert.equal(times, 1);

    res = await cached("name", "age");
    assert.deepEqual(res, { arg1: "name", arg2: "age", data });
    assert.equal(times, 1);

    assert.throws(() => {
      cache.caching('test');
    }, err => err instanceof Error);

    assert.throws(() => {
      cache.caching(fn, 'abc');
    }, err => err instanceof Error);

    assert.throws(() => {
      cache.caching(fn, 300, 'abc');
    }, err => err instanceof Error);
  });
});
