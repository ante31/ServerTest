const { sendSMS } = require("../services/sendSMS");

function frontendStatusSocket(io) {
  let activeFrontend = null; 
  const HEARTBEAT_TIMEOUT = 3 * 60 * 1000;

  const scheduleTimeout = (socket) => {
    if (!activeFrontend || activeFrontend.socketId !== socket.id) return;
    
    if (activeFrontend.timeoutHandle) clearTimeout(activeFrontend.timeoutHandle);

    activeFrontend.timeoutHandle = setTimeout(() => {
      // Dupla provjera prije slanja SMS-a
      if (activeFrontend && activeFrontend.socketId === socket.id) {
        console.log("Frontend nestao (heartbeat timeout):", socket.id);
        sendSMS("0958138612", "Frontend je nestao (heartbeat timeout)!", new Date().toISOString());
        activeFrontend = null;
      }
    }, HEARTBEAT_TIMEOUT);
  };

  io.on("connection", (socket) => {
    socket.on("frontend-logged-in", (data) => {
      if (data.isAdmin) return;

      if (!activeFrontend) {
        activeFrontend = { socketId: socket.id, lastHeartbeat: Date.now(), timeoutHandle: null };
        //sendSMS("0958138612", "Frontend je aktivan!", data.timestamp);
      } else {
        activeFrontend.socketId = socket.id;
        activeFrontend.lastHeartbeat = Date.now();
      }
      scheduleTimeout(socket);
    });

    socket.on("heartbeat", (data) => {
      if (data.isAdmin) return;

      console.log(`💓 HEARTBEAT ${new Date()}`);

      if (!activeFrontend) {
        activeFrontend = { socketId: socket.id, lastHeartbeat: Date.now(), timeoutHandle: null };
      }

      if (activeFrontend.socketId === socket.id) {
        activeFrontend.lastHeartbeat = Date.now();
        scheduleTimeout(socket);
        socket.emit("heartbeat-ack", { timestamp: new Date().toISOString() });
      }
    });

    socket.on("frontend-closed", (data) => {
      if (data.isAdmin) return;

      if (activeFrontend && activeFrontend.socketId === socket.id) {
        if (activeFrontend.timeoutHandle) clearTimeout(activeFrontend.timeoutHandle);
        activeFrontend = null;
        //sendSMS("0958138612", "Frontend je zatvoren!", data.timestamp);
      }
    });

    socket.on("disconnect", (reason) => {
      // Ne čistimo activeFrontend ovdje, scheduleTimeout će to odraditi ako se ne vrati
    });
  });
}

module.exports = frontendStatusSocket;
