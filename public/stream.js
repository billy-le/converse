"use strict";

// polyfill https://github.com/webrtc/adapter
await import("./adapter.mjs");
const emitter = await import("./emitter.js").then(({ emitter }) => emitter);

let stream;
let screenCastId = null;
let facingMode = "user";

const [
  localStreamVideo,
  buttonMic,
  buttonCamera,
  buttonHangup,
  streamsContainer,
  remoteStreamsContainer,
  swapCamera,
  startScreenCastButton,
] = ["local-stream", "mic", "camera", "hangup", "streams", "remote-streams", "swap-camera", "screen-cast"].map((id) =>
  document.querySelector(`#${id}`)
);

if (startScreenCastButton) {
  startScreenCastButton.addEventListener("pointerdown", async () => {
    if (startScreenCastButton.classList.contains("active")) {
      localStreamVideo.srcObject.getTracks().forEach((track) => {
        track.stop();
      });
      startScreenCastButton.classList.remove("active");
      localStreamVideo.srcObject = stream;
      emitter.emit("stream:remove-track", { trackId: Number(screenCastId) });
      screenCastId = null;
    } else {
      const screenCast = await import("./screencast.js").then(({ getScreenCastMedia }) => getScreenCastMedia());
      startScreenCastButton.classList.add("active");
      if (screenCast) {
        if (localStreamVideo) {
          localStreamVideo.srcObject = screenCast;
        }

        screenCast.getVideoTracks().forEach((track) => {
          track.addEventListener("ended", async () => {
            startScreenCastButton.classList.remove("active");
            screenCastId = null;
            localStreamVideo.srcObject = stream;
            emitter.emit("stream:remove-track", { trackId: track.id });
          });

          screenCastId = track.id;
          emitter.emit("stream:add-screen-cast", { track, screenCast });
        });
      }
    }
  });
}

if (swapCamera) {
  swapCamera.addEventListener("pointerdown", async () => {
    facingMode = facingMode === "user" ? "environment" : "user";
    if (stream) {
      const camera = await window.navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
        },
      });

      camera.getVideoTracks().forEach((track) => {
        stream.addTrack(track);
      });
    }
  });
}

if (buttonMic) {
  buttonMic.addEventListener("pointerdown", () => {
    buttonMic.classList.toggle("active");
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
  });
}

if (buttonCamera) {
  buttonCamera.addEventListener("pointerdown", () => {
    buttonCamera.classList.toggle("active");
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
  });
}

if (buttonHangup) {
  buttonHangup.addEventListener("pointerdown", () => {
    const remoteStreamVideos = document.querySelectorAll("[data-remote-stream]");

    if (remoteStreamVideos) {
      remoteStreamVideos.forEach((element) => {
        element.srcObject.getTracks().forEach((track) => {
          track.stop();
        });
        element.classList.remove("active");
        element.remove();
      });
    }

    if (localStreamVideo) {
      localStreamVideo.classList.remove("active");
    }

    if (localStreamVideo) {
      localStreamVideo.srcObject.getTracks().forEach((track) => {
        track.stop();
      });
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      localStreamVideo.srcObject = null;

      if (streamsContainer) {
        streamsContainer.classList.remove("open");
      }
    }

    startScreenCastButton.classList.remove("active");
    emitter.emit("stream:stop");
  });
}

function addVideoStream(stream) {
  if (localStreamVideo) {
    localStreamVideo.srcObject = stream;
    localStreamVideo.addEventListener("loadedmetadata", () => {
      localStreamVideo.play();
    });
  }
}

const mediaConstraints = {
  video: {
    height: {
      min: 480,
      ideal: 1080,
      max: 1080,
    },
    width: {
      min: 640,
      ideal: 1920,
      max: 1920,
    },
  },
  audio: {},
};

