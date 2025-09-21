// Configure server to listen on all interfaces
const PORT = 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/busTracking';

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const WebSocket = require('ws');
const zlib = require('zlib');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10kb' }));

// Connect to MongoDB
mongoose.connect(MONGODB_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Schema with TTL for automatic data clearance after 24 hours
const busLocationSchema = new mongoose.Schema({
  bus_id: String,
  latitude: Number,
  longitude: Number,
  timestamp: Number,
  status: String,
  issue: String,
}, {
  timestamps: true
});

// TTL index to automatically remove documents after 24 hours
busLocationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

const BusLocation = mongoose.model('BusLocation', busLocationSchema);

// Cache for latest locations
let latestLocationsCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5000;

// API to get latest bus locations with caching
app.get('/api/locations', async (req, res) => {
  try {
    // Check cache first
    const now = Date.now();
    if (latestLocationsCache && now - cacheTimestamp < CACHE_DURATION) {
      res.json(latestLocationsCache);
      return;
    }

    const latest = await BusLocation.aggregate([
      { $sort: { timestamp: -1 } },
      { $group: { _id: "$bus_id", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } }
    ]);
    
    // Update cache
    latestLocationsCache = latest;
    cacheTimestamp = now;
    
    res.json(latest);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ 
  server,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024
  }
});

const clients = new Set();

// Function to compress data before sending
function compressData(data) {
  return new Promise((resolve, reject) => {
    zlib.deflate(JSON.stringify(data), (err, buffer) => {
      if (err) reject(err);
      else resolve(buffer);
    });
  });
}

wss.on('connection', ws => {
  clients.add(ws);

  ws.on('message', async message => {
    console.log('Received message:', message);
    try {
      const data = JSON.parse(message);
      const allowedBusIds = Array.from({length: 10}, (_, i) => String(101 + i));
      
      if (data.bus_id && allowedBusIds.includes(data.bus_id)) {
        // Check if we really need to update (significant position change)
        const existing = await BusLocation.findOne({ bus_id: data.bus_id }).sort({ timestamp: -1 });
        
        const MIN_DISTANCE_CHANGE = 0.0001; // ~11 meters
        const MIN_TIME_CHANGE = 5000; // 5 seconds
        
        if (existing) {
          const distance = Math.sqrt(
            Math.pow(data.latitude - existing.latitude, 2) + 
            Math.pow(data.longitude - existing.longitude, 2)
          );
          
          const timeDiff = data.timestamp - existing.timestamp;
          
          // Only update if significant change or enough time has passed
          if (distance < MIN_DISTANCE_CHANGE && timeDiff < MIN_TIME_CHANGE) {
            return; // Skip insignificant update
          }
        }
        
        // Delete older entries for this bus_id
        await BusLocation.deleteMany({ bus_id: data.bus_id });
        // Insert the new location
        const updated = await BusLocation.create(data);
        
        // Invalidate cache
        latestLocationsCache = null;
        
        broadcastUpdate(updated);
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  });

  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

async function broadcastUpdate(data) {
  try {
    const compressed = await compressData({ type: 'update', data });
    
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(compressed);
      }
    });
  } catch (e) {
    console.error('Compression error:', e);
    // Fallback to uncompressed
    const message = JSON.stringify({ type: 'update', data });
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

// Listen on all network interfaces
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Accessible via your server's IP addresses (including 152.67.22.253)`);
});
