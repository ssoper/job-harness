var moment = require('moment')

module.exports = {
  readableDate: function(date) {
    return moment(date*1000).fromNow()
  },

  readableDuration: function(chore) {
    var data = moment.duration(chore.completed - chore.started)._data;
    var str = '';

    if (data.hours != 0) {
      str += data.hours + ' hour';
      if (data.hours > 1) str += 's';
    }

    if (data.minutes != 0) {
      if (str.length > 0) str += ', '
      str += data.minutes + ' minute';
      if (data.minutes > 1) str += 's';
    }

    if (data.seconds != 0) {
      if (str.length > 0) str += ' and '
      str += data.seconds + ' second';
      if (data.seconds > 1) str += 's';
    }

    if (str.length == 0)
      str = 'less than a second';

    return str;
  },

  choreId: function(chore) {
    return chore.name + '_' + chore.started;
  },

  compareToAverage: function(chore) {
    var diff = (chore.ended - chore.started) - chore.average;
    if (diff < 0)
      return 'Ran ' + Math.abs(diff) + ' faster than average';
    if (diff > 0)
      return 'Ran ' + Math.abs(diff) + ' slower than average';
    return 'Ran in the same amount of time as average';
  }
}
// [ { name: 'test_1',
//     timeout: '5',
//     desc: 'Test 1',
//     entries: 
//      [ 'Started',
//        '2012-11-26T23:35:41.317Z - info: Log 1',
//        '2012-11-26T23:35:41.317Z - info: Log 2' ],
//     started: '1353972941',
//     state: 'success',
//     progress: '1.0',
//     ended: '1353972941',
//     completed: 'a few seconds ago',
//     average: 0 },
