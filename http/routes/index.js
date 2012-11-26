var chores = require('../../index');

exports.index = function(req, res) {
  
  
  res.render('index', { title: 'Chores' });
};