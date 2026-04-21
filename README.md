# 🔐 SecureCam – Smart Camera Security System

A web-based smart surveillance and monitoring platform that provides real-time video streaming, intelligent event detection, and secure media storage using modern web technologies.

---

## 📌 Project Overview

SecureCam transforms a simple device into a smart security system.  
One device acts as a camera and another acts as a viewer, enabling real-time monitoring through a browser.

It provides:
- Live streaming  
- Smart alerts  
- Real-time interaction  
- Activity analysis  

---

## 🚀 Features

### Core Features
- Real-time live video streaming (WebRTC)
- Camera ↔ Viewer connection using Camera ID
- Private chat system
- Manual alarm system
- Motion detection
- Camera cover detection
- Location tracking (Map)

### Smart Features
- Human detection (basic AI)
- Activity dashboard (motion, alarms, risk)
- Event tracking

### Media Features
- Video recording
- Photo capture
- Secure media storage
- Download & delete options

### Security Features
- User authentication (Login/Signup)
- Session management
- Per-user data access

---

## 🏗️ System Architecture

Frontend (HTML, CSS, JS)  
↓  
Backend (Flask + Socket.IO)  
↓  
Database (SQLite)  
↓  
WebRTC (Camera ↔ Viewer Streaming)  

---

## ⚙️ Technology Stack

- Frontend: HTML, CSS, JavaScript  
- Backend: Flask, Flask-SocketIO  
- Database: SQLite  
- Streaming: WebRTC  
- Real-time: Socket.IO  
- Detection: OpenCV  
- Maps: Leaflet.js  

---

## 🔄 How It Works

1. User logs in  
2. Opens Connect Page and starts camera  
3. Camera generates Camera ID  
4. Viewer enters ID on Live Page  
5. WebRTC connection established  
6. Live streaming starts  

User can:
- Chat  
- Trigger alarm  
- Record video  
- Capture photo  

---

## 📊 Key Modules

Camera Module  
- Captures video  
- Detects motion & events  
- Sends alerts  

Viewer Module  
- Receives stream  
- Controls recording & alarms  

Backend Module  
- Handles logic and communication  
- Manages sessions  

Database Module  
- Stores users, media, and events  

---

## 📁 Project Structure

SecureCam/  
│── app.py  
│── camera.py  
│── database.py  

├── templates/  
│   ├── login.html  
│   ├── connect.html  
│   ├── live.html  
│   ├── activity.html  
│   ├── videos.html  
│   ├── photos.html  

├── static/  
│   ├── css/  
│   ├── js/  

├── recordings/  
├── photos/  

---

## 🧪 Testing

- Login/Signup ✔  
- Camera connection ✔  
- Live streaming ✔  
- Chat & alarm ✔  
- Motion detection ✔  
- Secure media access ✔  

---

## ✅ Advantages

- Low-cost solution  
- Easy to use  
- Real-time monitoring  
- Smart detection  
- Interactive system  
- Secure storage  

---

## ⚠️ Limitations

- Requires internet  
- Depends on device performance  
- Limited advanced AI  

---

## 🔮 Future Scope

- Face recognition  
- Mobile app  
- Cloud storage  
- Push notifications  
- Multi-camera support  
- IoT integration  

---

## 🏆 Achievement

First Prize – IndoTech 2026  
Science City, Punjab  
₹7,000 Prize  

---

## 👨‍💻 Authors
Jaspreet Kaur,
Manavjeet Singh  
Gursehaj Pal Singh  

---

## ⭐ Final Note

SecureCam is a complete smart surveillance system combining monitoring, interaction, and intelligent detection in one platform.
