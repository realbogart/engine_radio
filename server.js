var http = require('http');
var fs = require('fs');

//
//	WebSocket server
//

var WebSocketServer = require('websocket').server;
socketClients = [];

var lastBackground = "https://raised3rdday.files.wordpress.com/2013/08/cobrakai.png";
var lastActiveShow = "1";

function sendAll (message) {
	console.log('Sending message to ' + socketClients.length + ' clients: ' + message );
	
    for ( var i=0; i < socketClients.length; i++ ) {
        socketClients[i].send( message );
    }
}

var requestHandler = function(request) {
    var connection = request.accept(null, request.origin);

	connection.on('message', function(message) {
		if( message.type == 'utf8' )
		{
			if( message.utf8Data == '"connected"' )
			{
				console.log( "A new listener connected!" );
				
				connection.send( JSON.stringify({ type : 'setBackground', data : lastBackground }) );
				connection.send( JSON.stringify({ type : 'setActiveShow', data : lastActiveShow }) );
		
				socketClients.push(connection);
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

var socketServer = spawnSocketServer(1338);





//
//	HTTP server
//

var simpleResponse = function(response) {
	response.writeHead(200, {'Content-Type': 'text/html','Content-Length':11});
	response.write( 'Successful!' );
	response.end();
}

var server = http.createServer();
server.on('request', function(request, response){
	var url = require('url');
	var method = request.method;
	var url_parts = url.parse(request.url, true);
	var headers = request.headers;
	
	//console.log( url_parts );
	
	if(url_parts.pathname == "/swyh") {
		var request = require('request');
		request('http://127.0.0.1:1485/stream/swyh.mp3').pipe(response);
	}
	else if(url_parts.pathname == "/style"){
		fs.readFile('style.css', function (err, data){
        	response.writeHead(200, {'Content-Type': 'text/css','Content-Length':data.length});
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
		if( Object.prototype.hasOwnProperty.call(url_parts.query, 'image') )
		{
			console.log("Switching background to: " + url_parts.query.image);
			
			lastBackground = url_parts.query.image;
			sendAll( JSON.stringify( { type: 'setBackground', data: url_parts.query.image } ) );
		}
		
		if( Object.prototype.hasOwnProperty.call(url_parts.query, 'activeShow') )
		{
			console.log("Set active show to: " + url_parts.query.activeShow);
			
			lastActiveShow = url_parts.query.activeShow;
			sendAll( JSON.stringify( { type: 'setActiveShow', data: url_parts.query.activeShow } ) );
		}
		
		simpleResponse(response);
	}
	else{
		fs.readFile('index.html', function (err, data){
        	response.writeHead(200, {'Content-Type': 'text/html','Content-Length':data.length});
       		response.write(data);
        	response.end();
    	});
	}
});

server.listen(1337);