var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var cors = require('cors');
var dotenv = require('dotenv');

dotenv.config();

app.set('port', (process.env.PORT || 3000));
app.use(express.static('static'));
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(cors());

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

app.get('/', function(request, response){
  //response.writeHead(200, {'Content-Type': 'text/plain'});
  response.send('Hello World\n');
});

require('./magicpinaobot.js')(app);