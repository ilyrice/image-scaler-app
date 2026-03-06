import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  Text,
  View,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components/screen-container';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface PickedImage {
  uri: string;
  width: number;
  height: number;
  size: number;
}

interface ScaledImage {
  uri: string;
  width: number;
  height: number;
  originalSize: number;
  newSize: number;
}

const styles = StyleSheet.create({
  primaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonPressed: {
    opacity: 0.8,
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  secondaryButtonPressed: {
    opacity: 0.7,
  },
});

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const [selectedImage, setSelectedImage] = useState<PickedImage | null>(null);
  const [scaledImage, setScaledImage] = useState<ScaledImage | null>(null);
  const [targetWidth, setTargetWidth] = useState('800');
  const [targetHeight, setTargetHeight] = useState('600');
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [isScaling, setIsScaling] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(colorScheme === 'dark');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        try {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          console.log('[INIT] Image picker permission status:', status);
        } catch (error) {
          console.error('[INIT] Error requesting permissions:', error);
        }
      }
    })();
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const triggerHaptic = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        console.error('[HAPTIC] Error:', e);
      }
    }
  };

  const pickImage = async () => {
    console.log('[PICKER] Starting image picker...');
    try {
      await triggerHaptic();

      // Request permissions explicitly
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        console.log('[PICKER] Permission status:', status);
        
        if (status !== 'granted') {
          Alert.alert(
            'Permission Denied',
            'Please allow access to your photo library in settings.',
            [{ text: 'OK' }]
          );
          return;
        }
      }

      console.log('[PICKER] Launching image library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
        exif: false,
      });

      console.log('[PICKER] Result canceled:', result.canceled);
      console.log('[PICKER] Assets count:', result.assets?.length);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        console.log('[PICKER] Selected asset URI:', asset.uri);
        console.log('[PICKER] Asset dimensions:', asset.width, 'x', asset.height);

        let fileSize = 0;
        try {
          const fileInfo = await FileSystem.getInfoAsync(asset.uri);
          fileSize = (fileInfo as any).size || 0;
          console.log('[PICKER] File size:', fileSize);
        } catch (e) {
          console.error('[PICKER] Error getting file size:', e);
          fileSize = 0;
        }

        setSelectedImage({
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          size: fileSize,
        });
        setScaledImage(null);
        setShowResults(false);
        console.log('[PICKER] Image selected successfully');
      } else {
        console.log('[PICKER] Image selection was canceled');
      }
    } catch (error: any) {
      console.error('[PICKER] Error:', error);
      console.error('[PICKER] Error message:', error?.message);
      console.error('[PICKER] Error code:', error?.code);
      Alert.alert(
        'Error',
        `Failed to pick image: ${error?.message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    }
  };

  const scaleImage = async () => {
    if (!selectedImage) {
      Alert.alert('Error', 'Please select an image first');
      return;
    }

    const width = parseInt(targetWidth, 10);
    const height = parseInt(targetHeight, 10);

    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      Alert.alert('Error', 'Please enter valid width and height values');
      return;
    }

    setIsScaling(true);
    await triggerHaptic();
    try {
      const actions = maintainAspectRatio
        ? [{ resize: { width } }]
        : [{ resize: { width, height } }];

      const result = await ImageManipulator.manipulateAsync(
        selectedImage.uri,
        actions,
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      let newSize = 0;
      try {
        const fileInfo = await FileSystem.getInfoAsync(result.uri);
        newSize = (fileInfo as any).size || 0;
      } catch (e) {
        console.error('Error getting scaled file size:', e);
        newSize = 0;
      }

      Image.getSize(
        result.uri,
        (newWidth, newHeight) => {
          setScaledImage({
            uri: result.uri,
            width: newWidth,
            height: newHeight,
            originalSize: selectedImage.size,
            newSize,
          });
          setShowResults(true);
          setIsScaling(false);
        },
        (error) => {
          console.error('Error getting image size:', error);
          Alert.alert('Error', 'Failed to process image');
          setIsScaling(false);
        }
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to scale image');
      console.error(error);
      setIsScaling(false);
    }
  };

  const saveToGallery = async () => {
    if (!scaledImage) return;

    setActionInProgress('save');
    try {
      await triggerHaptic();
      if (Platform.OS !== 'web') {
        const asset = await MediaLibrary.createAssetAsync(scaledImage.uri);
        try {
          await MediaLibrary.createAlbumAsync('Processed Images', asset, false);
        } catch (e) {
          console.error('Album creation error:', e);
        }
        Alert.alert('✅ Success', 'Image saved to gallery!');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to save image');
      console.error('Save error:', error);
    } finally {
      setActionInProgress(null);
    }
  };

  const shareImage = async () => {
    if (!scaledImage) return;

    setActionInProgress('share');
    try {
      await triggerHaptic();
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing not available');
        setActionInProgress(null);
        return;
      }
      await Sharing.shareAsync(scaledImage.uri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Share Image',
      });
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        Alert.alert('❌ Error', 'Failed to share image');
      }
    } finally {
      setActionInProgress(null);
    }
  };

  const downloadImage = async () => {
    if (!scaledImage) return;

    setActionInProgress('download');
    try {
      await triggerHaptic();
      const timestamp = new Date().getTime();
      const filename = `scaled-image-${timestamp}.jpg`;
      const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory;
      const downloadDir = docDir + filename;
      
      await FileSystem.copyAsync({
        from: scaledImage.uri,
        to: downloadDir,
      });
      
      Alert.alert('✅ Success', `Image downloaded as ${filename}`);
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to download image');
      console.error('Download error:', error);
    } finally {
      setActionInProgress(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const bgColor = isDarkMode ? '#0F172A' : '#FFFFFF';
  const textColor = isDarkMode ? '#FFFFFF' : '#0F172A';
  const secondaryBg = isDarkMode ? '#1E293B' : '#F1F5F9';
  const borderColor = isDarkMode ? '#334155' : '#E2E8F0';

  if (showResults && scaledImage) {
    return (
      <ScreenContainer className="p-4" containerClassName={isDarkMode ? 'bg-slate-950' : 'bg-white'}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <View className="flex-1 gap-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Done!
              </Text>
              <Pressable
                onPress={toggleTheme}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  {
                    width: 40,
                    height: 40,
                    borderColor: borderColor,
                    backgroundColor: secondaryBg,
                  },
                  pressed && styles.secondaryButtonPressed,
                ]}
              >
                <Text className="text-lg">{isDarkMode ? '☀️' : '🌙'}</Text>
              </Pressable>
            </View>

            <Image
              source={{ uri: scaledImage.uri }}
              style={{ width: '100%', height: 240, resizeMode: 'contain' }}
            />

            <View className={`rounded-2xl p-4 gap-3 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
              <View className="flex-row justify-between">
                <Text className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  SIZE
                </Text>
                <Text className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {scaledImage.width} × {scaledImage.height}px
                </Text>
              </View>
              <View className={`h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <View className="flex-row justify-between">
                <Text className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  SAVED
                </Text>
                <Text className="text-sm font-bold text-green-500">
                  {Math.round(
                    ((scaledImage.originalSize - scaledImage.newSize) / scaledImage.originalSize) * 100
                  )}%
                </Text>
              </View>
            </View>

            <View className="gap-3">
              <Pressable
                onPress={saveToGallery}
                disabled={actionInProgress === 'save'}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: actionInProgress === 'save' ? '#0891B2' : '#00D9FF',
                  },
                  pressed && !actionInProgress && styles.primaryButtonPressed,
                ]}
              >
                {actionInProgress === 'save' ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold">💾 Save to Gallery</Text>
                )}
              </Pressable>

              <Pressable
                onPress={shareImage}
                disabled={actionInProgress === 'share'}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  {
                    borderColor: borderColor,
                    backgroundColor: secondaryBg,
                  },
                  pressed && !actionInProgress && styles.secondaryButtonPressed,
                ]}
              >
                {actionInProgress === 'share' ? (
                  <ActivityIndicator color="#00D9FF" />
                ) : (
                  <Text className="text-primary font-bold">📤 Share</Text>
                )}
              </Pressable>

              <Pressable
                onPress={downloadImage}
                disabled={actionInProgress === 'download'}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  {
                    borderColor: borderColor,
                    backgroundColor: secondaryBg,
                  },
                  pressed && !actionInProgress && styles.secondaryButtonPressed,
                ]}
              >
                {actionInProgress === 'download' ? (
                  <ActivityIndicator color="#00D9FF" />
                ) : (
                  <Text className="text-primary font-bold">⬇️ Download</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => {
                  setShowResults(false);
                  setScaledImage(null);
                }}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  {
                    borderColor: borderColor,
                    backgroundColor: secondaryBg,
                  },
                  pressed && styles.secondaryButtonPressed,
                ]}
              >
                <Text className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  ← Back
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4" containerClassName={isDarkMode ? 'bg-slate-950' : 'bg-white'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 gap-4">
          <View className="flex-row justify-between items-center mb-2">
            <View>
              <Text className={`text-4xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Scaler
              </Text>
              <Text className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Resize instantly
              </Text>
            </View>
            <Pressable
              onPress={toggleTheme}
              style={({ pressed }) => [
                styles.secondaryButton,
                {
                  width: 40,
                  height: 40,
                  borderColor: borderColor,
                  backgroundColor: secondaryBg,
                },
                pressed && styles.secondaryButtonPressed,
              ]}
            >
              <Text className="text-lg">{isDarkMode ? '☀️' : '🌙'}</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={pickImage}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: pressed ? '#0891B2' : '#00D9FF',
              },
              pressed && styles.primaryButtonPressed,
            ]}
          >
            <Text className="text-white font-bold text-base">📸 Select Image</Text>
          </Pressable>

          <View
            className={`rounded-2xl p-4 items-center justify-center h-20 ${
              isDarkMode ? 'bg-slate-900' : 'bg-slate-100'
            } border-2 border-dashed ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}
          >
            <Text className={`text-xs font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              📢 Ad Space 1
            </Text>
          </View>

          {selectedImage && (
            <>
              <View
                className={`rounded-2xl p-3 overflow-hidden ${
                  isDarkMode ? 'bg-slate-900' : 'bg-slate-100'
                }`}
              >
                <Image
                  source={{ uri: selectedImage.uri }}
                  style={{
                    width: '100%',
                    height: 180,
                    resizeMode: 'contain',
                  }}
                />
              </View>

              <View className={`rounded-2xl p-4 gap-2 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
                <View className="flex-row justify-between items-center">
                  <Text className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    SIZE
                  </Text>
                  <Text className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {selectedImage.width} × {selectedImage.height}px
                  </Text>
                </View>
                <View className={`h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <View className="flex-row justify-between items-center">
                  <Text className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    FILE SIZE
                  </Text>
                  <Text className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {formatFileSize(selectedImage.size)}
                  </Text>
                </View>
              </View>

              <View className={`rounded-2xl p-4 gap-3 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
                <View>
                  <Text className={`text-xs font-semibold mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    TARGET WIDTH
                  </Text>
                  <TextInput
                    value={targetWidth}
                    onChangeText={setTargetWidth}
                    placeholder="800"
                    placeholderTextColor={isDarkMode ? '#64748B' : '#CBD5E1'}
                    keyboardType="number-pad"
                    style={{
                      borderWidth: 1,
                      borderColor: borderColor,
                      borderRadius: 8,
                      padding: 10,
                      color: textColor,
                      backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
                    }}
                  />
                </View>

                <View>
                  <Text className={`text-xs font-semibold mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    TARGET HEIGHT
                  </Text>
                  <TextInput
                    value={targetHeight}
                    onChangeText={setTargetHeight}
                    placeholder="600"
                    placeholderTextColor={isDarkMode ? '#64748B' : '#CBD5E1'}
                    keyboardType="number-pad"
                    editable={!maintainAspectRatio}
                    style={{
                      borderWidth: 1,
                      borderColor: borderColor,
                      borderRadius: 8,
                      padding: 10,
                      color: textColor,
                      backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
                      opacity: maintainAspectRatio ? 0.5 : 1,
                    }}
                  />
                </View>

                <Pressable
                  onPress={() => setMaintainAspectRatio(!maintainAspectRatio)}
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      padding: 8,
                      borderRadius: 8,
                      backgroundColor: maintainAspectRatio ? '#00D9FF20' : 'transparent',
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text className="text-lg">{maintainAspectRatio ? '✓' : '○'}</Text>
                  <Text className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    Maintain Aspect Ratio
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={scaleImage}
                disabled={isScaling}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: isScaling ? '#0891B2' : '#00D9FF',
                  },
                  pressed && !isScaling && styles.primaryButtonPressed,
                ]}
              >
                {isScaling ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold">⚡ Scale Image</Text>
                )}
              </Pressable>
            </>
          )}

          <View
            className={`rounded-2xl p-4 items-center justify-center h-20 ${
              isDarkMode ? 'bg-slate-900' : 'bg-slate-100'
            } border-2 border-dashed ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}
          >
            <Text className={`text-xs font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              📢 Ad Space 2
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
