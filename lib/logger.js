var events = require('events'),
    util = require('util'),
    common = require('../node_modules/winston/lib/winston/common'),
    Transport = require('../node_modules/winston/lib/winston/transports/transport').Transport;

var Dreck = exports.Dreck = function (options) {
  Transport.call(this, options);

  this.client = options.client;
  this.key = 'dreck:logs:' + options.name + ':' + options.started;
};

util.inherits(Dreck, Transport);

//
// Expose the name of this Transport on the prototype
//
Dreck.prototype.name = 'dreck';

//
// ### function log (level, msg, [meta], callback)
// #### @level {string} Level at which to log the message.
// #### @msg {string} Message to log
// #### @meta {Object} **Optional** Additional metadata to attach
// #### @callback {function} Continuation to respond to when complete.
// Core logging method exposed to Winston. Metadata is optional.
//
Dreck.prototype.log = function (level, msg, meta, cb) {
  if (this.silent) {
    return cb(null, true);
  }

  var output = common.log({
    level:       level,
    message:     msg,
    meta:        meta,
  });

  this.client.lpush(this.key, output, function(err, result) {
    if (err) return cb(err);
    return cb(null, result);
  });
};
