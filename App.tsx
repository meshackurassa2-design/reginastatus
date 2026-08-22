import React, { useState, useEffect, useRef, Component } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator, Animated, Easing, LayoutAnimation, UIManager, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { compressAndSplitVideo } from './utils/VideoProcessor';
import OnboardingScreen from './components/OnboardingScreen';
import GalleryScreen from './components/GalleryScreen';
import EditorScreen from './components/EditorScreen';
import PhotoCompressScreen from './components/PhotoCompressScreen';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

class ErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean, error: string}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: String(error) };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#1a0000', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: '#FF4444', fontSize: 22, fontWeight: 'bold', marginBottom: 16 }}>⚠️ App Error</Text>
          <Text style={{ color: '#FFF', fontSize: 13, textAlign: 'center', fontFamily: 'monospace' }}>{this.state.error}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const TransferAnimation = () => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 30]
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0, 1, 1, 0]
  });

  return (
    <View style={styles.animationContainer}>
      <Ionicons name="film-outline" size={42} color="#888" />
      <View style={styles.trackContainer}>
        <View style={styles.trackLine} />
        <Animated.View style={{ transform: [{ translateX }], opacity }}>
          <Ionicons name="arrow-forward-circle" size={28} color="#25D366" />
        </Animated.View>
      </View>
      <Ionicons name="logo-whatsapp" size={42} color="#25D366" />
    </View>
  );
};

