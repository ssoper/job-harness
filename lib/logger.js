var events = require('events'),
    util = require('util'),
    winston = require('winston'),
    common = require('../node_modules/winston/lib/winston/common');

var DreckLogger = winston.transports.DreckLogger = function (options) {
  winston.Transport.call(this, options);
  this.name = 'DreckLogger';

  this.dreckClient = options.client;
  this.dreckKey = options.key;
  this.level = options.level || 'info';
};

util.inherits(DreckLogger, winston.Transport);

DreckLogger.prototype.log = function (level, msg, meta, cb) {
  if (this.silent) {
    return cb(null, true);
  }

  var output = common.log({
    level:     level,
    message:   msg,
    meta:      meta,
    timestamp: true
  });

  this.dreckClient.lpush(this.dreckKey, output, function(err, result) {
    if (err) return cb(err);
    return cb(null, result);
  });
};
