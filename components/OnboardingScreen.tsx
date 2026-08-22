import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, Dimensions, SafeAreaView, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
// import * as TrackingTransparency from 'expo-tracking-transparency'; // Causes crash in Expo Go

const { width, height } = Dimensions.get('window');

interface OnboardingProps {
  onComplete: () => void;
}

const Header = () => (
  <View style={styles.header}>
    <View style={styles.logoIcon}>
      <Text style={styles.logoTextHD}>HD</Text>
      <Ionicons name="videocam" size={16} color="#FFF" />
    </View>
    <Text style={styles.logoTitle}>ReginaStatus</Text>
  </View>
);

const Slide1 = ({ isActive, onComplete }: { isActive: boolean, onComplete: () => void }) => {
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      Animated.sequence([
        Animated.spring(anim1, { toValue: 1, friction: 6, useNativeDriver: true }),
        Animated.spring(anim2, { toValue: 1, friction: 6, useNativeDriver: true }),
        Animated.spring(anim3, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]).start(() => {
        onComplete();
      });
    } else {
      anim1.setValue(0);
      anim2.setValue(0);
      anim3.setValue(0);
    }
  }, [isActive]);

  const getStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{
      translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] })
    }]
  });

  return (
    <View style={styles.slide}>
      <Header />
      <Text style={styles.slideTitle}>3 Easy Steps</Text>
      
      <View style={styles.stepsContainer}>
        <Animated.View style={[styles.stepCard, getStyle(anim1)]}>
          <View style={styles.stepIconPlaceholder}><Ionicons name="images" size={40} color="#FF9800" /></View>
          <View style={styles.stepTextContainer}>
            <Text style={styles.stepNumber}>Step 1</Text>
            <Text style={styles.stepDescription}>Select Video{"\n"}Or Photos</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.stepCard, getStyle(anim2)]}>
          <View style={styles.stepTextContainer}>
            <Text style={styles.stepNumber}>Step 2</Text>
            <Text style={styles.stepDescription}>Compress with{"\n"}Single Click</Text>
          </View>
          <View style={styles.stepIconPlaceholder}><Ionicons name="hardware-chip" size={40} color="#4CAF50" /></View>
        </Animated.View>

        <Animated.View style={[styles.stepCard, getStyle(anim3)]}>
          <View style={styles.stepIconPlaceholder}><Ionicons name="logo-whatsapp" size={40} color="#25D366" /></View>
          <View style={styles.stepTextContainer}>
            <Text style={styles.stepNumber}>Step 3</Text>
            <Text style={styles.stepDescription}>Forward to Your{"\n"}WhatsApp Status</Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

