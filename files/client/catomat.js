// Based on https://github.com/meetecho/janus-gateway/blob/master/html/streamingtest.html

var server = "http://" + window.location.hostname + "/janus";

var janus = null;
var streaming = null;
function dispense(slot) {
  $.post("/api/dispense/" + slot, function() {
    $("#status").html("Dispense food on slot " + slot);
  }).fail(function(data) {
    $("#status").html("Couldn't dispense food on slot " + slot + ": " + data);
  })
}

function reloadImage() {
  d = new Date();
  $('#stream img').attr("src", "/cam/cam.jpg?"+d.getTime());
}

$(document).ready(function() {
  // Initialize controls
  $('#dispenseA').click(function() { dispense('a') })
  $('#dispenseB').click(function() { dispense('b') })
  $('#startJpeg').click(function() {
    $('#stream').html('<img src="/cam/cam.jpg"/>');
    setInterval(reloadImage, 200);
  })

  // Initialize the library (all console debuggers enabled)
  Janus.init({debug: "all", callback: function() {
    // Use a button to start the demo
    $('#start').click(function() {
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
                    $('#stream').html('<video id="remotevideo" autoplay/>');
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
  $('#stream').html('<video id="waitingvideo" />');
  }});
}
