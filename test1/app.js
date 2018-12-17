var createError = require('http-errors');
var express = require('express');
var https = require('https');
var http = require('http');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var fs = require('fs');
var url = require('url');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var querystring = require('querystring');
var WebSocket = require('ws')

var privateKey  = fs.readFileSync('/root/nginx_ssl/1567281_vorringer.moe.key', 'utf8');
var certificate = fs.readFileSync('/root/nginx_ssl/1567281_vorringer.moe.pem', 'utf8');
var credentials = {key: privateKey, cert: certificate};

var expressWs = require('express-ws');
var app = express();


var httpsServer = https.createServer(credentials, app);
var expressWs = expressWs(app, httpsServer);

//var wss = require('express-ws')(app, httpsServer);
var port = 18080;
var sslport = 18081;

//conferenceID type name userID
var bonus = {};
var hasB = {};
var bonusPool = {};


//conferenceID [{name, value}]
var hasV = {}
var vote = {}

//conferenceID, contents:[ {name, value}]
var hasS = {}
var score = {}
var scoreNum = 0;

const voteMsgBit = 0;
const scoreMsgBit = 1;
const bonusMsgBit = 2;
const msgArray = ['voteMsg', 'scoreMsg', 'bonusMsg'];

var oldMsg = 0;
var obj={};
Object.defineProperty(obj,'message',{
    get:function(){
        return message;
    },
    set:function(newValue){
        message = newValue;
        console.log('set :', oldMsg, "--->", newValue);
        //需要触发的渲染函数可以写在这...
	var res = (oldMsg ^ newValue) & newValue;
	for (var i = 0; i < 3; ++i) {
		if (res >> i == 1) msgWss.clients.forEach(function (client) {
					if (msgClients.indexOf(client.id) != -1) 
						client.send(msgArray[i]);
				   });

	}
	oldMsg = newValue;
    }
})

obj.message = 0;
/*
Object.defineProperty(obj,'data',{
    get:function(){
        return obj.data;
    },
    set:function(newValue){
	var oldValue = obj.data;
        data = newValue;
        console.log('set :', newValue);
        var res = (oldValue ^ newValue) & newValue;
	for (var i = 0; i < 3; ++i) {
		if (res >> i == 1) msgWss.clients.forEach(function (client) {
					if (msgClients.indexOf(client.id) != -1) 
						client.send(msgArray[i]);
				   });

	}
    }
});

obj.data = 0;
*/
httpsServer.listen(sslport, function() {
    console.log('https server is running on: https://localhost:%s', sslport);
});

function pickOneBonus (id) {
	try {
		var arr = bonusPool[id];
		var min = 0;
		var max = arr.length - 1;
		var num = Math.floor(Math.random()*(max-min+1)+min);
		var userid = bonusPool[id][num];
		bonus[id]['userID'] = userid;
			
	} catch(err) {
		console.log("pick one bonus error!");
		return -1;
	}
	return 0;	
}
app.get('/', function(req, res) {
    if(req.protocol === 'https') {
        res.status(200).send('welcome to safety land!');
    }
    else {
        res.status(200).send('welcome!');
    }
});

//conferenceID score
app.post('/giveScore', function(req, res) {
	var body = '';
	req.on('data', function(chunk) {
		body += chunk;
	});
	
	req.on('end', function() {
		scoreNum++;
		console.log("giveSocre  receive: %s", body);
		try {
			body = JSON.parse(body);
			var conferenceID = body.conferenceID;
			for (var i = 0; i < body.contents.length; ++i) {
				var value = score[conferenceID]['contents'][i]['value'];
				var newValue = (value * (scoreNum - 1) + body.contents[i].value) / scoreNum;
				score[conferenceID]['contents'][i]['value'] = newValue;
			}
			res.status(200).send("success");
		} catch(err) {
			res.status(200).send("giveScore error!");
		}
		res.end();
	});
});

