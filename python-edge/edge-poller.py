"""
边缘主轮询器
遍历所有品牌配置 → 拉数据 → 转 UDM → 发 MQTT
"""
import json
import time
import yaml
import paho.mqtt.client as mqtt
from pathlib import Path

# 导入各品牌客户端
from fanuc_focas.focas_client import FocasClient
from fanuc_focas.parser import FanucParser
# from kuka_opcua.opcua_client import KukaClient
# from kuka_opcua.parser import KukaParser

def load_all_configs(config_dir: str):
    """扫描所有品牌的 config.yaml"""
    configs = []
    for cfg_path in Path(config_dir).glob("*/config.yaml"):
        cfg = yaml.safe_load(cfg_path.read_text())
        cfg['_path'] = str(cfg_path)
        configs.append(cfg)
    return configs

def main():
    # 加载配置
    configs = load_all_configs(".")

    # 初始化 MQTT
    mqtt_client = mqtt.Client()
    mqtt_client.connect("localhost", 1883, 60)
    mqtt_client.loop_start()

    # 初始化各品牌客户端
    clients = []
    for cfg in configs:
        brand = cfg['brand'].lower()
        if brand == 'fanuc':
            fc = FocasClient(cfg['host'], cfg['port'])
            parser = FanucParser(cfg['_path'])
            if fc.connect():
                clients.append(('fanuc', fc, parser, cfg))

    try:
        while True:
            for brand, client, parser, cfg in clients:
                try:
                    # 读 R 寄存器
                    r_values = {}
                    for reg in parser.r_map.values():
                        val = client.read_r_register(reg)
                        if val is not None:
                            r_values[reg] = val

                    # 读告警
                    alarms = client.read_alarms()

                    # 转 UDM
                    udm = parser.parse(r_values, alarms)

                    # 发 MQTT
                    topic = cfg.get('mqtt', {}).get('topic', f'industrial/robot/{brand}/telemetry')
                    mqtt_client.publish(topic, json.dumps({
                        'type': 'industrial_state',
                        'brand': brand,
                        'payload': udm,
                    }))

                    print(f"[{brand}] published at {udm['timestamp']}")

                except Exception as e:
                    print(f"[{brand}] error: {e}")
                    client.disconnect()
                    time.sleep(5)
                    client.connect()

            time.sleep(5)  # 采样间隔

    except KeyboardInterrupt:
        print("Shutting down...")
    finally:
        for _, client, _, _ in clients:
            client.disconnect()
        mqtt_client.loop_stop()
        mqtt_client.disconnect()

if __name__ == "__main__":
    main()
