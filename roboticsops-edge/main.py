# roboticsops-edge 采集主循环（低空扩展示例）
# 负责拉取厂商 API、归一化、发布 MQTT
# 当前是 mock 模式，不连真机；接入生产时把 lambda 换成真实 Collector 实例
import time
import json
import logging
from collectors.dji_dock_collector import DJIDockCollector, mock_collect as mock_dji
from collectors.autel_dock_collector import AutelDockCollector, mock_collect as mock_autel
from collectors.vertiport_collector import VertiportCollector, mock_collect as mock_vertiport

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# 采集器配置（mock 模式，不连真机）
# 每个 tuple 为 (brand, collector_fn)，brand 决定 to_mqtt_payload 生成的 robot_id 前缀与 device_class
COLLECTORS = [
    ("dji-dock", lambda: mock_dji()),
    ("autel-dock", lambda: mock_autel()),
    ("generic-vertiport", lambda: mock_vertiport()),
]


# 构造简化版 UDM payload，实际可以调 adapter-kit Node 侧转换
def to_mqtt_payload(brand: str, raw: dict) -> dict:
    # 统一用 UTC ISO 字符串作为时间戳，避免边缘侧时区差异导致后端排序错乱
    ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    if brand == "dji-dock":
        return {
            "robot_id": f"DJI_DOCK_{raw['sn']}",
            "device_class": "uav_dock",
            "brand": brand,
            "ts": ts,
            "state": raw,
        }
    if brand == "autel-dock":
        return {
            "robot_id": f"AUTEL_DOCK_{raw['id']}",
            "device_class": "uav_dock",
            "brand": brand,
            "ts": ts,
            "state": raw,
        }
    return {
        "robot_id": f"VERTIPORT_{raw['id']}",
        "device_class": "vertiport",
        "brand": brand,
        "ts": ts,
        "state": raw,
    }


# MQTT 发布占位，当前只打印日志，生产环境换成 paho-mqtt
def mqtt_publish(topic: str, payload: dict) -> None:
    log.info("[mqtt] %s %s", topic, json.dumps(payload, ensure_ascii=False))


# 主循环：逐个采集并发布，一个品牌挂了不影响其他品牌
def loop() -> None:
    # 逐个采集并发布，单品牌异常不应影响其他品牌继续上报
    for brand, collector in COLLECTORS:
        try:
            raw = collector()
            payload = to_mqtt_payload(brand, raw)
            mqtt_publish("roboticsops/telemetry", payload)
        except Exception as e:
            log.warning("collect failed: %s", e)


if __name__ == "__main__":
    # 5 秒周期兼顾实时性与边缘侧负载；机巢/起降场状态变化通常秒级足够
    while True:
        loop()
        time.sleep(5)
