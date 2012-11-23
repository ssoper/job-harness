var _ = require('lodash'),
    async = require('async'),
    winston = require('winston'),
    moment = require('moment'),
    util = require('util'),
    redis = require('./lib/redis'),
    DreckLogger = require('./lib/logger');

function Job(name, desc, timeout, cb) {
  if (name.match(/\s/))
    return cb(new TypeError('Name cannot contain spaces, use underscores instead'));

  var logsKey, statsKey;
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

    client.hset(statsKey, 'progress', value.toString(), function(err, result) {
      if (err && _cb) return _cb(err);
      if (_cb) return _cb(null, result);
      return;
    });
  };

  var done = function(error, _cb) {
    clearTimeout(_timeout);

    if (_.isFunction(error)) {
      _cb = error;
      error = null;
    }

    var ended = moment().unix(),
        state = error && 'failure' || 'success';

    async.series([
      function(series) {
        client.hmset(statsKey, 'ended', ended, 'progress', '1.0', 'state', state, function(err, result) {
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
      client.sadd('dreck:jobs', name, function(err, result) {
        if (err) return series(err);
        return series();
      });
    },
    function(series) {
      var _timeout = _.isNumber(timeout) && timeout.toString() || timeout;
      client.hmset('dreck:jobs:' + name, { name: name, desc: desc, timeout: _timeout }, function(err, result) {
        if (err) return series(err);
        return series();          
      });
    },
    function(series) {
      client.lpush('dreck:logs:' + name, started, function(err, result) {
        if (err) return series(err);
        statsKey = 'dreck:stats:' + name + ':' + started;
        logsKey = 'dreck:logs:' + name + ':' + started;
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
      client.hmset(statsKey, 'started', started, 'state', 'running', 'progress', 0, function(err, result) {
        if (err) return series(err);
        return series();          
      });
    },
    function(series) {
      client.expire(statsKey, ttl, function(err, result) {
        if (err) return series(err);
        return series();          
      });
    }
  ], function(err) {
    if (err) return cb(err);

    var logger = new winston.Logger({
      transports: [
        new (winston.transports.DreckLogger)({ client: client, key: logsKey, handleExceptions: true })
      ]
    });

    Object.defineProperty(self, 'logger', { value: logger, enumerable: true });
    Object.defineProperty(self, 'progress', { value: progress, enumerable: true });
    Object.defineProperty(self, 'done', { value: done, enumerable: true });
    Object.defineProperty(self, 'started', { value: started, enumerable: true });

    return cb(null, self);
  });
}

module.exports = function(name, desc, timeout, cb) {
  return new Job(name, desc, timeout, cb);
}

module.exports.redis = redis;

/*    
    sadd dreck:jobs name
      hmset dreck:jobs:name name desc timeout
        lpush dreck:logs:name started
          expire dreck:logs:name:started 608400
            hmset dreck:stats:name:started started time ended time events number state running
              expire dreck:stats:name:started 608400

    on job finish
    hmset dreck:stats:name:started started time ended time events number state (success|failure)
      expire dreck:stats:name:started 608400

    on log
    lpush dreck:logs:name:started log
*/
//   }
// }

/**
 * Adds timeout functionality to a Kue job
 * 
 * Use:
 *  var jobRunner = require('job_runner');
 *  jobRunner.create('poll', 'Poll a server', 60) // Poll a server every hour, timeout expressed in minutes
 *  jobRunner.run(function(job, done) {
 *    // polling code
 *  }, function(timeout) {
 *    console.log('Timed out');
 *    process.exit(1);
 *  })
 *
 **/
/*
function JobRunner() {
  var jobs = kue.createQueue();
  var _name;
  var _title;
  var _timeout;

  var object = {
    create: function(name, title, timeout) {
      _name = name;
      _title = title;
      _timeout = timeout * 60 * 1000;

      jobs.create(name, {
        title: title
      }).save();
    },

    run: function(cb, timeout_cb) {
      jobs.process(_name, function(job, done) {
        var doneTimeout = setTimeout(function() {
          done({ message: 'Timeout' });
          timeout_cb(_timeout);
        }, _timeout);

        var _done = function(err) {
          clearTimeout(doneTimeout);
          if (err && !(err.stack || err.message)) {
            err = { message: err };
          }
          done(err);
        }

        cb(job, _done);
      });
    }
  };

  return object;
}

module.exports = new JobRunner();
*/