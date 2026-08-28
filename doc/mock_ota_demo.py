"""
Robot-Ops-Solo 轻量 OTA - 本地 Mock 验证脚本
不连真机、不连真盒子，本地模拟 ota-server + 两个 mock 盒子 + Dashboard 订阅者，
验证完整链路：上传包 -> 下发 command -> 盒子下载/验签/安装/健康检查 -> 状态上报

用法:
  # 终端1: MQTT broker
  mosquitto -p 1883 -v   (或用完整 ws 配置)

  # 终端2: 运行本脚本
  python mock_ota_demo.py
"""
import json
import time
import hashlib
import subprocess
import os
import sys
import threading
from pathlib import Path
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

BROKER = "localhost"
PORT = 1883
BASE = "roboticsops/ota"

# ---------- 工具函数 ----------
def now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat()

def sha256_of(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

# ---------- Mock 盒子 ----------
class MockBox:
    def __init__(self, robot_id: str, current_version: str, should_fail_health: bool = False):
        self.robot_id = robot_id
        self.version = current_version
        self.should_fail_health = should_fail_health
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"box-{robot_id}")
        self.client.connect(BROKER, PORT, 60)
        self.client.loop_start()
        self.client.subscribe(f"{BASE}/{robot_id}/command", qos=1)
        self.client.on_message = self._on_message

    def _publish_status(self, state: str, progress: int, message: str, campaign_id: str = ""):
        payload = json.dumps({
            "campaign_id": campaign_id, "state": state,
            "version": self.version, "progress": progress,
            "message": message, "reported_at": now_iso(),
        }, ensure_ascii=False)
        self.client.publish(f"{BASE}/{robot_id}/status", payload, qos=1)
        print(f"  [{self.robot_id}] -> {state} {progress}% {message}")

    def _on_message(self, client, userdata, msg):
        cmd = json.loads(msg.payload.decode("utf-8"))
        print(f"  [{self.robot_id}] << command: {cmd.get('type')} {cmd.get('package_id')}")
        threading.Thread(target=self._handle, args=(cmd,), daemon=True).start()

    def _handle(self, cmd: dict):
        campaign_id = cmd.get("campaign_id", "")
        new_version = cmd.get("version", "1.2.0")
        try:
            # 1) DOWNLOADING
            self._publish_status("DOWNLOADING", 10, "start download", campaign_id)
            time.sleep(0.5)  # 模拟下载

            # 2) VERIFYING
            self._publish_status("VERIFYING", 50, "verify sha256", campaign_id)
            # 本地校验: 检查 download_url 指向的文件是否存在且哈希匹配
            url = cmd.get("download_url", "").replace("http://ota.local/", "")
            if url and os.path.exists(url):
                actual = sha256_of(url)
                if actual != cmd.get("sha256"):
                    raise ValueError(f"sha256 mismatch: {actual[:8]} != {cmd.get('sha256','')[:8]}")
            time.sleep(0.3)

            # 3) INSTALLING
            self._publish_status("INSTALLING", 70, "install (mock)", campaign_id)
            time.sleep(0.5)

            # 4) HEALTH_CHECK
            self._publish_status("HEALTH_CHECK", 90, "health check", campaign_id)
            if self.should_fail_health:
                raise RuntimeError("health check failed (simulated)")
            time.sleep(0.3)

            # 5) SUCCESS
            self.version = new_version
            self._publish_status("SUCCESS", 100, "upgrade success", campaign_id)
        except Exception as e:
            print(f"  [{self.robot_id}] !! {e}")
            # 回滚
            self._publish_status("FAILED", 100, str(e), campaign_id)
            time.sleep(0.2)
            self._publish_status("ROLLED_BACK", 100, f"rolled back to {cmd.get('rollback_version', self.version)}", campaign_id)

# ---------- Mock Dashboard 订阅者 ----------
class Dashboard:
    def __init__(self):
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="dashboard")
        self.client.connect(BROKER, PORT, 60)
        self.client.loop_start()
        self.client.subscribe(f"{BASE}/+/status", qos=1)
        self.client.on_message = self._on_status

    def _on_status(self, client, userdata, msg):
        data = json.loads(msg.payload.decode("utf-8"))
        robot_id = msg.topic.split("/")[2]
        print(f"[Dashboard] {robot_id}: {data['state']:14s} {data['progress']:>3d}% v{data['version']} - {data['message']}")

