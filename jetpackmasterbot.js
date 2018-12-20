var request = require('request');
var mysql  = require('mysql');  
var fs = require('fs');
var path = require('path');

 
const RUN_ON_LOCAL_SERVER = false;
const RUN_FOR_TEST = false;
const MAX_TOTAL_SEND_COUNT = 5;
const INTERVAL_TICKS_MS = 60000;

var jetpack_master_global_top_score = -1;
var jetpack_master_global_top_score_update_time = new Date();
const msg_interval_days = [1, 1, 2, 3, 3];
const msg_interval_seconds = [10, 10, 20, 30, 30];
const msg_imgs = ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg'];
const msg_text = ['Back to Jump Runner!', 'Join the Jump Runners!', 'Welcome Back!', 'Time to Join Us Now!', 'Join and Run longer!'];

var connection = mysql.createConnection({     
  host     : RUN_ON_LOCAL_SERVER ? '47.52.75.206' : 'localhost',       
  user     : 'longtrip',              
  password : 'db_longtrip_2018',       
  port: '9876',                   
  database: 'fbgames' 
}); 
 
connection.connect();

module.exports = function(app) {
    setInterval(function(){IntervalHandler();}, RUN_FOR_TEST ? 5000 : INTERVAL_TICKS_MS);
	var file = path.join(__dirname, 'data/jetpack_master_global_top_score.json');
	if(fs.existsSync(file)){
		fs.readFile(file, 'utf-8', function(err, data){
			if(err){
				console.log(err);
				jetpack_master_global_top_score = 0;
				jetpack_master_global_top_score_update_time = Date.now();
			}else{
				var topscore = JSON.parse(data);
				jetpack_master_global_top_score = topscore.score;
				jetpack_master_global_top_score_update_time = topscore.time;
				console.log('Load data for Jetpackmaster Success, score:' + jetpack_master_global_top_score+'Date:'+jetpack_master_global_top_score_update_time);
			}
		});
	}else{
		var topscore = {
			score: 0,
			time: Date.now()
		}
		var content = JSON.stringify(topscore); 
		
		fs.writeFile(file, content, function(err) {
			if (err)
				console.log(err);
			else
				console.log('Init file for Jetpackmaster Success, score:' + topscore.score+ 'Date:'+ topscore.time);
		});		
	}		

    //
    // GET /bot
    //
    app.get('/fb/jetpackmasterbot', function(request, response) {
        if (request.query['hub.mode'] === 'subscribe' && 
			request.query['hub.verify_token'] === 'longtrip') {            
            //request.query['hub.verify_token'] === process.env.BOT_VERIFY_TOKEN) {            
            console.log("Validating webhook");
            response.status(200).send(request.query['hub.challenge']);
        } else {
            console.error("Failed validation. Make sure the validation tokens match.");
            response.sendStatus(403);          
        }  
    });

    //
    // POST /bot
    //
    app.post('/fb/jetpackmasterbot', function(request, response) {
       var data = request.body;
       console.log('received bot webhook');
        // Make sure this is a page subscription
        if (data.object === 'page') {
            // Iterate over each entry - there may be multiple if batched
            data.entry.forEach(function(entry) {
                // Iterate over each messaging event
                entry.messaging.forEach(function(event) {
                    if (event.game_play) {
                        receivedGameplay(event);
                    } else {
                        console.log("Webhook received unknown event: ", event);
                    }
                });
            });
        }
        response.sendStatus(200);
    });
	
    function receivedGameplay(event) {
        var senderId = event.sender.id; 
        var playerId = event.game_play.player_id; 
        var topScore = 0;		
		
        if (event.game_play.payload) {
            var payload = JSON.parse(event.game_play.payload);
            topScore = payload.top_score;
        }
        if(topScore > 0 && topScore > jetpack_master_global_top_score){
            jetpack_master_global_top_score = topScore;
            jetpack_master_global_top_score_update_time = new Date();
			var file = path.join(__dirname, 'data/jetpack_master_global_top_score.json');
			var topscore = {
				score: jetpack_master_global_top_score,
				time: jetpack_master_global_top_score_update_time
			}
			var content = JSON.stringify(topscore); 
		
			fs.writeFile(file, content, function(err) {
				if (err)
					console.log(err);
				else
					console.log('Update Topscore for Jetpackmaster Success, score:' + topscore.score+ 'Date:'+ topscore.time);
			});					
        }
        var sqlQuery = 'SELECT * FROM jetpackmaster WHERE sender_id = ?';
        var sqlQueryParam = [senderId];
        connection.query(sqlQuery, sqlQueryParam, function(err, queryResult){
            if(err){
                console.log(err.message);
                return;
            }
            console.log('queryResult : ' + JSON.stringify(queryResult));
            var now = new Date();
            var nextSendTime = new Date();
            if(RUN_FOR_TEST){
                nextSendTime.setSeconds(nextSendTime.getSeconds() + msg_interval_seconds[0]);
            }
            else{
                nextSendTime.setDate(nextSendTime.getDate() + msg_interval_days[0]);
            }
            if(queryResult.length == 0){
                var sqlInsert = 'INSERT INTO jetpackmaster(sender_id,player_id,last_open_time,total_open_count,next_send_time, total_send_count, top_score) VALUES(?,?,?,?,?,?,?)';
                var sqlInsertParams = [senderId, playerId, now, 1, nextSendTime, 0, topScore];
                connection.query(sqlInsert, sqlInsertParams, function(err, insertResult){
                    if(err){
                        console.log(err.message);
                        return;
                    }
                    console.log('insertResult : ' + JSON.stringify(insertResult));
                });
            }
            else if(queryResult.length == 1){
                var currentOpenCount = queryResult[0].total_open_count;
                var currentTopScore = queryResult[0].top_score;
                var sqlUpdate = 'UPDATE jetpackmaster SET last_open_time = ?,total_open_count = ?, next_send_time = ?, total_send_count = ?, top_score = ? WHERE sender_id = ?';
                var sqlUpdateParam = [now, currentOpenCount + 1, nextSendTime, 0, topScore > currentTopScore ? topScore : currentTopScore, senderId];
                connection.query(sqlUpdate, sqlUpdateParam, function(err, updateResult){
                    if(err){
                        console.log(err.message);
                        return;
                    }
                    console.log('updateResult : ' + JSON.stringify(updateResult));
                });
            }
        });
    }

    //
    // Handle game_play (when player closes game) events here. 
    //
    function handleGameplay(item) {
        var pageToken = 'EAAEAVBruJBQBAAwQHXQy9q5KIZCIeolYM0WYl4vQ7znZBvKsujrH58z6ooAuxOVWUYiv6u2ZADX7wB3RjZC373srpvdPWaXqVpVLKE88qgQmJ2u0KN2WjW8EYAGF0otrA7dZAGwuNnEZBylaE0HmI9MA0ztdmgIQNc8Pct2n19ugZDZD';
                         
        // Check for payload
        var payload = {};
		
        if(item.total_send_count > 0){
            var last_send_time = new Date();
            if(RUN_FOR_TEST){
                last_send_time.setSeconds(last_send_time.getSeconds() - msg_interval_seconds[item.total_send_count - 1]);
            }
            else{
                last_send_time.setDate(last_send_time.getDate() - msg_interval_days[item.total_send_count - 1]);
            }

            if(jetpack_master_global_top_score > 0 && jetpack_master_global_top_score_update_time.getTime() > last_send_time.getTime()){
                sendMessage(item.sender_id, null, pageToken, "https://www.long-trip.com/message-content/jetpack-master/img/" + msg_imgs[item.total_send_count], "Someone has run for " + jetpack_master_global_top_score + " ! Join Us NOW!!!", "Play now!", payload);
                return;
            }
        }
        sendMessage(item.sender_id, null, pageToken, "https://www.long-trip.com/message-content/jetpack-master/img/" + msg_imgs[item.total_send_count], msg_text[item.total_send_count], "Play now!", payload);
    }

    function IntervalHandler(){
        var endTime = new Date();
        if(RUN_FOR_TEST){
            endTime.setSeconds(endTime.getSeconds() + 5);
            jetpack_master_global_top_score += 100;
            jetpack_master_global_top_score_update_time = new Date();
        }
        else{
            endTime.setMinutes(endTime.getMinutes() + 1);
        }
        var sqlQuery = 'SELECT * FROM jetpackmaster WHERE next_send_time <= ? AND total_send_count < ?';
            var sqlQueryParam = [endTime, MAX_TOTAL_SEND_COUNT];
            connection.query(sqlQuery, sqlQueryParam, function(err, queryResult){
                if(err){
                    console.log(err.message);
                    return;
                }
                queryResult.forEach(function(item){
                    console.log(JSON.stringify(item));
                    handleGameplay(item);
                    var nextSendTime = new Date();
                    if(RUN_FOR_TEST){
                        nextSendTime.setSeconds(nextSendTime.getSeconds() + msg_interval_seconds[item.total_send_count]);
                    }
                    else{
                        nextSendTime.setDate(nextSendTime.getDate() + msg_interval_days[item.total_send_count]);
                    }
                    console.log('nextSendTime : ' + nextSendTime.toLocaleString());
                    var sqlUpdate = 'UPDATE jetpackmaster SET next_send_time = ?, total_send_count = ? WHERE sender_id = ?';
                    var sqlUpdateParam = [nextSendTime, item.total_send_count + 1, item.sender_id];
                    connection.query(sqlUpdate, sqlUpdateParam, function(err, updateResult){
                        if(err){
                            console.log(err.message);
                            return;
                        }
                        console.log('updateResult : ' + JSON.stringify(updateResult));
                    });
                });
            });
    }

    //
    // Send bot message
    //
    // player (string) : Page-scoped ID of the message recipient
    // context (string): FBInstant context ID. Opens the bot message in a specific context
    // message (string): Message text
    // cta (string): Button text
    // payload (object): Custom data that will be sent to game session
    // 
    function sendMessage(player, context, pageToken, image, text, cta, payload) {
        console.log('send msg : ' + image + ', ' + text);
        var button = {
            type: "game_play",
            title: cta
        };

        if (context) {
            button.context = context;
        }
        if (payload) {
            button.payload = JSON.stringify(payload)
        }
        var messageData = {
            recipient: {
                id: player
            },
            message: {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "generic",
                        elements: [
                        {
                            title:text,
                            image_url:image,
                            buttons: [button]
                        }
                        ]
                    }
                }
            }
        };

        if(!RUN_ON_LOCAL_SERVER){
            callSendAPI(messageData, pageToken);
        }
    }

    function callSendAPI(messageData, pageToken) {
		var graphApiUrl = 'https://graph.facebook.com/me/messages?access_token='+ pageToken;
        request({
            url: graphApiUrl,
            method: "POST",
            json: true,  
            body: messageData
        }, function (error, response, body){
            console.error('send api returned', 'error', error, 'status code', response.statusCode, 'body', body);
        });
    }
}
