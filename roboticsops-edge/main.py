"""
roboticsops-edge 采集主循环（低空扩展示例）
负责：① 拉取厂商 API ② 归一化 ③ 发布 MQTT
"""
import time
import json
import logging
from collectors.dji_dock_collector import DJIDockCollector, mock_collect as mock_dji
from collectors.autel_dock_collector import AutelDockCollector, mock_collect as mock_autel
from collectors.vertiport_collector import VertiportCollector, mock_collect as mock_vertiport

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# 采集器配置（mock 模式，不连真机）
COLLECTORS = [
    ("dji-dock", lambda: mock_dji()),
    ("autel-dock", lambda: mock_autel()),
    ("generic-vertiport", lambda: mock_vertiport()),
]


def to_mqtt_payload(brand: str, raw: dict) -> dict:
    """简化的 UDM 风格 payload，实际可调用 adapter-kit Node 侧转换"""
    if brand == "dji-dock":
        return {
            "robot_id": f"DJI_DOCK_{raw['sn']}",
            "device_class": "uav_dock",
            "brand": brand,
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "state": raw,
        }
    if brand == "autel-dock":
        return {
            "robot_id": f"AUTEL_DOCK_{raw['id']}",
            "device_class": "uav_dock",
            "brand": brand,
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "state": raw,
        }
    return {
        "robot_id": f"VERTIPORT_{raw['id']}",
        "device_class": "vertiport",
        "brand": brand,
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "state": raw,
    }


def mqtt_publish(topic: str, payload: dict) -> None:
    """MQTT 发布占位，实际接入 paho-mqtt"""
    log.info("[mqtt] %s %s", topic, json.dumps(payload, ensure_ascii=False))


def loop() -> None:
    for brand, collector in COLLECTORS:
        try:
            raw = collector()
            payload = to_mqtt_payload(brand, raw)
            mqtt_publish("roboticsops/telemetry", payload)
        except Exception as e:
            log.warning("collect failed: %s", e)


if __name__ == "__main__":
    while True:
        loop()
        time.sleep(5)
