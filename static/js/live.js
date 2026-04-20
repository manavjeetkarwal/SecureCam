const socket = io();
let peerConnection = null;
let roomId = null;
let viewerName = "Viewer";
let cameraSocketId = null;
let connected = false;
let connectionTimer = null;
let streamReceived = false;
let reconnectTimer = null;
const humanAlertBanner = document.getElementById("humanAlertBanner");
const viewerAlarmSound = document.getElementById("viewerAlarmSound");
if (typeof CURRENT_USER !== "undefined" && CURRENT_USER) viewerName = CURRENT_USER;
let mediaRecorder = null;
let recordedChunks = [];
let recordingStartTime = null;
let recTimerInterval = null;
const video = document.getElementById("remoteVideo");
const viewerLabel = document.getElementById("viewerNameLabel");
let map = L.map("map").setView([20, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
let cameraMarker = null;
const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "turn:global.relay.metered.ca:80", username: "securecam1", credential: "securecam1" },
    { urls: "turn:global.relay.metered.ca:443", username: "securecam1", credential: "securecam1" },
    { urls: "turn:global.relay.metered.ca:443?transport=tcp", username: "securecam1", credential: "securecam1" }
  ]
};
function saveViewerState() {
  localStorage.setItem("securecam_live_active", "1");
  if (roomId) {
    localStorage.setItem("securecam_live_room", roomId);
    localStorage.setItem("securecam_activity_room", roomId);
  }
}
function clearViewerState() {
  localStorage.removeItem("securecam_live_active");
  localStorage.removeItem("securecam_live_room");
}
function resetConnectionState() {
  connected = false;
  streamReceived = false;
  cameraSocketId = null;
  if (connectionTimer) clearTimeout(connectionTimer);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  connectionTimer = null; reconnectTimer = null;
  if (peerConnection) {
    try { peerConnection.close(); } catch (e) {}
    peerConnection = null;
  }
}
function startConnectionTimeout() {
  if (connectionTimer) clearTimeout(connectionTimer);
  connectionTimer = setTimeout(() => {
    if (!streamReceived) {
      resetConnectionState();
      showToast("warning", "No response", "Camera not found or not responding.");
    }
  }, 12000);
}
function stopConnectionTimeout() {
  if (connectionTimer) clearTimeout(connectionTimer);
  connectionTimer = null;
}
function scheduleReconnect() {
  if (!roomId || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectToRoom();
  }, 2000);
}
function reconnectToRoom() {
  if (!roomId) return;
  streamReceived = false;
  connected = true;
  socket.emit("join", { room: roomId, role: "viewer" });
  socket.emit("viewer_ready", { room: roomId });
  saveViewerState();
  startConnectionTimeout();
}
function stopRecordingUI() {
  clearInterval(recTimerInterval);
  recTimerInterval = null;
  document.getElementById("recIndicator").style.display = "none";
  document.getElementById("recTimer").innerText = "00:00";
}
function connectViewer(autoRoom = null) {
  const enteredRoom = (autoRoom || document.getElementById("cameraIdInput").value.trim()).toUpperCase();
  if (!enteredRoom) {
    showToast("warning", "Enter Camera ID", "Please enter a valid camera ID.");
    return;
  }
  if (connected && roomId === enteredRoom && streamReceived) return;
  resetConnectionState();
  roomId = enteredRoom;
  connected = true;
  document.getElementById("cameraIdInput").value = roomId;
  reconnectToRoom();
  showToast("info", "Connecting", "Trying to connect to the camera...");
}
socket.on("connect", () => {
  const wasActive = localStorage.getItem("securecam_live_active");
  const savedRoom = localStorage.getItem("securecam_live_room");
  if (roomId) reconnectToRoom();
  else if (wasActive === "1" && savedRoom) connectViewer(savedRoom);
});
socket.on("offer", async (data) => {
  if (data.room !== roomId) return;
  cameraSocketId = data.sid;
  if (peerConnection) {
    try { peerConnection.close(); } catch (e) {}
    peerConnection = null;
  }
  peerConnection = new RTCPeerConnection(config);
  peerConnection.ontrack = (event) => {
    video.srcObject = event.streams[0];
    streamReceived = true;
    connected = true;
    stopConnectionTimeout();
    saveViewerState();
    if (viewerLabel) {
      viewerLabel.style.display = "block";
      viewerLabel.innerText = "Connected as: " + viewerName;
    }
    showToast("success", "Live connected", "You are now connected to the live camera.");
    setTimeout(() => map.invalidateSize(), 400);
  };
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) socket.emit("candidate", { room: roomId, target: cameraSocketId, candidate: event.candidate });
  };
  peerConnection.onconnectionstatechange = () => {
    if (!peerConnection) return;
    const state = peerConnection.connectionState;
    if (state === "failed" || state === "disconnected") scheduleReconnect();
    if (state === "closed" && !streamReceived) resetConnectionState();
  };
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("answer", { room: roomId, target: cameraSocketId, answer });
  } catch (e) {
    console.error("Offer handling error:", e);
    scheduleReconnect();
  }
});
socket.on("candidate", async (data) => {
  if (!peerConnection) return;
  try { await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) { console.warn("ICE error", e); }
});
function sendChat() {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!connected || !cameraSocketId) {
    showToast("warning", "Connect first", "Connect to a camera before sending a message.");
    return;
  }
  if (!msg) return;
  socket.emit("chat_message", { target: cameraSocketId, sender: viewerName, message: msg });
  appendMessage(viewerName, msg);
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
socket.on("camera_location", (data) => {
  const { lat, lng } = data;
  if (!cameraMarker) {
    cameraMarker = L.marker([lat, lng]).addTo(map);
    cameraMarker.bindPopup("Camera Location").openPopup();
  } else {
    cameraMarker.setLatLng([lat, lng]);
  }
  map.setView([lat, lng], 16);
});
function startRecording() {
  const stream = video.srcObject;
  if (!stream) {
    showToast("warning", "No stream", "No live stream is available for recording.");
    return;
  }
  if (mediaRecorder && mediaRecorder.state === "recording") {
    showToast("info", "Already recording", "Recording is already in progress.");
    return;
  }
  recordedChunks = [];
  try {
    mediaRecorder = new MediaRecorder(stream);
  } catch (e) {
    showToast("error", "Recording unsupported", "Recording is not supported on this device or browser.");
    return;
  }
  mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) recordedChunks.push(event.data); };
  mediaRecorder.onerror = () => stopRecordingUI();
  recordingStartTime = Date.now();
  mediaRecorder.start();
  stopRecordingUI();
  document.getElementById("recIndicator").style.display = "inline-flex";
  recTimerInterval = setInterval(() => {
    const sec = Math.floor((Date.now() - recordingStartTime) / 1000);
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    document.getElementById("recTimer").innerText = m + ":" + s;
  }, 1000);
  showToast("info", "Recording started", "The live stream recording has started.");
}
function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state !== "recording") {
    showToast("warning", "Not recording", "Recording has not started yet.");
    return;
  }
  mediaRecorder.onstop = async () => {
    try {
      const durationSeconds = Math.round((Date.now() - recordingStartTime) / 1000);
      const blob = new Blob(recordedChunks, { type: "video/webm" });
      const previewUrl = URL.createObjectURL(blob);
      showMediaToast({ type: "video", url: previewUrl, title: "Recording saved", meta: `Duration: ${durationSeconds}s` });
      setTimeout(() => URL.revokeObjectURL(previewUrl), 5000);
      const formData = new FormData();
      formData.append("video", blob, "recording.webm");
      formData.append("camera_id", roomId);
      formData.append("duration", durationSeconds);
      const res = await fetch("/upload_recording", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      showToast("success", "Video saved", "The recording was saved successfully.");
    } catch (e) {
      console.error("Recording save error:", e);
      showToast("error", "Save failed", "Failed to save the recording.");
    }
  };
  stopRecordingUI();
  mediaRecorder.stop();
}
function capturePhoto() {
  if (!video.srcObject || !video.videoWidth || !video.videoHeight) {
    showToast("warning", "No stream", "No live stream is available for capture.");
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(async (blob) => {
    if (!blob) {
      showToast("error", "Capture failed", "Photo capture failed.");
      return;
    }
    try {
      const previewUrl = URL.createObjectURL(blob);
      showMediaToast({ type: "photo", url: previewUrl, title: "Photo saved", meta: "Captured from live stream" });
      setTimeout(() => URL.revokeObjectURL(previewUrl), 5000);
      const formData = new FormData();
      formData.append("photo", blob, "photo.png");
      formData.append("camera_id", roomId);
      const res = await fetch("/upload_photo", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      showToast("success", "Photo saved", "The photo was saved successfully.");
    } catch (e) {
      console.error("Photo upload error:", e);
      showToast("error", "Save failed", "Failed to save the photo.");
    }
  }, "image/png");
}
function triggerAlarm() {
  if (!roomId || !connected) {
    showToast("warning", "Connect first", "Connect to a camera before triggering an alarm.");
    return;
  }
  socket.emit("manual_alarm", { room: roomId });
  showToast("warning", "Alarm sent", "Alarm signal was sent to the camera.");
}
function openActivityPage() {
  if (!roomId) {
    showToast("warning", "No camera", "Connect to a camera first.");
    return;
  }
  localStorage.setItem("securecam_activity_room", roomId);
  window.location.href = "/activity?camera=" + roomId;
}
function stopLiveStream() {
  if (video.srcObject) {
    try { video.srcObject.getTracks().forEach(track => track.stop()); } catch (e) {}
  }
  video.srcObject = null;
  stopRecordingUI();
  clearViewerState();
  roomId = null;
  resetConnectionState();
  if (viewerLabel) viewerLabel.style.display = "none";
  if (humanAlertBanner) humanAlertBanner.style.display = "none";
  showToast("info", "Live stopped", "The live stream has been stopped.");
}
socket.on("disconnect", () => scheduleReconnect());
window.addEventListener("load", () => {
  const wasActive = localStorage.getItem("securecam_live_active");
  const savedRoom = localStorage.getItem("securecam_live_room");
  if (wasActive === "1" && savedRoom) connectViewer(savedRoom);
  if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && localStorage.getItem("securecam_live_active") === "1" && roomId && !streamReceived) reconnectToRoom();
});
socket.on("human_detected", (data) => {
  if (data.room !== roomId) return;
  try {
    if (viewerAlarmSound) {
      viewerAlarmSound.currentTime = 0;
      viewerAlarmSound.play().catch(() => {});
    }
  } catch (e) {}
  if (humanAlertBanner) {
    humanAlertBanner.innerText = "⚠ Human detected in camera";
    humanAlertBanner.style.display = "block";
    setTimeout(() => { humanAlertBanner.style.display = "none"; }, 5000);
  }
  if ("Notification" in window && Notification.permission === "granted") {
    try { new Notification("SecureCam Alert", { body: "Human detected in camera" }); } catch (e) {}
  }
});