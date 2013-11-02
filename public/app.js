var channel = location.href.split("/").pop() || "public";
var client = new BinaryClient('ws://surg.co/'+channel);

client.on('close', function() {
    $("#box span").html("Your session expired! <a href='' class='refr'>Refresh</a>.");
    $("#listeners").text("-/- listeners");
});
client.on('open', function(){
    var stream = client.send("hello", {type: "message"});
    stream.on("data", function(data) {
	$("#listeners").text(data.active+"/"+data.total+" listeners active.");
    });
    $('#box').bind('drop', function(e){    
	e.originalEvent.preventDefault();
	var file = e.originalEvent.dataTransfer.files[0];
	
	// Add to list of uploaded files
	$('#box span').text("Sending "+file.name);                        
	
	// `client.send` is a helper function that creates a stream with the 
	// given metadata, and then chunks up and streams the data.
	var stream = client.send(file, {name: file.name, size: file.size, type: "bit"});
	
	// Print progress
	var tx = 0;
	stream.on('data', function(data){
	    if( data.fail ) { 
		stream.end(); 
		$('#box span').html("No-one received "+file.name+"!");
		return;
	    }
	    var percent = Math.round(tx+=data.rx*100);
	    $('#box2 span').text(percent + '% complete');
	    if( percent === 100 ) $('#box span').html("Sent "+file.name+"!");
	});
    });  
});
client.on('stream', function(stream, meta){    
    // Buffer for parts
    var parts = [];
    var composite = function(parts) {
	var map = parts.length ? parts.map(function(el) { return el.byteLength }) : [];
	var reduce = map.length ? map.reduce(function(a,b) {
	    return a-(-b);
	}) : 0;            
	return reduce;
    }        
    
    $('#box span').text("Receiving "+meta.name);
    
    var _fileWriterCache = [];
    var _fileWriter = {
	write: function(blob) {
	    _fileWriterCache.push(blob);
	}
    };
    // Create a new Blob and write it to log.txt.
    var BlobBuilder = BlobBuilder || function() {
	var _cache = [];
	this.append = function(data) {
	    _cache.push(data);
	};
	this.getBlob = function(type) {
	    return new Blob(_cache, {"type": type}); // the blob 
	};
    }
    var bb = new BlobBuilder();                 
    // Got new data
    var endHandler = function(){
	console.log(parts);
	// Display new data in browser!
	_fileWriter.write(bb.getBlob('application/octet-stream'));
	var a = document.createElement("a");
	a.href = (window.URL ? window.URL.createObjectURL :
		  window.webkitURL.createObjectURL)(bb.getBlob('application/octet-stream'));
	a.download = meta.name;
	a.innerText = "Grab "+meta.name;
	$("#box2 span").html(a);
	$("#box span").html("Received "+meta.name+"!");
    };
    stream.on('data', function(data){    
	console.log("DATA");
	parts.push(data);
	bb.append(data);
	var percent = composite(parts)/meta.size*100;                        
	$('#box2 span').text(Math.round(percent) + '% complete');
	console.log(percent+"%");
	if( percent == 100 ) {
	    endHandler();
	}
    });                    
    stream.on('end', endHandler);
    
    var errorHandler = function(err){console.error(err)};
    function onInitFs(fs) {    
	fs.root.getFile(meta.name, {create: true}, function(fileEntry) {    
	    // Create a FileWriter object for our FileEntry (log.txt).
	    fileEntry.createWriter(function(fileWriter) {
		_fileWriter = fileWriter;
		if( _fileWriterCache.length ) {
		    // we were late! but we cached it ;)
		    fileWriter.write(_fileWriterCache[0]);
		}
		fileWriter.onwriteend = function(e) {
		    console.log('Write completed.');                    
		};
		
		fileWriter.onerror = function(e) {
		    console.log('Write failed: ' + e.toString());
		};                                                        
	    }, errorHandler);    
	}, errorHandler);    
    }    
    (window.webkitRequestFileSystem ||
     window.requestFileSystem)(window.TEMPORARY, 1024*1024, onInitFs, errorHandler);
});    

