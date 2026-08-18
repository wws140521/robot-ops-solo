// packages/adapter-kit/src/protocol/mqtt-client.ts
import mqtt from 'mqtt';
import type { UnifiedRobotState, UnifiedAlert } from '../types/unified';
import { adaptByBrandEnhanced } from '../adapters';

// broker 地址 + 工业遥测主题
const MQTT_BROKER = 'ws://localhost:9001';   // MQTT over WebSocket（浏览器用）
const TELEMETRY_TOPIC = 'industrial/robot/+/telemetry';

// 回调函数，由 wsHub 注入
type TelemetryCallback = (state: UnifiedRobotState, alerts: UnifiedAlert[]) => void;

let client: mqtt.MqttClient | null = null;
let onTelemetry: TelemetryCallback | null = null;

export function connectMqtt(callback: TelemetryCallback) {
  onTelemetry = callback;

  if (client && client.connected) {
    console.log('[mqtt-client] already connected');
    return;
  }

  client = mqtt.connect(MQTT_BROKER, {
    clientId: `robotops-web-${Math.random().toString(16).slice(2, 8)}`,
    clean: true,
    reconnectPeriod: 3000,
  });

  client.on('connect', () => {
    console.log('[mqtt-client] ✅ connected to', MQTT_BROKER);
    client!.subscribe(TELEMETRY_TOPIC, (err) => {
      if (err) console.error('[mqtt-client] subscribe error:', err);
      else console.log('[mqtt-client] 📡 subscribed to', TELEMETRY_TOPIC);
    });
  });

  client.on('message', (_topic: string, payload: Buffer) => {
    try {
      const raw = JSON.parse(payload.toString());
      const brand = raw.brand?.toLowerCase() || 'fanuc';
      const { state, alerts } = adaptByBrandEnhanced(brand, raw);
      onTelemetry?.(state, alerts);
    } catch (e) {
      console.error('[mqtt-client] parse error:', e);
    }
  });

  client.on('error', (err) => {
    console.error('[mqtt-client] error:', err);
  });

  client.on('offline', () => {
    console.warn('[mqtt-client] offline, reconnecting...');
  });
}

export function disconnectMqtt() {
  if (client) {
    client.end();
    client = null;
    console.log('[mqtt-client] disconnected');
  }
}