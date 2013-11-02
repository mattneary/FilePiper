var BinaryServer = require('binaryjs').BinaryServer;
var fs = require('fs');
var app = require("http").createServer(handler);
var crypto = require('crypto');

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
    fs.readFile(__dirname + '/public/home.html', function (err, data) {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading index.html');
      }
  
      res.writeHead(200, {
        "Content-Type": "text/html"
      });
      res && res.write(data);
      res.end();
    });
  } else {
    fs.readFile(~req.url.indexOf('public/') ? __dirname+req.url : __dirname + '/public/index.html', function (err, data) {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading index.html');
      }
  
      res.writeHead(200, !~req.url.indexOf('public/')||~req.url.indexOf(".html")?{
        "Content-Type": "text/html"
      }:{});
      res && res.write(data);
      res.end();
    });
  }
}

// Start Binary.js server
var server = BinaryServer({server: app});
// Wait for new user connections
var notify_user_count = function(listeners) {
  listeners.map(function(listener) {  
    var channel = clients.filter(function(c) {
      return c.channel == listener.channel;  
    });
    var active = channel.filter(function(c) {
       return c.client._socket.readyState == 1;
    });
    if( listener.stream._socket.readyState == 1 ) {
      listener.stream.write({
        total: channel.length,
        active: active.length,
        self: listener.client._socket.readyState == 1
      });
    }
  });
};
var clients = [];
var listeners = [];
server.on('connection', function(client){
  var channel = client._socket.upgradeReq.url;
  clients.push({
    client: client,
    channel: channel
  });    
  notify_user_count(listeners);

  // Incoming stream from browsers
  client.on('stream', function(stream, meta){
    // TODO: pipe very latent one way
    // TODO: sending a file closes a stream
    if( meta.type === "message" ) {
      listeners.push({
        stream: stream,
        channel: channel,
        client: client
      });
      //stream && stream.write(channel_count);
      notify_user_count(listeners);
    } else {
      //var file = fs.createWriteStream(__dirname+ '/uploads/' + meta.name);
      var count = clients.map(function(data) {
        var peer = data.client;
        if( peer !== client && channel == data.channel && peer._socket.readyState == 1 ) {  
          var watcher = peer.createStream({size: meta.size, name: meta.name});
          stream.pipe(watcher);
          stream.on("end", function() {
            watcher.end();
          });
          return 1;
        }
        return 0;
      }).reduce(function(a,b){return a+b});
      if( count == 0 && client._socket.readyState == 1 ) {
        stream.write({rx: 0, fail: true})
      }
      // Send progress back
      stream.on('data', function(data){
        if( client._socket.readyState == 1 ) {
          stream.write({rx: data.length / meta.size});
        }
      });      
    }
  });
  client.on('close', function() {
    var client = this;
    var spot = clients.indexOf({
      client: client,
      channel: channel
    });
    clients.splice(spot, 1);
    listeners = listeners.filter(function(listener) {
      return listener.client !== client
    });
    notify_user_count(listeners);
  });
});
exports.module = app;
