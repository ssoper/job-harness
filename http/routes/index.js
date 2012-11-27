var chores = require('../../lib/chores');

exports.index = function(req, res) {
  chores.all(function(err, results) {
    if (err) return res.render('index', { title: 'Error' });
    res.render('index', { title: 'Chores', chores: results });
  });
};