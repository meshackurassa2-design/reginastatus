import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, Dimensions, ActivityIndicator, Modal, ScrollView, LayoutAnimation, UIManager, Platform, Animated, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 4;
const itemSize = width / COLUMN_COUNT;

interface GalleryScreenProps {
  onSelectMedia: (uris: string[], type: 'video' | 'photo') => void;
}

export default function GalleryScreen({ onSelectMedia }: GalleryScreenProps) {
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [albums, setAlbums] = useState<MediaLibrary.Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<MediaLibrary.Album | null>(null);
  const [showAlbums, setShowAlbums] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsView, setSettingsView] = useState<'main' | 'faq' | 'privacy'>('main');
  const [loading, setLoading] = useState(true);
  const [mediaType, setMediaType] = useState<'video' | 'photo'>('video');
  const [isScrolled, setIsScrolled] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [defaultWatermark, setDefaultWatermark] = useState('');

  const scrollAnim = React.useRef(new Animated.Value(1)).current;

  const insets = { top: 50, bottom: 30 }; 

  useEffect(() => {
    fetchAlbums();
    AsyncStorage.getItem('@default_watermark').then(val => {
      if (val) setDefaultWatermark(val);
    });
  }, []);

  useEffect(() => {
    fetchMedia();
  }, [mediaType, selectedAlbum]);

  const fetchAlbums = async () => {
    try {
      const result = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
      setAlbums(result);
    } catch (err) {
      console.warn("Error fetching albums:", err);
    }
  };

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: mediaType === 'video' ? [MediaLibrary.MediaType.video] : [MediaLibrary.MediaType.photo],
        first: 80,
        sortBy: [MediaLibrary.SortBy.creationTime],
        album: selectedAlbum ? selectedAlbum.id : undefined,
      });
      setAssets(result.assets);
    } catch (err) {
      console.warn("Error fetching media:", err);
    }
    setLoading(false);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const paddedSecs = secs < 10 ? `0${secs}` : secs;
    if (mins === 0) return `:${paddedSecs}`;
    return `${mins}:${paddedSecs}`;
  };

  const handleScroll = () => {
    // Scroll animation removed per user request
    if (!isScrolled) setIsScrolled(true);
  };
  
  const handleContactAdmin = () => {
    import('react-native').then(({ Linking }) => {
      Linking.openURL('whatsapp://send?phone=+255765450573').catch(() => {
        alert('Make sure WhatsApp is installed on your device.');
      });
    });
  };

  const Header = () => (
    <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
      <View style={styles.headerLeft}>
        <BlurView intensity={90} tint="dark" style={[styles.glassPill, isScrolled && { paddingRight: 6 }]}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoTextHD}>HD</Text>
            <Ionicons name="videocam" size={16} color="#FFF" />
          </View>
          
          <View style={styles.titleContainer}>
            <Text style={styles.logoTitle} numberOfLines={1}>ReginaStatus</Text>
            {selectedAlbum && (
              <Text style={styles.albumSubtitle} numberOfLines={1}>{selectedAlbum.title}</Text>
            )}
          </View>
        </BlurView>
      </View>
      
      <BlurView intensity={90} tint="dark" style={styles.glassCircleRight}>
        <TouchableOpacity style={styles.menuButton} onPress={() => { setSettingsView('main'); setShowSettings(true); }}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#FFF" />
        </TouchableOpacity>
      </BlurView>
    </View>
  );

  const renderItem = ({ item }: { item: MediaLibrary.Asset }) => {
    const isSelected = selectedPhotos.includes(item.uri);
    return (
      <TouchableOpacity 
        style={styles.gridItem} 
        onPress={async () => {
          if (mediaType === 'photo') {
            setSelectedPhotos(prev => {
              if (prev.includes(item.uri)) return prev.filter(uri => uri !== item.uri);
              if (prev.length >= 10) {
                alert('You can only select up to 10 photos at a time.');
                return prev;
              }
              return [...prev, item.uri];
            });
            return;
          }
          
          setLoading(true);
          try {
            const info = await MediaLibrary.getAssetInfoAsync(item.id);
            onSelectMedia([info.localUri || info.uri], mediaType);
          } catch (e) {
            console.warn("Failed to load local URI", e);
            onSelectMedia([item.uri], mediaType);
          }
          setLoading(false);
        }}
        activeOpacity={0.7}
      >
        <Image source={{ uri: item.uri }} style={styles.thumbnail} contentFit="cover" transition={200} />
        {mediaType === 'video' && (
          <View style={styles.durationOverlay}>
            <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
          </View>
        )}
        {mediaType === 'photo' && isSelected && (
          <View style={styles.selectedOverlay}>
            <Ionicons name="checkmark-circle" size={24} color="#0084FF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#32CD32" />
        </View>
      ) : (
        <FlatList
          data={assets}
          numColumns={COLUMN_COUNT}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 70 }]}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No {mediaType}s found in this album.</Text>
            </View>
          }
        />
      )}

      {/* Floating Header */}
      <Header />

      {/* Floating Bottom Tab Bar (Left side) */}
      <View style={styles.tabBarWrapper}>
        <BlurView intensity={90} tint="dark" style={styles.tabBar}>
          <TouchableOpacity 
            style={[styles.tabItem, mediaType === 'video' && styles.tabItemActiveVideo]} 
            onPress={() => { setMediaType('video'); setSelectedPhotos([]); }}
          >
            <Ionicons name="videocam" size={20} color={mediaType === 'video' ? '#32CD32' : '#888'} />
            <Text style={[styles.tabText, mediaType === 'video' ? styles.tabTextActive : null]}>Videos</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabItem, mediaType === 'photo' && styles.tabItemActivePhoto]} 
            onPress={() => { setMediaType('photo'); setSelectedPhotos([]); }}
          >
            <Ionicons name="image" size={20} color={mediaType === 'photo' ? '#FFF' : '#888'} />
            <Text style={[styles.tabText, mediaType === 'photo' ? styles.tabTextActivePhotoText : null]}>Photos</Text>
          </TouchableOpacity>
        </BlurView>
      </View>

      {/* Floating Stack Icon (Albums - Right side) */}
      <View style={styles.fabContainer}>
        <BlurView intensity={90} tint="dark" style={styles.fabBlur}>
          <TouchableOpacity style={styles.fabButton} onPress={() => setShowAlbums(true)}>
            <Ionicons name="albums-outline" size={24} color="#FFF" />
          </TouchableOpacity>
        </BlurView>
      </View>

      {/* Floating Next Button for Photo Selection */}
      {mediaType === 'photo' && selectedPhotos.length > 0 && (
        <View style={styles.nextButtonContainer}>
          <TouchableOpacity 
            style={styles.nextButton} 
            onPress={() => onSelectMedia(selectedPhotos, 'photo')}
            activeOpacity={0.8}
          >
            <Text style={styles.nextButtonText}>Next ({selectedPhotos.length})</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Albums Modal */}
      <Modal visible={showAlbums} animationType="slide" transparent={true}>
        <BlurView intensity={100} tint="dark" style={styles.modalContainer}>
          <View style={{ flex: 1, paddingTop: insets.top }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Album</Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowAlbums(false)}>
                <Ionicons name="close" size={28} color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.albumsList}>
              <TouchableOpacity 
                style={styles.albumItem} 
                onPress={() => { setSelectedAlbum(null); setShowAlbums(false); }}
              >
                <Text style={[styles.albumName, !selectedAlbum && styles.albumNameActive]}>All Media</Text>
                {!selectedAlbum && <Ionicons name="checkmark" size={20} color="#32CD32" />}
              </TouchableOpacity>
              
              {albums.filter(a => a.assetCount > 0).map(album => (
                <TouchableOpacity 
                  key={album.id} 
                  style={styles.albumItem} 
                  onPress={() => { setSelectedAlbum(album); setShowAlbums(false); }}
                >
                  <Text style={[styles.albumName, selectedAlbum?.id === album.id && styles.albumNameActive]}>
                    {album.title} <Text style={styles.albumCount}>({album.assetCount})</Text>
                  </Text>
                  {selectedAlbum?.id === album.id && <Ionicons name="checkmark" size={20} color="#32CD32" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </BlurView>
      </Modal>

      {/* Unified Settings Modal */}
      <Modal visible={showSettings} animationType="fade" transparent={true}>
        <BlurView intensity={95} tint="dark" style={styles.modalContainer}>
          <View style={styles.settingsContent}>
            <View style={[styles.modalHeader, { paddingTop: insets.top }]}>
              {settingsView !== 'main' && (
                <TouchableOpacity onPress={() => setSettingsView('main')} style={{ marginRight: 16 }}>
                  <Ionicons name="arrow-back" size={28} color="#FFF" />
                </TouchableOpacity>
              )}
              <Text style={[styles.modalTitle, { flex: 1 }]}>
                {settingsView === 'main' ? 'Settings' : settingsView === 'faq' ? 'FAQs' : 'Privacy Policy'}
              </Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={28} color="#FFF" />
              </TouchableOpacity>
            </View>
            
            {settingsView === 'main' && (
              <ScrollView style={styles.settingsList}>
                <TouchableOpacity style={styles.settingsItem} onPress={() => setSettingsView('faq')}>
                  <Ionicons name="help-circle-outline" size={24} color="#FFF" />
                  <Text style={styles.settingsItemText}>FAQs</Text>
                  <Ionicons name="chevron-forward" size={20} color="#555" />
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.settingsItem} onPress={() => setSettingsView('privacy')}>
                  <Ionicons name="shield-checkmark-outline" size={24} color="#FFF" />
                  <Text style={styles.settingsItemText}>Privacy Policy</Text>
                  <Ionicons name="chevron-forward" size={20} color="#555" />
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.settingsItem} onPress={handleContactAdmin}>
                  <Ionicons name="chatbubbles-outline" size={24} color="#32CD32" />
                  <Text style={[styles.settingsItemText, { color: '#32CD32' }]}>Contact Admin (Bugs/Ideas)</Text>
                  <Ionicons name="logo-whatsapp" size={20} color="#32CD32" />
                </TouchableOpacity>
                
                <View style={styles.settingsDivider} />
                
                <Text style={styles.settingsLabel}>Default Watermark</Text>
                <TextInput
                  style={styles.settingsInput}
                  placeholder="Enter your name/brand..."
                  placeholderTextColor="#888"
                  value={defaultWatermark}
                  onChangeText={(text) => {
                    setDefaultWatermark(text);
                    AsyncStorage.setItem('@default_watermark', text);
                  }}
                />

                <View style={styles.settingsDivider} />

                <View style={styles.settingsInfoBlock}>
                  <Text style={styles.settingsInfoLabel}>Developer</Text>
                  <Text style={styles.settingsInfoValue}>Dapaz Company</Text>
                </View>
              </ScrollView>
            )}

            {settingsView === 'faq' && (
              <ScrollView style={{ paddingHorizontal: 24, paddingTop: 20 }}>
                <Text style={styles.faqQuestion}>Why use PureStatus?</Text>
                <Text style={styles.faqAnswer}>It bypasses WhatsApp's aggressive compression limits so your videos stay crisp and HD.</Text>
                
                <Text style={styles.faqQuestion}>Is it safe to use?</Text>
                <Text style={styles.faqAnswer}>Yes! Our app uses safe, local lossless compression and passes it directly to your native WhatsApp app without logging into your account.</Text>
              </ScrollView>
            )}

            {settingsView === 'privacy' && (
              <ScrollView style={{ paddingHorizontal: 24, paddingTop: 20 }}>
                <Text style={styles.privacyText}>
                  1. Data Collection{'\n'}
                  We do not collect or store your media files on our servers. All video compression happens locally on your device.{'\n\n'}
                  2. Data Sharing{'\n'}
                  We do not sell or share any of your personal data or phone number with third parties.{'\n\n'}
                  3. Third Party Services{'\n'}
                  Our app passes your media safely to WhatsApp, governed by Meta's privacy policies.
                </Text>
              </ScrollView>
            )}

          </View>
        </BlurView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  glassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    paddingRight: 16,
    borderRadius: 30,
    backgroundColor: 'rgba(20, 20, 20, 0.25)', // More clear glass
    overflow: 'hidden',
  },
  glassCircle: {
    padding: 6,
    borderRadius: 30,
    backgroundColor: 'rgba(20, 20, 20, 0.25)', // More clear glass
    overflow: 'hidden',
  },
  glassCircleRight: {
    borderRadius: 30,
    backgroundColor: 'rgba(20, 20, 20, 0.25)', // More clear glass
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {
    backgroundColor: '#32CD32',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 20, // Circular inner logo
  },
  logoTextHD: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 10,
    marginRight: 2,
  },
  titleContainer: {
    marginLeft: 12,
  },
  logoTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: -0.5,
  },
  albumSubtitle: {
    color: '#32CD32',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: -2,
  },
  menuButton: {
    padding: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingTop: 100,
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
  },
  listContent: {
    paddingBottom: 120, // Space for bottom tab bar
  },
  gridItem: {
    width: itemSize,
    height: itemSize * 1.5, // 2:3 aspect ratio
    padding: 0.5, // 1px gap
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#111',
  },
  durationOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
  },
  durationText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  
  // Tab Bar (Left side)
  tabBarWrapper: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    alignItems: 'flex-start',
    zIndex: 5,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 40,
    padding: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(20, 20, 20, 0.25)', // More clear glass
  },
  tabItem: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 30,
    minWidth: 70,
  },
  tabItemActiveVideo: {
    backgroundColor: 'rgba(50, 205, 50, 0.25)', // Slightly stronger green tint
  },
  tabItemActivePhoto: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  tabText: {
    color: '#DDD',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  tabTextActive: {
    color: '#32CD32',
  },
  tabTextActivePhotoText: {
    color: '#FFF',
  },

  // Floating Action Button (Right side)
  fabContainer: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    borderRadius: 28,
    overflow: 'hidden',
    zIndex: 10,
  },
  fabBlur: {
    width: 56,
    height: 56,
    backgroundColor: 'rgba(20, 20, 20, 0.25)', // More clear glass
  },
  fabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Albums Modal
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: 4,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0084FF',
  },
  nextButtonContainer: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    zIndex: 10,
  },
  nextButton: {
    backgroundColor: '#0084FF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  nextButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  albumsList: {
    padding: 24,
  },
  albumItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  albumName: {
    color: '#CCC',
    fontSize: 18,
  },
  albumNameActive: {
    color: '#32CD32',
    fontWeight: 'bold',
  },
  albumCount: {
    color: '#666',
    fontSize: 16,
  },
  settingsContent: {
    flex: 1,
  },
  settingsList: {
    flex: 1,
    paddingHorizontal: 24,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  settingsItemText: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    marginLeft: 16,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 16,
  },
  settingsLabel: {
    color: '#888',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  settingsInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFF',
    fontSize: 16,
  },
  settingsInfoBlock: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  settingsInfoLabel: {
    color: '#888',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 0,
  },
  settingsInfoValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#32CD32',
    marginLeft: 8,
    marginRight: 4,
  },
  statusActiveText: {
    color: '#32CD32',
    fontSize: 12,
    fontWeight: 'bold',
  },
  faqQuestion: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 16,
  },
  faqAnswer: {
    color: '#CCC',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  privacyText: {
    color: '#CCC',
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 40,
  }
});
