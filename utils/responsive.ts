import { Dimensions, PixelRatio, useWindowDimensions } from 'react-native';

// Breakpoint definitions (tailor as needed)
export const breakpoints = {
  phoneSmall: 0,
  phone: 360,
  tablet: 768,
  largeTablet: 1024,
  desktopLike: 1280,
};

// Hook returning convenient flags & width/height
export function useBreakpoint() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    isSmallPhone: width < breakpoints.phone,
    isPhone: width >= breakpoints.phone && width < breakpoints.tablet,
    isTablet: width >= breakpoints.tablet && width < breakpoints.largeTablet,
    isLargeTablet: width >= breakpoints.largeTablet,
  };
}

// Scale helpers (inspired by react-native-size-matters but lightweight)
const guidelineBaseWidth = 375; // iPhone X width reference
const guidelineBaseHeight = 812;

export function scale(size: number) {
  const { width } = Dimensions.get('window');
  return (width / guidelineBaseWidth) * size;
}

export function verticalScale(size: number) {
  const { height } = Dimensions.get('window');
  return (height / guidelineBaseHeight) * size;
}

// Moderate scale to prevent extreme growth on large tablets
export function moderateScale(size: number, factor = 0.5) {
  return size + (scale(size) - size) * factor;
}

// Utility to pick a value per breakpoint
export function responsiveValue<T>(values: {
  small?: T;
  phone?: T;
  tablet?: T;
  largeTablet?: T;
  default: T;
}): T {
  const { width } = Dimensions.get('window');
  if (width >= breakpoints.largeTablet && values.largeTablet !== undefined) return values.largeTablet;
  if (width >= breakpoints.tablet && values.tablet !== undefined) return values.tablet;
  if (width >= breakpoints.phone && values.phone !== undefined) return values.phone;
  if (width < breakpoints.phone && values.small !== undefined) return values.small;
  return values.default;
}

// Normalize font size across densities while respecting user settings
export function normalizeFont(size: number) {
  const newSize = scale(size);
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}
