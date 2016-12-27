var http = require('http');
var fs = require('fs');

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
	else{
		fs.readFile('index.html', function (err, data){
        	response.writeHead(200, {'Content-Type': 'text/html','Content-Length':data.length});
       		response.write(data);
        	response.end();
    	});
	}
});

server.listen(1337);
