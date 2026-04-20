const params = new URLSearchParams(window.location.search);
const urlCameraId = params.get("camera");
const storedCameraId = localStorage.getItem("securecam_activity_room");
let cameraId = urlCameraId || storedCameraId || null;
if (urlCameraId) localStorage.setItem("securecam_activity_room", urlCameraId);
const barCtx = document.getElementById("barChart");
const pieCtx = document.getElementById("pieChart");
let barChart, pieChart;
let alarmCount = 0, coverCount = 0, latestMotionData = [], lastTableUpdate = 0;
function createCharts() {
  if (!barCtx || !pieCtx) return;
  barChart = new Chart(barCtx, {
    type: "bar",
    data: { labels: [], datasets: [{ label: "Motion Count", data: [], backgroundColor: "#7c5cff", borderRadius: 8 }] },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
  pieChart = new Chart(pieCtx, {
    type: "doughnut",
    data: { labels: ["High", "Low", "None"], datasets: [{ data: [0, 0, 100], backgroundColor: ["#ff5d73", "#ffb44d", "#37d67a"], borderWidth: 0 }] },
    options: { cutout: "65%" }
  });
}
async function loadMotionData() {
  if (!cameraId || cameraId === "null" || cameraId === "undefined") return;
  try {
    const motionRes = await fetch("/api/activity/motion?camera=" + encodeURIComponent(cameraId));
    const alarmRes = await fetch("/api/activity/alarms?camera=" + encodeURIComponent(cameraId));
    if (!motionRes.ok || !alarmRes.ok) throw new Error("API failed");
    const motionData = await motionRes.json();
    const alarmData = await alarmRes.json();
    const safeMotionData = Array.isArray(motionData) ? motionData : [];
    const alarmTimes = Array.isArray(alarmData.viewer_alarm_times) ? alarmData.viewer_alarm_times : [];
    const coverTimes = Array.isArray(alarmData.camera_cover_times) ? alarmData.camera_cover_times : [];
    alarmCount = alarmTimes.length;
    coverCount = coverTimes.length;
    latestMotionData = safeMotionData;
    updateBarChart(safeMotionData.map(r => (r.time || 0) + "s"), safeMotionData.map(r => Number(r.motion) || 0));
    calculateRisk(latestMotionData);
    if (Date.now() - lastTableUpdate > 5000) {
      updateTable(latestMotionData, alarmTimes, coverTimes);
      lastTableUpdate = Date.now();
    }
  } catch (e) {
    console.error("Activity load error:", e);
  }
}
function updateBarChart(labels, motions) {
  if (!barChart) return;
  const maxPoints = 15;
  barChart.data.labels = labels.slice(-maxPoints);
  barChart.data.datasets[0].data = motions.slice(-maxPoints);
  barChart.options.scales = { y: { beginAtZero: true, suggestedMax: 2, ticks: { stepSize: 1 } } };
  barChart.update();
}
function updateTable(data, alarmTimes = [], coverTimes = []) {
  const tbody = document.querySelector("#activityTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  data.slice(-15).forEach(row => {
    const motionValue = Number(row.motion) || 0;
    const timeValue = Number(row.time) || 0;
    let activity = "None", levelClass = "none", alarmText = "No";
    if (motionValue >= 1) { activity = "Motion"; levelClass = "low"; }
    const hasViewerAlarm = alarmTimes.some(t => Math.abs((Number(t) || 0) - timeValue) <= 2);
    const hasCoverAlarm = coverTimes.some(t => Math.abs((Number(t) || 0) - timeValue) <= 2);
    if (hasViewerAlarm && hasCoverAlarm) { activity = "Critical"; levelClass = "high"; alarmText = "Viewer + Cover"; }
    else if (hasViewerAlarm) { activity = motionValue >= 1 ? "Motion + Alarm" : "Alarm"; levelClass = "high"; alarmText = "Viewer Alarm"; }
    else if (hasCoverAlarm) { activity = motionValue >= 1 ? "Motion + Cover" : "Cover Attempt"; levelClass = "high"; alarmText = "Cover Alarm"; }
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${timeValue}s</td><td><span class="level ${levelClass}">${activity}</span></td><td>${motionValue}</td><td>${alarmText}</td>`;
    tbody.appendChild(tr);
  });
}
function calculateRisk(data) {
  let totalMotion = 0, riskScore = 0, reasons = [];
  data.forEach(row => totalMotion += Number(row.motion) || 0);
  if (totalMotion >= 8) { riskScore += 10; reasons.push("Repeated motion detected"); }
  else if (totalMotion >= 3) { riskScore += 5; reasons.push("Some motion detected"); }
  if (alarmCount >= 3) { riskScore += 45; reasons.push("Viewer triggered alarm multiple times"); }
  else if (alarmCount >= 1) { riskScore += 30; reasons.push("Viewer triggered alarm"); }
  if (coverCount >= 3) { riskScore += 50; reasons.push("Camera cover detected multiple times"); }
  else if (coverCount >= 1) { riskScore += 35; reasons.push("Camera cover attempt detected"); }
  let high = 0, low = 0, none = 0, riskLevel = "No Risk", color = "#37d67a";
  if (riskScore >= 50) { high = 100; riskLevel = "High Risk"; color = "#ff5d73"; }
  else if (riskScore >= 15) { low = 100; riskLevel = "Low Risk"; color = "#ffb44d"; }
  else { none = 100; }
  if (!reasons.length) reasons.push("No major suspicious activity detected");
  updatePieChart(high, low, none);
  updateRiskPanel(riskLevel, color, reasons);
  updateSummary(totalMotion, riskLevel);
}
function updatePieChart(high, low, none) {
  if (!pieChart) return;
  pieChart.data.datasets[0].data = [high, low, none];
  pieChart.update();
}
function updateRiskPanel(level, color, reasons) {
  const riskElement = document.getElementById("riskLevel");
  const reasonList = document.getElementById("riskReasons");
  const actionList = document.getElementById("riskActions");
  if (!riskElement || !reasonList || !actionList) return;
  riskElement.innerHTML = `<span class="dot"></span> ${level}`;
  riskElement.style.background = color + "22";
  riskElement.querySelector(".dot").style.background = color;
  reasonList.innerHTML = "";
  actionList.innerHTML = "";
  const actions = level === "High Risk" ? ["Check live feed immediately", "Inspect camera surroundings"] : level === "Low Risk" ? ["Monitor activity closely"] : ["System operating normally"];
  reasons.forEach(r => { const li = document.createElement("li"); li.innerText = r; reasonList.appendChild(li); });
  actions.forEach(a => { const li = document.createElement("li"); li.innerText = a; actionList.appendChild(li); });
}
async function updateSummary(totalMotion, riskLevel) {
  try {
    const res = await fetch("/api/activity/summary?camera=" + encodeURIComponent(cameraId));
    if (!res.ok) throw new Error("Summary API failed");
    const data = await res.json();
    const totalMotionValue = Number(data.total_motion) || totalMotion || 0;
    const viewerAlarms = Number(data.viewer_alarms) || 0;
    const cameraCovers = Number(data.camera_covers) || 0;
    const totalAlarms = viewerAlarms + cameraCovers;
    const summaryText = document.getElementById("summaryText");
    if (summaryText) {
      summaryText.innerText = `Current Risk Level: ${riskLevel}
Total Motion Detections: ${totalMotionValue}
Viewer Alarm Triggers: ${viewerAlarms}
Camera Cover Attempts: ${cameraCovers}
Total Alarm Events: ${totalAlarms}
Risk is calculated mainly from alarm triggers and camera cover attempts.
Motion count is used as a supporting factor.`;
    }
  } catch (e) {
    console.error("Summary fetch error:", e);
  }
}
function goToLivePage() {
  if (cameraId) {
    localStorage.setItem("securecam_live_room", cameraId);
    localStorage.setItem("securecam_live_active", "1");
  }
  window.location.href = "/live";
}
createCharts();
loadMotionData();
setInterval(loadMotionData, 5000);