const SuccessAnimation = ({ uris, shareClip, saveClip }: { uris: string[], shareClip: (uris: string[]) => void, saveClip: (uris: string[]) => void }) => {
  const checkScale = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(20)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const buttonsTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(checkScale, {
        toValue: 1,
        tension: 80,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.spring(contentTranslateY, {
          toValue: 0,
          tension: 60,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(buttonsOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.spring(buttonsTranslateY, {
          toValue: 0,
          tension: 60,
          friction: 7,
          useNativeDriver: true,
        }),
      ])
    ]).start();
  }, []);

  return (
    <View style={styles.cleanCard}>
      <Animated.View style={{ transform: [{ scale: checkScale }], marginBottom: 24 }}>
        <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(37, 211, 102, 0.15)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(37, 211, 102, 0.25)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark-circle" size={64} color="#25D366" />
          </View>
        </View>
      </Animated.View>
      
      <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentTranslateY }], alignItems: 'center', width: '100%' }}>
        <Text style={styles.processingTitle}>Ready to Share</Text>
        <Text style={styles.processingSubtitle}>
          Your video has been perfectly split and optimized for WhatsApp.
        </Text>
      </Animated.View>

      <Animated.View style={{ opacity: buttonsOpacity, transform: [{ translateY: buttonsTranslateY }], width: '100%' }}>
        <View style={styles.resultsList}>
          <TouchableOpacity style={styles.premiumShareButton} onPress={() => shareClip(uris)}>
            <View style={styles.whatsappIconContainer}>
              <Ionicons name="logo-whatsapp" size={28} color="#25D366" />
            </View>
            <Text style={styles.premiumShareText}>
              Share to WhatsApp
            </Text>
            <Ionicons name="chevron-forward" size={20} color="rgba(0,0,0,0.3)" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.premiumShareButton, { backgroundColor: 'rgba(255,255,255,0.05)' }]} onPress={() => saveClip(uris)}>
            <View style={[styles.whatsappIconContainer, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
              <Ionicons name="download-outline" size={24} color="#FFF" />
            </View>
            <Text style={[styles.premiumShareText, { color: '#FFF' }]}>
              Save to Gallery
            </Text>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

function App() {
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const splashScale = useRef(new Animated.Value(0.8)).current;
  const splashOpacity = useRef(new Animated.Value(0)).current;
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{uris: string[], type: 'video' | 'photo'} | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedUris, setProcessedUris] = useState<string[]>([]);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const value = await AsyncStorage.getItem('@has_onboarded');
        if (value === 'true') {
          setIsOnboarded(true);
        }
      } catch (e) {
        console.warn('Failed to read onboarding state');
      }

      Animated.parallel([
        Animated.timing(splashOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.spring(splashScale, { toValue: 1, friction: 5, useNativeDriver: true })
      ]).start();

      setTimeout(() => {
        try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch (_) {}
        setIsSplashVisible(false);
      }, 2000);
    };

    checkOnboarding();
    
    try {
      Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (_) {}
  }, []);

  const handleOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem('@has_onboarded', 'true');
    } catch (e) {
      console.warn('Failed to save onboarding state');
    }
    setIsOnboarded(true);
  };

  const processVideo = async (options: {
    trimStartMillis: number;
    trimEndMillis: number;
    watermarkText: string;
    musicUri: string | null;
    videoVolume: number;
    musicVolume: number;
  }) => {
    if (!selectedMedia || selectedMedia.type !== 'video') return;
    setIsProcessing(true);
    setProcessedUris([]);
    
    try {
      const result = await compressAndSplitVideo(selectedMedia.uris[0], options.trimEndMillis, options);
      
      try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch (_) {}
      
      setIsProcessing(false);
      
      if (result.success) {
        setProcessedUris(result.outputUris);
      } else {
        alert('Processing failed:\n' + result.error);
      }
    } catch (err: any) {
      setIsProcessing(false);
      alert('Crash caught:\n' + (err?.message ?? String(err)));
    }
  };

  const handleShare = async (uris: string[]) => {
    if (uris.length === 0) {
      alert('No files to share.');
      return;
    }
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        alert('Sharing is not available on this device.');
        return;
      }

      // Resolve ph:// or assets-library:// to local cache file
      let shareUri = uris[0];
      if (shareUri.startsWith('ph://') || shareUri.startsWith('assets-library://')) {
        const ext = shareUri.includes('.jpg') || shareUri.includes('.jpeg') ? 'jpg' : 'mp4';
        const localUri = ((FileSystem as any).cacheDirectory as string) + `share_media.${ext}`;
        // Remove existing cached file first
        const existing = await FileSystem.getInfoAsync(localUri);
        if (existing.exists) await FileSystem.deleteAsync(localUri, { idempotent: true });
        await FileSystem.copyAsync({ from: shareUri, to: localUri });
        shareUri = localUri;
      }

      await Sharing.shareAsync(shareUri, { dialogTitle: 'Share via WhatsApp' });
    } catch (e: any) {
      alert('Share failed: ' + (e?.message ?? String(e)));
    }
  };

  const handleSaveToGallery = async (uris: string[]) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Camera Roll permission is required. Please allow it in iPhone Settings → Privacy → Photos.');
        return;
      }

      let saved = 0;
      for (const uri of uris) {
        await MediaLibrary.saveToLibraryAsync(uri);
        saved++;
      }
      alert(`✅ Saved ${saved} file${saved > 1 ? 's' : ''} to your Camera Roll!`);
    } catch (e: any) {
      alert('Save failed: ' + (e?.message ?? String(e)));
    }
  };

  // 0. Custom Splash Screen
  if (isSplashVisible) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar style="light" />
        <Animated.View style={{ opacity: splashOpacity, transform: [{ scale: splashScale }] }}>
          <Text style={{ color: '#32CD32', fontSize: 44, fontWeight: 'bold', letterSpacing: 1 }}>ReginaStatus</Text>
        </Animated.View>
      </View>
    );
  }

  // 1. Show Onboarding
  if (!isOnboarded) {
    return (
      <>
        <StatusBar style="light" />
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      </>
    );
  }

  // 2 & 3. Main App Flow (Gallery -> Editor/Compress -> Success)
  if (processedUris.length === 0 && !isProcessing) {
    return (
      <>
        <StatusBar style="light" />
        {!selectedMedia ? (
          <GalleryScreen onSelectMedia={(uris, type) => {
            setSelectedMedia({ uris, type });
            setProcessedUris([]);
          }} />
        ) : selectedMedia.type === 'video' ? (
          <View style={{ flex: 1 }}>
            <EditorScreen 
              videoUri={selectedMedia.uris[0]} 
              onDiscard={() => setSelectedMedia(null)}
              onSave={processVideo}
            />
          </View>
        ) : (
          <PhotoCompressScreen
            photoUris={selectedMedia.uris}
            onClose={() => setSelectedMedia(null)}
            onCompress={async (watermarkStr) => {
              setIsProcessing(true);
              setProcessedUris([]);
              try {
                const ImageManipulator = require('expo-image-manipulator');
                const compressed: string[] = [];
                let idx = 0;
                for (const uri of selectedMedia.uris) {
                  // Resolve ph:// to file:// by copying to cache
                  let localUri = uri;
                  if (uri.startsWith('ph://') || uri.startsWith('assets-library://')) {
                    localUri = ((FileSystem as any).cacheDirectory as string) + `temp_img_${idx}.jpg`;
                    const existing = await FileSystem.getInfoAsync(localUri);
                    if (existing.exists) await FileSystem.deleteAsync(localUri, { idempotent: true });
                    await FileSystem.copyAsync({ from: uri, to: localUri });
                  }
                  
                  const result = await ImageManipulator.manipulateAsync(
                    localUri,
                    [{ resize: { width: 1080 } }],
                    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
                  );
                  compressed.push(result.uri);
                  idx++;
                }
                setIsProcessing(false);
                setProcessedUris(compressed);
              } catch (e: any) {
                setIsProcessing(false);
                alert('Photo processing failed: ' + (e?.message ?? String(e)));
              }
            }}
          />
        )}
      </>
    );
  }

  // 4. Show Processing / Results View
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Premium Header */}
      <View style={styles.processingHeader}>
        <TouchableOpacity style={styles.backButtonGlass} onPress={() => { setSelectedMedia(null); setProcessedUris([]); }}>
          <Ionicons name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitleText}>Export Media</Text>
      </View>

      <View style={styles.processingContent}>
        
        {isProcessing ? (
          <View style={styles.cleanCard}>
            <TransferAnimation />
            <Text style={styles.processingTitle}>Compressing Video...</Text>
            <Text style={styles.processingSubtitle}>
              Please wait while we optimize your video for WhatsApp Status.
            </Text>
          </View>
        ) : null}

        {processedUris.length > 0 ? (
          <SuccessAnimation uris={processedUris} shareClip={handleShare} saveClip={handleSaveToGallery} />
        ) : null}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#161616',
  },
  processingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButtonGlass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  processingContent: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  cleanCard: {
    alignItems: 'center',
    padding: 24,
  },
  animationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  trackContainer: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  trackLine: {
    position: 'absolute',
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 1,
  },
  processingTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  processingSubtitle: {
    color: '#888',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 40,
  },
  resultsList: {
    width: '100%',
    gap: 16,
  },
  premiumShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF', 
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
    width: '100%',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 12,
  },
  whatsappIconContainer: {
    marginRight: 16,
  },
  premiumShareText: {
    flex: 1,
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
  },
});

const WrappedApp = () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

export default WrappedApp;
