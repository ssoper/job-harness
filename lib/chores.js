var _ = require('lodash'),
    async = require('async'),
    moment = require('moment'),
    chore = require('../index'),
    client = chore.redis.client(),
    redisKey = chore.redisKey;

var getNames = function(cb) {
  client.smembers(redisKey, function(err, results) {
    if (err) return cb(err);
    cb(null, results);
  });
}

var getChoreInfo = function(name, cb) {
  client.hgetall(redisKey + ':' + name, function(err, results) {
    if (err) return cb(err);
    cb(null, results);    
  });
}

var getStartTimes = function(name, end, cb) {
  if (_.isFunction(end)) {
    cb = end;
    end = 0;
  }

  client.lrange(redisKey + ':logs:' + name, 0, end, function(err, started) {
    if (err) return cb(err);
    cb(null, started);
  });
}

var getLogEntries = function(name, started, cb) {
  client.lrange(redisKey + ':logs:' + name + ':' + started, 0, -1, function(err, results) {
    if (err) return cb(err);
    cb(null, results);
  });
}

var getRunInfo = function(name, started, cb) {
  client.hgetall(redisKey + ':' + name + ':' + started, function(err, info) {
    if (err) return cb(err);
    cb(null, info);
  })
}

var getAvgCompleted = function(name, cb) {
  getStartTimes(name, -1, function(err, startTimes) {
    if (err) return cb(err);
    var results = [];
    async.forEach(startTimes, function(startTime, _cb) {
      getRunInfo(name, startTime, function(err, info) {
        if (err) return _cb(err);
        if (!info.ended) return _cb();
        results.push(info.ended - info.started);
        _cb();
      });
    }, function(err) {
      if (err) return cb(err);
      var avg = _.reduce(results, function(memo, num) { return memo + num }) / results.length;
      cb(null, avg)
    })
  })
}

exports.all = function(cb) {
  var results = [];

  getNames(function(err, names) {
    if (err) return cb(err);
    async.forEach(names, function(name, _cb) {
      var result = {};
      async.waterfall([
        function(wf) {
          getChoreInfo(name, function(err, info) {
            wf(err, { name: info.name, timeout: info.timeout, desc: info.desc });
          });
        },
        function(result, wf) {
          getStartTimes(name, function(err, startTimes) {
            wf(err, result, startTimes[0]);
          });
        },
        function(result, started, wf) {
          getLogEntries(name, started, function(err, entries) {
            result.entries = entries;
            wf(err, result, started);
          });
        },
        function(result, started, wf) {
          getRunInfo(name, started, function(err, stats) {
            _.extend(result, stats);
            wf(err, result);
          });
        },
        function(result, wf) {
          getAvgCompleted(name, function(err, avg) {
            result.average = avg;
            wf(err, result);
          });
        }
      ], function(err, result) {
        if (err) return _cb(err);
        results.push(result);
        _cb();
      });
    }, function(err) {
      if (err) return cb(err);
      if (cb) return cb(null, results);
    });
  });
}

/*
* name, desc, timeout, last started, last finished, avg time to complete (ms), current state
*/
    