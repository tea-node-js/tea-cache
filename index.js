const redis = require('redis');
const _ = require('lodash');
const async = require('async');

let client = null;
let namespace = '';

const { slice } = Array.prototype;

const getKey = key => `${namespace}::${key}`;

const get = (key, callback) => {
  const _key = getKey(key);
  client.get(_key, (error, result) => {
    if (error) {
      return callback(error);
    }
    return callback(null, JSON.parse(result));
  });
};

const set = (key, value, life, callback) => {
  const _key = getKey(key);
  client.set(_key, JSON.stringify(value), (error) => {
    if (error) {
      callback(error);
      return;
    }
    if (!life) {
      callback();
      return;
    }
    client.expire([_key, life || 1], (error) => {
      if (error) {
        console.error(error);
        return;
      }
      callback();
    });
  });
};

const flush = (key, callback) => {
  const _key = getKey(key);
  client.keys(_key, (error, list) => {
    if (error) {
      callback(error);
      return;
    }
    async.each(list, client.del.bind(client), callback);
  });
};

const del = (key, callback = console.error) => {
  const _key = getKey(key);
  client.del(_key, callback);
};

// 只为cache 函数使用，用来根据用户执行函数的参数中获取到cache的key
const cacheKey = (tpl, args) => {
  const regexp = /\{(\d+)\}/g;
  if (!regexp.test(tpl)) {
    return tpl;
  }
  return tpl.replace(regexp, (m, i) => args[i]);
};

const cache = (keyTpl, func, life) => {
  if (!client) throw Error('cache must be init, at use before');

  function fn() {
    const _arguments = slice.call(arguments);
    const callback = _arguments[_arguments.length - 1];
    if (!_.isFunction(callback)) {
      throw Error('Callback function non-exists');
    }
    const args = slice.call(_arguments, 0, _arguments.length - 1);
    const key = cacheKey(keyTpl, args);
    get(key, (error, result) => {
      /**
       * 获取cache有错误的时候需要输出，但是不需要通知调用方，对调用方透明
       * 因为调用方可能压根没有处理这种异常的逻辑
       * 另外这种并不会影响程序功能
       * 所以返回给用户将毫无意义，而且会打乱调用方原有的代码
       */
      if (error) {
        console.error(error);
        return;
      }
      // 如果有错误或者结果不存在，则需要执行func
      if (!error && result) {
        callback(null, result);
        return;
      }
      /**
       * 这里要把用户原有的callback给封装起来，这样我们才能将他的结果cache起来
       * 这里要注意的是我们只cache成功的结果。失败的，错误的都不cache
       * 以免影响用户既有功能
       */
      args.push((error, result) => {
        if (error) {
          callback(error, result);
          return;
        }
        set(key, result, life, (_error) => {
          callback(_error, result);
        });
      });

      /**
       * 执行函数
       * 因为callback已经是被替换后的函数了。
       * 所以尽管只是简单的调用的用户的函数，但其实会把他的结果cache起来
       */
      func.apply(null, args);
    });
  }

  function removeKey() {
    const _arguments = slice.call(arguments);
    let callback = _arguments[_arguments.length - 1];
    if (!callback) {
      callback = console.error;
    }
    const args = slice.call(_arguments, 0, _arguments.length - 1);
    const key = cacheKey(keyTpl, args);
    del(key, callback);
  }

  fn.removeKey = removeKey;

  return fn;
};

cache.init = (port = 6379, ip = '127.0.0.1', opts) => {
  if (client) {
    return client;
  }
  /* eslint prefer-destructuring: 0 */
  if (opts && opts.namespace) {
    namespace = opts.namespace;
  }
  client = redis.createClient(port, ip, opts || opts.redis);
  client.on('error', (error) => {
    console.error(error);
  });
  cache.get = get;
  cache.set = set;
  cache.del = del;
  cache.flush = flush;
  cache.client = client;
  cache.inited = true;
  return client;
};

const notInitial = () => {
  throw Error('cache must be init, at use before');
};

cache.get = notInitial;
cache.set = notInitial;
cache.del = notInitial;

module.exports = cache;
