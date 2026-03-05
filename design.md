# Image Scaler App - Design Document

## Overview
A mobile app for resizing and scaling images to custom dimensions. Users can select images from their device, preview them, set target width/height, and save the scaled results.

## Screen List

1. **Home Screen** - Main entry point with image selection and scaling controls
2. **Image Preview Screen** - Full-screen preview of selected image with dimension display
3. **Scaling Results Screen** - Preview of the scaled image with save/share options

## Primary Content and Functionality

### Home Screen
- **Image Picker Button** - Large, prominent button to select image from device library
- **Current Image Display** - Thumbnail preview of selected image (if any)
- **Original Dimensions Display** - Shows width × height of selected image
- **Scale Input Fields** - Input fields for target width and height (in pixels)
- **Scale Mode Toggle** - Options: "Exact Size", "Maintain Aspect Ratio"
- **Scale Button** - Primary action to process the image
- **Recent Scaled Images** - Quick access list to previously scaled images (optional)

### Image Preview Screen
- **Full Image Display** - Large preview of the selected image
- **Image Metadata** - File size, dimensions, format
- **Back Button** - Return to home screen
- **Confirm Selection Button** - Proceed to scaling

### Scaling Results Screen
- **Scaled Image Preview** - Display the processed image at full size (scrollable if needed)
- **New Dimensions Display** - Shows width × height of scaled image
- **File Size Comparison** - Original vs. new file size
- **Save to Gallery Button** - Save the scaled image to device photo library
- **Share Button** - Share via system share sheet
- **Download Button** - Save to device downloads folder
- **Back to Home Button** - Return to home screen for another scaling operation

## Key User Flows

### Flow 1: Scale an Image
1. User taps "Select Image" button on Home Screen
2. Image picker opens (device library)
3. User selects an image
4. Home Screen displays thumbnail and original dimensions
5. User enters target width and height
6. User selects scale mode (exact or maintain aspect ratio)
7. User taps "Scale Image" button
8. App processes image and navigates to Scaling Results Screen
9. User sees scaled image preview and new dimensions
10. User taps "Save to Gallery" to save the result
11. Confirmation toast appears, user returns to Home Screen

### Flow 2: Quick Re-scale
1. User modifies width/height values on Home Screen
2. User taps "Scale Image" again
3. App processes with new dimensions
4. Results screen updates with new scaled image

### Flow 3: Share Scaled Image
1. On Scaling Results Screen, user taps "Share"
2. System share sheet opens
3. User selects destination (Messages, Email, etc.)
4. Scaled image is shared

## Color Choices

- **Primary Color**: `#0a7ea4` (Teal/Blue) - Used for buttons and interactive elements
- **Background**: `#ffffff` (Light) / `#151718` (Dark) - Screen background
- **Surface**: `#f5f5f5` (Light) / `#1e2022` (Dark) - Card backgrounds
- **Foreground**: `#11181C` (Light) / `#ECEDEE` (Dark) - Primary text
- **Muted**: `#687076` (Light) / `#9BA1A6` (Dark) - Secondary text
- **Success**: `#22C55E` (Green) - Confirmation messages
- **Error**: `#EF4444` (Red) - Error states

## Layout Considerations

- **Portrait Orientation** - App optimized for portrait (9:16) aspect ratio
- **One-Handed Usage** - All interactive elements positioned within thumb reach
- **Safe Area** - Content respects notch and home indicator areas
- **Touch Targets** - Minimum 44pt height for buttons and interactive elements
- **Spacing** - Consistent 16pt padding/margins for visual hierarchy
