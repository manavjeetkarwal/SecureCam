const socket = io();
let localStream = null;
let peerConnections = {};
let cameraId = null;
let viewers = {};
let motionTimer = null;
let motionStartTime = null;
let currentFacingMode = "environment";
let humanDetectionEnabled = false;
let humanDetectionModel = null;
let humanDetectionTimer = null;
let humanStableHits = 0;
let lastHumanAlertTime = 0;
let humanDetectionBusy = false;
const video = document.getElementById("localVideo");
const viewerList = document.getElementById("viewerList");
const viewerSelect = document.getElementById("viewerSelect");
const viewerCount = document.getElementById("viewerCount");
const alarmSound = document.getElementById("alarmSound");
const coverCanvas = document.getElementById("coverCanvas");
const coverCtx = coverCanvas.getContext("2d");
let coverTimer = null;
let darkFrames = 0;
let lastCoverTriggerTime = 0;
const alertOverlay = document.getElementById("alertOverlay");
let locationTimer = null;
const CAMERA_STATE_KEY = "securecam_camera_state";
const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "turn:global.relay.metered.ca:80", username: "securecam1", credential: "securecam1" },
    { urls: "turn:global.relay.metered.ca:443", username: "securecam1", credential: "securecam1" },
    { urls: "turn:global.relay.metered.ca:443?transport=tcp", username: "securecam1", credential: "securecam1" }
  ]
};
function generateId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
function saveCameraState() {
  if (!cameraId) return;
  sessionStorage.setItem(CAMERA_STATE_KEY, JSON.stringify({ active: true, cameraId, facingMode: currentFacingMode }));
}
function clearCameraState() {
  sessionStorage.removeItem(CAMERA_STATE_KEY);
}
function loadCameraState() {
  try { return JSON.parse(sessionStorage.getItem(CAMERA_STATE_KEY) || "null"); } catch (e) { return null; }
}
function getElapsedSessionTime() {
  return motionStartTime ? Math.max(0, Math.floor((Date.now() - motionStartTime) / 1000)) : 0;
}
function stopLocalStream() {
  if (localStream) {
    localStream.getTracks().forEach(track => { try { track.stop(); } catch (e) {} });
    localStream = null;
  }
  if (video) video.srcObject = null;
}
function closeAllPeerConnections() {
  Object.keys(peerConnections).forEach(id => { try { peerConnections[id].close(); } catch (e) {} });
  peerConnections = {};
}
function closePeerConnection(viewerId) {
  if (peerConnections[viewerId]) {
    try { peerConnections[viewerId].close(); } catch (e) {}
    delete peerConnections[viewerId];
  }
}
async function startCamera(savedCameraId = null, silent = false) {
  try {
    const errorBox = document.getElementById("cameraError");
    if (errorBox) errorBox.innerText = "";
    stopLocalStream();
    closeAllPeerConnections();
    viewers = {};
    updateViewerUI();
    cameraId = savedCameraId || cameraId || generateId();
    document.getElementById("cameraId").innerText = cameraId;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === "videoinput");
    if (!videoDevices.length) throw new Error("No camera found");
    let selectedStream = null;
    try {
      selectedStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: currentFacingMode } }, audio: true });
    } catch (e1) {
      try {
        selectedStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacingMode }, audio: true });
      } catch (e2) {
        selectedStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: videoDevices[0].deviceId } }, audio: true });
      }
    }
    localStream = selectedStream;
    video.srcObject = localStream;
    await new Promise(resolve => { video.onloadedmetadata = () => resolve(); });
    motionStartTime = Date.now();
    socket.emit("join", { room: cameraId, role: "camera" });
    startLocationUpdates();
    startCoverDetection();
    startMotionDetection();
    saveCameraState();
    if (!silent) showToast("success", "Camera started", "Your camera is now live and ready to connect.");
  } catch (err) {
    console.error("Camera start error:", err);
    clearCameraState();
    if (silent) return;
    const message = err.name === "NotReadableError" ? "Camera is busy. Close other apps or refresh."
      : err.name === "NotAllowedError" ? "Please allow camera permission."
      : err.name === "NotFoundError" ? "No camera device found."
      : "Camera failed to start.";
    showToast("error", "Camera error", message);
  }
}
async function switchCamera() {
  if (!localStream) {
    showToast("warning", "Start camera first", "Please start the camera before switching.");
    return;
  }
  try {
    document.getElementById("cameraError").innerText = "";
    currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
    const oldVideoTrack = localStream.getVideoTracks()[0];
    const oldAudioTrack = localStream.getAudioTracks()[0];
    if (oldVideoTrack) { try { oldVideoTrack.stop(); } catch (e) {} }
    let newVideoStream;
    try {
      newVideoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: currentFacingMode } }, audio: false });
    } catch (err) {
      newVideoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacingMode }, audio: false });
    }
    const newVideoTrack = newVideoStream.getVideoTracks()[0];
    const finalStream = oldAudioTrack ? new MediaStream([newVideoTrack, oldAudioTrack]) : new MediaStream([newVideoTrack]);
    video.srcObject = finalStream;
    Object.values(peerConnections).forEach(pc => {
      const videoSender = pc.getSenders().find(s => s.track && s.track.kind === "video");
      if (videoSender && newVideoTrack) videoSender.replaceTrack(newVideoTrack);
      const audioSender = pc.getSenders().find(s => s.track && s.track.kind === "audio");
      if (audioSender && oldAudioTrack) audioSender.replaceTrack(oldAudioTrack);
    });
    localStream = finalStream;
    saveCameraState();
    showToast("info", "Camera switched", "The camera view was changed successfully.");
  } catch (e) {
    console.error("Switch camera error:", e);
    document.getElementById("cameraError").innerText = "Unable to switch camera on this device.";
    showToast("warning", "Switch failed", "Unable to switch camera on this device.");
  }
}
function stopCamera() {
  stopHumanDetection();
  const btn = document.getElementById("humanDetectBtn");
  if (btn) btn.innerText = "Human Detection: OFF";
  stopLocalStream();
  closeAllPeerConnections();
  viewers = {};
  updateViewerUI();
  if (motionTimer) clearInterval(motionTimer);
  if (coverTimer) clearInterval(coverTimer);
  if (locationTimer) clearInterval(locationTimer);
  motionTimer = null; coverTimer = null; locationTimer = null;
  motionStartTime = null;
  darkFrames = 0;
  lastCoverTriggerTime = 0;
  stopAlarm();
  clearCameraState();
  document.getElementById("cameraId").innerText = "Stopped";
  cameraId = null;
  showToast("info", "Camera stopped", "The live camera session has been stopped.");
}
function stopAlarm() {
  try {
    alarmSound.pause();
    alarmSound.currentTime = 0;
  } catch (e) {}
  alertOverlay.style.display = "none";
}
function startCoverDetection() {
  if (coverTimer) return;
  coverTimer = setInterval(() => {
    try {
      if (!video || !video.videoWidth || !video.videoHeight || !cameraId) return;
      coverCanvas.width = video.videoWidth;
      coverCanvas.height = video.videoHeight;
      coverCtx.drawImage(video, 0, 0, coverCanvas.width, coverCanvas.height);
      const frame = coverCtx.getImageData(0, 0, coverCanvas.width, coverCanvas.height);
      const pixels = frame.data;
      let brightness = 0;
      for (let i = 0; i < pixels.length; i += 4) brightness += pixels[i] + pixels[i + 1] + pixels[i + 2];
      brightness = brightness / (pixels.length / 4) / 3;
      if (brightness < 20) {
        darkFrames++;
        if (darkFrames >= 4) {
          const now = Date.now();
          if (now - lastCoverTriggerTime > 8000) {
            triggerAlarm();
            showToast("warning", "Camera cover alert", "The camera may be covered or blocked.");
            socket.emit("camera_cover_event", { room: cameraId, time: getElapsedSessionTime() });
            lastCoverTriggerTime = now;
          }
          darkFrames = 0;
        }
      } else {
        darkFrames = 0;
      }
    } catch (e) {
      console.warn("Cover detection error:", e);
    }
  }, 1500);
}
function triggerAlarm() {
  try { alarmSound.currentTime = 0; alarmSound.play().catch(() => {}); } catch (e) {}
  alertOverlay.style.display = "flex";
  setTimeout(() => { alertOverlay.style.display = "none"; }, 5000);
}
async function sendIpFallbackLocation() {
  try {
    const res = await fetch("/api/ip-location");
    if (!res.ok) throw new Error("IP location API failed");
    const data = await res.json();
    if (data.status !== "success") throw new Error(data.message || "IP location failed");
    socket.emit("camera_location", { room: cameraId, lat: data.lat, lng: data.lng, source: data.source || "ip" });
  } catch (e) {
    console.warn("IP fallback location error:", e);
  }
}
function startLocationUpdates() {
  if (locationTimer) return;
  locationTimer = setInterval(() => {
    if (!cameraId) return;
    if (!navigator.geolocation) return sendIpFallbackLocation();
    navigator.geolocation.getCurrentPosition(
      (pos) => socket.emit("camera_location", { room: cameraId, lat: pos.coords.latitude, lng: pos.coords.longitude, source: "browser" }),
      () => sendIpFallbackLocation(),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, 8000);
}
socket.on("connect", () => {
  if (localStream && cameraId) socket.emit("join", { room: cameraId, role: "camera" });
});
socket.on("viewer_ready", async (data) => {
  if (data.room !== cameraId || !localStream) return;
  const viewerId = data.sid;
  if (!viewers[viewerId]) {
    viewers[viewerId] = "Viewer";
    updateViewerUI();
  }
  if (peerConnections[viewerId]) closePeerConnection(viewerId);
  const pc = new RTCPeerConnection(config);
  peerConnections[viewerId] = pc;
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  pc.onicecandidate = (event) => {
    if (event.candidate) socket.emit("candidate", { room: cameraId, target: viewerId, candidate: event.candidate });
  };
  pc.onconnectionstatechange = () => {
    if (["failed", "closed", "disconnected"].includes(pc.connectionState)) closePeerConnection(viewerId);
  };
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { room: cameraId, target: viewerId, offer });
  } catch (e) {
    console.error("Offer creation error:", e);
  }
});
socket.on("viewer_joined", (data) => {
  viewers[data.sid] = data.username || "Viewer";
  viewerCount.innerText = data.count;
  updateViewerUI();
});
socket.on("viewer_left", (data) => {
  delete viewers[data.sid];
  closePeerConnection(data.sid);
  updateViewerUI();
});
function updateViewerUI() {
  viewerList.innerHTML = "";
  viewerSelect.innerHTML = '<option value="">Select viewer</option>';
  const ids = Object.keys(viewers);
  viewerCount.innerText = ids.length;
  ids.forEach(id => {
    const name = viewers[id];
    const li = document.createElement("li");
    li.innerText = name;
    viewerList.appendChild(li);
    const option = document.createElement("option");
    option.value = id;
    option.text = name;
    viewerSelect.appendChild(option);
  });
}
socket.on("answer", async (data) => {
  const pc = peerConnections[data.sid];
  if (!pc) return;
  try { await pc.setRemoteDescription(new RTCSessionDescription(data.answer)); } catch (e) { console.warn("Answer error:", e); }
});
socket.on("candidate", async (data) => {
  const pc = peerConnections[data.sid];
  if (!pc) return;
  try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) { console.warn("ICE candidate error:", e); }
});
function sendChat() {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  const viewerId = viewerSelect.value;
  if (!viewerId) {
    showToast("warning", "Select viewer", "Please select a viewer first.");
    return;
  }
  if (!msg) return;
  socket.emit("chat_message", { target: viewerId, sender: "Camera", message: msg });
  appendMessage("Camera", msg);
  input.value = "";
}
socket.on("chat_message", (data) => appendMessage(data.sender, data.message));
function appendMessage(sender, msg) {
  const box = document.getElementById("messages");
  const p = document.createElement("p");
  p.innerHTML = "<b>" + sender + ":</b> " + msg;
  box.appendChild(p);
  box.scrollTop = box.scrollHeight;
}
socket.on("manual_alarm", (data) => {
  if (data.room !== cameraId) return;
  triggerAlarm();
  showToast("warning", "Viewer alarm", "A viewer triggered the alarm.");
});
function startMotionDetection() {
  if (motionTimer) clearInterval(motionTimer);
  let previousFrame = null, inMotion = false, motionCountInWindow = 0, windowStart = Date.now();
  const sampleWidth = 160, detectionInterval = 500, sendInterval = 4000;
  motionTimer = setInterval(() => {
    try {
      if (!video || !video.videoWidth || !video.videoHeight || !cameraId) return;
      const sampleHeight = Math.max(90, Math.floor(video.videoHeight * (sampleWidth / video.videoWidth)));
      coverCanvas.width = sampleWidth;
      coverCanvas.height = sampleHeight;
      coverCtx.drawImage(video, 0, 0, sampleWidth, sampleHeight);
      const frame = coverCtx.getImageData(0, 0, sampleWidth, sampleHeight);
      const pixels = frame.data;
      const currentFrame = new Array(sampleWidth * sampleHeight);
      let index = 0, totalBrightness = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const gray = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        currentFrame[index++] = gray;
        totalBrightness += gray;
      }
      const avgBrightness = totalBrightness / currentFrame.length;
      if (avgBrightness < 25) {
        previousFrame = currentFrame.slice();
      } else {
        if (!previousFrame) previousFrame = currentFrame.slice();
        else {
          let changedPixels = 0;
          for (let i = 0; i < currentFrame.length; i++) if (Math.abs(currentFrame[i] - previousFrame[i]) > 20) changedPixels++;
          const changedRatio = changedPixels / currentFrame.length;
          const motionNow = changedRatio >= 0.012 && changedRatio <= 0.45;
          if (motionNow && !inMotion) { motionCountInWindow++; inMotion = true; }
          if (!motionNow) inMotion = false;
          previousFrame = currentFrame.slice();
        }
      }
      if (Date.now() - windowStart >= sendInterval) {
        socket.emit("motion_event", { room: cameraId, motion: motionCountInWindow, time: getElapsedSessionTime() });
        motionCountInWindow = 0;
        windowStart = Date.now();
      }
    } catch (e) { console.warn("Motion detection error:", e); }
  }, detectionInterval);
}
window.addEventListener("load", () => {
  const saved = loadCameraState();
  if (saved && saved.active && saved.cameraId) {
    currentFacingMode = saved.facingMode || "environment";
    startCamera(saved.cameraId, true);
  }
});
async function loadHumanDetectionModel() {
  if (humanDetectionModel) return humanDetectionModel;
  humanDetectionModel = await cocoSsd.load();
  return humanDetectionModel;
}
async function toggleHumanDetection() {
  const btn = document.getElementById("humanDetectBtn");
  if (!localStream || !cameraId) {
    showToast("warning", "Start camera first", "Please start the camera before enabling human detection.");
    return;
  }
  if (!humanDetectionEnabled) {
    try {
      if (btn) btn.innerText = "Human Detection: Loading...";
      await loadHumanDetectionModel();
      humanDetectionEnabled = true;
      humanStableHits = 0;
      lastHumanAlertTime = 0;
      if (btn) btn.innerText = "Human Detection: ON";
      startHumanDetection();
      showToast("success", "Human detection on", "Human detection mode is now enabled.");
    } catch (e) {
      if (btn) btn.innerText = "Human Detection: OFF";
      showToast("error", "Detection failed", "Failed to load human detection model.");
    }
  } else {
    stopHumanDetection();
    if (btn) btn.innerText = "Human Detection: OFF";
    showToast("info", "Human detection off", "Human detection mode is now disabled.");
  }
}
function stopHumanDetection() {
  humanDetectionEnabled = false;
  humanStableHits = 0;
  humanDetectionBusy = false;
  if (humanDetectionTimer) clearInterval(humanDetectionTimer);
  humanDetectionTimer = null;
}
function startHumanDetection() {
  if (humanDetectionTimer) clearInterval(humanDetectionTimer);
  humanDetectionTimer = setInterval(async () => {
    if (humanDetectionBusy) return;
    humanDetectionBusy = true;
    try {
      if (!humanDetectionEnabled || !humanDetectionModel || !video || !video.videoWidth || !video.videoHeight || !cameraId || video.readyState < 2) return;
      const predictions = await humanDetectionModel.detect(video);
      const persons = predictions.filter(p => p.class === "person" && (p.score || 0) >= 0.5);
      humanStableHits = persons.length > 0 ? humanStableHits + 1 : 0;
      const now = Date.now();
      if (humanStableHits >= 1 && now - lastHumanAlertTime > 10000) {
        socket.emit("human_detected", { room: cameraId, time: getElapsedSessionTime(), count: persons.length });
        lastHumanAlertTime = now;
        humanStableHits = 0;
      }
    } catch (e) {
      console.warn("Human detection error:", e);
    } finally {
      humanDetectionBusy = false;
    }
  }, 1800);
}