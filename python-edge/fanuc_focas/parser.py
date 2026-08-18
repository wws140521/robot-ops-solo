"""
FANUC 原始数据 → UDM JSON（与 TypeScript adapter-fanuc.ts 对齐）
输出格式和 mock-ws-server.js 的 mockFanucTelemetry() 一致
"""
import yaml
from datetime import datetime, timezone, timedelta

class FanucParser:
    def __init__(self, config_path: str):
        with open(config_path) as f:
            self.cfg = yaml.safe_load(f)
        self.r_map = self.cfg.get('r_map', {})
        self.alarm_dict = self.cfg.get('alarm_dict', {})

    def parse(self, raw_r_values: dict, raw_alarms: list) -> dict:
        """raw_r_values: {100: 67.0, 110: 118.0, ...}"""
        tz_cn = timezone(timedelta(hours=8))
        now = datetime.now(tz_cn).isoformat()

        # 解析关节数据
        joints = []
        for j in range(1, 7):
            temp_key = f"j{j}_temp"
            load_key = f"j{j}_load"
            temp_reg = self.r_map.get(temp_key, 0)
            load_reg = self.r_map.get(load_key, 0)
            joints.append({
                "j": j,
                "load_pct": raw_r_values.get(load_reg, 0),
                "temp_c": raw_r_values.get(temp_reg, 0),
                "current_a": 0,  # 需 KAREL 额外映射
                "speed_rpm": 0,
                "health_score": 100,
            })

        # 解析告警
        alarms = []
        for code in raw_alarms:
            a = self.alarm_dict.get(code, {})
            alarms.append({
                "raw_code": code,
                "udm_code": a.get("udm_code", "UNKNOWN"),
                "severity": a.get("severity", "warn"),
                "zh_desc": a.get("zh_desc", ""),
                "occurred_at": now,
                "cleared": False,
            })

        return {
            "robot_id": f"{self.cfg['brand']}_{self.cfg['model'].replace('/', '_')}_001",
            "model": self.cfg['model'],
            "timestamp": now,
            "joints": joints,
            "alarms": alarms,
            "runtime": {
                "power_on_hours": 0,  # 需从 FOCAS 读取
                "cycle_count": 0,
            },
        }
