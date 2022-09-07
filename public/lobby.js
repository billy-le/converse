import { io } from "https://cdn.socket.io/4.4.1/socket.io.esm.min.js";
const socket = io();

const LOBBY_MESSAGE = "lobby";

function createRoomList(rooms) {
}

socket.on(LOBBY_MESSAGE, (data) => {
  const { type } = data;
  switch (type) {
    case "current-rooms":
      createRoomList(data.rooms);
      break;
  }
});
