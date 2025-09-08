import { useTheme } from "@/contexts/ThemeContext";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function Layout({
  children,
  backgroundColor,
  statusBarStyle,
  statusBarBackgroundColor,
  safeAreaBackground,
  padding = 0,
  paddingHorizontal = 0,
  paddingVertical = 0,
}: {
  children: React.ReactNode;
  backgroundColor?: string;
  statusBarStyle?: "dark-content" | "light-content";
  statusBarBackgroundColor?: string;
  safeAreaBackground?: string;
  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
}) {
  const { isDarkMode, theme } = useTheme();
  const themeBg = backgroundColor || theme.colors.background;
  const themeSafeArea = safeAreaBackground || theme.colors.background;
  const barStyle = statusBarStyle || (isDarkMode ? "light-content" : "dark-content");
  return (
    <>
      <StatusBar
        barStyle={barStyle}
        backgroundColor={statusBarBackgroundColor || themeSafeArea}
        translucent={false}
      />
      <SafeAreaView
        style={[
          styles.safeArea,
          { backgroundColor: themeSafeArea },
        ]}
      >
        <View
          style={[
            styles.container,
            {
              backgroundColor: themeBg,
              padding,
              paddingHorizontal,
              paddingVertical,
            },
          ]}
        >
          {children}
        </View>
      </SafeAreaView>
    </>
  );
}

// Modern Header Component for consistent headers across screens
export const ModernHeader = ({
  title,
  subtitle,
  leftIcon,
  rightIcon,
  onLeftPress,
  onRightPress,
  backgroundColor,
  showBorder = true,
}: {
  title: string;
  subtitle?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onLeftPress?: () => void;
  onRightPress?: () => void;
  backgroundColor?: string;
  showBorder?: boolean;
}) => {
  const { theme } = useTheme();
  const bg = backgroundColor || theme.colors.background;
  const borderColor = theme.colors.border;
  const textColor = theme.colors.text;
  return (
    <View
      style={[
        styles.modernHeader,
        { backgroundColor: bg },
        showBorder && { borderBottomWidth: 1, borderBottomColor: borderColor },
      ]}
    >
      <View style={styles.headerContent}>
        {/* Left Icon/Button */}
        {leftIcon && (
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: theme.colors.card }]}
            onPress={onLeftPress}
            activeOpacity={0.7}
          >
            {leftIcon}
          </TouchableOpacity>
        )}

        {/* Title Section */}
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: textColor }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.headerSubtitle, { color: textColor }]}>{subtitle}</Text>
          )}
        </View>

        {/* Right Icon/Button */}
        {rightIcon && (
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: theme.colors.card }]}
            onPress={onRightPress}
            activeOpacity={0.7}
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// Modern Card Component for consistent card styling
export const ModernCard = ({
  children,
  style,
  padding = 16,
  margin = 0,
  marginHorizontal = 0,
  marginVertical = 0,
  backgroundColor,
  borderRadius = 15,
  elevation = 3,
  onPress,
}: {
  children: React.ReactNode;
  style?: any;
  padding?: number;
  margin?: number;
  marginHorizontal?: number;
  marginVertical?: number;
  backgroundColor?: string;
  borderRadius?: number;
  elevation?: number;
  onPress?: () => void;
}) => {
  const { theme } = useTheme();
  const bg = backgroundColor || theme.colors.card;
  const cardStyle = [
    styles.modernCard,
    {
      padding,
      margin,
      marginHorizontal,
      marginVertical,
      backgroundColor: bg,
      borderRadius,
      elevation,
    },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        activeOpacity={0.95}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

// Section Header Component
export const SectionHeader = ({
  title,
  subtitle,
  rightElement,
  marginBottom = 16,
  marginTop = 0,
}: {
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  marginBottom?: number;
  marginTop?: number;
}) => {
  const { theme } = useTheme();
  return (
    <View style={[styles.sectionHeader, { marginBottom, marginTop }]}>
      <View style={styles.sectionTitleContainer}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.sectionSubtitle, { color: theme.colors.text }]}>{subtitle}</Text>
        )}
      </View>
      {rightElement && (
        <View style={styles.sectionRightElement}>{rightElement}</View>
      )}
    </View>
  );
};

