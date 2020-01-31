var http = require('http');
var fs = require('fs');
var sheets = require("./sheets");

//
// Configuration
//


function readConfig(filename) {
	var contents = fs.readFileSync(filename).toString();
	return JSON.parse(contents);
}

var config = readConfig("config.json");


//
//	WebSocket server
//

var WebSocketServer = require('websocket').server;
socketClients = [];

var lastBackground = config.default_background;
var lastActiveShow = "0";
var lastSchedule = JSON.stringify( { shows : [ { time: "00:00", dj:"", name : "", imageLink : config.default_background } ] } );
var lastMetaData = JSON.stringify( { type : "none", id : '' } );

function addConnection(connection) {		
	connection.send( JSON.stringify({ type : 'setSchedule',   data : lastSchedule }) );
	connection.send( JSON.stringify({ type : 'setBackground', data : lastBackground }) );
	connection.send( JSON.stringify({ type : 'setActiveShow', data : lastActiveShow }) );
	connection.send( JSON.stringify({ type : 'setMetaData',   data : lastMetaData }) );
	
	socketClients.push(connection);
	
	for ( var i = socketClients.length - 1; i >= 0; i-- ) {
        if(!socketClients[i].connected) {
			socketClients.splice(i, 1);
		}
    }

    console.log( "("+socketClients.length+") "+"New connection: '"+ connection.remoteAddress +"'" );
}

function sendAll (message) {
	console.log('Sending message to ' + socketClients.length + ' clients: ' + message );
	
    for ( var i=0; i < socketClients.length; i++ ) {
        socketClients[i].send( message );
    }
}

var requestHandler = function(request) {
    var connection = request.accept(null, request.origin);

	connection.on('message', function(message) {
		if( message.type == 'utf8' ) {
			if( message.utf8Data == '"connected"' ) {
				addConnection(connection);
			}
			else
			{
				// TODO: Parse and check message type
				sendAll( JSON.parse( message.utf8Data ) );
			}
		}
	});
}

var spawnSocketServer = function(port) {
    var server = http.createServer(function(request, response) {});
    server.listen(port, function() { });

    wsServer = new WebSocketServer({
        httpServer: server
    });

    wsServer.on('request', requestHandler);
	
	return wsServer;
};

var socketServer = spawnSocketServer(config.websocket_port);
console.log("Starting WebSocket server on port "+config.websocket_port);

//
//	HTTP server
//

var server = http.createServer();

var simpleResponse = function(response) {
	response.writeHead(200, {'Content-Type': 'text/html','Content-Length':11});
	response.write( 'Successful!' );
	response.end();
}

var sendPage = function(response) {
	fs.readFile('index.html', "utf-8", function (err, data) {
		data = data.replace("<websocket_server>", config.websocket_server_ip);
		data = data.replace("<stream_ip>", config.stream_ip);
		
		response.writeHead(200, {'Content-Type': 'text/html','Content-Length':data.length});
		response.write(data);
		response.end();
    });
}

var sendAdmin = function(response) {
	fs.readFile('admin.html', "utf-8", function (err, data) {
		data = data.replace("<websocket_server>", config.websocket_server_ip);
		data = data.replace("<stream_ip>", config.stream_ip);
		
		response.writeHead(200, {'Content-Type': 'text/html','Content-Length':data.length});
		response.write(data);
		response.end();
    });
}

var sendSchedule = function(schedule) {
	lastSchedule = schedule;
	sendAll( JSON.stringify( { type: 'setSchedule', data: schedule } ) );
	console.log("New schedule set!");
}

