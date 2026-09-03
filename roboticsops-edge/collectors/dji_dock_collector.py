# DJI Dock 采集器，通过大疆开放 API 拉取机巢和无人机状态
# 归一化成 adapter-kit 能吃的 raw dict，再由边缘侧转 MQTT 发出去
import time
import requests
from typing import Optional


# 大疆机场采集器
class DJIDockCollector:
    def __init__(self, dock_sn: str, api_base: str, app_key: str, app_secret: str):
        self.dock_sn = dock_sn
        self.api_base = api_base.rstrip('/')
        self.app_key = app_key
        self.app_secret = app_secret
        self._token: Optional[str] = None
        # 提前 60 秒刷新 token，避免边界时刻请求因过期被拒绝
        self._token_expire = 0

    # 鉴权，示意代码，生产按大疆开放平台文档来
    def _get_token(self) -> str:
        if self._token and time.time() < self._token_expire - 60:
            return self._token
        resp = requests.post(f"{self.api_base}/oauth/token", json={
            "app_key": self.app_key, "app_secret": self.app_secret,
        }, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        self._token = data["access_token"]
        self._token_expire = time.time() + data.get("expires_in", 7200)
        return self._token

    # 带 token 的 GET 请求
    def _request(self, path: str) -> dict:
        headers = {"Authorization": f"Bearer {self._get_token()}"}
        resp = requests.get(f"{self.api_base}{path}", headers=headers, timeout=5)
        resp.raise_for_status()
        return resp.json()

    # 采集并归一化成 adapter-kit dji-dock 输入的 raw 结构
    def collect(self) -> dict:
        dock = self._request(f"/v1/docks/{self.dock_sn}/state")
        uav = None
        try:
            uav = self._request(f"/v1/docks/{self.dock_sn}/uav")
        except Exception:
            # 机巢内无无人机时该接口通常 404/空响应，忽略即可；uav 字段留 None
            pass

        return {
            "sn": self.dock_sn,
            "product_version": dock.get("product_version"),
            "dock_state": dock.get("state"),
            # 充电器字段缺失时给 0，adapter-kit 侧会再用默认值兜底
            "charger_temperature_c": dock.get("charger", {}).get("temperature_c", 0),
            "charger_voltage_v": dock.get("charger", {}).get("voltage_v", 0),
            "charger_current_a": dock.get("charger", {}).get("current_a", 0),
            "door_state": dock.get("door", {}).get("state", "closed"),
            "door_jammed": dock.get("door", {}).get("jammed", False),
            "lift_platform_state": dock.get("lift", {}).get("state", "down"),
            "wind_speed": dock.get("weather", {}).get("wind_speed_mps", 0),
            "wind_gust": dock.get("weather", {}).get("wind_gust_mps", 0),
            "rainfall": dock.get("weather", {}).get("rainfall_mm", 0),
            "temperature": dock.get("weather", {}).get("temperature_c", 0),
            "humidity": dock.get("weather", {}).get("humidity_pct", 0),
            "uav_inside": dock.get("uav_inside", False),
            # 机巢内有无人机时才填充 UAV 遥测；None 会让 adapter-kit 跳过 uav 字段
            "uav": uav and {
                "battery_percent": uav.get("battery", {}).get("percent", 0),
                "battery_cycles": uav.get("battery", {}).get("cycles", 0),
                "signal_rssi": uav.get("link", {}).get("rssi", -90),
                "gps_satellites": uav.get("gps", {}).get("satellites", 0),
                "motor_temperatures": uav.get("motors", []),
                "propeller_rpms": uav.get("propellers", []),
                "last_flight_id": uav.get("last_flight_id"),
            } or None,
        }


# 本地 mock 数据，不连真机，给测试和离线验证用
# 数据覆盖常见场景：充电器 45℃、电池循环 132 次、图传-62dBm
def mock_collect() -> dict:
    return {
        "sn": "SN_MOCK_DOCK_001",
        "product_version": "Dock 2",
        "dock_state": "charging",
        "charger_temperature_c": 45,
        "charger_voltage_v": 24.2,
        "charger_current_a": 3.1,
        "door_state": "closed",
        "door_jammed": False,
        "lift_platform_state": "down",
        "wind_speed": 3.2,
        "wind_gust": 5.1,
        "rainfall": 0.0,
        "temperature": 28,
        "humidity": 65,
        "uav_inside": True,
        "uav": {
            "battery_percent": 78,
            "battery_cycles": 132,
            "signal_rssi": -62,
            "gps_satellites": 12,
            "motor_temperatures": [42, 41, 43, 40],
            "propeller_rpms": [7200, 7180, 7220, 7190],
            "last_flight_id": "FLIGHT_20260902_001",
        },
    }


if __name__ == "__main__":
    import json
    print(json.dumps(mock_collect(), indent=2, ensure_ascii=False))
