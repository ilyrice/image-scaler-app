import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { ScreenContainer } from '@/components/screen-container';

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
  const [selectedImage, setSelectedImage] = useState<PickedImage | null>(null);
  const [scaledImage, setScaledImage] = useState<ScaledImage | null>(null);
  const [targetWidth, setTargetWidth] = useState('800');
  const [targetHeight, setTargetHeight] = useState('600');
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [isScaling, setIsScaling] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Request permissions on mount
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
        if (libraryStatus !== 'granted' || mediaStatus !== 'granted') {
          Alert.alert('Permission Required', 'Please allow access to your photo library');
        }
      }
    })();
  }, []);

  const pickImage = async () => {
    try {
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
          // File size may not be available on all platforms
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
        // File size may not be available on all platforms
        newSize = 0;
      }

      // Get dimensions of scaled image
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

    try {
      if (Platform.OS !== 'web') {
        const asset = await MediaLibrary.createAssetAsync(scaledImage.uri);
        await MediaLibrary.createAlbumAsync('Scaled Images', asset, false);
        Alert.alert('Success', 'Image saved to gallery!');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save image');
      console.error(error);
    }
  };

  const shareImage = async () => {
    if (!scaledImage) return;

    try {
      if (Platform.OS === 'web') {
        if (!(await Sharing.isAvailableAsync())) {
          Alert.alert('Error', 'Sharing is not available on this platform');
          return;
        }
      }
      await Sharing.shareAsync(scaledImage.uri);
    } catch (error) {
      Alert.alert('Error', 'Failed to share image');
      console.error(error);
    }
  };

  const downloadImage = async () => {
    if (!scaledImage) return;

    try {
      const timestamp = Date.now();
      const filename = `scaled-image-${timestamp}.jpg`;
      const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory;
      const downloadPath = docDir + filename;

      // Copy the scaled image to downloads
      await FileSystem.copyAsync({
        from: scaledImage.uri,
        to: downloadPath,
      });

      Alert.alert('Success', `Image downloaded as ${filename}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to download image');
      console.error(error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (showResults && scaledImage) {
    return (
      <ScreenContainer className="p-4">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View className="flex-1 gap-4">
            {/* Header */}
            <View className="items-center gap-2 mb-4">
              <Text className="text-3xl font-bold text-foreground">Scaled Image</Text>
              <Text className="text-sm text-muted">Preview and save your result</Text>
            </View>

            {/* Image Preview */}
            <View className="bg-surface rounded-2xl p-4 items-center justify-center border border-border">
              <Image
                source={{ uri: scaledImage.uri }}
                style={{
                  width: '100%',
                  height: 300,
                  resizeMode: 'contain',
                }}
              />
            </View>

            {/* Dimensions Info */}
            <View className="bg-surface rounded-xl p-4 border border-border gap-3">
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">New Dimensions:</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {scaledImage.width} × {scaledImage.height}px
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Original Size:</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {formatFileSize(scaledImage.originalSize)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">New Size:</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {formatFileSize(scaledImage.newSize)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Reduction:</Text>
                <Text className="text-sm font-semibold text-success">
                  {Math.round(
                    ((scaledImage.originalSize - scaledImage.newSize) /
                      scaledImage.originalSize) *
                      100
                  )}%
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="gap-3 mt-4">
              <TouchableOpacity
                onPress={saveToGallery}
                style={{ opacity: 1 }}
                className="bg-primary rounded-xl py-3 items-center"
              >
                <Text className="text-background font-semibold text-base">Save to Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={shareImage}
                style={{ opacity: 1 }}
                className="bg-surface rounded-xl py-3 items-center border border-primary"
              >
                <Text className="text-primary font-semibold text-base">Share</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={downloadImage}
                style={{ opacity: 1 }}
                className="bg-surface rounded-xl py-3 items-center border border-primary"
              >
                <Text className="text-primary font-semibold text-base">Download</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowResults(false);
                  setScaledImage(null);
                }}
                style={{ opacity: 1 }}
                className="bg-surface rounded-xl py-3 items-center border border-border"
              >
                <Text className="text-foreground font-semibold text-base">Back to Home</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-6">
          {/* Header */}
          <View className="items-center gap-2">
            <Text className="text-3xl font-bold text-foreground">Image Scaler</Text>
            <Text className="text-sm text-muted text-center">Resize your images easily</Text>
          </View>

          {/* Image Picker Button */}
          <TouchableOpacity
            onPress={pickImage}
            style={{ opacity: 1 }}
            className="bg-primary rounded-2xl py-4 items-center"
          >
            <Text className="text-background font-semibold text-base">Select Image</Text>
          </TouchableOpacity>

          {/* Selected Image Preview */}
          {selectedImage && (
            <View className="bg-surface rounded-2xl p-4 border border-border gap-4">
              <View className="items-center justify-center bg-background rounded-xl h-48">
                <Image
                  source={{ uri: selectedImage.uri }}
                  style={{
                    width: '100%',
                    height: '100%',
                    resizeMode: 'contain',
                  }}
                />
              </View>
              <View className="gap-2">
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Original Dimensions:</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {selectedImage.width} × {selectedImage.height}px
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">File Size:</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {formatFileSize(selectedImage.size)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Scale Settings */}
          {selectedImage && (
            <View className="bg-surface rounded-2xl p-4 border border-border gap-4">
              <Text className="text-lg font-semibold text-foreground">Scale Settings</Text>

              {/* Width Input */}
              <View className="gap-2">
                <Text className="text-sm text-muted">Target Width (px)</Text>
                <TextInput
                  value={targetWidth}
                  onChangeText={setTargetWidth}
                  placeholder="800"
                  keyboardType="number-pad"
                  className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                />
              </View>

              {/* Height Input */}
              <View className="gap-2">
                <Text className="text-sm text-muted">Target Height (px)</Text>
                <TextInput
                  value={targetHeight}
                  onChangeText={setTargetHeight}
                  placeholder="600"
                  keyboardType="number-pad"
                  editable={!maintainAspectRatio}
                  className={`bg-background border border-border rounded-lg px-4 py-3 text-foreground ${
                    !maintainAspectRatio ? '' : 'opacity-50'
                  }`}
                />
              </View>

              {/* Aspect Ratio Toggle */}
              <TouchableOpacity
                onPress={() => setMaintainAspectRatio(!maintainAspectRatio)}
                style={{ opacity: 1 }}
                className="flex-row items-center gap-3 py-2"
              >
                <View
                  className={`w-6 h-6 rounded border-2 items-center justify-center ${
                    maintainAspectRatio
                      ? 'bg-primary border-primary'
                      : 'border-border bg-background'
                  }`}
                >
                  {maintainAspectRatio && (
                    <Text className="text-background font-bold">✓</Text>
                  )}
                </View>
                <Text className="text-sm text-foreground">Maintain Aspect Ratio</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Scale Button */}
          {selectedImage && (
            <TouchableOpacity
              onPress={scaleImage}
              disabled={isScaling}
              style={{ opacity: isScaling ? 0.6 : 1 }}
              className="bg-primary rounded-2xl py-4 items-center"
            >
              {isScaling ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-background font-semibold text-base">Scale Image</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
