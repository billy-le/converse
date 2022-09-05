const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Liquid } = require("liquidjs");
const { v4: uuidv4, validate } = require("uuid");
const app = express();
const engine = new Liquid();

app.use(express.static("public"));
app.engine("liquid", engine.express());
app.set("views", "./views");
app.set("view engine", "liquid");

const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

app.get("/", (_, res) => {
  const roomId = uuidv4();
  res.redirect(`/${roomId}`);
});

app.get("/:roomId", (req, res) => {
  const roomId = req.params.roomId;
  const isValidUUID = validate(roomId);
  res.render("index", isValidUUID ? { roomId: req.params.roomId } : null);
});

const SOCKET_MESSAGE = "message";
const connectedSockets = {};

io.on("connection", (socket) => {
  if (!connectedSockets[socket.id]) {
    connectedSockets[socket.id] = {};
  }
  socket.on(SOCKET_MESSAGE, (data) => {
    const { type, roomId } = data;
    if (connectedSockets[socket.id] && data.userId) {
      connectedSockets[socket.id] = {
        userId: data.userId,
        roomId: data.roomId,
      };
    }
    switch (type) {
      case "chat-message":
        io.in(roomId).emit(SOCKET_MESSAGE, data);
        break;
      case "join-room":
        socket.join(roomId);
        socket.broadcast.to(roomId).emit(SOCKET_MESSAGE, data);
        break;
      case "leave-room":
        socket.broadcast.to(roomId).emit(SOCKET_MESSAGE, data);
        socket.leave(roomId);
        break;
      case "offer-sdp":
      case "answer-sdp":
      case "ice-candidate":
        socket.broadcast.to(roomId).emit(SOCKET_MESSAGE, data);
        break;
      default:
        console.log(type, data);
        break;
    }
  });

  socket.on("disconnect", () => {
    const { roomId, userId } = connectedSockets[socket.id];
    if (roomId && userId) {
      socket.broadcast.to(roomId).emit(SOCKET_MESSAGE, { type: "leave-room", roomId, userId });
      delete connectedSockets[socket.id];
    }
  });
});

server.listen(PORT, () => {
  console.log(`Listening on PORT: ${PORT}`);
});
