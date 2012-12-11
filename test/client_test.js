var assert = require('assert')
    async = require('async'),
    fakeredis = require('fakeredis'),
    chore = require('../index'),
    maxTimeout = 0.05; // 3 seconds

describe('job', function() {
  var job, client;
  var name = 'job_1', 
      desc = 'Job 1';

  before(function() {
    chore.redis.createClient = function() {
      return fakeredis.createClient();
    };
    client = chore.redis.client();
  });

  it('doesnt allow spaces in name', function(done) {
    chore('invalid name', 'Valid Desc', maxTimeout, function(error, result) {
      assert.ok(error);
      assert.ifError(result);
      done();
    });
  });

  it('succeeds', function(done) {
    chore(name, desc, maxTimeout, function(error, result) {
      assert.ifError(error);
      assert.ok(result.logger);
      assert.ok(result.progress);
      assert.ok(result.done);
      assert.ok(result.started);
      assert.ok(result.timedOut);
      job = result;
      job.done(function(err, res) {
        assert.ifError(err);
        assert.ok(res);
        done();
      })
    });
  });

  it('times out', function(done) {
    chore('times_out', 'Times out', maxTimeout, function(error, result) {
      result.timedOut(function() {
        assert.ok(result);
        done();
      });
    });
  });

  it('fails', function(done) {
    chore(name, desc, maxTimeout, function(error, result) {
      result.done('Failure', function(err, res) {
        console.log(err)
        console.log(res)
      });
    });
  });

  describe('redis', function() {
    it('logs', function(done) {
      client.smembers(chore.redisKey, function(error, results) {
        assert.ifError(error);
        assert.ok(results);
        assert.ok(Array.isArray(results));
        assert.equal(2, results.length);
        done();
      });
    });

    it('start times', function(done) {
      client.lrange(chore.redisKey + ':logs:' + name, 0, -1, function(error, results) {
        assert.ifError(error);
        assert.ok(results);
        assert.equal(2, results.length);
        done();
      });
    });
  });

  describe('progress', function() {
    it('doesnt accept a string', function(done) {
      job.progress('0.6', function(error, result) {
        assert.ifError(result);
        assert.ok(error);
        done();
      });
    });

    it('doesnt accept an integer', function(done) {
      job.progress(60, function(error, result) {
        assert.ifError(result);
        assert.ok(error);
        done();
      });
    });

    it('accepts a float', function(done) {
      job.progress(0.6, function(error, result) {
        assert.ifError(error);
        assert.equal(0, result);
        done();
      });
    });
  });

  describe('logs', function() {
    describe('info', function() {
      it('log', function(done) {
        job.logger.info('Info Event', function(error, event) {
          assert.ifError(error)
          assert.ok(event);
          assert.equal('info', event);
          done();
        });
      });

      it('retrieve', function(done) {
        client.lrange(chore.redisKey + ':logs:' + name + ':' + job.started, 0, -1, function(error, results) {
          assert.ifError(error);
          assert.equal(results[0], 'Started')
          done();
        });
      });
    });
  });
});