const Slide2 = ({ isActive, onComplete }: { isActive: boolean, onComplete: () => void }) => {
  // 6 cards + 2 banners = 8 animations
  const anims = useRef([...Array(8)].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (isActive) {
      Animated.sequence(anims.map(anim => 
        Animated.spring(anim, { toValue: 1, friction: 7, useNativeDriver: true })
      )).start(() => {
        onComplete();
      });
    } else {
      anims.forEach(anim => anim.setValue(0));
    }
  }, [isActive]);

  const getStyle = (index: number) => ({
    opacity: anims[index],
    transform: [{
      scale: anims[index].interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] })
    }]
  });

  return (
    <ScrollView style={styles.slide} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
      <Header />
      <Text style={styles.slideTitle}>Do's & Don'ts</Text>

      <View style={styles.gridContainer}>
        <Animated.View style={[styles.gridCard, styles.dontCard, getStyle(0)]}>
          <Ionicons name="cut" size={24} color="#FF4C4C" style={{alignSelf:'center'}}/>
          <Text style={styles.dontText}>Don't <Ionicons name="close-circle" size={16} /></Text>
          <Text style={styles.gridCardDesc}>Don't Edit Or Crop Video After Compression</Text>
        </Animated.View>
        
        <Animated.View style={[styles.gridCard, styles.doCard, getStyle(1)]}>
          <Ionicons name="cut" size={24} color="#00C853" style={{alignSelf:'center'}}/>
          <Text style={styles.doText}>Do <Ionicons name="checkmark-circle" size={16} /></Text>
          <Text style={styles.gridCardDesc}>Do All the Video Editing Before Compression</Text>
        </Animated.View>

        <Animated.View style={[styles.gridCard, styles.dontCard, getStyle(2)]}>
          <Ionicons name="cloud-download" size={24} color="#FF4C4C" style={{alignSelf:'center'}}/>
          <Text style={styles.dontText}>Don't <Ionicons name="close-circle" size={16} /></Text>
          <Text style={styles.gridCardDesc}>Don't Compress Videos Downloaded from WhatsApp</Text>
        </Animated.View>
        
        <Animated.View style={[styles.gridCard, styles.doCard, getStyle(3)]}>
          <Ionicons name="phone-portrait" size={24} color="#00C853" style={{alignSelf:'center'}}/>
          <Text style={styles.doText}>Do <Ionicons name="checkmark-circle" size={16} /></Text>
          <Text style={styles.gridCardDesc}>Do Compress Memories Captured on Your Phone</Text>
        </Animated.View>

        <Animated.View style={[styles.gridCard, styles.dontCard, getStyle(4)]}>
          <Ionicons name="sad" size={24} color="#FF4C4C" style={{alignSelf:'center'}}/>
          <Text style={styles.dontText}>Don't <Ionicons name="close-circle" size={16} /></Text>
          <Text style={styles.gridCardDesc}>Don't Compress Low Quality or Blurry Videos</Text>
        </Animated.View>
        
        <Animated.View style={[styles.gridCard, styles.doCard, getStyle(5)]}>
          <Ionicons name="happy" size={24} color="#00C853" style={{alignSelf:'center'}}/>
          <Text style={styles.doText}>Do <Ionicons name="checkmark-circle" size={16} /></Text>
          <Text style={styles.gridCardDesc}>Do Compress High Quality HD Videos</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.warningBanner, getStyle(6)]}>
        <Text style={styles.bannerText}>
          ⚠️ ReginaStatus will not Enhance the original video quality, it will prevent your HD videos from becoming blurry on your status.
        </Text>
      </Animated.View>

      <Animated.View style={[styles.successBanner, getStyle(7)]}>
        <Text style={styles.bannerText}>
          ✅ Observe the difference in quality by uploading the ReginaStatus Compressed video with the Original one on your WhatsApp Status.
        </Text>
      </Animated.View>
    </ScrollView>
  );
};

const Slide3 = ({ isActive, onComplete }: { isActive: boolean, onComplete: () => void }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const spreadAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(spreadAnim, { toValue: 1, friction: 5, useNativeDriver: true })
      ]).start(() => {
        onComplete();
      });
    } else {
      fadeAnim.setValue(0);
      spreadAnim.setValue(0);
    }
  }, [isActive]);

  const leftTransform = [
    { translateX: spreadAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -60] }) },
    { translateY: spreadAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) },
    { rotate: spreadAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-15deg'] }) }
  ];

  const rightTransform = [
    { translateX: spreadAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 60] }) },
    { translateY: spreadAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) },
    { rotate: spreadAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '15deg'] }) }
  ];

  return (
    <Animated.View style={[styles.slide, { opacity: fadeAnim }]}>
      <Header />
      <View style={styles.centeredContent}>
        
        <View style={styles.galleryStackContainer}>
          <Animated.View style={[styles.photoCard, { transform: leftTransform }]}>
            <Ionicons name="image" size={40} color="#FF9800" />
          </Animated.View>
          <Animated.View style={[styles.photoCard, { transform: rightTransform }]}>
            <Ionicons name="film" size={40} color="#4CAF50" />
          </Animated.View>
          <Animated.View style={[styles.photoCard, styles.photoCardCenter]}>
            <Ionicons name="images" size={60} color="#0084FF" />
          </Animated.View>
        </View>

        <Text style={styles.privacyTitle}>Allow ReginaStatus to{"\n"}Access your Gallery...</Text>
        
        <View style={styles.privacyCard}>
          <View style={styles.privacyIconRow}>
            <Ionicons name="shield-checkmark" size={24} color="#00C853" />
            <Text style={styles.privacySubtitle}>Your Privacy is 100% Safe</Text>
          </View>
          <Text style={styles.privacyText}>
            Our app compresses your photos and videos <Text style={styles.boldText}>directly on your device</Text>. 
            We <Text style={styles.boldText}>never</Text> upload or have access to your personal files at any point. 
            Everything stays exclusively on your phone.
          </Text>
        </View>

      </View>
    </Animated.View>
  );
};

