const socket = require("socket.io-client")("http://localhost:6723/devices");
const moment = require("moment");
const mongo = require("mongodb");
const settings = require("./settings");

//Make a connection to the mongo database and operate client within database connection
mongo.MongoClient.connect(settings.db_server, { useNewUrlParser: true })
  .then(client => {
    console.log("Database connection successful");
    //Set database name from settings
    const db = client.db(settings.db_name);
    //Set a record count cap for all 3 collections
    db.createCollection("list", { capped: true, size: 1000000, max: 10000 })
      .then(() => console.log("'list' collection capped at 1000 records"))
      .catch(err => console.error(err));
    db.createCollection("tests", { capped: true, size: 1000000, max: 10000 })
      .then(() => console.log("'tests' collection capped at 1000 records"))
      .catch(err => console.error(err));
    db.createCollection("socket_ids", {
      capped: true,
      size: 1000000,
      max: 10000
    })
      .then(() => console.log("'socket_ids' collection capped at 1000 records"))
      .catch(err => console.error(err));
    //Declare variables to quickly utilize collections
    const db_alerts = db.collection("list");
    const db_test_alerts = db.collection("tests");
    const db_socket_ids = db.collection("socket_ids");

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
      //If the alert is a test then save it to the test collection
      if (data.test === true || String(data.test) === "true") {
        db_alerts
          .insertOne({
            ...alert_result,
            _id: new mongo.ObjectId(),
            save_to_client_db_time: moment().toDate()
          })
          .then(() => socket.emit("feedback", alert_result))
          .catch(err => {
            console.error(err);
            error(err);
          });
        //If the alert is NOT a test then save it to the list collection
      } else {
        db_test_alerts
          .insertOne({
            ...alert_result,
            _id: new mongo.ObjectId(),
            save_to_client_db_time: moment().toDate()
          })
          .then(() => socket.emit("feedback", alert_result))
          .catch(err => {
            console.error(err);
            error(err);
          });
      }
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
    socket.on("registered", data =>
      db_socket_ids
        .updateOne(
          { socket_id: data },
          {
            $set: {
              _id: new mongo.ObjectId(),
              socket_id: data,
              assigned: moment().toDate()
            }
          },
          { upsert: true }
        )
        .then(() => console.log("Registered socket id: ", data))
        .catch(err => {
          console.error(err);
          error(err);
        })
    );

    //If a test is received, run it and pass the results to the feedback method
    socket.on("test", data => {
      console.log(
        "Socket connection test: ",
        moment()
          .local()
          .format("YYYY-MM-DD HH:mm:ss")
      );
      /////INSERT RELAY SCRIPTING HERE/////
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
    socket.on("disconnect", () => console.log("SOCKET CONNECTION LOST"));
  })

  .catch(err => {
    console.log(err);
    console.error("Database connection error");
  });
