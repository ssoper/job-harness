var _ = require('lodash'),
    express = require('express'),
    http = require('http'),
    path = require('path'),
    routes = require('./routes'),
    app = express();

exports.start = function(resourcePath, port) {
  if (_.isNumber(resourcePath)) {
    port = resourcePath;
    resourcePath = '/';
  }

  app.configure(function() {
    app.set('port', port || 3000);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.favicon());
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(path.join(__dirname, 'public')));
  });

  app.get(resourcePath || '/', routes.index);

  http.createServer(app).listen(app.get('port'));
}