server.on('request', function(request, response){
	var url = require('url');
	var method = request.method;
	var url_parts = url.parse(request.url, true);
	var headers = request.headers;
	
	if(url_parts.pathname == "/style"){
		fs.readFile('style.css', function (err, data){
        	response.writeHead(200, {'Content-Type': 'text/css','Content-Length':data.length});
       		response.write(data);
        	response.end();
    	});
	}
	else if(url_parts.pathname == "/fireworks"){
		fs.readFile('fireworks.gif', function (err, data){
        	response.writeHead(200, {'Content-Type': 'image/gif','Content-Length':data.length});
       		response.write(data);
        	response.end();
    	});
	}
	else if(url_parts.pathname == "/simplesocket"){
		fs.readFile('jquery.simple.websocket.js', function (err, data){
        	response.writeHead(200, {'Content-Type': 'text/javascript','Content-Length':data.length});
       		response.write(data);
        	response.end();
    	});
	}
	else if(url_parts.pathname == "/reload"){
		sendAll( JSON.stringify( { type: 'reload', data: 0 } ) );
		simpleResponse(response);
	}
	else if(url_parts.pathname == "/set"){
		if( Object.prototype.hasOwnProperty.call(url_parts.query, 'image') ) {
			console.log("Switching background to: " + url_parts.query.image);
			
			lastBackground = url_parts.query.image;
			sendAll( JSON.stringify( { type: 'setBackground', data: url_parts.query.image } ) );
		}
		
		if( Object.prototype.hasOwnProperty.call(url_parts.query, 'activeShow') ) {
			console.log("Set active show to: " + url_parts.query.activeShow);
			
			lastActiveShow = url_parts.query.activeShow;
			sendAll( JSON.stringify( { type: 'setActiveShow', data: url_parts.query.activeShow } ) );
		}
		
		simpleResponse(response);
	}
	else if(url_parts.pathname == "/admin"){
		sendAdmin(response);
	}
	else if(url_parts.pathname == "/getSchedule"){
		response.writeHead(200, {'Content-Type': 'application/json','Content-Length':Buffer.byteLength(lastSchedule, 'utf8')});
       	response.write(lastSchedule);
        response.end();
	}
	else if(url_parts.pathname == "/getSchedules"){
		sheets.loadSchedules( function(schedules){
			var schedulesText = JSON.stringify(schedules);
			response.writeHead(200, {'Content-Type': 'application/json', 'Content-Length':Buffer.byteLength(schedulesText, 'utf8')});
       		response.write(schedulesText);
        	response.end();
		});
	}
	else if(url_parts.pathname == "/updateSchedule"){
		if(request.method == 'POST') {
			var postString = '';

			request.on('data', function (data) {
				postString += data;
			});
		
			request.on('end', function () {
				sendSchedule(postString);
			});
		}
		
		simpleResponse(response);
	}
	else {
		sendPage(response);
	}
});

var streamHeaders;
function readIcyMetaData () {
	var options = {
		hostname: 'sweeptheleg.club',
		port: 8000,
		path: '/stream',
		headers: { 'Icy-MetaData' : '1' }
	};
	
	var request = http.get(options, (result) => {
		result.setEncoding('ascii');
		
		streamHeaders = result.headers;
		console.log( "Stream headers: " );
		console.log( streamHeaders );
		
		var icyMetaInt = parseInt(streamHeaders['icy-metaint']);
		
		var data = [];
		result.on('data', (chunk) => {
			data = data + chunk;
			
			if( data.length > icyMetaInt + 512 )
			{				
				var metadata = data.substring( icyMetaInt );
				var metalength = 16 * parseInt( metadata.charCodeAt(0) );
				
				if( metalength > 0 )
				{
					metadata = metadata.substring( 1, metalength );
					
					var titleStart = metadata.search( "'" );
					var title = metadata.substring( titleStart + 1 );
					
					var titleStop = title.search( "'" );
					title = title.substring( 0, titleStop );
					
					if( title.length == 0 )
					{
						console.log( "No metadata. Restarting listener" );
						request.abort();
						
						setTimeout( readIcyMetaData, 5000 );
					}
					else
					{
						var parts = title.split(":");
						lastMetaData = JSON.stringify( { type : parts[0], id : parts[1] } );
						console.log( "New metadata: " + lastMetaData );
						sendAll( JSON.stringify( { type: 'setMetaData', data: lastMetaData } ) );
					}
				}
				
				data = data.substring( icyMetaInt + metalength + 1 );
			}
		}).on('error', (e) => {
			console.log( "Error: " + e.message );
		});
	});
}

console.log("Starting HTTP server on port "+config.httpserver_port);
server.listen(config.httpserver_port);

readIcyMetaData();
