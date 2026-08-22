import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, DeviceEventEmitter } from 'react-native';

export default function ToastProvider() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('showToast', (msg) => {
      setMessage(msg);
      setTimeout(() => setMessage(''), 3000);
    });
    return () => sub.remove();
  }, []);

  if (!message) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.toast}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    backgroundColor: 'rgba(40,40,40,0.95)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    maxWidth: '85%',
  },
  text: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
