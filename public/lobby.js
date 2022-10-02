'use strict'

import { io } from "https://cdn.socket.io/4.4.1/socket.io.esm.min.js";
const socket = io();

const LOBBY_MESSAGE = "lobby";

const [heroImg, roomsContainer, roomsList] = ["hero-img", "rooms-container", "rooms"].map((id) =>
  document.querySelector(`#${id}`)
);

function createRoomList(rooms) {
  if (roomsList) {
    roomsList.innerHTML = "";
    rooms.forEach(([name, users]) => {
      const listItem = document.createElement("li");
      listItem.classList.add("room-item");

      const roomName = document.createElement("h4");
      const content = document.createElement("div");
      const usersWrapper = document.createElement("div");
      const usersIcon = document.createElement("i");
      const usersCount = document.createElement("p");
      const joinButtonWrapper = document.createElement("div");
      const joinButton = document.createElement("button");

      roomName.textContent = name;
      usersCount.textContent = users;
      joinButton.textContent = "JOIN";

      content.classList.add("room-content");
      usersWrapper.classList.add("users");
      usersIcon.classList.add(...["fa-solid", "fa-users"]);
      joinButtonWrapper.classList.add("join-button");
      joinButton.classList.add("button");

      joinButton.addEventListener("click", () => {
        window.location = `/room/${name}`;
      });

      usersWrapper.append(usersCount, usersIcon);
      joinButtonWrapper.append(joinButton);
      content.append(usersWrapper, joinButtonWrapper);
      listItem.append(roomName, content);
      roomsList.append(listItem)
    });
  }
}

socket.on(LOBBY_MESSAGE, (data) => {
  const { type } = data;
  switch (type) {
    case "current-rooms":
      createRoomList(data.rooms);
      break;
  }
});

window.addEventListener("resize", () => {
  roomsContainer.style.height = heroImg.clientHeight + "px";
});

async function init() {
  roomsContainer.style.height = heroImg.clientHeight + "px";
  const rooms = await fetch("/rooms").then((res) => res.json());
  createRoomList(rooms);
}

init();
