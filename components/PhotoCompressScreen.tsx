import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Dimensions, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as MediaLibrary from 'expo-media-library';

const { width } = Dimensions.get('window');

interface PhotoCompressScreenProps {
  photoUris: string[];
  onClose: () => void;
  onCompress: (watermark: string) => void;
}

export default function PhotoCompressScreen({ photoUris, onClose, onCompress }: PhotoCompressScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [watermarkText, setWatermarkText] = useState('');

  useEffect(() => {
    if (photoUris.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % photoUris.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [photoUris.length]);

  useEffect(() => {
    AsyncStorage.getItem('@default_watermark').then(val => {
      if (val) setWatermarkText(val);
    });
  }, []);

  const currentPreviewUri = photoUris[currentIndex];

  return (
    <View style={styles.container}>
      {/* Background Image filling the entire screen */}
      <Image source={{ uri: currentPreviewUri }} style={styles.backgroundImage} contentFit="cover" blurRadius={0} />
      
      {/* Subtle Dark Gradient Overlay at the bottom for text readability */}
      <View style={styles.overlay} />

      {/* Top Header */}
      <SafeAreaView style={styles.header}>
        <View />
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
      </SafeAreaView>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.mainContent}>
        
        {/* Action Buttons & Watermark */}
        <View style={styles.bottomControls}>
          <View style={styles.watermarkInputContainer}>
            <Ionicons name="text" size={20} color="#FFF" style={styles.watermarkIcon} />
            <TextInput
              style={styles.watermarkInput}
              placeholder="Add watermark (Defaults to ReginaStatus)"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={watermarkText}
              onChangeText={setWatermarkText}
              returnKeyType="done"
            />
          </View>
          
          <TouchableOpacity 
            style={[styles.compressButton, { backgroundColor: '#32CD32' }]} 
            onPress={() => {
              const name = watermarkText.trim();
              const finalWatermark = name.length > 0 ? `ReginaStatus • ${name}` : 'ReginaStatus';
              onCompress(finalWatermark);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Export Image</Text>
          </TouchableOpacity>
        </View>

          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)', // Slightly dark to make content pop
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    zIndex: 10,
  },
  logoIcon: {
    backgroundColor: '#32CD32',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  logoTextHD: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 12,
    marginRight: 4,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  bottomControls: {
    width: '100%',
    gap: 14,
    position: 'absolute',
    bottom: 40,
  },
  watermarkInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  watermarkIcon: {
    marginRight: 10,
  },
  watermarkInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    fontWeight: '500',
  },
  compressButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  buttonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