//conferenceID
app.get('/hasScore', function(req, res) {
	var params = url.parse(req.url, true).query;
	var conferenceID = params.conferenceID;
	if (hasS[conferenceID]) {
		res.status(200).send(JSON.stringify(score[conferenceID]));
	} else {
		res.status(200).send('');
	}
	
	res.end();
});

//conferenceID
app.get('/hasBonus', function(req, res) {
	var params = url.parse(req.url, true).query;
	var userID = params.userID;
	var conferenceID = params.conferenceID;
	if (hasB[conferenceID]) {
		res.status(200).send(JSON.stringify(bonus[conferenceID]));
	} else {
		res.status(200).send('');
	}
	
	res.end();
});

//conferenceID
app.get('/hasVote', function(req, res) {
	var params = url.parse(req.url, true).query;
	var conferenceID = params.conferenceID;
	if (hasV[conferenceID]) {
		res.status(200).send(JSON.stringify(vote[conferenceID]));
	} else {
		res.status(200).send('');
	}
	res.end();
});

app.post('/addVoteValue', function(req, res) {
	var body = '';
	req.on('data', function(chunk) {
		body += chunk;
	});
		
	req.on('end', function() {
		try {
			body = JSON.parse(body);
			var conferenceID = body.conferenceID;
			var nameID = body.nameID;
			console.log("receive add vote: ", conferenceID, " ", nameID);
			vote[conferenceID]['contents'][nameID]['value']++;
			res.status(200).send('');
		} catch(err) {
			res.status(200).send("vote not found");
		}
		res.end();
	});
});
var getUniqueID = function() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4();
};
var bulletWss = expressWs.getWss('/bullet');
var bulletClients = [];
app.ws('/bullet', function(ws, res) {
	ws.id = getUniqueID();
	bulletClients.push(ws.id);
	ws.on('message', function(msg) {
		try {
			bulletWss.clients.forEach(function (client) {
				if (bulletClients.indexOf(client.id) != -1) 
					client.send(msg);
			});
		} catch(err) {
		}
	});
	ws.on('close', function(msg) {
		bulletClients.splice(bulletClients.indexOf(ws.id),1);
	});
});

var msgWss = expressWs.getWss('/message');
var msgClients = [];
app.ws('/message', function(ws, res) {
	if (ws.id === undefined) ws.id = getUniqueID();
	msgClients.push(ws.id);
	console.log("message client: ", ws.id);
	ws.on('close', function(msg) {
		console.log("message wss closed");
		msgClients.splice(msgClients.indexOf(ws.id));
	})
}); 

app.ws('/setScore', function(ws, res) {
	ws.on('message', function(msg) {
		try {
			var req = JSON.parse(msg);
			console.log("score", msg);

			score[req.conferenceID] = req;
			hasS[req.conferenceID] = true;
			obj.message |= (1 << scoreMsgBit);
			console.log('msg', obj.message);
			var avg = 0.0;
			setTimeout(function() {
				console.log("send to client: ", JSON.stringify(score[req.conferenceID]));
				ws.send(JSON.stringify(score[req.conferenceID]));
				score[req.conferenceID] = {};
				scoreNum = 0;
				obj.message &= ~(1 << scoreMsgBit);
				
				hasS[req.conferenceID] = false;
			}, 20000);
			
		} catch(err) {
			console.log("err: ", err);
		}
	});
	ws.on('close', function() {
	});
	//ws.send("score  connection");
	console.log("score connection");
});

//conferenceID: [{name, value}]
app.ws('/setVote', function(ws, res) {
	ws.on('message', function(msg) {
		try {
			var req = JSON.parse(msg);
			vote[req.conferenceID] = req;
			hasV[req.conferenceID] = true;
			obj.message |= (1 << voteMsgBit);
			var rounds = 0;
			var interval = setInterval(function() {
				rounds++;
				ws.send(JSON.stringify(vote[req.conferenceID]));
				if(rounds >= 20) {
					vote[req.conferenceID] = {};
					hasV[req.conferenceID] = false;
					obj.message &= ~(1 << voteMsgBit);
					clearInterval(interval);
				}
			}, 1000);
		} catch(err) {
			ws.send("");
		}
	});
});

