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
          const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          console.log('Library permission status:', libraryStatus);
        } catch (error) {
          console.error('Error requesting library permissions:', error);
        }

        try {
          const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
          console.log('Media library permission status:', mediaStatus);
        } catch (error) {
          console.error('Error requesting media permissions:', error);
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
        console.error('Haptics error:', e);
      }
    }
  };

  const pickImage = async () => {
    try {
      console.log('Starting image picker...');
      await triggerHaptic();

      console.log('Launching image library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      console.log('Image picker result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        console.log('Selected asset:', asset);

        let fileSize = 0;
        try {
          const fileInfo = await FileSystem.getInfoAsync(asset.uri);
          fileSize = (fileInfo as any).size || 0;
          console.log('File size:', fileSize);
        } catch (e) {
          console.error('Error getting file size:', e);
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
        console.log('Image selected successfully');
      } else {
        console.log('Image selection was canceled');
      }
    } catch (error: any) {
      console.error('Image picker error:', error);
      Alert.alert('Error', `Failed to pick image: ${error?.message || 'Unknown error'}`);
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
          Alert.alert('Error', 'Failed to get scaled image dimensions');
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
          await MediaLibrary.createAlbumAsync('Scaled Images', asset, false);
        } catch (e) {
          console.error('Album creation error:', e);
        }
        Alert.alert('✅ Success', 'Image saved to gallery!');
      } else {
        Alert.alert('Info', 'Save to gallery is not available on web');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to save image to gallery');
      console.error('Save to gallery error:', error);
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
        Alert.alert('Error', 'Sharing is not available on this platform');
        setActionInProgress(null);
        return;
      }
      await Sharing.shareAsync(scaledImage.uri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Share Scaled Image',
      });
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        Alert.alert('❌ Error', 'Failed to share image');
        console.error('Share error:', error);
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
      const timestamp = Date.now();
      const filename = `scaled-image-${timestamp}.jpg`;
      const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory;
      const downloadPath = `${docDir}${filename}`;

      await FileSystem.copyAsync({
        from: scaledImage.uri,
        to: downloadPath,
      });

      Alert.alert('✅ Success', `Image saved to: ${filename}`);
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

  // Results Screen
  if (showResults && scaledImage) {
    return (
      <ScreenContainer className="p-4" containerClassName={isDarkMode ? 'bg-slate-950' : 'bg-white'}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <View className="flex-1 gap-4">
            {/* Header */}
            <View className="flex-row justify-between items-center mb-2">
              <View>
                <Text className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Done!
                </Text>
                <Text className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Ready to use
                </Text>
              </View>
              <Pressable
                onPress={toggleTheme}
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  isDarkMode ? 'bg-slate-800' : 'bg-slate-100'
                }`}
              >
                <Text className="text-lg">{isDarkMode ? '☀️' : '🌙'}</Text>
              </Pressable>
            </View>

            {/* Image Preview */}
            <View
              className={`rounded-2xl p-3 overflow-hidden ${
                isDarkMode ? 'bg-slate-900' : 'bg-slate-100'
              }`}
            >
              <Image
                source={{ uri: scaledImage.uri }}
                style={{
                  width: '100%',
                  height: 240,
                  resizeMode: 'contain',
                }}
              />
            </View>

            {/* Stats */}
            <View className={`rounded-2xl p-4 gap-3 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
              <View className="flex-row justify-between items-center">
                <Text className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  SIZE
                </Text>
                <Text className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {scaledImage.width} × {scaledImage.height}px
                </Text>
              </View>
              <View className={`h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <View className="flex-row justify-between items-center">
                <Text className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  BEFORE
                </Text>
                <Text className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {formatFileSize(scaledImage.originalSize)}
                </Text>
              </View>
              <View className={`h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <View className="flex-row justify-between items-center">
                <Text className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  AFTER
                </Text>
                <Text className="text-sm font-bold text-green-500">
                  {formatFileSize(scaledImage.newSize)}
                </Text>
              </View>
              <View className={`h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <View className="flex-row justify-between items-center">
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

            {/* Ad Space */}
            <View
              className={`rounded-2xl p-4 items-center justify-center h-24 ${
                isDarkMode ? 'bg-slate-900' : 'bg-slate-100'
              } border-2 border-dashed ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}
            >
              <Text className={`text-xs font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                📢 Ad Space
              </Text>
            </View>

            {/* Action Buttons */}
            <View className="gap-3 mt-2">
              <Pressable
                onPress={saveToGallery}
                disabled={actionInProgress === 'save'}
                className={`bg-gradient-to-r from-primary to-cyan-400 rounded-xl py-3 items-center justify-center ${
                  actionInProgress === 'save' ? 'opacity-60' : 'active:opacity-80'
                }`}
              >
                {actionInProgress === 'save' ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-bold text-sm">Save to Gallery</Text>
                )}
              </Pressable>

              <View className="flex-row gap-3">
                <Pressable
                  onPress={shareImage}
                  disabled={actionInProgress === 'share'}
                  className={`flex-1 rounded-xl py-3 items-center justify-center border-2 ${
                    isDarkMode
                      ? 'bg-slate-900 border-slate-700'
                      : 'bg-slate-100 border-slate-300'
                  } ${actionInProgress === 'share' ? 'opacity-60' : 'active:opacity-70'}`}
                >
                  {actionInProgress === 'share' ? (
                    <ActivityIndicator color="#00D9FF" size="small" />
                  ) : (
                    <Text className="text-primary font-bold text-sm">Share</Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={downloadImage}
                  disabled={actionInProgress === 'download'}
                  className={`flex-1 rounded-xl py-3 items-center justify-center border-2 ${
                    isDarkMode
                      ? 'bg-slate-900 border-slate-700'
                      : 'bg-slate-100 border-slate-300'
                  } ${actionInProgress === 'download' ? 'opacity-60' : 'active:opacity-70'}`}
                >
                  {actionInProgress === 'download' ? (
                    <ActivityIndicator color="#00D9FF" size="small" />
                  ) : (
                    <Text className="text-primary font-bold text-sm">Download</Text>
                  )}
                </Pressable>
              </View>

              <Pressable
                onPress={() => {
                  setShowResults(false);
                  setScaledImage(null);
                }}
                className={`rounded-xl py-3 items-center border-2 ${
                  isDarkMode
                    ? 'bg-slate-900 border-slate-700'
                    : 'bg-slate-100 border-slate-300'
                } active:opacity-70`}
              >
                <Text className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Back
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // Home Screen
  return (
    <ScreenContainer className="p-4" containerClassName={isDarkMode ? 'bg-slate-950' : 'bg-white'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 gap-4">
          {/* Header */}
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
              className={`w-10 h-10 rounded-full items-center justify-center ${
                isDarkMode ? 'bg-slate-800' : 'bg-slate-100'
              }`}
            >
              <Text className="text-lg">{isDarkMode ? '☀️' : '🌙'}</Text>
            </Pressable>
          </View>

          {/* Primary CTA */}
          <Pressable
            onPress={pickImage}
            className="bg-gradient-to-r from-primary to-cyan-400 rounded-2xl py-4 items-center shadow-lg active:opacity-90"
          >
            <Text className="text-white font-bold text-base">📸 Select Image</Text>
          </Pressable>

          {/* Ad Space 1 */}
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
              {/* Image Preview */}
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

              {/* Image Info */}
              <View className={`rounded-2xl p-4 gap-2 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
                <View className="flex-row justify-between items-center">
                  <Text className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    SIZE
                  </Text>
                  <Text className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {selectedImage.width} × {selectedImage.height}
                  </Text>
                </View>
                <View className={`h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <View className="flex-row justify-between items-center">
                  <Text className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    FILE
                  </Text>
                  <Text className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {formatFileSize(selectedImage.size)}
                  </Text>
                </View>
              </View>

              {/* Scale Settings */}
              <View className={`rounded-2xl p-4 gap-3 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
                <Text className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Settings
                </Text>

                <View className="gap-2">
                  <Text className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    WIDTH
                  </Text>
                  <TextInput
                    value={targetWidth}
                    onChangeText={setTargetWidth}
                    placeholder="800"
                    placeholderTextColor={isDarkMode ? '#64748B' : '#CBD5E1'}
                    keyboardType="number-pad"
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                      isDarkMode
                        ? 'bg-slate-800 text-white border border-slate-700'
                        : 'bg-white text-slate-900 border border-slate-300'
                    }`}
                  />
                </View>

                <View className="gap-2">
                  <Text className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    HEIGHT
                  </Text>
                  <TextInput
                    value={targetHeight}
                    onChangeText={setTargetHeight}
                    placeholder="600"
                    placeholderTextColor={isDarkMode ? '#64748B' : '#CBD5E1'}
                    keyboardType="number-pad"
                    editable={!maintainAspectRatio}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                      isDarkMode
                        ? 'bg-slate-800 text-white border border-slate-700'
                        : 'bg-white text-slate-900 border border-slate-300'
                    } ${!maintainAspectRatio ? '' : 'opacity-50'}`}
                  />
                </View>

                <Pressable
                  onPress={() => setMaintainAspectRatio(!maintainAspectRatio)}
                  className="flex-row items-center gap-2 py-2 active:opacity-70"
                >
                  <View
                    className={`w-5 h-5 rounded border-2 items-center justify-center ${
                      maintainAspectRatio
                        ? 'bg-gradient-to-r from-primary to-cyan-400 border-primary'
                        : isDarkMode
                          ? 'border-slate-700 bg-slate-800'
                          : 'border-slate-300 bg-white'
                    }`}
                  >
                    {maintainAspectRatio && (
                      <Text className="text-white font-bold text-xs">✓</Text>
                    )}
                  </View>
                  <Text className={`text-xs font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Maintain Aspect Ratio
                  </Text>
                </Pressable>
              </View>

              {/* Ad Space 2 */}
              <View
                className={`rounded-2xl p-4 items-center justify-center h-20 ${
                  isDarkMode ? 'bg-slate-900' : 'bg-slate-100'
                } border-2 border-dashed ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}
              >
                <Text className={`text-xs font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  📢 Ad Space 2
                </Text>
              </View>

              {/* Scale Button */}
              <Pressable
                onPress={scaleImage}
                disabled={isScaling}
                className={`bg-gradient-to-r from-primary to-cyan-400 rounded-2xl py-4 items-center shadow-lg ${
                  isScaling ? 'opacity-60' : 'active:opacity-90'
                }`}
              >
                {isScaling ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-bold text-base">⚡ Scale Image</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
