var _ = require('lodash'),
    redis = require('redis'),
    winston = require('winston');


function Harness() {
  
}

module.exports = function() {
  return function(name, desc, timeout, host, port, cb) {
    var client;
    
    // timeout = timeout*3600;

    if (!cb) {
      cb = host;
      client = redis.createClient();
    } else {
      client = redis.createClient(host, port);
    }

    
  }
}

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
