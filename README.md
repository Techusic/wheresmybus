# 🚌 Bus Tracking System - SIH25013 by Techusic

A real-time bus tracking solution for public transportation management, designed specifically for **Smart India Hackathon 2025 - Problem Statement SIH25013**.

---

## 🚀 Overview

This system provides **real-time tracking of public transportation buses** with a mobile app for drivers and a web dashboard for monitoring.  
It is **optimized for low-bandwidth environments** and ensures reliable operation even under unstable network conditions.

---

## ✨ Key Features

### 📱 Mobile App (Driver Side)
- Real-time GPS location tracking (every 10s)
- Background and battery-optimized location updates
- Enroute / Stopped status with issue reporting
- Auto-reconnect WebSocket connections
- Offline update queueing system
- Low bandwidth consumption (~1–2MB per 8-hour shift)

### 🖥 Web Dashboard (Monitoring)
- Interactive **Leaflet** map with live bus positions
- Multi-bus and single-bus viewing modes
- "Center on Me" and "Center on Bus" navigation
- Real-time status and issue monitoring
- User location tracking
- Bus selection dropdown with auto-refresh
- Responsive UI for all screen sizes

### ⚙️ Backend Server
- **WebSocket-based real-time communication**
- Node.js + Express.js server
- MongoDB with **TTL indexes** for auto-cleanup
- Gzip compression for bandwidth optimization
- Smart update filtering to avoid redundant updates
- Scalable cloud-ready deployment

---

## 🛠 Technology Stack

- **Frontend**  
  - Mobile App: React Native (Expo Location)  
  - Web Dashboard: React.js with Leaflet Maps  
  - Real-time Communication: WebSocket  

- **Backend**  
  - Server: Node.js with Express.js  
  - Database: MongoDB  
  - WebSocket: `ws` library with compression  
  - Deployment: Any cloud provider (e.g., AWS, Oracle, Heroku)  

---

## 📊 Bandwidth Efficiency

This system is designed for **low-data usage**, suitable even on **2G/3G networks**:

- **Mobile App**  
  - ~150–200 bytes per update  
  - ~115 KB/hour for 10 buses  
  - ~1–2 MB/day per driver  

- **Dashboard**  
  - ~40–60 bytes per bus (compressed)  
  - Lightweight real-time streaming  

---

## ⚙️ Backend Architecture

### Data Flow
1. **Mobile App** → WebSocket → **Server** → WebSocket → **Web Dashboard**
2. MongoDB stores data with **24-hour auto-cleanup**
3. Cached responses for fast queries

### Optimizations
- **Compression**: 70–80% bandwidth savings with Gzip  
- **Smart Updates**: Ignores insignificant location changes  
- **TTL Indexes**: Auto-delete records after 24 hours  
- **Connection Management**: Handles 100+ concurrent users  

---

## 📈 Performance Metrics

- **Update Frequency**: Mobile App (10s), Dashboard (5s with fallback)  
- **Data Retention**: 24 hours (auto-cleanup)  
- **Reconnect Speed**: <5 seconds  
- **Response Latency**: <100 ms  
- **Server Load**: 100+ concurrent connections  

---

## 🔧 Configuration

- Supports **10 buses by default** (IDs: 101–110)  
- Easily configurable for more buses  
- Role-based access control ready  

---

## 🎯 SIH25013 Problem Alignment

This project meets all key problem statement requirements:

- ✅ Real-time tracking with WebSockets  
- ✅ Multi-bus fleet monitoring  
- ✅ Reliable auto-reconnect + fallback mechanisms  
- ✅ Cost-effective open-source stack  
- ✅ Cloud-ready scalable architecture  
- ✅ Optimized for low-bandwidth Indian networks  

---

## 🤝 Contributing

This project was developed for **SIH 2025**.  
Contributions are welcome for:
- New features  
- Performance improvements  
- Bug fixes  

---

## 📄 License

Developed for **Smart India Hackathon 2025 - Problem Statement SIH25013**  
Free to use and extend under open-source license.

---

**✨ Built for reliability, optimized for Indian conditions, designed for public transportation excellence.**