async function getLocalStream() {
  if (window?.navigator?.mediaDevices) {
    let mediaDevicesMap;

    const getMediaDevices = async () => {
      mediaDevicesMap = new Map();
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      if (mediaDevices.length) {
        mediaDevices.forEach((mediaDevice) => {
          const kind = mediaDevice.kind;
          const devices = mediaDevicesMap.get(mediaDevice.kind);
          if (devices) {
            mediaDevicesMap.set(kind, [...devices, mediaDevice]);
          } else {
            mediaDevicesMap.set(kind, [mediaDevice]);
          }
        });
      }

      const mediaDevicesContainer = document.querySelector("#media-devices");
      mediaDevicesContainer.innerHTML = "";

      const devicesByKind = Array.from(mediaDevicesMap);

      devicesByKind.forEach(([kind, devices]) => {
        const div = document.createElement("div");
        const h2 = document.createElement("h2");
        h2.textContent = kind === "videoinput" ? "Camera" : kind === "audiooutput" ? "Audio Output" : "Audio Input";
        div.appendChild(h2);

        const devicesList = document.createElement("select");

        devices.forEach((device) => {
          const option = document.createElement("option");
          option.setAttribute("data-kind", device.kind.includes("video") ? "video" : "audio");
          option.value = device.deviceId;
          option.label = device.label;
          devicesList.append(option);
        });

        devicesList.addEventListener("change", async (event) => {
          const deviceId = event.target.value;
          const kind = event.target.options[event.target.options.selectedIndex].dataset.kind;
          const otherSelectedDevices = [];
          stream.getTracks().forEach((track) => {
            if (kind === track.kind) {
              track.stop();
            } else {
              otherSelectedDevices.push([track.kind, { deviceId: track.id }]);
            }
          });

          const constraints = {
            ...mediaConstraints,
            [kind]: {
              ...mediaConstraints[kind],
              deviceId,
            },
            ...Object.fromEntries(otherSelectedDevices),
          };

          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stream) {
            addVideoStream(stream);
          }
        });

        div.appendChild(devicesList);

        mediaDevicesContainer.append(div);
      });
    };

    navigator.mediaDevices.addEventListener("devicechange", () => {
      getMediaDevices();
    });

    stream = await navigator.mediaDevices.getUserMedia({ ...mediaConstraints, audio: true });
    getMediaDevices();
  }

  return stream;
}

emitter.on("stream:start", async (data) => {
  try {
    await getLocalStream().then((stream) => {
      if (stream) {
        data.handleSuccess();
        streamsContainer?.classList?.add("open");
        addVideoStream(stream);
      }
    });
  } catch (err) {
    console.log(err);
    alert("User must enable permissions to begin streaming");
  }
});

emitter.on("stream:add-video", (data) => {
  const { track, target, remoteStream } = data;
  if (track) {
    const videoElement = document.querySelector(`[data-track-id="${track.id}"]`);
    if (!videoElement) {
      const remoteStreamVideo = document.createElement("video");
      remoteStreamVideo.setAttribute("data-remote-stream", target);
      remoteStreamVideo.setAttribute("data-track-id", track.id);
      remoteStreamVideo.classList.add("active");

      if (remoteStreamsContainer) {
        remoteStreamsContainer.appendChild(remoteStreamVideo);
        remoteStreamsContainer.classList.add("active");
      }

      if (localStreamVideo) {
        localStreamVideo.classList.add("active");
      }

      if (remoteStreamVideo) {
        remoteStreamVideo.srcObject = remoteStream;
        remoteStreamVideo.addEventListener("loadedmetadata", () => {
          remoteStreamVideo.play();
        });
      }
    }
  }
});

emitter.emit("stream:remove-video", (data) => {
  const { track } = data;
  if (track) {
    const videoElement = document.querySelector(`[data-track-id="${track.id}"]`);
    videoElement.classList.remove("active");
    videoElement.srcObject.getTracks().forEach((track) => track.stop());
    videoElement.remove();
  }
});

emitter.on("stream:disconnect", (data) => {
  const { target } = data;
  let remoteStreams = document.querySelectorAll(`[data-remote-stream]`);
  let remoteCount = remoteStreams.length;
  remoteStreams.forEach((element) => {
    if (element.dataset.remoteStream === target.toString()) {
      element.srcObject.getTracks().forEach((track) => {
        track.stop();
      });
      element.classList.remove("active");
      element.remove();
      remoteCount--;
    }
  });

  if (remoteCount < 2) {
    if (localStreamVideo) {
      localStreamVideo.classList.remove("active");
    }
    if (remoteStreamsContainer) {
      remoteStreamsContainer.classList.remove("active");
    }
  }
});
