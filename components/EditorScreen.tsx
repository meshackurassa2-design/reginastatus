import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, ScrollView, PanResponder, Image, Switch, LayoutAnimation, TouchableWithoutFeedback } from 'react-native';
import { Video, ResizeMode, Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';

const { width } = Dimensions.get('window');
const scale = width < 380 ? 0.85 : 1;
const TRIMMER_WIDTH = width - 44; // 22 padding on each side

interface EditorScreenProps {
  videoUri: string;
  onDiscard: () => void;
  onSave: (trimmedDurationMillis: number) => void;
}

type EditorMode = 'default' | 'trim' | 'text' | 'music' | 'watermark';
type TextAlign = 'left' | 'center' | 'right';

const availableFonts = Platform.OS === 'ios'
  ? ['System', 'Georgia', 'Palatino', 'Courier', 'Chalkboard SE', 'Marker Felt']
  : ['normal', 'serif', 'monospace', 'sans-serif-condensed'];

const CustomSlider = ({ value, onValueChange, color }: { value: number, onValueChange: (v: number) => void, color: string }) => {
  const sliderWidthRef = useRef(0);
  const startVal = useRef(value);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startVal.current = value; // Capture current value at start of drag
      },
      onPanResponderMove: (e, gestureState) => {
        if (sliderWidthRef.current > 0) {
          // 0.6 friction multiplier to make fine-tuning the volume much slower and easier
          let newVal = startVal.current + ((gestureState.dx * 0.6) / sliderWidthRef.current);
          if (newVal < 0) newVal = 0;
          if (newVal > 1) newVal = 1;
          onValueChange(newVal);
        }
      },
    })
  ).current;

  // Sync ref with current prop value in case it changes externally
  useEffect(() => {
    startVal.current = value;
  }, [value]);

  return (
    <View 
      style={{ flex: 1, height: 40, justifyContent: 'center', marginHorizontal: 15 }} 
      onLayout={(e) => { sliderWidthRef.current = e.nativeEvent.layout.width; }}
      {...panResponder.panHandlers}
    >
      <View style={{ height: 4, backgroundColor: '#555', borderRadius: 2, width: '100%' }} />
      <View style={{ position: 'absolute', height: 4, backgroundColor: color, borderRadius: 2, width: `${value * 100}%` }} pointerEvents="none" />
      <View style={{ position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: color, left: `${value * 100}%`, marginLeft: -11, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, elevation: 4 }} pointerEvents="none" />
    </View>
  );
};