// Loading Component
export const ModernLoading = ({
  title = "Loading...",
  subtitle = "Please wait",
  color,
  overlay = true,
}: { title?: string; subtitle?: string; color?: string; overlay?: boolean }) => {
  const { theme } = useTheme();
  const spinner = color || theme.colors.notification;
  const containerStyle = overlay
    ? styles.loadingOverlay
    : styles.loadingContainer;

  return (
    <View style={containerStyle}>
      <View style={[styles.loadingCard, { backgroundColor: theme.colors.card }]}>
        <ActivityIndicator size="large" color={spinner} />
        <Text style={[styles.loadingTitle, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.loadingSubtext, { color: theme.colors.text }]}>{subtitle}</Text>
      </View>
    </View>
  );
};

// Empty State Component
export const EmptyState = ({
  icon,
  title,
  subtitle,
  buttonText,
  onButtonPress,
  secondaryButtonText,
  onSecondaryButtonPress,
  iconSize = 60,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle: string;
  buttonText?: string;
  onButtonPress?: () => void;
  secondaryButtonText?: string;
  onSecondaryButtonPress?: () => void;
  iconSize?: number;
}) => {
  const { theme } = useTheme();
  return (
    <View style={styles.emptyStateContainer}>
      <View style={[styles.emptyStateCard, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.emptyStateIcon, { fontSize: iconSize }]}>
          {icon}
        </Text>
        <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.emptyStateSubtitle, { color: theme.colors.text }]}>{subtitle}</Text>
        {buttonText && onButtonPress && (
          <TouchableOpacity
            style={[styles.emptyStateButton, { backgroundColor: theme.colors.notification }]}
            onPress={onButtonPress}
            activeOpacity={0.8}
          >
            <Text style={[styles.emptyStateButtonText, { color: 'white' }]}>{buttonText}</Text>
          </TouchableOpacity>
        )}
        {secondaryButtonText && onSecondaryButtonPress && (
          <TouchableOpacity
            style={[styles.emptyStateButton, styles.emptyStateSecondaryButton, { borderColor: theme.colors.border }]}
            onPress={onSecondaryButtonPress}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.emptyStateButtonText,
                styles.emptyStateSecondaryButtonText,
              ]}
            >
              {secondaryButtonText}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },

  // Modern Header Styles
  modernHeader: {
    paddingTop: Platform.OS === "ios" ? 10 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  modernHeaderBorder: {
  borderBottomWidth: 1,
  borderBottomColor: "#F0F0F0",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
  backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  color: "#000",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 14,
  color: "#666",
    textAlign: "center",
    marginTop: 2,
  },

  // Modern Card Styles
  modernCard: {
    boxShadow: "0px 2px 10px rgba(0,0,0,0.05)",
    elevation: 3,
  },

  // Section Header Styles
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  sectionRightElement: {
    marginLeft: 16,
  },

  // Loading Styles
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingCard: {
  backgroundColor: "white",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    margin: 40,
    boxShadow: "0px 10px 20px rgba(0,0,0,0.1)",
    elevation: 10,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: "bold",
  color: "#000",
    marginTop: 16,
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
  color: "#666",
    textAlign: "center",
  },

  // Empty State Styles
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyStateCard: {
  backgroundColor: "white",
    borderRadius: 20,
    padding: 40,
    alignItems: "center",
    width: "100%",
    maxWidth: 300,
    boxShadow: "0px 5px 15px rgba(0,0,0,0.1)",
    elevation: 8,
  },
  emptyStateIcon: {
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "bold",
  color: "#000",
    textAlign: "center",
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
  color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyStateButton: {
  backgroundColor: "#8B5FBF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    boxShadow: "0px 4px 8px rgba(139,95,191,0.3)",
    elevation: 5,
  },
  emptyStateButtonText: {
  color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyStateSecondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
  borderColor: "#E2E8F0",
    marginTop: 12,
    boxShadow: "none",
    elevation: 0,
  },
  emptyStateSecondaryButtonText: {
  color: "#0F172A",
  },
});
