var events = require('events'),
    util = require('util'),
    winston = require('winston'),
    common = require('../node_modules/winston/lib/winston/common');

var ChoreLogger = winston.transports.ChoreLogger = function (options) {
  winston.Transport.call(this, options);
  this.name = 'ChoreLogger';

  this.choreClient = options.client;
  this.choreKey = options.key;
  this.level = options.level || 'info';
};

util.inherits(ChoreLogger, winston.Transport);

ChoreLogger.prototype.log = function (level, msg, meta, cb) {
  if (this.silent) {
    return cb(null, true);
  }

  var output = common.log({
    level:     level,
    message:   msg,
    meta:      meta,
    timestamp: true
  });

  this.choreClient.rpush(this.choreKey, output, function(err, result) {
    if (err) return cb(err);
    return cb(null, result);
  });
};
