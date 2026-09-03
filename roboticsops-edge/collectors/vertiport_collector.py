"""
eVTOL 起降场地面设施采集器
输入：BACnet / Modbus / 厂商 API 数据
"""
from typing import Optional


class VertiportCollector:
    def __init__(self, site_id: str, api_base: str, api_key: Optional[str] = None):
        self.site_id = site_id
        self.api_base = api_base.rstrip('/')
        self.api_key = api_key

    def collect(self) -> dict:
        # 实际场景：请求起降场地面设施 API
        # 此处返回 mock 结构供本地验证
        return {
            "id": self.site_id,
            "model": "Vertiport Ground System",
            "charging_pad_state": "available",
            "charging_current_a": 0.0,
            "fire_suppression_state": "armed",
            "lighting": "auto",
            "ground_power_v": 400.0,
        }


def mock_collect() -> dict:
    return VertiportCollector("SZ_LONGHUA_001", "https://api.example.com").collect()


if __name__ == "__main__":
    import json
    print(json.dumps(mock_collect(), indent=2, ensure_ascii=False))
