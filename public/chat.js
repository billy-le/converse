import dateFnsFormat from "https://cdn.jsdelivr.net/npm/date-fns@2.29.2/esm/format/index.js";

const MAX_STREAMERS = 4;

window.addEventListener("DOMContentLoaded", () => {
  const [form, message, messages, buttonCopyLink, startStreamButton, wrapContainer, chatControls] = [
    "form",
    "message-input",
    "messages",
    "copy-link",
    "start-stream",
    "wrap",
    "chat-controls",
  ].map((id) => document.querySelector(`#${id}`));

  function toggleStreamButtonVisibility({ detail: { streamers, isStreaming } }) {
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

  function createMessage({ detail: { msg, userId, isCurrentUser } }) {
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
          window.dispatchEvent(
            new CustomEvent("stream:start", {
              detail: {
                handleSuccess() {
                  if (wrapContainer) {
                    wrapContainer.classList.add("stream-open");
                  }

                  window.dispatchEvent(new CustomEvent("stream:join"));
                  startStreamButton.remove();
                },
              },
            })
          );
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
          window.dispatchEvent(
            new CustomEvent("message:send", {
              detail: {
                message: message.value,
                clear() {
                  message.value = "";
                },
              },
            })
          );
        }

        message.focus();
      }
    });
  }

  window.addEventListener("message:receive", createMessage);
  window.addEventListener("message:streamers", toggleStreamButtonVisibility);
  window.addEventListener("stream:stop", toggleStreamButtonVisibility);
});