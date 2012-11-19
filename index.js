var _ = require('lodash'),
    async = require('async'),
    redis = require('redis'),
    winston = require('winston'),
    moment = require('moment'),
    util = require('util'),
    Logger = require('./lib/logger');

function Dreck(name, desc, timeout, client, cb) {
  var key, logger,
      ttl = moment().add('weeks', 2).unix(),
      started = moment().unix();

  var progress = function(value, _cb) {
    var _value = _.isNumber(value) && value.toString() || value;
    client.hset(key, 'progress', _value, function(err, result) {
      if (err && _cb) return _cb(err);
      if (_cb) return _cb(null, result);
      return;
    });
  };

  var doneTimeout = setTimeout(function() {
    done('Timeout');
  }, timeout*60*1000);

  var done = function(error, _cb) {
    clearTimeout(doneTimeout);

    if (_.isFunction(error)) {
      _cb = error;
      error = null;
    }

    var ended = moment().unix();
    var state = err && 'failure' || 'success';

    async.series([
      function(series) {
        client.hmset(key, 'ended', ended, 'progress', '1.0', 'state', state, function(err, result) {
          return series();
        });
      },
      function(series) {
        if (error) {
          // log winston error
          logger.error(error, function() {
            client.end();
            series(error);
            process.exit(1);              
          });
        }    
      }
    ], function(err) {
      if (err && _cb) return _cb(err);
      if (err) process.exit(1);
      if (_cb) return _cb();
      process.exit();
    });
  };

  async.series([
    function(series) {
      client.sadd('dreck:jobs', name, function(err, result) {
        if (err) return series(err);
        return series();
      });
    },
    function(series) {
      console.log(name)
      console.log(desc)
      console.log(timeout)
      var _timeout = _.isNumber(timeout) && timeout.toString() || timeout;
      client.hmset('dreck:jobs:' + name, { name: name, desc: desc, timeout: _timeout }, function(err, result) {
        if (err) return series(err);
        return series();          
      });
    },
    function(series) {
      client.lpush('dreck:logs:' + name, started, function(err, result) {
        if (err) return series(err);
        key = 'dreck:logs:' + name + ':' + started;
        return series();
      });
    },
    function(series) {
      client.expire(key, ttl, function(err, result) {
        if (err) return series(err);
        return series();
      });
    },
    function(series) {
      client.hmset(key, 'started', started, 'state', 'running', 'progress', 0, function(err, result) {
        if (err) return series(err);
        return series();          
      });
    },
    function(series) {
      client.expire(key, ttl, function(err, result) {
        if (err) return series(err);
        return series();          
      });
    }
  ], function(err) {
    if (err) return cb(err);

    logger = new (winston.Logger)({
      transports: [
        new (Logger)({ client: client, name: name, started: started, handleExceptions: true })
      ]
    });

    return cb(null, logger, progress, done);
  });
}

module.exports = function(name, desc, timeout, host, port, cb) {
  if (!this._client) {
    if (!cb) {
      cb = host;
      this._client = redis.createClient();
    } else {
      this._client = redis.createClient(host, port);
    }
  }

  return new Dreck(name, desc, timeout, this._client, cb);
}  
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