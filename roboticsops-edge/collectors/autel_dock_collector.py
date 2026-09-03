"""
Autel / 科比特 / 普宙 机巢采集器
输入：MAVLink 或厂商 REST 归一化后的数据
"""
from typing import Optional


class AutelDockCollector:
    def __init__(self, dock_id: str, api_base: str, api_key: Optional[str] = None):
        self.dock_id = dock_id
        self.api_base = api_base.rstrip('/')
        self.api_key = api_key

    def collect(self) -> dict:
        # 实际场景：请求厂商 API 或监听 MAVLink
        # 此处返回 mock 结构供本地验证
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


def mock_collect() -> dict:
    return AutelDockCollector("SN_AUTEL_DOCK_001", "https://api.example.com").collect()


if __name__ == "__main__":
    import json
    print(json.dumps(mock_collect(), indent=2, ensure_ascii=False))
