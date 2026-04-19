import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RootNavigator from './src/navigation/RootNavigator';
import NetworkBanner from './src/components/NetworkBanner';
import { getDatabase } from './src/database/database';
import { COLORS } from './src/constants/theme';
import { APP_CONFIG } from './src/constants/config';

export default function App(): React.JSX.Element {
  const [dbReady, setDbReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    async function init() {
      // Initialize database
      await getDatabase();
      setDbReady(true);

      // Show splash for 2 seconds
      setTimeout(() => setShowSplash(false), 2000);
    }
    init();
  }, []);

  if (showSplash || !dbReady) {
    return (
      <View style={styles.splash}>
        <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
        <Image
          source={require('./assets/prescopad.png')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <Text style={styles.splashTitle}>{APP_CONFIG.name}</Text>
        <Text style={styles.splashTagline}>{APP_CONFIG.tagline}</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
        <NetworkBanner />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  splash: {
    flex: 1,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogo: {
    width: 120,
    height: 120,
    borderRadius: 24,
    marginBottom: 20,
  },
  splashTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 1,
  },
  splashTagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },
});
