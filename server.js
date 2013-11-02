var io = require('socket.io').listen(3034, { log: false }),
	http = require('http'),
	fs = require('fs'),
	crypto = require('crypto');
	
function nextLetter($str) {
    return ('z' === $str ? 'a' : String.fromCharCode($str.charCodeAt(0)+1));
}
function getNextShortURL($s) {
    $a = $s.split("");
    $c = $a.length;
    if ($s.match('/^z*$/')) { // string consists entirely of `z`
        return Array($c + 1).join("a");
    }
    while ('z' === $a[--$c]) {
        $a[$c] = nextLetter($a[$c]);
    }
    $a[$c] = nextLetter($a[$c]);
    return $a.join("");
}
function handler (req, res) {
	if( req.url == "/link-allocator/" ) {
		fs.readFile(__dirname + "/shortlink.txt", function(err, data) {
			var link = getNextShortURL(""+data||"abcd");
			res.end(crypto.createHash('md5').update(link).digest("hex").substr(0,16));
			fs.writeFile(__dirname + "/shortlink.txt", link);
		});		
	} else if( req.url == "" || req.url == "/" ) {
		res.writeHead(200, {'Content-Type': 'text/html'});
		fs.createReadStream(__dirname + '/home.html').pipe(res);
	} else {
		res.writeHead(200, {
			"Content-Type": "text/html"
		});
		fs.createReadStream(__dirname + '/index.html').pipe(res);				
	}
}
io.sockets.on('connection', function (socket) {
	var channels = [];
	var handler = function(channel) {
		// rebroadcast data on an arbitrary channel
		return function(data) {
			socket.broadcast.emit(channel, data);
		};
	};
	var listen = function(channel) {
		socket.on(channel, handler(channel));	
	};
	socket.on('initiate', function (data) {
		// listen to a channel if not already
		if( channels.indexOf(data.channel) == -1 ) {
			listen(data.channel);
			channels.push(data.channel);
		}
	});
});
exports.module = http.createServer(handler);
