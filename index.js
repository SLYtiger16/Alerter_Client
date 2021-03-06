const settings = require("./settings");
const socket = require("socket.io-client")(
  "http://" + settings.remote + ":6723/devices"
);
const moment = require("moment");
const Gpio = require("onoff").Gpio;

//set led output to gpio pin
const led = new Gpio(2, "out");
led.write(0);

//Set error method
error = err =>
  socket.emit("pi_error", {
    branch: settings.branch,
    name: settings.name,
    version: settings.version,
    ip: settings.ip,
    error: err
  });
//Feedback function to send back to the server
feedback = (data, a, v) => {
  let alert_result = {
    ...data,
    audio_success: a,
    visual_success: v
  };
  socket.emit("feedback", alert_result);
};

//On socket connection send this pi's credentials from the settings file
socket.on("connect", () =>
  socket.emit("register", {
    branch: settings.branch,
    name: settings.name,
    version: settings.version,
    ip: settings.ip
  })
);

//Once a registered event is fired from the server, then save the socket_id to the pi database with a time
socket.on("registered", data => console.log("Registered socket id: ", data));

//If a test is received, run it and pass the results to the feedback method
socket.on("test", data => {
  console.log(
    "Socket connection test: ",
    moment()
      .local()
      .format("YYYY-MM-DD HH:mm:ss")
  );
  /////INSERT RELAY SCRIPTING HERE/////
  //led.write(1);
  //setTimeout(() => led.write(0), 1500);
  flash();
  let audio_success = 7;
  let visual_success = 5;
  /////INSERT RELAY SCRIPTING HERE/////
  feedback(data, audio_success, visual_success);
});

//If a real alert is received, run it and pass the results to the feedback method
socket.on("alert", data => {
  console.log(
    "Alert: ",
    moment()
      .local()
      .format("YYYY-MM-DD HH:mm:ss")
  );
  /////INSERT RELAY SCRIPTING HERE/////
  let audio_success = 0;
  let visual_success = 0;
  /////INSERT RELAY SCRIPTING HERE/////
  feedback(data, audio_success, visual_success);
});

//On socket disconnect alert console
socket.on("disconnect", () => {
  led.write(0);
  console.log("SOCKET CONNECTION LOST");
});

const flash = () => {
  let stopBlinking = false;
 
// Toggle the state of the LED connected to GPIO2 every 200ms
const blinkLed = () => {
  if (stopBlinking) {
    return led.write(0);
  }
 
  led.read()
    .then(value => led.write(value ^ 1))
    .then(_ => setTimeout(blinkLed, 200))
    .catch(err => console.log(err));
};
 
blinkLed();
 
// Stop blinking the LED after 5 seconds
setTimeout(_ => stopBlinking = true, 5000);
}
