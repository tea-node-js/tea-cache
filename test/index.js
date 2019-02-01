const assert = require('assert');
const cache = require('..');

/* global describe it */
describe('cache', () => {
  describe('init function exception', () => {
    it('call cache.get throw', () => {
      assert.throws(() => {
        cache.get('name');
      }, Error);
    });

    it('call cache.set throw', () => {
      assert.throws(() => {
        cache.set('name', new Date(), 10);
      }, Error);
    });

    it('call cache.del throw', () => {
      assert.throws(() => {
        cache.del('name');
      }, Error);
    });

    it('call cache.get name non-exists', (done) => {
      cache.init(undefined, undefined, { namespace: 'tea-cache-rest' });
      // notice: clear all keys from redis
      cache.get('name', (error, result) => {
        assert.equal(null, error);
        assert.equal(null, result);
        done();
      });
    });

    it('call cache.set name', (done) => {
      cache.set('name', 'tea-node', 1, (error) => {
        assert.equal(null, error);
        done();
      });
    });

    it('call cache.get name exists', (done) => {
      cache.get('name', (error, value) => {
        assert.equal(null, error, null);
        assert.equal('tea-node', value);
        done();
      });
    });

    it('call cache.get cache expired, return null', (done) => {
      setTimeout(() => {
        cache.get('name', (error, value) => {
          assert.equal(null, error);
          assert.equal(null, value);
          done();
        });
      }, 1000);
    });

    it('call cache.del cache, again cache.get return null', (done) => {
      cache.set('name', 'tea-node', 0, (error) => {
        assert.equal(null, error);
        cache.del('name', (error) => {
          assert.equal(null, error);
          cache.get('name', (error, value) => {
            assert.equal(null, error);
            assert.equal(null, value);
            done();
          });
        });
      });
    });
    it('call cache, auto cached function', (done) => {
      let count = 0;
      let readFile = (path, callback) => {
        count += 1;
        process.nextTick(() => {
          callback(null, 'hello world');
        });
      };

      readFile = cache('fs.readFile:{0}', readFile, 1);

      const path = `${__dirname}/index.js`;

      readFile(path, (error, data) => {
        assert.equal(1, count);
        assert.equal(null, error);
        assert.equal('hello world', data);

        readFile(path, (error, data) => {
          assert.equal(1, count);
          assert.equal(null, error);
          assert.equal('hello world', data);
          setTimeout(() => {
            readFile(path, (error, data) => {
              assert.equal(2, count);
              assert.equal(null, error);
              assert.equal('hello world', data);
              done();
            });
          }, 1000);
        });
      });
    });

    it('call cache, auto cached function, exec fail, no-cache', (done) => {
      let count = 0;
      let asyncFn = (path, callback) => {
        count += 1;
        process.nextTick(() => {
          callback(Error('something is wrong'));
        });
      };

      asyncFn = cache('asyncFn:{0}', asyncFn, 1);

      const path = 'index.js';

      asyncFn(path, (error, data) => {
        assert.equal(1, count);
        assert.equal('something is wrong', error.message);
        assert.equal(undefined, data);
        asyncFn(path, (error, data) => {
          assert.equal(2, count);
          assert.equal('something is wrong', error.message);
          assert.equal(undefined, data);
          setTimeout(() => {
            asyncFn(path, (error, data) => {
              assert.equal(3, count);
              assert.equal('something is wrong', error.message);
              assert.equal(undefined, data);
              done();
            });
          }, 1000);
        });
      });
    });

    it('call cache, auto cached function, exec fail, restore cache', (done) => {
      let count = 0;
      let asyncFn2 = (path, callback) => {
        count += 1;
        process.nextTick(() => {
          if (count > 1) {
            return callback(null, 'hello world');
          }
          return callback(Error('something is wrong'));
        });
      };

      asyncFn2 = cache('asyncFn2:{0}', asyncFn2, 1);

      const path = 'index.js';

      asyncFn2(path, (error, data) => {
        assert.equal(1, count);
        assert.equal('something is wrong', error.message);
        assert.equal(undefined, data);
        asyncFn2(path, (error, data) => {
          assert.equal(2, count);
          assert.equal(null, error);
          assert.equal('hello world', data);
          asyncFn2(path, (error, data) => {
            assert.equal(2, count);
            assert.equal(null, error);
            assert.equal('hello world', data);
            setTimeout(() => {
              asyncFn2(path, (error, data) => {
                assert.equal(3, count);
                assert.equal(null, error);
                assert.equal('hello world', data);
                done();
              });
            }, 1000);
          });
        });
      });
    });

    const key1 = 'key1';
    const key2 = 'key2';

    it('set, get, key length test', (done) => {
      cache.set(key1, 'key1', 1, (error) => {
        assert.equal(null, error);
        cache.get(key2, (error, data) => {
          assert.equal(null, error);
          assert.equal(undefined, data);
          cache.get(key1, (error, data) => {
            assert.equal(null, error);
            assert.equal('key1', data);
            done();
          });
        });
      });
    });

    it('set, get, key length test 2', (done) => {
      cache.set(key2, 'key2', 1, (error) => {
        assert.equal(null, error);
        cache.get(key2, (error, data) => {
          assert.equal(null, error);
          assert.equal('key2', data);
          cache.get(key1, (error, data) => {
            assert.equal(null, error);
            assert.equal('key1', data);
            done();
          });
        });
      });
    });

    it('removeKey test', (done) => {
      let count = 0;
      let fn = (key, callback) => {
        count += 1;
        callback(null, `${key}, Hello world`);
      };
      fn = cache('Key: {0}', fn, 100);
      fn('nihao', (error, result) => {
        assert.ifError(error);
        assert.equal('nihao, Hello world', result);
        fn.removeKey('nihao', (error) => {
          assert.equal(null, error);
          cache.get('Key: nihao', (error, result) => {
            assert.ifError(error);
            assert.equal(null, result);
            fn('nihao', (error, result) => {
              assert.ifError(error);
              assert.equal('nihao, Hello world', result);
              assert.equal(2, count);
              fn.removeKey('nihao', (error) => {
                assert.ifError(error);
                done();
              });
            });
          });
        });
      });
    });

    it('close redis client', () => {
      cache.client.end(true);
    });
  });
});
