import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, Keyboard, FlatList, TouchableWithoutFeedback } from 'react-native';
import * as Location from 'expo-location';

export default function App() {
  const [busId, setBusId] = useState('');
  const [showPicker, setShowPicker] = useState({ busId: false, status: false });
  const [status, setStatus] = useState('enroute');
  const [issue, setIssue] = useState('');
  const lastLocation = useRef(null);
  const locationThreshold = 0.0001;
  const ws = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        ws.current = new WebSocket('ws://152.67.22.253:4000');
        
        ws.current.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
        };
        
        ws.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
        };
        
        ws.current.onclose = () => {
          console.log('WebSocket disconnected, attempting to reconnect...');
          setIsConnected(false);
          setTimeout(connectWebSocket, 5000);
        };
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        setTimeout(connectWebSocket, 5000);
      }
    };
    
    connectWebSocket();
    
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  // Send location updates every 10 seconds
  useEffect(() => {
    let intervalId;
    
    if (busId && isConnected) {
      intervalId = setInterval(() => {
        sendLocationUpdate();
      }, 10000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [busId, status, issue, isConnected]);

  // Send update immediately when status changes
  useEffect(() => {
    if (busId && isConnected) {
      sendLocationUpdate();
    }
  }, [status]);

  // Request location permissions
  useEffect(() => {
    (async () => {
      let { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for this app to work.');
        return;
      }
    })();
  }, []);

  const sendLocationUpdate = async () => {
    try {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
      
      const location = await Location.getCurrentPositionAsync({});
      const coords = location.coords;
      
      const payload = {
        bus_id: busId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        timestamp: Date.now(),
        status,
        issue,
      };
      
      ws.current.send(JSON.stringify(payload));
      console.log('Location update sent:', payload);
    } catch (error) {
      console.error('Error sending location update:', error);
    }
  };

  const handleIssueSubmit = () => {
    Keyboard.dismiss();
    sendLocationUpdate();
  };

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        if (showPicker.busId || showPicker.status) setShowPicker({ busId: false, status: false });
      }}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Bus Location Pinger</Text>
        
        <View style={styles.section}>
          <Text style={styles.label}>Bus ID</Text>
          <View style={styles.dropdownWrapper}>
            <TouchableOpacity
              onPress={() => setShowPicker({ busId: !showPicker.busId, status: false })}
              style={styles.pickerTouchable}
            >
              <Text style={styles.pickerText}>{busId ? `Bus ${busId}` : 'Select Bus ID'}</Text>
            </TouchableOpacity>
            {showPicker.busId && (
              <View style={styles.dropdownList}>
                <FlatList
                  data={[...Array(10)].map((_, i) => ({ key: `${101 + i}`, label: `Bus ${101 + i}` }))}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => {
                        setBusId(item.key);
                        setShowPicker({ busId: false, status: false });
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{item.label}</Text>
                    </TouchableOpacity>
                  )}
                  keyExtractor={item => item.key}
                />
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.label}>Status</Text>
          <View style={styles.dropdownWrapper}>
            <TouchableOpacity
              onPress={() => busId && setShowPicker({ busId: false, status: !showPicker.status })}
              style={styles.pickerTouchable}
              disabled={!busId}
            >
              <Text style={styles.pickerText}>{status === 'enroute' ? 'Enroute' : 'Stopped'}</Text>
            </TouchableOpacity>
            {showPicker.status && (
              <View style={styles.dropdownList}>
                <FlatList
                  data={[
                    { key: 'enroute', label: 'Enroute' },
                    { key: 'stopped', label: 'Stopped' }
                  ]}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => {
                        setStatus(item.key);
                        setShowPicker({ busId: false, status: false });
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{item.label}</Text>
                    </TouchableOpacity>
                  )}
                  keyExtractor={item => item.key}
                />
              </View>
            )}
          </View>
        </View>
        
        {status === 'stopped' && (
          <View style={styles.issueContainer}>
            <Text style={styles.label}>Issue Description</Text>
            <TextInput
              style={styles.input}
              placeholder="Describe issue"
              value={issue}
              onChangeText={setIssue}
              multiline
              numberOfLines={2}
            />
            <TouchableOpacity
              style={styles.doneButton}
              onPress={handleIssueSubmit}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.connectionStatus}>
          <Text style={[styles.statusText, { color: isConnected ? 'green' : 'red' }]}>
            {isConnected ? 'Connected to Server' : 'Disconnected from Server'}
          </Text>
        </View>
        
        <Text style={styles.info}>Location updates sent in real time via WebSocket.</Text>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#333',
  },
  dropdownWrapper: {
    position: 'relative',
  },
  pickerTouchable: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 16,
    justifyContent: 'center',
  },
  pickerText: {
    fontSize: 15,
    color: '#333',
  },
  dropdownList: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginBottom: 8,
    position: 'absolute',
    left: 0,
    right: 0,
    top: 40,
    zIndex: 20,
    maxHeight: 220,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 10,
    marginBottom: 16,
    fontSize: 16,
    color: '#333',
    minHeight: 40,
  },
  issueContainer: {
    marginBottom: 16,
    padding: 8,
    backgroundColor: '#fffbe6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffe58f',
  },
  doneButton: {
    backgroundColor: '#4f8ef7',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  doneButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  connectionStatus: {
    marginBottom: 16,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  info: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
  },
});