import dateFnsFormat from "https://cdn.jsdelivr.net/npm/date-fns@2.29.2/esm/format/index.js";

const MAX_STREAMERS = 4;

window.addEventListener("DOMContentLoaded", async () => {
  const emitter = await import("./emitter.js").then(({ emitter }) => emitter);

  const [form, message, messages, buttonCopyLink, startStreamButton, wrapContainer, chatControls] = [
    "form",
    "message-input",
    "messages",
    "copy-link",
    "start-stream",
    "wrap",
    "chat-controls",
  ].map((id) => document.querySelector(`#${id}`));

  function toggleStreamButtonVisibility(data = {}) {
    const { streamers, isStreaming } = data;
    if (startStreamButton) {
      if (!isStreaming) {
        switch (true) {
          case streamers?.length === MAX_STREAMERS:
            startStreamButton.remove();
            break;
          case streamers?.length && streamers.length < MAX_STREAMERS:
            startStreamButton.innerHTML = `Join Stream<i class="fa-solid fa-arrow-right-to-bracket"></i>`;
            break;
          default:
            startStreamButton.innerHTML = `<i class="fa-solid fa-video"></i>Start Stream`;
            if (!chatControls.contains(startStreamButton)) {
              chatControls.appendChild(startStreamButton);
            }
            wrapContainer.classList.remove("stream-open");
            break;
        }
      }
    }
  }

  function sanitizeHTML(element) {
    const span = document.createElement("span");
    span.innerHTML = element;
    return span.textContent;
  }

  function createMessage({ msg, userId, isCurrentUser }) {
    const li = document.createElement("li");

    const chatMessageContainer = document.createElement("div");
    chatMessageContainer.classList.add("chat-message");

    if (userId) {
      const messageContainer = document.createElement("div");
      messageContainer.classList.add("message-container");
      const message = document.createElement("p");
      message.classList.add("message");
      message.textContent = sanitizeHTML(msg);

      const date = document.createElement("div");
      date.classList.add("date");

      const currentTime = dateFnsFormat(new Date(), "hh:mm a");
      date.append(currentTime);

      messageContainer.append(date, message);

      const avatar = document.createElement("div");
      avatar.classList.add("avatar");

      if (isCurrentUser) {
        chatMessageContainer.classList.add("reverse");
        avatar.classList.add("current-user");
        avatar.textContent = "Me";
      } else {
        avatar.classList.add("user");
        avatar.textContent = sanitizeHTML(userId);
      }

      chatMessageContainer.append(avatar, messageContainer);
    } else {
      const systemMessage = document.createElement("p");
      systemMessage.classList.add("system-message");
      systemMessage.textContent = sanitizeHTML(msg);

      chatMessageContainer.append(systemMessage);
    }

    li.appendChild(chatMessageContainer);

    if (messages) {
      messages.appendChild(li);
      messages.scrollTo({ top: messages.scrollHeight, behavior: "smooth" });
    }
  }

  if (startStreamButton) {
    async function handleStartStream() {
      try {
        await import("./stream.js").then(() => {
          emitter.emit("stream:start", {
            handleSuccess() {
              if (wrapContainer) {
                wrapContainer.classList.add("stream-open");
              }

              emitter.emit("stream:join");
              startStreamButton.remove();
            },
          });
        });
      } catch (err) {
        console.log(err);
      }
    }

    startStreamButton.addEventListener("pointerdown", handleStartStream);
  }

  if (buttonCopyLink) {
    buttonCopyLink.addEventListener("pointerdown", async () => {
      if (window.navigator?.clipboard) {
        await window.navigator.clipboard.writeText(window.location.href);
      }
    });
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (message) {
        if (message.value) {
          emitter.emit("message:send", {
            message: message.value,
            clear() {
              message.value = "";
            },
          });
        }

        message.focus();
      }
    });
  }

  emitter.on("message:receive", createMessage);
  emitter.on("message:streamers", toggleStreamButtonVisibility);
  emitter.on("stream:stop", toggleStreamButtonVisibility);
});
