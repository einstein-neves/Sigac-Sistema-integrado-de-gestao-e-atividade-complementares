import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export async function registerPushToken(token) {
  if (!token || !Device.isDevice) return null;

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('sigac-status', {
      name: 'SIGAC Status',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const push = await Notifications.getExpoPushTokenAsync();
  const expoPushToken = push?.data || '';
  if (!expoPushToken) return null;
  await api.registrarPushToken(token, {
    token: expoPushToken,
    platform: Platform.OS,
  });
  return expoPushToken;
}
