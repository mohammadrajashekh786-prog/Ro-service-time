import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity,
  Vibration, Linking, Animated, Dimensions
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Audio } from 'expo-av';
import { StatusBar } from 'expo-status-bar';

const CALL_NUMBER = 'tel:+918340542632';
const { width, height } = Dimensions.get('window');

// Handle notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

export default function App() {
  const [alertActive, setAlertActive] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState('');
  const soundRef = useRef(null);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    registerForPushNotifications();

    // Listen for notifications received while app is foregrounded
    const foregroundSub = Notifications.addNotificationReceivedListener(() => {
      triggerAlert();
    });

    // Listen for notification tapped
    const responseSub = Notifications.addNotificationResponseReceivedListener(() => {
      triggerAlert();
    });

    return () => {
      foregroundSub.remove();
      responseSub.remove();
    };
  }, []);

  async function registerForPushNotifications() {
    if (!Device.isDevice) return;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    setExpoPushToken(token);
    console.log('Expo Push Token:', token);

    // Send token to your Firebase/Netlify backend
    try {
      await fetch('https://dynamic-frangollo-db2ddc.netlify.app/.netlify/functions/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform: 'android' })
      });
    } catch (e) {
      console.log('Token registration error:', e);
    }

    await Notifications.setNotificationChannelAsync('ro-alert', {
      name: 'RO Service Alert',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500, 200, 500, 200, 500],
      lightColor: '#FF0000',
      sound: 'alarm.wav',
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  async function triggerAlert() {
    setAlertActive(true);

    // Start vibration pattern
    Vibration.vibrate([500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 500], true);

    // Start flashing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ])
    ).start();

    // Start pulsing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();

    // Play alarm sound
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('./assets/alarm.wav'),
        { isLooping: true, volume: 1.0 }
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch (e) {
      console.log('Sound error:', e);
    }
  }

  async function handleCallNow() {
    // Stop everything
    Vibration.cancel();
    flashAnim.stopAnimation();
    scaleAnim.stopAnimation();

    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    setAlertActive(false);

    // Make phone call
    Linking.openURL(CALL_NUMBER);
  }

  const bgColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#CC0000', '#FF0000']
  });

  if (!alertActive) {
    return (
      <View style={styles.waitingScreen}>
        <StatusBar style="light" />
        <Text style={styles.waitingIcon}>💧</Text>
        <Text style={styles.waitingTitle}>RO Service Alert</Text>
        <Text style={styles.waitingText}>Waiting for service reminder...</Text>
        <Text style={styles.tokenText}>{expoPushToken ? '✅ Connected' : '⏳ Connecting...'}</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.alertScreen, { backgroundColor: bgColor }]}>
      <StatusBar style="light" />
      <Animated.Text style={[styles.warningIcon, { transform: [{ scale: scaleAnim }] }]}>
        ⚠️
      </Animated.Text>
      <Animated.Text style={[styles.dangerText, { transform: [{ scale: scaleAnim }] }]}>
        DANGER!
      </Animated.Text>
      <Text style={styles.messageText}>
        GET YOUR{'\n'}RO FILTER SERVICE{'\n'}NOW!
      </Text>
      <TouchableOpacity style={styles.callButton} onPress={handleCallNow} activeOpacity={0.8}>
        <Text style={styles.callButtonText}>📞  CALL NOW</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  waitingScreen: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  waitingIcon: { fontSize: 64, marginBottom: 16 },
  waitingTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  waitingText: { fontSize: 16, color: '#aaa', textAlign: 'center', marginBottom: 16 },
  tokenText: { fontSize: 14, color: '#4CAF50' },
  alertScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  warningIcon: { fontSize: 100, marginBottom: 16 },
  dangerText: {
    fontSize: 64,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 4,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    marginBottom: 16,
  },
  messageText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 40,
    marginBottom: 60,
  },
  callButton: {
    backgroundColor: '#27AE60',
    paddingVertical: 24,
    paddingHorizontal: 48,
    borderRadius: 20,
    width: width - 48,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  callButtonText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
  },
});
