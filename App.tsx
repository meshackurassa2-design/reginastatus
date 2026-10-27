import React, { useState, useEffect, useRef, Component } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator, Animated, Easing, LayoutAnimation, UIManager, Platform, ScrollView } from 'react-native';
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
import { Toast } from './utils/Toast';
import ToastProvider from './components/ToastProvider';
import { DeviceEventEmitter } from 'react-native';

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

const SuccessAnimation = ({ uris, shareClip, saveClip }: { uris: string[], shareClip: (uri: string) => Promise<boolean>, saveClip: (uris: string[]) => Promise<boolean> }) => {
  const checkScale = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(20)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const buttonsTranslateY = useRef(new Animated.Value(20)).current;
  
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sharedParts, setSharedParts] = useState<boolean[]>(() => uris.map(() => false));
  const isMultiPart = uris.length > 1;
  const isVideo = uris[0]?.toLowerCase().endsWith('.mp4');
  const itemLabel = isVideo ? 'Part' : 'Photo';
  const nextPartIndex = sharedParts.findIndex(shared => !shared);

  const sharePart = async (index: number) => {
    const ok = await shareClip(uris[index]);
    if (ok) {
      setSharedParts(prev => prev.map((v, i) => (i === index ? true : v)));
    }
  };

  const saveAll = async () => {
    setIsSaving(true);
    const ok = await saveClip(uris);
    setIsSaving(false);
    if (ok) setIsSaved(true);
  };

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
          {isMultiPart
            ? isVideo
              ? `Split into ${uris.length} HD parts. Share them to your status in order, starting with Part 1.`
              : `${uris.length} HD photos ready. Share each one to your status.`
            : 'Optimized in HD for WhatsApp Status.'}
        </Text>
      </Animated.View>

      <Animated.View style={{ opacity: buttonsOpacity, transform: [{ translateY: buttonsTranslateY }], width: '100%' }}>
        <View style={styles.resultsList}>
          {isMultiPart ? (
            <ScrollView style={styles.partsScroll} contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
              {uris.map((uri, index) => {
                const isShared = sharedParts[index];
                const isNext = index === nextPartIndex;
                return (
                  <TouchableOpacity
                    key={uri}
                    testID={`share-part-${index + 1}`}
                    style={[styles.partRow, isNext && styles.partRowNext, isShared && styles.partRowShared]}
                    onPress={() => sharePart(index)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.partNumber, isShared && { backgroundColor: 'rgba(37, 211, 102, 0.25)' }]}>
                      {isShared ? (
                        <Ionicons name="checkmark" size={18} color="#25D366" />
                      ) : (
                        <Text style={[styles.partNumberText, isNext && { color: '#000' }]}>{index + 1}</Text>
                      )}
                    </View>
                    <Text style={[styles.partLabel, isNext && { color: '#000' }]}>
                      {itemLabel} {index + 1} of {uris.length}
                    </Text>
                    <Text style={[styles.partAction, isNext && { color: '#128C7E' }, isShared && { color: '#25D366' }]}>
                      {isShared ? 'Shared' : 'Share'}
                    </Text>
                    <Ionicons name="logo-whatsapp" size={22} color={isNext ? '#128C7E' : '#25D366'} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <TouchableOpacity testID="share-whatsapp" style={styles.premiumShareButton} onPress={() => sharePart(0)}>
              <View style={styles.whatsappIconContainer}>
                <Ionicons name="logo-whatsapp" size={28} color="#25D366" />
              </View>
              <Text style={styles.premiumShareText}>
                {sharedParts[0] ? 'Share Again' : 'Share to WhatsApp'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="rgba(0,0,0,0.3)" />
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            testID="save-gallery"
            style={[styles.premiumShareButton, { backgroundColor: isSaved ? 'rgba(37, 211, 102, 0.15)' : 'rgba(255,255,255,0.05)' }]} 
            onPress={saveAll}
            disabled={isSaved || isSaving}
          >
            <View style={[styles.whatsappIconContainer, { backgroundColor: isSaved ? 'rgba(37, 211, 102, 0.25)' : 'rgba(255,255,255,0.1)' }]}>
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name={isSaved ? "checkmark-done" : "download-outline"} size={24} color={isSaved ? "#25D366" : "#FFF"} />
              )}
            </View>
            <Text style={[styles.premiumShareText, { color: isSaved ? '#25D366' : '#FFF' }]}>
              {isSaved ? "Saved to Gallery" : isMultiPart ? `Save All ${uris.length} ${itemLabel}s` : "Save to Gallery"}
            </Text>
          </TouchableOpacity>

          <View style={styles.tipBox}>
            <Ionicons name="sparkles" size={16} color="#FFD700" />
            <Text style={styles.tipText}>
              For best quality, tap HD in WhatsApp and don't trim or edit the clip there.
            </Text>
          </View>
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
        Toast.show('Processing failed:\n' + result.error);
      }
    } catch (err: any) {
      setIsProcessing(false);
      Toast.show('Crash caught:\n' + (err?.message ?? String(err)));
    }
  };

  // Shares a single file. expo-sharing only supports one file per share sheet,
  // so multi-part videos are shared part-by-part from the results screen.
  const handleShare = async (uri: string): Promise<boolean> => {
    try {
      if (!uri) {
        Toast.show('No file to share.');
        return false;
      }
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Toast.show('Sharing is not available on this device.');
        return false;
      }
      
      const isVideo = uri.toLowerCase().endsWith('.mp4');
      
      await Sharing.shareAsync(uri, {
        mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
        dialogTitle: 'Share to WhatsApp',
        UTI: isVideo ? 'public.mpeg-4' : 'public.jpeg'
      });
      return true;
    } catch (e: any) {
      Toast.show('Share failed: ' + (e?.message ?? String(e)));
      return false;
    }
  };

  const handleSaveToGallery = async (uris: string[]): Promise<boolean> => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Toast.show('Camera Roll permission is required. Please allow it in Settings.');
        return false;
      }
      
      for (const uri of uris) {
        await MediaLibrary.saveToLibraryAsync(uri);
      }
      // No toast here anymore, the button itself changes state!
      return true;
    } catch (e: any) {
      Toast.show('Save failed: ' + (e?.message ?? String(e)));
      return false;
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
                const { processPhoto } = await import('./utils/VideoProcessor');
                const compressed: string[] = [];
                for (const uri of selectedMedia.uris) {
                  const result = await processPhoto(uri, watermarkStr);
                  if (result.success && result.outputUri) {
                    compressed.push(result.outputUri);
                  } else {
                    throw new Error(result.error || 'Failed to process photo');
                  }
                }
                setIsProcessing(false);
                setProcessedUris(compressed);
              } catch (e: any) {
                setIsProcessing(false);
                Toast.show('Photo processing failed: ' + (e?.message ?? String(e)));
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
            <Text style={styles.processingTitle}>
              {selectedMedia?.type === 'photo' ? 'Optimizing Photo...' : 'Optimizing Video...'}
            </Text>
            <Text style={styles.processingSubtitle}>
              {selectedMedia?.type === 'photo'
                ? 'Please wait while we prepare your photo in HD for WhatsApp Status.'
                : 'Please wait while we prepare your video in HD for WhatsApp Status. Longer videos take a bit more time.'}
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
  partsScroll: {
    maxHeight: 280,
    marginBottom: 12,
  },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 22,
  },
  partRowNext: {
    backgroundColor: '#FFF',
    borderColor: '#FFF',
  },
  partRowShared: {
    backgroundColor: 'rgba(37, 211, 102, 0.08)',
    borderColor: 'rgba(37, 211, 102, 0.3)',
  },
  partNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(37, 211, 102, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  partNumberText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 15,
  },
  partLabel: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  partAction: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  tipText: {
    flex: 1,
    color: '#888',
    fontSize: 13,
    lineHeight: 18,
  },
});

const WrappedApp = () => (
  <ErrorBoundary>
    <View style={{ flex: 1 }}>
      <App />
      {/* Must be mounted for Toast.show() messages to appear on any screen */}
      <ToastProvider />
    </View>
  </ErrorBoundary>
);

export default WrappedApp;