export default function OnboardingScreen({ onComplete }: OnboardingProps) {
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNextButton, setShowNextButton] = useState(false);
  const nextButtonAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showNextButton) {
      Animated.spring(nextButtonAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    } else {
      nextButtonAnim.setValue(0);
    }
  }, [showNextButton]);

  const handleAnimationsComplete = () => {
    setShowNextButton(true);
  };

  const nextSlide = async () => {
    if (currentIndex < 2) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      // 1. Ask for Gallery Permissions First
      const galleryStatus = await MediaLibrary.requestPermissionsAsync();
      
      // 2. Ask for Tracking Transparency Permissions (Required for iOS)
      // const trackingStatus = await TrackingTransparency.requestTrackingPermissionsAsync();

      // Proceed to main app (Gallery)
      onComplete(); 
    }
  };

  const renderPagination = () => (
    <View style={styles.pagination}>
      {[0, 1, 2].map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            currentIndex === index ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );

  const renderItem = ({ index }: { index: number }) => {
    switch (index) {
      case 0: return <Slide1 isActive={currentIndex === 0} onComplete={handleAnimationsComplete} />;
      case 1: return <Slide2 isActive={currentIndex === 1} onComplete={handleAnimationsComplete} />;
      case 2: return <Slide3 isActive={currentIndex === 2} onComplete={handleAnimationsComplete} />;
      default: return null;
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
      setShowNextButton(false); // Hide button immediately when slide changes
    }
  }).current;

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={[0, 1, 2]}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={true}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        keyExtractor={(item) => item.toString()}
      />
      
      <View style={styles.bottomBar}>
        <Animated.View style={{ 
          opacity: nextButtonAnim, 
          transform: [{ translateY: nextButtonAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }]
        }}>
          <TouchableOpacity style={styles.nextButton} onPress={nextSlide}>
            <Text style={styles.nextButtonText}>
              {currentIndex === 1 ? "Got it 👍 Next " : "Next "} 
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </Text>
          </TouchableOpacity>
        </Animated.View>
        {renderPagination()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  slide: {
    width,
    flex: 1,
    padding: 20,
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  logoIcon: {
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
  },
  logoTextHD: {
    color: '#FFF',
    fontWeight: 'bold',
    marginRight: 2,
    fontSize: 12,
  },
  logoTitle: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '400',
  },
  slideTitle: {
    color: '#0084FF',
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  
  // Slide 1
  stepsContainer: {
    gap: 20,
  },
  stepCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepTextContainer: {
    flex: 1,
  },
  stepNumber: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 4,
  },
  stepDescription: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '300',
  },
  stepIconPlaceholder: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Slide 2
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  gridCard: {
    width: (width - 52) / 2, // 20 padding each side + 12 gap
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
  },
  dontCard: {
    backgroundColor: '#1E1010', // Dark Tinted Red
    borderColor: 'rgba(255, 76, 76, 0.4)',
    borderWidth: 1,
  },
  doCard: {
    backgroundColor: '#101E14', // Dark Tinted Green
    borderColor: 'rgba(0, 200, 83, 0.4)',
    borderWidth: 1,
  },
  dontText: {
    color: '#FF4C4C',
    fontWeight: '900',
    fontSize: 18,
    marginTop: 8,
    marginBottom: 4,
  },
  doText: {
    color: '#00C853',
    fontWeight: '900',
    fontSize: 18,
    marginTop: 8,
    marginBottom: 4,
  },
  gridCardDesc: {
    color: '#E0E0E0',
    fontSize: 14,
    fontWeight: '500',
  },
  warningBanner: {
    backgroundColor: '#2D2A1C',
    borderColor: 'rgba(255, 215, 0, 0.3)',
    borderWidth: 1,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  successBanner: {
    backgroundColor: '#1C2938',
    borderColor: 'rgba(0, 132, 255, 0.3)',
    borderWidth: 1,
    padding: 16,
    borderRadius: 12,
  },
  bannerText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },

  // Slide 3
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -50,
  },
  galleryStackContainer: {
    height: 120,
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  photoCard: {
    position: 'absolute',
    backgroundColor: '#1C1C1E',
    width: 80,
    height: 100,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  photoCardCenter: {
    width: 100,
    height: 120,
    zIndex: 10,
    backgroundColor: '#2C2C2E',
    borderColor: '#444',
  },
  privacyTitle: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  privacyCard: {
    backgroundColor: '#1C1C1E',
    padding: 24,
    borderRadius: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#333',
  },
  privacyIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  privacySubtitle: {
    color: '#00C853',
    fontSize: 18,
    fontWeight: 'bold',
  },
  privacyText: {
    color: '#A0A0A0',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
  },
  boldText: {
    color: '#FFF',
    fontWeight: 'bold',
  },

  // Bottom Navigation
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  nextButton: {
    backgroundColor: '#0084FF',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  nextButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  pagination: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#0084FF',
  },
  dotInactive: {
    backgroundColor: '#333',
  },
});
