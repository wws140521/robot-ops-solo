# Autel / 科比特 / 普宙 机巢采集器
# 国产机巢协议差异大，边缘侧先统一成 raw dict，再交给 adapter-kit 做 UDM 映射
from typing import Optional


# Autel 机巢采集器
class AutelDockCollector:
    def __init__(self, dock_id: str, api_base: str, api_key: Optional[str] = None):
        self.dock_id = dock_id
        self.api_base = api_base.rstrip('/')
        self.api_key = api_key

    # 实际请求厂商 API 或监听 MAVLink，当前 mock 点数据
    def collect(self) -> dict:
        # 实际场景：请求厂商 API 或监听 MAVLink；当前 mock 数值刻意覆盖充电器 48℃（不过温）与电池循环 210 次
        return {
            "id": self.dock_id,
            "model": "Generic MAVLink Dock",
            "state": "charging",
            "charger_temp_c": 48,
            "charger_v": 24.0,
            "charger_a": 2.8,
            "door_jammed": False,
            "door_open": False,
            "lift_fault": False,
            "lift_up": False,
            "lift_moving": False,
            "wind": 2.8,
            "wind_gust": 4.5,
            "rain": 0.0,
            "temp": 30,
            "humidity": 60,
            "uav_inside": True,
            "uav_battery_pct": 65,
            "uav_battery_cycles": 210,
        }


# 返回 mock 数据，给主循环和本地验证用
def mock_collect() -> dict:
    return AutelDockCollector("SN_AUTEL_DOCK_001", "https://api.example.com").collect()


if __name__ == "__main__":
    import json
    print(json.dumps(mock_collect(), indent=2, ensure_ascii=False))
