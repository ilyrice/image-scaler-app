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
  useColorScheme,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const systemColorScheme = useColorScheme();
  const [selectedImage, setSelectedImage] = useState<PickedImage | null>(null);
  const [scaledImage, setScaledImage] = useState<ScaledImage | null>(null);
  const [targetWidth, setTargetWidth] = useState('800');
  const [targetHeight, setTargetHeight] = useState('600');
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [isScaling, setIsScaling] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
        if (libraryStatus !== 'granted' || mediaStatus !== 'granted') {
          Alert.alert('Permission Required', 'Please allow access to your photo library');
        }
      }
      // Load saved theme preference
      try {
        const savedTheme = await AsyncStorage.getItem('app-theme');
        if (savedTheme) {
          setIsDarkMode(savedTheme === 'dark');
        }
      } catch (e) {
        console.error('Failed to load theme:', e);
      }
    })();
  }, []);

  const toggleTheme = async () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    try {
      await AsyncStorage.setItem('app-theme', newTheme ? 'dark' : 'light');
    } catch (e) {
      console.error('Failed to save theme:', e);
    }
  };

  const triggerHaptic = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        // Haptics not available
      }
    }
  };

  const pickImage = async () => {
    try {
      await triggerHaptic();
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        let fileSize = 0;
        try {
          const fileInfo = await FileSystem.getInfoAsync(asset.uri);
          fileSize = (fileInfo as any).size || 0;
        } catch (e) {
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
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
      console.error(error);
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
          // Album might already exist
        }
        Alert.alert('Success', 'Image saved to gallery!');
      } else {
        Alert.alert('Info', 'Save to gallery is not available on web');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save image to gallery');
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
        return;
      }
      await Sharing.shareAsync(scaledImage.uri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Share Scaled Image',
      });
    } catch (error) {
      if ((error as any).message !== 'User did not share') {
        Alert.alert('Error', 'Failed to share image');
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

      Alert.alert('Success', `Image saved to: ${filename}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to download image');
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

  const bgColor = isDarkMode ? '#0A0E27' : '#F8FAFC';
  const cardBg = isDarkMode ? 'bg-slate-900/30' : 'bg-white/40';
  const textColor = isDarkMode ? 'text-slate-100' : 'text-slate-900';

  if (showResults && scaledImage) {
    return (
      <ScreenContainer
        className="p-4"
        containerClassName={isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <View className="flex-1 gap-5">
            <View className="flex-row justify-between items-center mb-2">
              <View className="flex-1">
                <Text className={`text-4xl font-bold ${textColor}`}>Complete</Text>
                <Text className="text-sm text-muted">Your image is ready</Text>
              </View>
              <Pressable
                onPress={toggleTheme}
                className={`w-12 h-12 rounded-full items-center justify-center ${
                  isDarkMode ? 'bg-slate-800' : 'bg-slate-200'
                }`}
              >
                <Text className="text-xl">{isDarkMode ? '☀️' : '🌙'}</Text>
              </Pressable>
            </View>

            <View
              className={`${cardBg} backdrop-blur-md rounded-3xl p-5 border border-white/20 dark:border-slate-700/30 shadow-lg items-center justify-center overflow-hidden`}
            >
              <Image
                source={{ uri: scaledImage.uri }}
                style={{
                  width: '100%',
                  height: 280,
                  resizeMode: 'contain',
                }}
              />
            </View>

            <View
              className={`${cardBg} backdrop-blur-md rounded-3xl p-5 border border-white/20 dark:border-slate-700/30 gap-4`}
            >
              <View className="flex-row justify-between items-center">
                <Text className="text-sm text-muted font-medium">Dimensions</Text>
                <Text className="text-sm font-bold text-primary">
                  {scaledImage.width} × {scaledImage.height}px
                </Text>
              </View>
              <View className="h-px bg-white/10 dark:bg-slate-700/20" />
              <View className="flex-row justify-between items-center">
                <Text className="text-sm text-muted font-medium">Original</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {formatFileSize(scaledImage.originalSize)}
                </Text>
              </View>
              <View className="h-px bg-white/10 dark:bg-slate-700/20" />
              <View className="flex-row justify-between items-center">
                <Text className="text-sm text-muted font-medium">Optimized</Text>
                <Text className="text-sm font-semibold text-success">
                  {formatFileSize(scaledImage.newSize)}
                </Text>
              </View>
              <View className="h-px bg-white/10 dark:bg-slate-700/20" />
              <View className="flex-row justify-between items-center">
                <Text className="text-sm text-muted font-medium">Reduction</Text>
                <Text className="text-sm font-bold text-success">
                  {Math.round(
                    ((scaledImage.originalSize - scaledImage.newSize) /
                      scaledImage.originalSize) *
                      100
                  )}%
                </Text>
              </View>
            </View>

            <View className="gap-3 mt-2">
              <Pressable
                onPress={saveToGallery}
                disabled={actionInProgress === 'save'}
                className={`bg-gradient-to-r from-primary to-cyan-400 rounded-2xl py-4 items-center justify-center ${
                  actionInProgress === 'save' ? 'opacity-60' : 'active:opacity-80'
                }`}
              >
                {actionInProgress === 'save' ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-bold text-base">Save to Gallery</Text>
                )}
              </Pressable>

              <View className="flex-row gap-3">
                <Pressable
                  onPress={shareImage}
                  disabled={actionInProgress === 'share'}
                  className={`flex-1 ${cardBg} backdrop-blur-md rounded-2xl py-4 items-center justify-center border border-white/20 dark:border-slate-700/30 ${
                    actionInProgress === 'share' ? 'opacity-60' : 'active:opacity-70'
                  }`}
                >
                  {actionInProgress === 'share' ? (
                    <ActivityIndicator color="#00D9FF" size="small" />
                  ) : (
                    <Text className="text-primary font-semibold text-sm">Share</Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={downloadImage}
                  disabled={actionInProgress === 'download'}
                  className={`flex-1 ${cardBg} backdrop-blur-md rounded-2xl py-4 items-center justify-center border border-white/20 dark:border-slate-700/30 ${
                    actionInProgress === 'download' ? 'opacity-60' : 'active:opacity-70'
                  }`}
                >
                  {actionInProgress === 'download' ? (
                    <ActivityIndicator color="#00D9FF" size="small" />
                  ) : (
                    <Text className="text-primary font-semibold text-sm">Download</Text>
                  )}
                </Pressable>
              </View>

              <Pressable
                onPress={() => {
                  setShowResults(false);
                  setScaledImage(null);
                }}
                className={`${cardBg} backdrop-blur-md rounded-2xl py-4 items-center border border-white/10 dark:border-slate-700/20 active:opacity-70`}
              >
                <Text className="text-foreground font-semibold text-base">Back</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      className="p-4"
      containerClassName={isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 gap-6">
          <View className="flex-row justify-between items-center">
            <View className="flex-1">
              <Text className={`text-5xl font-black ${textColor}`}>Scaler</Text>
              <Text className="text-sm text-muted font-medium">Resize images instantly</Text>
            </View>
            <Pressable
              onPress={toggleTheme}
              className={`w-12 h-12 rounded-full items-center justify-center ${
                isDarkMode ? 'bg-slate-800' : 'bg-slate-200'
              }`}
            >
              <Text className="text-xl">{isDarkMode ? '☀️' : '🌙'}</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={pickImage}
            className="bg-gradient-to-r from-primary to-cyan-400 rounded-3xl py-5 items-center shadow-lg active:opacity-90"
          >
            <Text className="text-white font-bold text-lg">Select Image</Text>
          </Pressable>

          {selectedImage && (
            <>
              <View
                className={`${cardBg} backdrop-blur-md rounded-3xl p-5 border border-white/20 dark:border-slate-700/30 gap-4`}
              >
                <View className="items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl h-56 overflow-hidden">
                  <Image
                    source={{ uri: selectedImage.uri }}
                    style={{
                      width: '100%',
                      height: '100%',
                      resizeMode: 'contain',
                    }}
                  />
                </View>
                <View className="gap-3">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-xs text-muted font-semibold uppercase">Dimensions</Text>
                    <Text className="text-sm font-bold text-primary">
                      {selectedImage.width} × {selectedImage.height}
                    </Text>
                  </View>
                  <View className="h-px bg-white/10 dark:bg-slate-700/20" />
                  <View className="flex-row justify-between items-center">
                    <Text className="text-xs text-muted font-semibold uppercase">File Size</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {formatFileSize(selectedImage.size)}
                    </Text>
                  </View>
                </View>
              </View>

              <View
                className={`${cardBg} backdrop-blur-md rounded-3xl p-5 border border-white/20 dark:border-slate-700/30 gap-4`}
              >
                <Text className={`text-lg font-bold ${textColor}`}>Scale Settings</Text>

                <View className="gap-2">
                  <Text className="text-xs text-muted font-semibold uppercase">Width (px)</Text>
                  <TextInput
                    value={targetWidth}
                    onChangeText={setTargetWidth}
                    placeholder="800"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    className={`${isDarkMode ? 'bg-slate-900/20 text-white' : 'bg-white/20 text-slate-900'} border border-white/20 dark:border-slate-700/30 rounded-xl px-4 py-3 text-base font-semibold`}
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-xs text-muted font-semibold uppercase">Height (px)</Text>
                  <TextInput
                    value={targetHeight}
                    onChangeText={setTargetHeight}
                    placeholder="600"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    editable={!maintainAspectRatio}
                    className={`${isDarkMode ? 'bg-slate-900/20 text-white' : 'bg-white/20 text-slate-900'} border border-white/20 dark:border-slate-700/30 rounded-xl px-4 py-3 text-base font-semibold ${
                      !maintainAspectRatio ? '' : 'opacity-50'
                    }`}
                  />
                </View>

                <Pressable
                  onPress={() => setMaintainAspectRatio(!maintainAspectRatio)}
                  className="flex-row items-center gap-3 py-2 active:opacity-70"
                >
                  <View
                    className={`w-6 h-6 rounded-lg border-2 items-center justify-center ${
                      maintainAspectRatio
                        ? 'bg-gradient-to-r from-primary to-cyan-400 border-primary'
                        : 'border-white/30 dark:border-slate-700/30 bg-white/10 dark:bg-slate-900/10'
                    }`}
                  >
                    {maintainAspectRatio && (
                      <Text className="text-white font-bold text-sm">✓</Text>
                    )}
                  </View>
                  <Text className={`text-sm font-semibold ${textColor}`}>
                    Maintain Aspect Ratio
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={scaleImage}
                disabled={isScaling}
                className={`bg-gradient-to-r from-primary to-cyan-400 rounded-3xl py-5 items-center shadow-lg ${
                  isScaling ? 'opacity-60' : 'active:opacity-90'
                }`}
              >
                {isScaling ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-bold text-lg">Scale Image</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
