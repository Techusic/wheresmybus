import React, { useEffect, useState, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import './App.css';

// Use environment variable for API and WebSocket URLs
const API_URL = process.env.REACT_APP_API_URL || 'http://152.67.22.253:4000'; // Updated to your current IP
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://152.67.22.253:4000'; // Updated to your current IP

// Use the requested bus icon
const busIcon = new L.Icon({
  iconUrl: 'https://png.pngtree.com/png-vector/20220726/ourmid/pngtree-color-sketch-icon-bus-doodle-clip-art-rounded-vector-png-image_38074712.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
  shadowUrl: undefined
});

// User icon
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  shadowSize: [41, 41],
  shadowAnchor: [12, 41]
});

// Throttle helper
function throttle(func, limit) {
  let inThrottle;
  return function () {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// WebSocket hook (unchanged)
function useWebSocket(url, onMessage) {
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);
  const messageQueue = useRef([]);
  const isConnected = useRef(false);

  const processQueue = useCallback(() => {
    while (messageQueue.current.length > 0 && isConnected.current) {
      const message = messageQueue.current.shift();
      ws.current.send(message);
    }
  }, []);

  const send = useCallback((data) => {
    const message = JSON.stringify(data);
    if (isConnected.current) {
      ws.current.send(message);
    } else {
      const busId = data.bus_id;
      messageQueue.current = messageQueue.current.filter(msg => {
        try {
          const parsed = JSON.parse(msg);
          return parsed.bus_id !== busId;
        } catch {
          return true;
        }
      });
      messageQueue.current.push(message);
    }
  }, []);

  const connect = useCallback(() => {
    try {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        isConnected.current = true;
        if (reconnectTimeout.current) {
          clearTimeout(reconnectTimeout.current);
          reconnectTimeout.current = null;
        }
        processQueue();
      };

      ws.current.onmessage = onMessage;

      ws.current.onclose = () => {
        console.log('WebSocket disconnected, attempting to reconnect...');
        isConnected.current = false;
        if (!reconnectTimeout.current) {
          reconnectTimeout.current = setTimeout(() => connect(), 5000);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        ws.current.close();
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, [url, onMessage, processQueue]);

  useEffect(() => {
    connect();
    return () => {
      if (ws.current) ws.current.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [connect]);

  return { send, isConnected };
}

// Navigation control component — uses useMap() and centers directly
function MapNavigation({ userLocation, busPosition }) {
  const map = useMap();

  const pan = useCallback((latDelta, lngDelta) => {
    const center = map.getCenter();
    map.panTo([center.lat + latDelta, center.lng + lngDelta]);
  }, [map]);

  const zoomIn = useCallback(() => map.setZoom(map.getZoom() + 1), [map]);
  const zoomOut = useCallback(() => map.setZoom(map.getZoom() - 1), [map]);

  const handleCenterOnUser = useCallback(() => {
    // If we already have userLocation state, use it
    if (userLocation && userLocation.length === 2) {
      map.setView(userLocation, 15, { animate: true });
      return;
    }

    // Otherwise try to fetch a fresh current position (and prompt permissions)
    if (!navigator.geolocation) {
      alert('Geolocation not supported by this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        console.log('getCurrentPosition success', coords);
        map.setView(coords, 15, { animate: true });
      },
      (err) => {
        console.warn('getCurrentPosition error:', err);
        if (err.code === err.PERMISSION_DENIED) {
          alert('Please allow location access for "Center on Me" to work.');
        } else {
          alert('Unable to get location. Check console for more details.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [map, userLocation]);

  const handleCenterOnBus = useCallback(() => {
    if (busPosition && busPosition.length === 2) {
      map.setView(busPosition, 15, { animate: true });
    } else {
      alert('No bus selected or bus position not available yet.');
    }
  }, [map, busPosition]);

  return (
    <div className="map-navigation">
      <div className="zoom-controls">
        <button onClick={zoomIn} className="nav-button">+</button>
        <button onClick={zoomOut} className="nav-button">-</button>
      </div>
      <button onClick={() => pan(0.01, 0)} className="nav-button">▲</button>
      <div className="horizontal-controls">
        <button onClick={() => pan(0, -0.01)} className="nav-button">◀</button>
        <button onClick={() => pan(0, 0.01)} className="nav-button">▶</button>
      </div>
      <button onClick={() => pan(-0.01, 0)} className="nav-button">▼</button>

      <button onClick={handleCenterOnUser} className="nav-button center-button">
        Center on Me
      </button>
      <button onClick={handleCenterOnBus} className="nav-button center-bus-button">
        Center on Bus
      </button>
    </div>
  );
}

export default function Dashboard() {
  const [busLocations, setBusLocations] = useState({});
  const [selectedBus, setSelectedBus] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastUpdateTime = useRef({});
  const MIN_UPDATE_INTERVAL = 5000; // Only update every 5 seconds

  // Process WebSocket messages with throttling
  const handleWebSocketMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'update') {
        const now = Date.now();
        const busId = msg.data.bus_id;
        if (!lastUpdateTime.current[busId] || now - lastUpdateTime.current[busId] > MIN_UPDATE_INTERVAL) {
          lastUpdateTime.current[busId] = now;
          setBusLocations(prev => ({
            ...prev,
            [busId]: {
              ...msg.data,
              timestamp: msg.data.timestamp ? new Date(msg.data.timestamp) : new Date()
            }
          }));
        }
      }
    } catch (err) {
      console.error('Error processing WebSocket message:', err);
    }
  }, []);

  // Initialize WebSocket connection
  const { send } = useWebSocket(WS_URL, handleWebSocketMessage);

  // Fetch initial bus locations
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setIsLoading(true);
        const cacheBuster = Date.now();
        const response = await fetch(`${API_URL}/api/locations?cb=${cacheBuster}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const locMap = {};
        data.forEach(bus => {
          locMap[bus.bus_id] = { ...bus, timestamp: bus.timestamp ? new Date(bus.timestamp) : new Date() };
        });
        setBusLocations(locMap);
        if (!selectedBus && data.length > 0) setSelectedBus(data[0].bus_id);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch initial locations:', err);
        setError('Failed to load bus data. Please check your connection.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Regularly update dashboard data every 5 seconds
  useEffect(() => {
    const fetchData = async () => {
      try {
        const cacheBuster = Date.now();
        const response = await fetch(`${API_URL}/api/locations?cb=${cacheBuster}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const locMap = {};
        data.forEach(bus => {
          locMap[bus.bus_id] = {
            ...bus,
            timestamp: new Date(bus.timestamp)
          };
        });
        setBusLocations(locMap);
        if (!selectedBus && data.length > 0) {
          setSelectedBus(data[0].bus_id);
        }
        setError(null);
      } catch (err) {
        setError('Failed to load bus data. Please check your connection.');
      }
    };
    fetchData();
    const intervalId = setInterval(fetchData, 5000);
    return () => clearInterval(intervalId);
  }, [selectedBus]);

  // Get user location (initial + watch)
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser.');
      return;
    }

    // initial immediate attempt (prompts user)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        console.log('Initial location obtained:', coords);
        setUserLocation(coords);
      },
      (err) => {
        console.warn('Initial getCurrentPosition error:', err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // watch for updates (throttled)
    const throttledLocationUpdate = throttle((position) => {
      setUserLocation([position.coords.latitude, position.coords.longitude]);
    }, 5000);

    const watchId = navigator.geolocation.watchPosition(
      throttledLocationUpdate,
      (err) => console.warn('Geolocation watchPosition error:', err),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // derive selected bus coords to pass into MapNavigation
  const selectedBusPosition = selectedBus && busLocations[selectedBus]
    ? [busLocations[selectedBus].latitude, busLocations[selectedBus].longitude]
    : null;

  return (
    <div className="dashboard-container">
      <h2>Bus Location Dashboard</h2>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => window.location.reload()} className="retry-button">Retry</button>
        </div>
      )}

      <div className="bus-selector">
        <label htmlFor="bus-select"><b>Select Bus:</b> </label>
        <select
          id="bus-select"
          value={selectedBus}
          onChange={e => setSelectedBus(e.target.value)}
          disabled={isLoading || Object.keys(busLocations).length === 0}
        >
          <option value="" disabled>Select Bus</option>
          {Object.keys(busLocations).map(busId => (
            <option key={busId} value={busId}>{busId}</option>
          ))}
        </select>
        {isLoading && <span className="loading-indicator">Loading...</span>}
      </div>

      <div className="map-container">
        <div className="map-wrapper">
          <MapContainer
            center={[28.61, 77.23]}
            zoom={12}
            className="map"
            zoomControl={false}
            style={{ height: '600px', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapNavigation userLocation={userLocation} busPosition={selectedBusPosition} />

            {selectedBus && busLocations[selectedBus] && (
              <Marker
                position={[busLocations[selectedBus].latitude, busLocations[selectedBus].longitude]}
                icon={busIcon}
              >
                <Popup>
                  <div className="bus-info">
                    <h3>Bus {busLocations[selectedBus].bus_id}</h3>
                    <p><b>Status:</b> {busLocations[selectedBus].status}</p>
                    {busLocations[selectedBus].status === 'stopped' && busLocations[selectedBus].issue && (
                      <p><b>Issue:</b> {busLocations[selectedBus].issue}</p>
                    )}
                    <p><b>Last Updated:</b> {busLocations[selectedBus].timestamp?.toLocaleTimeString?.()}</p>
                  </div>
                </Popup>
              </Marker>
            )}

            {userLocation && (
              <Marker position={userLocation} icon={userIcon}>
                <Popup><b>Your Location</b></Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}