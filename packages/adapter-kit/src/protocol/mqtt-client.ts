// packages/adapter-kit/src/protocol/mqtt-client.ts
import mqtt from 'mqtt';
import type { UnifiedRobotState, UnifiedAlert } from '../types/unified';
import { adaptByBrandEnhanced } from '../adapters';

// broker 地址 + 工业遥测主题（与 fanuc_mock.py / kuka_mock.py 发布主题一致）
const MQTT_BROKER = 'ws://localhost:9001';   // MQTT over WebSocket（浏览器用）
const TELEMETRY_TOPIC = 'roboticsops/telemetry';
// 2026-08-21 OTA 状态订阅主题（轻量OTA开发文档第 10.2 节）
const OTA_STATUS_TOPIC = 'roboticsops/ota/+/status';

// 回调函数，由 wsHub 注入
type TelemetryCallback = (state: UnifiedRobotState, alerts: UnifiedAlert[]) => void;
// 2026-08-21 OTA 状态回调，由 otaStore 注入
type OtaStatusCallback = (robotId: string, state: string, progress: number, message: string, campaignId: string) => void;

let client: mqtt.MqttClient | null = null;
let onTelemetry: TelemetryCallback | null = null;
let onOtaStatus: OtaStatusCallback | null = null;

export function connectMqtt(callback: TelemetryCallback, otaCallback?: OtaStatusCallback) {
  onTelemetry = callback;
  onOtaStatus = otaCallback ?? null;

  if (client && client.connected) {
    console.log('[mqtt-client] already connected');
    return;
  }

  client = mqtt.connect(MQTT_BROKER, {
    clientId: `robotops-web-${Math.random().toString(16).slice(2, 8)}`,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
    keepalive: 30,
    resubscribe: true,
  });

  client.on('connect', () => {
    console.log('[mqtt-client] ✅ connected to', MQTT_BROKER);
    // 订阅工业遥测
    client!.subscribe(TELEMETRY_TOPIC, (err) => {
      if (err) console.error('[mqtt-client] subscribe telemetry error:', err);
      else console.log('[mqtt-client] 📡 subscribed to', TELEMETRY_TOPIC);
    });
    // 2026-08-21 订阅 OTA 状态上报（ota/{robot_id}/status）
    client!.subscribe(OTA_STATUS_TOPIC, (err) => {
      if (err) console.error('[mqtt-client] subscribe ota error:', err);
      else console.log('[mqtt-client] 📡 subscribed to', OTA_STATUS_TOPIC);
    });
  });

  client.on('message', (topic: string, payload: Buffer) => {
    try {
      // 2026-08-21 OTA 状态消息分流：topic 匹配 roboticsops/ota/{robot_id}/status
      if (topic.includes('/ota/') && topic.endsWith('/status')) {
        const robotId = topic.split('/')[2];
        const data = JSON.parse(payload.toString());
        console.log('[mqtt-client] OTA status received:', { robotId, state: data.state, progress: data.progress });
        onOtaStatus?.(robotId, data.state, data.progress, data.message, data.campaign_id);
        return;
      }
      // 工业遥测消息
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