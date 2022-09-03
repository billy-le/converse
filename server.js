const express = require("express");
const http = require("http");
const { v4: uuidv4, validate } = require("uuid");
const app = express();
const { Server } = require("socket.io");
const { Liquid } = require("liquidjs");
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

io.on("connection", (socket) => {
  socket.on("chat-message", (roomId, msg) => {
    io.in(roomId).emit('chat-message', msg)
  });

  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId);
    socket.broadcast.to(roomId).emit("user-connected", userId);
  });
  
  socket.on("leave-room", (roomId, userId) => {
    socket.broadcast.to(roomId).emit("user-disconnected", userId);
    socket.leave(roomId)
  });

  socket.on('call', (roomId, offer) => {
    console.log('called?')
    socket.broadcast.to(roomId).emit('call', offer)
  })

  socket.on('answer', (roomId, answer) => {
    socket.broadcast.to(roomId).emit('answer', answer)
  })
});

server.listen(PORT, () => {
  console.log(`Listening on PORT: ${PORT}`);
});
