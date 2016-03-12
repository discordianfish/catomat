// We make use of this 'server' variable to provide the address of the
// REST Janus API. By default, in this example we assume that Janus is
// co-located with the web server hosting the HTML pages but listening
// on a different port (8088, the default for HTTP in Janus), which is
// why we make use of the 'window.location.hostname' base address. Since
// Janus can also do HTTPS, and considering we don't really want to make
// use of HTTP for Janus if your demos are served on HTTPS, we also rely
// on the 'window.location.protocol' prefix to build the variable, in
// particular to also change the port used to contact Janus (8088 for
// HTTP and 8089 for HTTPS, if enabled).
// In case you place Janus behind an Apache frontend (as we did on the
// online demos at http://janus.conf.meetecho.com) you can just use a
// relative path for the variable, e.g.:
//
//    var server = "/janus";
//
// which will take care of this on its own.
//
//
// If you want to use the WebSockets frontend to Janus, instead, you'll
// have to pass a different kind of address, e.g.:
//
//    var server = "ws://" + window.location.hostname + ":8188";
//
// Of course this assumes that support for WebSockets has been built in
// when compiling the gateway. WebSockets support has not been tested
// as much as the REST API, so handle with care!
//
//
// If you have multiple options available, and want to let the library
// autodetect the best way to contact your gateway (or pool of gateways),
// you can also pass an array of servers, e.g., to provide alternative
// means of access (e.g., try WebSockets first and, if that fails, fall
// back to plain HTTP) or just have failover servers:
//
//    var server = [
//      "ws://" + window.location.hostname + ":8188",
//      "/janus"
//    ];
//
// This will tell the library to try connecting to each of the servers
// in the presented order. The first working server will be used for
// the whole session.
//

var server = "http://" + window.location.hostname + ":8088/janus";

var janus = null;
var streaming = null;
var started = false;
function dispense(slot) {
  $.post("/api/dispense/" + slot, function() {
    $("#status").html("Dispense food on slot " + slot);
  }).fail(function(data) {
    $("#status").html("Couldn't dispense food on slot " + slot + ": " + data);
  })
}

$(document).ready(function() {
  // Initialize controls
  $('#dispenseA').click(function() { dispense('a') })
  $('#dispenseB').click(function() { dispense('b') })
  // Initialize the library (all console debuggers enabled)
  Janus.init({debug: "all", callback: function() {
    // Use a button to start the demo
    $('#start').click(function() {
      if(started)
        return;
      started = true;
      $(this).attr('disabled', true).unbind('click');
      // Make sure the browser supports WebRTC
      if(!Janus.isWebrtcSupported()) {
        alert("No WebRTC support... ");
        return;
      }
      // Create session
      janus = new Janus(
        {
          server: server,
          success: function() {
            // Attach to streaming plugin
            janus.attach(
              {
                plugin: "janus.plugin.streaming",
                success: function(pluginHandle) {
                  streaming = pluginHandle;
                  Janus.log("Plugin attached! (" + streaming.getPlugin() + ", id=" + streaming.getId() + ")");
                  // Setup streaming session
                  startStream();
                },
                error: function(error) {
                  Janus.error("  -- Error attaching plugin... ", error);
                  alert("Error attaching plugin... " + error);
                },
                onmessage: function(msg, jsep) {
                  Janus.debug(" ::: Got a message :::");
                  Janus.debug(JSON.stringify(msg));
                  if(jsep !== undefined && jsep !== null) {
                    Janus.debug("Handling SDP as well...");
                    Janus.debug(jsep);
                    // Answer
                    streaming.createAnswer(
                      {
                        jsep: jsep,
                        media: { audioSend: false, videoSend: false },  // We want recvonly audio/video
                        success: function(jsep) {
                          Janus.debug("Got SDP!");
                          Janus.debug(jsep);
                          var body = { "request": "start" };
                          streaming.send({"message": body, "jsep": jsep});
                        },
                        error: function(error) {
                          Janus.error("WebRTC error:", error);
                          alert("WebRTC error... " + JSON.stringify(error));
                        }
                      });
                  }
                },
                onremotestream: function(stream) {
                  Janus.debug(" ::: Got a remote stream :::");
                  Janus.debug(JSON.stringify(stream));
                  if($('#remotevideo').length === 0)
                    $('#stream').html('<video class="rounded centered hide" id="remotevideo" autoplay/>');
                  // Show the stream and hide the spinner when we get a playing event
                  $("#remotevideo").bind("playing", function () {
                    $('#waitingvideo').remove();
                  });
                  attachMediaStream($('#remotevideo').get(0), stream);
                },
                oncleanup: function() {
                  Janus.log(" ::: Got a cleanup notification :::");
                  $('#waitingvideo').remove();
                  $('#remotevideo').remove();
                }
              });
          },
          error: function(error) {
            Janus.error(error);
            alert(error, function() {
              window.location.reload();
            });
          },
          destroyed: function() {
            window.location.reload();
          }
        });
    });
  }});
});

function startStream() {
  var body = { "request": "list" };
  streaming.send({"message": body, success: function(result) {
    if(result === null || result === undefined) {
  alert("Got no response to our query for available streams");
        return;
    }
  stream = result["list"][0]["id"]


  Janus.log("Selected video id #" + stream);
  var body = { "request": "watch", id: stream };
  streaming.send({"message": body});
  // No remote video yet
  $('#stream').html('<video class="rounded centered" id="waitingvideo" />');
  }});
}
