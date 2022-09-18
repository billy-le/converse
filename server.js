const express = require("express");
const http = require("http");
const bodyParser = require("body-parser");
const { Server } = require("socket.io");
const { Liquid } = require("liquidjs");
const app = express();
const engine = new Liquid();

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.engine("liquid", engine.express());
app.set("views", "./views");
app.set("view engine", "liquid");

const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const LOBBY_MESSAGE = "lobby";
const ROOM_MESSAGE = "room";

const connectedSockets = {};
const roomStreamers = {};

function getRooms() {
  return Object.entries(connectedSockets).reduce((arr, [, socketMeta]) => {
    const { roomId } = socketMeta;
    if (roomId) {
      const roomIndex = arr.findIndex(([room]) => room === roomId);
      if (roomIndex > -1) {
        let [roomName, userCount] = arr[roomIndex];
        arr[roomIndex] = [roomName, userCount + 1];
      } else {
        arr.push([roomId, 1]);
      }
    }

    return arr;
  }, []);
}

function sendCurrentRooms(io) {
  io.emit(LOBBY_MESSAGE, { type: "current-rooms", rooms: getRooms() });
}

app.get("/", (_, res) => {
  res.render("lobby");
});

app.get("/rooms", (_, res) => {
  return res.json(getRooms());
});

app.post("/", (req, res) => {
  const roomId = req.body.roomId;
  res.redirect(`room/${roomId}`);
});

app.get("/room/:roomId", (req, res) => {
  res.render("room", { roomId: req.params.roomId });
});

io.on("connection", (socket) => {
  if (!connectedSockets[socket.id]) {
    connectedSockets[socket.id] = {};
  }

  socket.on(LOBBY_MESSAGE, (data) => {
    const { type } = data;

    switch (type) {
      default: {
        console.log(data);
        break;
      }
    }
  });

  socket.on(ROOM_MESSAGE, (data) => {
    const { type, roomId } = data;
    if (data.userId) {
      connectedSockets[socket.id] = {
        userId: data.userId,
        roomId: data.roomId,
      };
    }
    switch (type) {
      case "chat-message": {
        io.in(roomId).emit(ROOM_MESSAGE, data);
        break;
      }
      case "join-room": {
        socket.join(roomId);
        io.to(roomId).emit(ROOM_MESSAGE, data);
        if (roomStreamers[roomId]) {
          const streamers = Array.from(roomStreamers[roomId]);
          io.to(roomId).emit(ROOM_MESSAGE, { type: "current-streamers", userId: data.userId, streamers });
        }
        sendCurrentRooms(io);
        break;
      }
      case "join-stream": {
        if (roomStreamers[roomId]) {
          roomStreamers[roomId].add(data.userId);
        } else {
          roomStreamers[roomId] = new Set();
          roomStreamers[roomId].add(data.userId);
        }
        io.to(roomId).emit(ROOM_MESSAGE, data);
        const streamers = Array.from(roomStreamers[roomId]);
        socket.to(roomId).emit(ROOM_MESSAGE, { ...data, type: "user-streamer", streamers });
        break;
      }
      case "leave-stream": {
        roomStreamers[roomId].delete(data.userId);
        const streamers = Array.from(roomStreamers[roomId]);
        io.to(roomId).emit(ROOM_MESSAGE, { ...data, streamers });
        break;
      }
      case "leave-room": {
        delete connectedSockets[socket.id];
        roomStreamers[roomId].delete(data.userId);
        socket.broadcast.to(roomId).emit(ROOM_MESSAGE, data);
        socket.leave(roomId);
        sendCurrentRooms(io);
        break;
      }
      case "offer-sdp":
      case "answer-sdp":
      case "ice-candidate": {
        const streamers = Array.from(roomStreamers[roomId]);
        socket.broadcast.to(roomId).emit(ROOM_MESSAGE, { ...data, streamers });
        break;
      }
      default: {
        console.log(data);
        break;
      }
    }
  });

  socket.on("disconnect", () => {
    if (connectedSockets[socket.id]) {
      const { roomId, userId } = connectedSockets[socket.id];
      if (roomId && userId) {
        if (roomStreamers[roomId]) {
          roomStreamers[roomId].delete(userId);
        }
        delete connectedSockets[socket.id];
        io.to(roomId).emit(ROOM_MESSAGE, { type: "leave-room", roomId, userId });
        sendCurrentRooms(io);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Listening on PORT: ${PORT}`);
});