export default function EditorScreen({ videoUri, onDiscard, onSave }: EditorScreenProps) {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [mode, setMode] = useState<EditorMode>('default');
  const [showPlayButton, setShowPlayButton] = useState(false);
  const playButtonTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const changeMode = (newMode: EditorMode) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMode(newMode);
    modeRef.current = newMode;
  };
  
  // Text Edits
  const [text, setText] = useState('');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [textAlign, setTextAlign] = useState<TextAlign>('center');
  const [fontFamily, setFontFamily] = useState('System');
  const [isWatermarkEnabled, setIsWatermarkEnabled] = useState(true);
  const [watermarkName, setWatermarkName] = useState('');
  const [showColors, setShowColors] = useState(false);
  const [showFonts, setShowFonts] = useState(false);
  
  // Music & Volume States
  const [selectedAudio, setSelectedAudio] = useState<string | null>(null);
  const [musicUri, setMusicUri] = useState<string | null>(null);
  const [musicSound, setMusicSound] = useState<Audio.Sound | null>(null);
  const [videoVolume, setVideoVolume] = useState(1.0);
  const [musicVolume, setMusicVolume] = useState(1.0);
  
  const [isTrimmed, setIsTrimmed] = useState(false);
  const [thumbnailTimes, setThumbnailTimes] = useState<number[]>([]);
  
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  
  // Stale closure bypass refs
  const modeRef = useRef<EditorMode>('default');
  const isTrimmedRef = useRef(false);
  const trimStartRef = useRef(0);
  const trimEndRef = useRef(0);
  const musicSoundRef = useRef<Audio.Sound | null>(null);

  // Slider UI positions
  const [trimLeft, setTrimLeft] = useState(0);
  const [trimRight, setTrimRight] = useState(TRIMMER_WIDTH);
  const [playheadX, setPlayheadX] = useState(0);

  // Refs for PanResponder logic
  const durationRef = useRef(0);
  const currentTrimLeft = useRef(0);
  const currentTrimRight = useRef(TRIMMER_WIDTH);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    isTrimmedRef.current = isTrimmed;
  }, [isTrimmed]);

  useEffect(() => {
    musicSoundRef.current = musicSound;
  }, [musicSound]);

  useEffect(() => {
    if (musicSound) {
      musicSound.setVolumeAsync(musicVolume);
    }
  }, [musicVolume, musicSound]);

  useEffect(() => {
    // Cleanup audio when exiting
    return () => {
      if (musicSoundRef.current) {
        musicSoundRef.current.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    if (duration > 0 && durationRef.current === 0) {
      durationRef.current = duration;
      setTrimEnd(duration);
      trimEndRef.current = duration;
    }
  }, [duration]);

  useEffect(() => {
    // Force auto-play imperatively to bypass native player autoplay bugs
    if (videoRef.current) {
      videoRef.current.playAsync();
      setIsPlaying(true);
    }
  }, [videoUri]);

  useEffect(() => {
    if (duration > 0 && thumbnailTimes.length === 0) {
      const numThumbnails = 6;
      const interval = duration / (numThumbnails - 1);
      const times = [];
      for (let i = 0; i < numThumbnails; i++) {
        let time = i * interval;
        if (time <= 0) time = 100;
        if (time >= duration) time = duration - 100;
        times.push(Math.floor(time));
      }
      setThumbnailTimes(times);
    }
  }, [duration]);

  const leftPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        videoRef.current?.pauseAsync();
        musicSoundRef.current?.pauseAsync();
        setIsPlaying(false);
      },
      onPanResponderMove: (e, gestureState) => {
        let newX = currentTrimLeft.current + gestureState.dx;
        if (newX < 0) newX = 0;
        if (newX > trimRight - 40) newX = trimRight - 40; // Ensure handles don't cross
        setTrimLeft(newX);
        if (durationRef.current > 0) {
          videoRef.current?.setPositionAsync((newX / TRIMMER_WIDTH) * durationRef.current);
        }
      },
      onPanResponderRelease: (e, gestureState) => {
        let newX = currentTrimLeft.current + gestureState.dx;
        if (newX < 0) newX = 0;
        if (newX > trimRight - 40) newX = trimRight - 40;
        currentTrimLeft.current = newX;
        const startMillis = (newX / TRIMMER_WIDTH) * durationRef.current;
        setTrimStart(startMillis);
        trimStartRef.current = startMillis;
      }
    })
  ).current;

  const rightPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        videoRef.current?.pauseAsync();
        musicSoundRef.current?.pauseAsync();
        setIsPlaying(false);
      },
      onPanResponderMove: (e, gestureState) => {
        let newX = currentTrimRight.current + gestureState.dx;
        if (newX > TRIMMER_WIDTH) newX = TRIMMER_WIDTH;
        if (newX < trimLeft + 40) newX = trimLeft + 40;
        setTrimRight(newX);
        if (durationRef.current > 0) {
          videoRef.current?.setPositionAsync((newX / TRIMMER_WIDTH) * durationRef.current);
        }
      },
      onPanResponderRelease: (e, gestureState) => {
        let newX = currentTrimRight.current + gestureState.dx;
        if (newX > TRIMMER_WIDTH) newX = TRIMMER_WIDTH;
        if (newX < trimLeft + 40) newX = trimLeft + 40;
        currentTrimRight.current = newX;
        const endMillis = (newX / TRIMMER_WIDTH) * durationRef.current;
        setTrimEnd(endMillis);
        trimEndRef.current = endMillis;
      }
    })
  ).current;


  const togglePlayPause = async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
      if (musicSound) await musicSound.pauseAsync();
      setShowPlayButton(true);
      if (playButtonTimeoutRef.current) clearTimeout(playButtonTimeoutRef.current);
    } else {
      await videoRef.current.playAsync();
      if (musicSound) await musicSound.playAsync();
      
      // Auto-hide after playing
      setShowPlayButton(true);
      if (playButtonTimeoutRef.current) clearTimeout(playButtonTimeoutRef.current);
      playButtonTimeoutRef.current = setTimeout(() => {
        setShowPlayButton(false);
      }, 2000);
    }
    setIsPlaying(!isPlaying);
  };
  
  const handleVideoTap = () => {
    if (mode === 'default') {
      setShowPlayButton(true);
      if (playButtonTimeoutRef.current) clearTimeout(playButtonTimeoutRef.current);
      playButtonTimeoutRef.current = setTimeout(() => {
        setShowPlayButton(false);
      }, 2000);
    }
  };

  const pickMusic = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
      if (!result.canceled) {
        const uri = result.assets[0].uri;
        const name = result.assets[0].name;
        
        setSelectedAudio(name);
        setMusicUri(uri);
        
        if (musicSound) {
          await musicSound.unloadAsync();
        }
        
        const { sound } = await Audio.Sound.createAsync({ uri });
        await sound.setVolumeAsync(musicVolume);
        setMusicSound(sound);
        
        // Ensure video is playing so music also plays
        if (!isPlaying) {
          await videoRef.current?.playAsync();
          setIsPlaying(true);
        }
        await sound.playAsync();
        
        changeMode('music');
      }
    } catch (err) {
      console.warn("Failed to pick music", err);
    }
  };

  const applyTrim = () => {
    setIsTrimmed(true);
    changeMode('default');
  };

  const cycleAlignment = () => {
    setTextAlign(prev => prev === 'center' ? 'left' : prev === 'left' ? 'right' : 'center');
  };

  const toggleColors = () => {
    setShowColors(!showColors);
    setShowFonts(false);
  };

  const toggleFonts = () => {
    setShowFonts(!showFonts);
    setShowColors(false);
  };

  const renderTrimOverlay = () => (
    <View style={styles.trimContainer}>
      <View style={styles.trimmerBoxBase}>
        {/* Real Video Thumbnails rendered via paused Video components to guarantee decoding */}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', overflow: 'hidden', backgroundColor: '#333' }}>
          {thumbnailTimes.length > 0 ? (
            thumbnailTimes.map((time, index) => (
              <Video 
                key={index} 
                source={{ uri: videoUri }} 
                positionMillis={time}
                shouldPlay={false}
                isMuted={true}
                resizeMode={ResizeMode.COVER}
                style={{ flex: 1, height: '100%' }} 
              />
            ))
          ) : null}
        </View>
        
        {/* Live Playhead Line */}
        <View style={{
          position: 'absolute',
          left: playheadX,
          top: -5,
          bottom: -5,
          width: 3,
          backgroundColor: '#FFF',
          borderRadius: 2,
          shadowColor: '#FFF',
          shadowOpacity: 0.8,
          shadowRadius: 4,
          elevation: 5,
        }} />

        <View style={[styles.trimmerHighlight, { left: trimLeft, width: trimRight - trimLeft }]}>
          <View {...leftPanResponder.panHandlers} style={styles.trimmerHandle}>
            <View style={styles.handleLine} />
          </View>
          <View {...rightPanResponder.panHandlers} style={styles.trimmerHandle}>
            <View style={styles.handleLine} />
          </View>
        </View>
      </View>
    </View>
  );

  const renderTextUI = () => (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.textOverlayContainer}
    >
      <View style={styles.textTopBar}>
        <TouchableOpacity style={styles.doneButton} onPress={() => { changeMode('default'); setShowColors(false); setShowFonts(false); }}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.textMiddleArea}>
        <View style={styles.verticalSlider}>
          <View style={styles.sliderTrack} />
          <View style={styles.sliderThumb} />
        </View>

        <TextInput
          style={[styles.textInputMain, { 
            color: textColor, 
            textAlign: textAlign,
            fontFamily: fontFamily === 'System' ? undefined : fontFamily 
          }]}
          value={text}
          onChangeText={setText}
          autoFocus
          placeholder="Type here..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          multiline
        />
      </View>

      <View style={styles.textBottomTools}>
        {showColors && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorPickerRow}>
            {['#000000', '#FFFFFF', '#FF3B30', '#32CD32', '#0084FF', '#FFD700', '#FF9500', '#A020F0'].map(color => (
              <TouchableOpacity 
                key={color} 
                onPress={() => setTextColor(color)}
                style={[
                  styles.colorCircle, 
                  { backgroundColor: color, borderWidth: color === '#000000' || color === '#FFFFFF' ? 1 : 0, borderColor: '#555' }
                ]} 
              />
            ))}
          </ScrollView>
        )}
        
        {showFonts && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorPickerRow}>
            {availableFonts.map(font => (
              <TouchableOpacity 
                key={font} 
                onPress={() => setFontFamily(font)}
                style={[
                  styles.fontPill, 
                  { borderColor: fontFamily === font ? '#32CD32' : '#555' }
                ]} 
              >
                <Text style={{ color: '#FFF', fontFamily: font === 'System' ? undefined : font }}>{font}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <BlurView intensity={90} tint="dark" style={styles.textFormatPill}>
           <TouchableOpacity onPress={toggleFonts}>
             <Text style={styles.formatIconAa}>Aa</Text>
           </TouchableOpacity>
           
           <TouchableOpacity onPress={toggleColors}>
             <View style={[styles.colorCircle, { width: 22, height: 22, backgroundColor: textColor, borderWidth: 1, borderColor: '#555' }]} />
           </TouchableOpacity>
           
           <TouchableOpacity onPress={cycleAlignment}>
             <Ionicons 
               name={textAlign === 'center' ? 'menu' : textAlign === 'left' ? 'reorder-four' : 'reorder-four-outline'} 
               size={24} 
               color="#FFF" 
             />
           </TouchableOpacity>
        </BlurView>
      </View>
    </KeyboardAvoidingView>
  );

  return (
    <View style={styles.container}>
      
      {/* Video Preview Container */}
      <TouchableWithoutFeedback onPress={handleVideoTap}>
        <View style={styles.videoContainer}>
          <Video
            ref={videoRef}
            source={{ uri: videoUri }}
          style={styles.videoPlayer}
          resizeMode={ResizeMode.COVER}
          shouldPlay={true}
          volume={videoVolume}
          isLooping={mode === 'trim'} // Only loop natively if we want, but we enforce bounds below
          progressUpdateIntervalMillis={50}
          onPlaybackStatusUpdate={status => {
            if (status.isLoaded) {
              setIsPlaying(status.isPlaying);
              setIsReady(true);
              if (duration === 0 && status.durationMillis) {
                setDuration(status.durationMillis);
              }

              // Update playhead position
              if (durationRef.current > 0) {
                setPlayheadX((status.positionMillis / durationRef.current) * TRIMMER_WIDTH);
              }

              // Check if video naturally finished and needs to loop back to trim start
              if (status.didJustFinish) {
                videoRef.current?.setPositionAsync(trimStartRef.current);
                videoRef.current?.playAsync();
                musicSoundRef.current?.setPositionAsync(0);
                musicSoundRef.current?.playAsync();
                return;
              }

              // Enforce trim loop bounds using live refs to avoid stale closures
              if (status.isPlaying && (modeRef.current === 'trim' || isTrimmedRef.current)) {
                if (status.positionMillis >= trimEndRef.current) {
                  videoRef.current?.setPositionAsync(trimStartRef.current);
                  musicSoundRef.current?.setPositionAsync(0);
                }
              }
            }
          }}
        />
        
        {!isReady && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0084FF" />
          </View>
        )}

        {/* Persisted Applied Text (Only visible in default/trim/music modes if text exists) */}
        {mode !== 'text' && text.length > 0 && (
          <View style={styles.appliedTextContainer} pointerEvents="none">
            <Text style={[styles.appliedTextMain, { 
              color: textColor, 
              textAlign: textAlign,
              fontFamily: fontFamily === 'System' ? undefined : fontFamily 
            }]}>{text}</Text>
          </View>
        )}

        {/* Watermark Overlay (Bottom Right) ALWAYS VISIBLE */}
        <View style={styles.watermarkContainer} pointerEvents="none">
          <View style={styles.watermarkRow}>
            <View style={styles.watermarkHDBadge}>
              <Text style={styles.watermarkHDText}>HD</Text>
            </View>
            <Text style={styles.watermarkTitle}>ReginaStatus</Text>
          </View>
          <Text style={styles.watermarkSubtitle}>Upload Status in Full HD</Text>
          {watermarkName ? (
            <Text style={styles.watermarkNameText}>by {watermarkName}</Text>
          ) : null}
        </View>

        {/* Text Mode Darkening */}
        {mode === 'text' && <View style={styles.darkOverlay} />}
        
        {/* Play Button Overlay (Only in default mode) */}
        {mode === 'default' && (!isPlaying || showPlayButton) && (
          <TouchableOpacity 
            style={styles.playButton} 
            activeOpacity={0.8}
            onPress={togglePlayPause}
          >
            <Ionicons 
              name={isPlaying ? "pause" : "play"} 
              size={32} 
              color="#FFF" 
              style={{ marginLeft: isPlaying ? 0 : 4 }} 
            />
          </TouchableOpacity>
        )}

        {/* Indicator for Music */}
        {selectedAudio && (mode === 'default' || mode === 'music') && (
          <TouchableOpacity style={styles.musicIndicator} onPress={() => changeMode('music')}>
            <Ionicons name="musical-notes" size={16} color="#00E676" />
            <Text style={styles.musicIndicatorText} numberOfLines={1}>{selectedAudio}</Text>
          </TouchableOpacity>
        )}
        </View>
      </TouchableWithoutFeedback>

      {/* Absolute Text UI */}
      {mode === 'text' && renderTextUI()}

      {/* Bottom Controls */}
      {mode === 'default' && (
        <View style={styles.bottomControlsContainer}>
          {/* Edit Tools Pill */}
          <BlurView intensity={80} tint="dark" style={styles.toolsPill}>
            <TouchableOpacity style={styles.toolButton} onPress={() => changeMode('trim')}>
              <Ionicons name="cut" size={24 * scale} color="#FF69B4" />
              <Text style={[styles.toolText, { fontSize: 11 * scale }]}>Trim</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.toolButton} onPress={pickMusic}>
              <Ionicons name="musical-notes" size={24 * scale} color="#00E676" />
              <Text style={[styles.toolText, { fontSize: 11 * scale }]}>Music</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.toolButton} onPress={() => changeMode('text')}>
              <View style={[styles.textIconContainer, { width: 24 * scale, height: 24 * scale }]}>
                <Text style={[styles.textIconLetter, { fontSize: 16 * scale, lineHeight: 18 * scale }]}>T</Text>
              </View>
              <Text style={[styles.toolText, { fontSize: 11 * scale }]}>Text</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.toolButton} onPress={() => changeMode('watermark')}>
              <Ionicons name="water" size={24 * scale} color="#0084FF" />
              <Text style={[styles.toolText, { fontSize: 11 * scale }]}>Brand</Text>
            </TouchableOpacity>
          </BlurView>

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={onDiscard}>
              <View style={[styles.actionIconCircle, { backgroundColor: '#FF3B30' }]}>
                <Ionicons name="close" size={20 * scale} color="#FFF" />
              </View>
              <Text style={[styles.actionText, { color: '#FF3B30', fontSize: 11 * scale }]}>Discard</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => onSave(trimEnd - trimLeft)}>
              <View style={[styles.actionIconCircle, { backgroundColor: '#32CD32' }]}>
                <Ionicons name="checkmark" size={20 * scale} color="#FFF" />
              </View>
              <Text style={[styles.actionText, { color: '#32CD32', fontSize: 11 * scale }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Music Mode Controls (Audio Mixing) */}
      {mode === 'music' && (
        <View style={styles.musicOverlay}>
          
          <View style={styles.sliderRow}>
            <Ionicons name="videocam" size={24} color="#FFF" />
            <CustomSlider
              value={videoVolume}
              onValueChange={async (val) => {
                setVideoVolume(val);
                await videoRef.current?.setVolumeAsync(val);
              }}
              color="#0084FF"
            />
            <Text style={styles.volumeText}>{Math.round(videoVolume * 100)}%</Text>
          </View>
          
          <View style={styles.sliderRow}>
            <Ionicons name="musical-notes" size={24} color="#00E676" />
            <CustomSlider
              value={musicVolume}
              onValueChange={async (val) => {
                setMusicVolume(val);
                await musicSound?.setVolumeAsync(val);
              }}
              color="#00E676"
            />
            <Text style={styles.volumeText}>{Math.round(musicVolume * 100)}%</Text>
          </View>

          <View style={styles.trimActionContainer}>
             <TouchableOpacity style={styles.actionButton} onPress={pickMusic}>
               <BlurView intensity={80} tint="light" style={[styles.actionIconCircle, { backgroundColor: 'rgba(255, 149, 0, 0.4)' }]}>
                 <Ionicons name="musical-notes" size={22 * scale} color="#FFF" />
               </BlurView>
               <Text style={[styles.actionText, { color: '#FF9500', fontSize: 12 * scale }]}>Change</Text>
             </TouchableOpacity>

             <TouchableOpacity style={styles.actionButton} onPress={() => changeMode('default')}>
               <BlurView intensity={80} tint="light" style={[styles.actionIconCircle, { backgroundColor: 'rgba(50, 205, 50, 0.4)' }]}>
                 <Ionicons name="checkmark" size={22 * scale} color="#FFF" />
               </BlurView>
               <Text style={[styles.actionText, { color: '#32CD32', fontSize: 12 * scale }]}>Done</Text>
             </TouchableOpacity>
          </View>

        </View>
      )}

      {/* Watermark Mode Controls */}
      {mode === 'watermark' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.watermarkControlsOverlay}>
            <View style={styles.watermarkSwitchRow}>
              <Text style={styles.watermarkConfigTitle}>Custom Watermark Name</Text>
            </View>
          
            <TextInput
              style={styles.watermarkInput}
              placeholder="Add your name (optional)"
              placeholderTextColor="#666"
              value={watermarkName}
              onChangeText={setWatermarkName}
              maxLength={20}
              autoCorrect={false}
            />

            <View style={styles.trimActionContainer}>
               <TouchableOpacity style={styles.actionButton} onPress={() => changeMode('default')}>
                 <BlurView intensity={80} tint="light" style={[styles.actionIconCircle, { backgroundColor: 'rgba(50, 205, 50, 0.4)' }]}>
                   <Ionicons name="checkmark" size={22 * scale} color="#FFF" />
                 </BlurView>
                 <Text style={[styles.actionText, { color: '#32CD32', fontSize: 12 * scale }]}>Done</Text>
               </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Trim Mode Action Buttons (Glassmorphic) */}
      {mode === 'trim' && (
        <View style={{ paddingHorizontal: 22 }}>
          {renderTrimOverlay()}
          
          <View style={styles.trimActionContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={togglePlayPause}>
              <BlurView intensity={80} tint="light" style={[styles.actionIconCircle, { backgroundColor: 'rgba(0, 132, 255, 0.4)' }]}>
                <Ionicons name={isPlaying ? "pause" : "play"} size={22 * scale} color="#FFF" style={{ marginLeft: isPlaying ? 0 : 3 }} />
              </BlurView>
              <Text style={[styles.actionText, { color: '#0084FF', fontSize: 12 * scale }]}>Play</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => changeMode('default')}>
              <BlurView intensity={80} tint="light" style={[styles.actionIconCircle, { backgroundColor: 'rgba(255, 149, 0, 0.4)' }]}>
                <Ionicons name="close" size={22 * scale} color="#FFF" />
              </BlurView>
              <Text style={[styles.actionText, { color: '#FF9500', fontSize: 12 * scale }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={applyTrim}>
              <BlurView intensity={80} tint="light" style={[styles.actionIconCircle, { backgroundColor: 'rgba(50, 205, 50, 0.4)' }]}>
                <Ionicons name="checkmark" size={22 * scale} color="#FFF" />
              </BlurView>
              <Text style={[styles.actionText, { color: '#32CD32', fontSize: 12 * scale }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#161616', // Dark gray/black background from screenshot
    paddingTop: 50, // Hardcoded top padding prevents notch clipping on all iOS devices
  },
  videoContainer: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 20,
    borderRadius: 45, // Huge border radius seen in screenshot
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)', // Darkens video when typing
  },
  playButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64 * scale,
    height: 64 * scale,
    borderRadius: 32 * scale,
    backgroundColor: '#0084FF', // Bright blue play button
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  
  // Default Mode Bottom Controls
  bottomControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 24, // Enough padding for bottom bezel
  },
  toolsPill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 30, 30, 0.5)', // Translucent glass base
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12 * scale, // increased gap slightly since stickers is gone
    overflow: 'hidden', // Essential for BlurView corners
  },
  toolButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40 * scale,
  },
  toolText: {
    color: '#FFF',
    fontWeight: 'bold',
    marginTop: 6,
  },
  textIconContainer: {
    borderWidth: 2,
    borderColor: '#FFD700',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textIconLetter: {
    color: '#FFD700',
    fontWeight: 'bold',
  },

  // Action Buttons (Shared)
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 8 * scale,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconCircle: {
    width: 36 * scale,
    height: 36 * scale,
    borderRadius: 20 * scale,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionText: {
    fontWeight: 'bold',
  },

  // Trim Mode
  trimActionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32 * scale,
    paddingBottom: 30,
  },
  trimContainer: {
    height: 54,
    marginBottom: 20,
    width: '100%',
  },
  trimmerBoxBase: {
    flex: 1,
    height: 60,
    backgroundColor: 'rgba(50,50,50,0.5)',
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  trimmerHighlight: {
    position: 'absolute',
    height: '100%',
    borderWidth: 3,
    borderColor: '#32CD32',
    backgroundColor: 'rgba(50, 205, 50, 0.2)',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trimmerHandle: {
    width: 22,
    backgroundColor: '#32CD32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  handleLine: {
    width: 4,
    height: 20,
    backgroundColor: '#FFF',
    borderRadius: 2,
  },
  trimmerFilmstrip: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filmstripText: {
    color: 'rgba(255,255,255,0.5)',
    fontWeight: 'bold',
  },

  // Text Mode UI
  textOverlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  textTopBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  doneButton: {
    backgroundColor: '#0084FF',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  doneText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  textMiddleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verticalSlider: {
    position: 'absolute',
    left: 20,
    height: 200,
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderTrack: {
    position: 'absolute',
    width: 2,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  sliderThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFF',
  },
  textInputMain: {
    color: '#FFF',
    fontSize: 48,
    fontWeight: 'bold',
    width: '70%',
    textAlign: 'center',
  },
  textBottomTools: {
    paddingBottom: 20,
  },
  colorPickerRow: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  colorCircleClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  textFormatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(50,50,50,0.6)',
    alignSelf: 'center',
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 24,
    overflow: 'hidden',
  },
  formatIconAa: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },

  // Persistent Overlay Styles
  appliedTextContainer: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  appliedTextMain: {
    color: '#FFF',
    fontSize: 48,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
  },
  
  // Watermark
  watermarkContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    alignItems: 'flex-end',
  },
  watermarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  watermarkHDBadge: {
    backgroundColor: '#FFF',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 4,
  },
  watermarkHDText: {
    color: '#000',
    fontSize: 7,
    fontWeight: '900',
  },
  watermarkTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  watermarkSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 8,
    fontWeight: '600',
  },
  watermarkNameText: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 2,
  },
  watermarkControlsOverlay: {
    paddingHorizontal: 22,
    paddingBottom: 20,
  },
  watermarkSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  watermarkConfigTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  watermarkInput: {
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    color: '#FFF',
    padding: 16,
    borderRadius: 16,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  musicIndicator: {
    position: 'absolute',
    top: 24,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    maxWidth: 200,
    zIndex: 10, // Ensure it's clickable above the video
  },
  musicIndicatorText: {
    color: '#00E676',
    fontSize: 12 * scale,
    fontWeight: 'bold',
  },
  musicOverlay: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 24,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  volumeText: {
    color: '#FFF',
    fontSize: 14 * scale,
    fontWeight: 'bold',
    minWidth: 50,
    textAlign: 'right',
  },
  fontPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(50,50,50,0.8)',
    borderWidth: 1,
  },
});
