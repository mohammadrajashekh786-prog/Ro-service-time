import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity,
  Vibration, Linking, Animated, Dimensions
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Audio } from 'expo-av';

const CALL_NUMBER = 'tel:+918340542632';
const { width, height } = Dimensions.get('window');

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
    const foregroundSub = Notifications.addNotificationReceivedListener(() => {
      triggerAlert();
    });
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
      vibrationPattern: [0, 500, 200, 500, 200, 500],
      lightColor: '#FF0000',
      sound: 'default',
      bypassDnd: true,
    });
  }

  async function triggerAlert() {
    setAlertActive(true);
    Vibration.vibrate([0, 500, 200, 500, 200, 500, 200, 500], true);
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
    Animated.loop(
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.08, duration: 400, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])
    ).start();
  }

  async function stopAndCall() {
    Vibration.cancel();
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    flashAnim.stopAnimation();
    scaleAnim.stopAnimation();
    setAlertActive(false);
    Linking.openURL(CALL_NUMBER);
  }

  const bgColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#CC0000', '#FF0000'],
  });

  if (alertActive) {
    return (
      <Animated.View style={[styles.alertContainer, { backgroundColor: bgColor }]}>
        <Text style={styles.dangerText}>⚠️ DANGER ⚠️</Text>
        <Text style={styles.alertTitle}>RO SERVICE ALERT</Text>
        <Text style={styles.alertSubtitle}>Your RO filter needs immediate service!</Text>
        <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '100%', alignItems: 'center' }}>
          <TouchableOpacity style={styles.callButton} onPress={stopAndCall}>
            <Text style={styles.callButtonText}>📞 CALL NOW</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <View style={styles.waitingContainer}>
      <Text style={styles.waitingIcon}>💧</Text>
      <Text style={styles.waitingTitle}>RO Service Alert</Text>
      <Text style={styles.waitingText}>Waiting for service reminder...</Text>
      {expoPushToken ? (
        <Text style={styles.tokenText}>✅ Device registered</Text>
      ) : (
        <Text style={styles.tokenText}>Registering device...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  alertContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  dangerText: { fontSize: 36, color: '#fff', fontWeight: 'bold', marginBottom: 10 },
  alertTitle: { fontSize: 28, color: '#fff', fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  alertSubtitle: { fontSize: 18, color: '#ffcccc', textAlign: 'center', marginBottom: 40 },
  callButton: { backgroundColor: '#00CC44', paddingVertical: 20, paddingHorizontal: 50, borderRadius: 50, elevation: 8 },
  callButtonText: { fontSize: 26, color: '#fff', fontWeight: 'bold' },
  waitingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1f36', padding: 30 },
  waitingIcon: { fontSize: 60, marginBottom: 20 },
  waitingTitle: { fontSize: 24, color: '#fff', fontWeight: 'bold', marginBottom: 10 },
  waitingText: { fontSize: 16, color: '#aaa', textAlign: 'center', marginBottom: 20 },
  tokenText: { fontSize: 13, color: '#4f46e5', textAlign: 'center' },
});