app.ws('/setBonus', function(ws, res) {
	ws.on('message', function(msg) {
		try {
			var req = JSON.parse(msg);
			console.log("receive setBonus: ", msg);
			bonus[req.conferenceID] = req;
			hasB[req.conferenceID] = true;
			obj.message |= (1 << bonusMsgBit);
			setTimeout(function() {
				console.log("send bonus to client"); 
				var ret = pickOneBonus(req.conferenceID);
				if (ret == 0) {
					console.log("bonus sent: ", JSON.stringify(bonus[req.conferenceID]));
					ws.send(JSON.stringify(bonus[req.conferenceID]));
					
					
				} else {
					console.log("error: pick one!");
				}
				bonus[req.conferenceID] = {}
				hasB[req.conferenceID] = false;
				bonusPool[req.conferenceID] = [];
				obj.message &= ~(1 << bonusMsgBit);
	
			}, 10000);
		}
		catch (err) {
			ws.send("Invalid json!");
		}
		//console.log("websocket setbonus receive: %s", msg);

	});
});

app.post('/pickBonus', function(req, res) {
	var body = '';
	req.on('data', function(chunk) {
		body += chunk;
	});
	
	req.on('end', function() {
		console.log("pickBonus receive: %s", body);
		body = JSON.parse(body);
		//bonus[body.conferencdID] = body;
		console.log("cID: ",body.conferenceID);
		if (hasB[body.conferenceID]) {
			console.log("hasB");
			if (bonusPool[body.conferenceID] === undefined) bonusPool[body.conferenceID] = [];
			bonusPool[body.conferenceID].push(body.userID);
			res.status(200).send("success");
		}
		else {
			res.status(200).send("There is  no bonus at the moment");
		}
		res.end();

	});
});
/*
app.post('/setbonus', function setbonus(req, res) {
	var body = '';
	req.on('data', function(chunk) {
		body += chunk;
	});
	
	req.on('end', function() {
		body = querystring.parse(body);
		bonus[body.id] = body;
		hasb[body.id] = true;
		res.status(200).send("success");
		res.end();
		settimeout(pickonebonus, 3000, body.id);
	});
});
*/	
/*
app.get('/forwardURl', function(req, res) {
	var params = url.parse(req.url, true).query;
	var requrl = url.parse(params.url, true);
	console.log('get url: %s', req.url);
	console.log('get rmp url: %s', params.url);
	var ch = '';	
	var forwardreq = http.request(params.url, function(ress) {
		ress.setencoding('utf8');
		ress.on('data', (chunk) => {
			console.log('rmp get result: ' + chunk);
			ch = chunk;	
 		 });
  		ress.on('end', () => {
			console.log('rmp get no data');
  		});
		
	});

	forwardreq.on('error', (e) => {
 		console.error('forward request error: ${e.message}');
	});

	forwardreq.end();
	res.write(ch);
	res.end();
});

app.post('/forwardurl', function(req, res) {
	var body = '';
	var requrl = '';
	req.on('data', function(chunk) {
		body += chunk;
	});
	res.write()
	
	req.on('end', function() {
		body = querystring.parse(body);
		console.log('post body: ', body);
		requrl = body.url;
		delete body['url'];
		requrl = url.parse(requrl, true);
		console.log('post rmp url: %s', params.url);

		requrl.method = 'post';
		requrl.headers['content-type'] = 'application/json';
	
        	var forwardreq = http.request(requrl, function(ress) {
                	ress.setencoding('utf8');
                	ress.on('data', (chunk) => {
                        	console.log('rmp post result: ' + chunk);
                        	res.write(chunk);
                 	});
                	ress.on('end', () => {
                        	console.log('rmp post no data');
                	});
        	});

        	forwardreq.on('error', (e) => {
                	console.error('forward request error: ${e.message}');
        	});     
		forwardreq.write(querystring.stringify(body));

        	forwardreq.end();
		res.end();


	});
});
*/

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

