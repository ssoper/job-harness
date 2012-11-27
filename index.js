var _ = require('lodash'),
    async = require('async'),
    winston = require('winston'),
    moment = require('moment'),
    redis = require('./lib/redis'),
    ChoreLogger = require('./lib/logger'),
    redisKey = 'chores';

function Job(name, desc, timeout, cb) {
  if (name.match(/\s/))
    return cb(new TypeError('Name cannot contain spaces, use underscores instead'));

  if (_.isFunction(timeout)) {
    cb = timeout;
    timeout = 5; // minutes
  }

  var logsKey, jobsKey;
  var client = redis.client();
  var _timeout = setTimeout(function() {
    done('Timeout');
  }, timeout*60*1000);

  var progress = function(value, _cb) {
    var isFloat = function (n) {
      return n===+n && n!==(n|0);
    }

    if (!_.isNumber(value))
      return _cb('Must pass a number');

    if (!isFloat(value))
      return _cb('Must pass a float');

    client.hset(jobsKey, 'progress', value.toString(), function(err, result) {
      if (err && _cb) return _cb(err);
      if (_cb) return _cb(null, result);
      return;
    });
  };

  var timedOut = function(_cb) {
    if (_cb) return _cb();
    process.exit(1);
  }

  var done = function(error, _cb) {
    clearTimeout(_timeout);

    if (_.isFunction(error)) {
      _cb = error;
      error = null;
    }

    var ended = moment().unix();
    var state = 'success';

    if (error) state = 'failure';
    if (error === 'Timeout') state = 'timeout';

    async.series([
      function(series) {
        client.hmset(jobsKey, 'ended', ended, 'progress', '1.0', 'state', state, function(err, result) {
          return series();
        });
      },
      function(series) {
        if (!error) return series();
        logger.error(error, function() {
          return series(error);
        });
      }
    ], function(err) {
      if (err && err === 'Timeout') return timedOut();
      if (err && _cb) return _cb(err);
      if (err) process.exit(1);
      if (_cb) return _cb(null, true);
      process.exit();
    });
  };

  var self = this,
      ttl = moment().add('weeks', 2).unix(),
      started = moment().unix();

  async.series([
    function(series) {
      client.sadd(redisKey, name, function(err, result) {
        if (err) return series(err);
        return series();
      });
    },
    function(series) {
      var _timeout = _.isNumber(timeout) && timeout.toString() || timeout;
      client.hmset(redisKey + ':' + name, { name: name, desc: desc, timeout: _timeout }, function(err, result) {
        if (err) return series(err);
        return series();          
      });
    },
    function(series) {
      client.lpush(redisKey + ':logs:' + name, started, function(err, result) {
        if (err) return series(err);
        jobsKey = redisKey + ':' + name + ':' + started;
        logsKey = redisKey + ':logs:' + name + ':' + started;
        return series();
      });
    },
    function(series) {
      client.lpush(logsKey, 'Started', function(err, result) {
        if (err) return series(err);
        return series();
      });
    },
    function(series) {
      client.expire(logsKey, ttl, function(err, result) {
        if (err) return series(err);
        return series();
      });
    },
    function(series) {
      client.hmset(jobsKey, 'started', started, 'state', 'running', 'progress', 0, function(err, result) {
        if (err) return series(err);
        return series();          
      });
    },
    function(series) {
      client.expire(jobsKey, ttl, function(err, result) {
        if (err) return series(err);
        return series();          
      });
    }
  ], function(err) {
    if (err) return cb(err);

    var logger = new winston.Logger({
      transports: [
        new (winston.transports.ChoreLogger)({ client: client, key: logsKey, handleExceptions: true })
      ]
    });

    Object.defineProperty(self, 'logger', { value: logger, enumerable: true });
    Object.defineProperty(self, 'log', { value: logger.info, enumerable: true });
    Object.defineProperty(self, 'progress', { value: progress, enumerable: true });
    Object.defineProperty(self, 'done', { value: done, enumerable: true });
    Object.defineProperty(self, 'started', { value: started, enumerable: false });
    Object.defineProperty(self, 'timedOut', { value: timedOut, enumerable: true });

    return cb(null, self);
  });
}

module.exports = function(name, desc, timeout, cb) {
  return new Job(name, desc, timeout, cb);
}

module.exports.redis = redis;
Object.defineProperty(module.exports, 'redisKey', { value: redisKey });

/*
sadd chores name
  hmset chores:name name desc timeout
    lpush chores:logs:name started
      lpush chores:logs:name:started 'Started'
        expire chores:logs:name:started 608400
          hmset chores:name:started started time ended time progress number state running
            expire chores:name:started 608400

on done
hmset chores:name:started started time ended time progress number state (success|failure|timeout)

on log
lpush chores:logs:name:started event
*/
