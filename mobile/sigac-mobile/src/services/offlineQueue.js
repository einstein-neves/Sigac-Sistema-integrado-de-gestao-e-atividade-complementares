import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { invalidateCachedResource } from './resourceCache';

const QUEUE_KEY = 'sigac.offline.submission.queue';

async function readQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

async function writeQueue(items) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items || []));
}

export async function enqueueSubmission(payload) {
  const items = await readQueue();
  const item = {
    id: `offline-${Date.now()}`,
    kind: 'activity-submission',
    payload,
    createdAt: new Date().toISOString(),
  };
  await writeQueue([...items, item]);
  return item;
}

export async function listQueuedSubmissions() {
  return readQueue();
}

export async function syncQueuedSubmissions(token) {
  if (!token) return { sent: 0, remaining: await readQueue() };
  const items = await readQueue();
  const remaining = [];
  let sent = 0;

  for (const item of items) {
    try {
      if (item.kind === 'activity-submission') {
        await api.enviarAtividade(token, item.payload);
        sent += 1;
      } else {
        remaining.push(item);
      }
    } catch (_) {
      remaining.push(item);
    }
  }

  if (sent) {
    invalidateCachedResource('student.activities');
    invalidateCachedResource('student.dashboard');
    invalidateCachedResource('student.status');
  }

  await writeQueue(remaining);
  return { sent, remaining };
}
