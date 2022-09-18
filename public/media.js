let stream;

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

function addVideoStream(selector, stream) {
  const video = document.querySelector(selector);
  if (video) {
    video.srcObject = stream;
    video.addEventListener("loadedmetadata", () => {
      video.play();
    });
  }
}

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
            addVideoStream("#local-stream", stream);
          }
        });

        div.appendChild(devicesList);

        mediaDevicesContainer.append(div);
      });
    };

    navigator.mediaDevices.addEventListener("devicechange", () => {
      getMediaDevices();
    });

    stream = await navigator.mediaDevices.getUserMedia({ ...mediaConstraints, audio: true })
    getMediaDevices();

    if (stream) {
      addVideoStream("#local-stream", stream);
    }
  }

  return stream;
}

export { getLocalStream };
