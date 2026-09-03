# eVTOL 起降场地面设施采集器
# 输入 BACnet / Modbus / 厂商 API 数据
# 安全优先级：充电坪 > 消防 > 地面电源 > 照明
from typing import Optional


# 起降场采集器
class VertiportCollector:
    def __init__(self, site_id: str, api_base: str, api_key: Optional[str] = None):
        self.site_id = site_id
        self.api_base = api_base.rstrip('/')
        self.api_key = api_key

    # 实际请求起降场地面设施 API，当前 mock 为正常状态
    def collect(self) -> dict:
        # 实际场景：请求起降场地面设施 API；当前 mock 为正常状态（400V 额定地面电源、消防待命）
        return {
            "id": self.site_id,
            "model": "Vertiport Ground System",
            "charging_pad_state": "available",
            "charging_current_a": 0.0,
            "fire_suppression_state": "armed",
            "lighting": "auto",
            "ground_power_v": 400.0,
        }


# 返回 mock 起降场数据，给主循环和本地验证用
def mock_collect() -> dict:
    return VertiportCollector("SZ_LONGHUA_001", "https://api.example.com").collect()


if __name__ == "__main__":
    import json
    print(json.dumps(mock_collect(), indent=2, ensure_ascii=False))