# ---------- Mock ota-server: 上传包 + 创建批次 ----------
def upload_and_dispatch(package_path: str, robot_ids: list, rollout: str = "full"):
    """模拟 ota-server 的行为: 计算哈希, 构造 command, 逐台下发"""
    sha = sha256_of(package_path)
    print(f"[ota-server] package={package_path} sha256={sha[:16]}...")

    total = len(robot_ids)
    if rollout == "10pct":
        selected = robot_ids[:max(1, total // 10)]
    elif rollout == "50pct":
        selected = robot_ids[:total // 2]
    else:
        selected = robot_ids

    pub = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="ota-server")
    pub.connect(BROKER, PORT, 60)
    pub.loop_start()

    for i, rid in enumerate(selected):
        cmd = {
            "type": "UPGRADE",
            "campaign_id": f"cmp-demo-{int(time.time())}-{i}",
            "package_id": Path(package_path).stem,
            "version": "1.2.0",
            "download_url": f"http://ota.local/{package_path}",
            "sha256": sha,
            "signature": "MOCK_SIGNATURE",  # mock 环境不真验签, 真实环境用 RSA
            "public_key_id": "key-2026-01",
            "target": "adapter-kit",
            "restart_service": "roboticsops-edge",
            "rollback_version": "1.1.3",
            "issued_at": now_iso(),
        }
        topic = f"{BASE}/{rid}/command"
        pub.publish(topic, json.dumps(cmd, ensure_ascii=False), qos=1)
        print(f"[ota-server] -> {rid} command sent")
        time.sleep(0.2)

    pub.loop_stop()
    pub.disconnect()

# ---------- 准备一个假升级包 ----------
def prepare_dummy_package(path: str = "pkg-adapter-kit-1.2.0.tar.gz") -> str:
    """创建一个真实存在的 tar.gz 用于校验哈希 (内容无意义, 仅验证流程)"""
    if os.path.exists(path):
        return path
    import tarfile
    with tarfile.open(path, "w:gz") as tar:
        # 写一个假 manifest
        manifest = json.dumps({"version": "1.2.0", "target": "adapter-kit"}).encode()
        info = tarfile.TarInfo(name="manifest.json")
        info.size = len(manifest)
        tar.addfile(info, io=__import__("io").BytesIO(manifest))
    print(f"[setup] created dummy package: {path} ({os.path.getsize(path)} bytes)")
    return path

# ---------- 主流程 ----------
def main():
    print("=" * 60)
    print("Robot-Ops-Solo 轻量 OTA - Mock 验证")
    print("=" * 60)

    # 1) 准备假包
    pkg = prepare_dummy_package()

    # 2) 启动 Dashboard 订阅者
    print("\n[1] 启动 Dashboard 订阅者...")
    dashboard = Dashboard()
    time.sleep(0.5)

    # 3) 启动 3 个 mock 盒子 (其中 FANUC 那台模拟健康检查失败, 演示回滚)
    print("[2] 启动 mock 盒子 (FANUC_M20iD_001 将模拟失败回滚)...")
    boxes = [
        MockBox("KUKA_KR210_002", "1.1.3", should_fail_health=False),
        MockBox("ESTUN_ER3A_001", "1.1.3", should_fail_health=False),
        MockBox("FANUC_M20iD_001", "1.1.3", should_fail_health=True),  # 失败用例
    ]
    time.sleep(0.5)

    # 4) 模拟 ota-server 上传包 + 全量下发
    print("\n[3] ota-server: 上传包 + 全量下发 (3 台)...")
    upload_and_dispatch(pkg, [b.robot_id for b in boxes], rollout="full")

    # 5) 等待流程跑完
    print("\n[4] 等待升级流程完成...")
    time.sleep(6)

    print("\n" + "=" * 60)
    print("验证结果:")
    for b in boxes:
        print(f"  {b.robot_id}: 最终版本 = {b.version}")
    print("=" * 60)
    print("预期: KUKA + ESTUN -> SUCCESS v1.2.0 ; FANUC -> FAILED -> ROLLED_BACK v1.1.3")

    # 清理
    for b in boxes:
        b.client.loop_stop()
        b.client.disconnect()
    dashboard.client.loop_stop()
    dashboard.client.disconnect()

if __name__ == "__main__":
    main()
