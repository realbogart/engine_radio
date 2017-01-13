var http = require('http');
var fs = require('fs');

//
//	WebSocket server
//

var WebSocketServer = require('websocket').server;
socketClients = [];

function sendAll (message) {
	console.log('Sending reload message to '+socketClients.length+' clients...');
	
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

var server = http.createServer();
server.on('request', function(request, response){
	var method = request.method;
	var url = request.url;
	var headers = request.headers;

	if(url == "/swyh") {
		var request = require('request');
		request('http://127.0.0.1:1485/stream/swyh.mp3').pipe(response);
	}
	else if(url == "/style"){
		fs.readFile('style.css', function (err, data){
        	response.writeHead(200, {'Content-Type': 'text/css','Content-Length':data.length});
       		response.write(data);
        	response.end();
    	});
	}
	else if(url == "/simplesocket"){
		fs.readFile('jquery.simple.websocket.js', function (err, data){
        	response.writeHead(200, {'Content-Type': 'text/javascript','Content-Length':data.length});
       		response.write(data);
        	response.end();
    	});
	}
	else if(url == "/reload"){
		sendAll( 'reload' );
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