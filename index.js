var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var cors = require('cors');

app.set('port', (process.env.PORT || 3000));
app.use(bodyParser.json());
app.use(cors());

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

app.get('/', function(request, response){
  //response.writeHead(200, {'Content-Type': 'text/plain'});
  response.send('Hello World\n');
});

//require('./jetpackmasterbot.js')(app);