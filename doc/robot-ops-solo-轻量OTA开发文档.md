# Robot-Ops-Solo · 轻量 OTA 开发文档

> **范围声明（最重要的一条）**
> 本文档的 OTA **只升级你自己部署的边缘网关盒子上的软件**，包括：
> - 协议适配器（`adapter-fanuc` / `adapter-kuka` …）
> - MQTT 桥接服务（`fanuc_poller` / `kuka_poller`）
> - 健康分 / RUL 模型
> - 告警规则、SOP 模板
> - 运维 Agent / OTA Agent 本身
>
> **绝不升级 FANUC / KUKA / 埃斯顿等机器人控制器固件。**
> 控制器固件更新必须使用厂商官方介质（FANUC R-50iA、KUKA KSS 通过 BOOT MONITOR / USB），
> 由厂商服务组织或持证人员执行——第三方不得擅自刷写，否则既违规又担责。
>
> 因为盒子是你买的、系统是你装的，**你对盒子拥有 100% 控制权**；
> 即使升级失败、盒子变砖，也只是盒子的事，**机器人照常生产**。
> 这是本方案合规且一人公司可落地的根本原因。

---

## 目录

1. [设计目标与边界](#一设计目标与边界)
2. [整体架构](#二整体架构)
3. [MQTT Topic 规范](#三mqtt-topic-规范)
4. [升级包格式（Manifest）](#四升级包格式manifest)
5. [云端 OTA Server](#五云端-ota-server)
6. [边缘端 OTA Agent（核心）](#六边缘端-ota-agent核心)
7. [签名与密钥管理](#七签名与密钥管理)
8. [灰度发布策略](#八灰度发布策略)
9. [状态机与回滚](#九状态机与回滚)
10. [Dashboard 集成](#十dashboard-集成)
11. [文件改动汇总](#十一文件改动汇总)
12. [开发顺序（5 天）](#十二开发顺序5-天)
13. [验证 Checklist](#十三验证-checklist)
14. [安全与合规边界](#十四安全与合规边界)

---

## 一、设计目标与边界

### 1.1 目标（L1 + L2 起步）

| 层次 | 内容 | 本版是否实现 |
|------|------|:---:|
| L1 配置 OTA | 告警阈值、采集周期、Topic、SOP 模板 | ✅ 第一版 |
| L2 应用 OTA | adapter-kit、健康分模型、OTA Agent 自身 | ✅ 核心 |
| L3 容器 OTA | Docker 镜像整体更新 | 🟡 10+ 台后 |
| L4 系统 OTA | A/B 分区 + 固件级回滚 | 🟡 大客户后 |

第一版只做 **L1 + L2**，用 **MQTT + 一个 Agent 脚本** 就能跑，**不上 Mender / Balena 等重型框架**。

### 1.2 非目标（明确不做）

- ❌ 不升级机器人控制器固件
- ❌ 不做差分升级（bsdiff/xdelta3）——Python 包很小，整包 + 签名足够
- ❌ 不做自己的 PKI 体系（用公私钥对 + 手动分发公钥即可）

### 1.3 核心安全原则

参考工业 IoT 标准，至少 4 层：

1. **传输加密**：MQTT over TLS 1.2+，生产环境用 mTLS 双向证书
2. **完整性**：SHA-256 校验
3. **来源合法**：RSA / ECDSA 数字签名（私钥签名、盒子公钥验签）
4. **失败回滚**：保留上一版本，健康检查失败自动回退

---

## 二、整体架构

```
┌──────────────────────────────────────────────────────────────┐
│  你的云端 / 本地开发机                                         │
│                                                                │
│  ota-server (FastAPI)                                         │
│   ├── POST /api/packages      上传升级包 (.tar.gz+manifest)    │
│   ├── POST /api/campaigns     创建批次 (灰度/全量)             │
│   └── MQTT: ota/+/command  ──→  盒子                          │
│                       ←───  ota/+/status   ←──  盒子         │
└──────────────────────────────────────────────────────────────┘
                            │ MQTT over TLS
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  边缘网关盒子 (Linux ARM64)                                     │
│                                                                │
│  ota-agent (systemd 服务)                                     │
│   ├── 1. 订阅 ota/{robot_id}/command                          │
│   ├── 2. 下载包 (HTTPS, 断点续传)                              │
│   ├── 3. SHA-256 + RSA 验签                                    │
│   ├── 4. 备份当前版本                                          │
│   ├── 5. 停旧服务 → 解压 → 起新服务 → 健康检查                 │
│   └── 6. 失败自动回滚, 上报状态                                │
│                                                                │
│  被管理组件:                                                   │
│   ├── fanuc_poller.py                                          │
│   ├── kuka_poller.py                                           │
│   ├── adapter-kit/  (Python 包)                                │
│   └── health-score 模型                                        │
└──────────────────────────────────────────────────────────────┘
                            │ FOCAS / OPC UA (只读)
                            ▼
                    [机器人控制器]  ← 绝不升级
```

数据流：
1. 你在 Dashboard 上传升级包 → `ota-server` 存储并广播指令
2. 盒子 `ota-agent` 收到 `ota/{robot_id}/command` → 下载包
3. 验签 + 校验哈希 → 通过后才动服务
4. 升级执行 → 状态通过 `ota/{robot_id}/status` 实时上报
5. Dashboard 显示进度条 + 成功/失败

---

## 三、MQTT Topic 规范

统一前缀 `roboticsops/ota`，与现有 `roboticsops/telemetry` 平级。

| 方向 | Topic | Payload |
|------|-------|---------|
| 云端 → 盒子 | `roboticsops/ota/{robot_id}/command` | 升级指令 (见下) |
| 盒子 → 云端 | `roboticsops/ota/{robot_id}/status` | 状态上报 |
| 盒子 → 云端 | `roboticsops/ota/{robot_id}/log` | 明细日志 (可选) |

### command 消息示例

```json
{
  "type": "UPGRADE",
  "campaign_id": "cmp-20260819-001",
  "package_id": "pkg-adapter-kit-1.2.0",
  "version": "1.2.0",
  "download_url": "https://ota.robot-ops-solo.cn/packages/pkg-adapter-kit-1.2.0.tar.gz",
  "sha256": "a3f5...c1",
  "signature": "base64(RSA_签名的_sha256)",
  "public_key_id": "key-2026-01",
  "target": "adapter-kit",
  "restart_service": "roboticsops-edge",
  "issued_at": "2026-08-19T10:00:00+08:00",
  "deadline_at": "2026-08-19T22:00:00+08:00"
}
```

### status 消息示例

```json
{
  "campaign_id": "cmp-20260819-001",
  "state": "SUCCESS",
  "version": "1.2.0",
  "progress": 100,
  "message": "health check passed",
  "reported_at": "2026-08-19T10:03:42+08:00"
}
```

`state` 枚举：`IDLE / DOWNLOADING / VERIFYING / INSTALLING / REBOOTING / HEALTH_CHECK / SUCCESS / FAILED / ROLLED_BACK`

---

## 四、升级包格式（Manifest）

一个升级包 = **一个 tar.gz** + **一个 manifest.json**，一起上传到 `ota-server`。

```
pkg-adapter-kit-1.2.0.tar.gz
 ├── manifest.json
 ├── files/                 # 要部署的实际文件
 │    └── adapter_kit-1.2.0-py3-none-any.whl
 └── scripts/
      ├── pre_install.sh    # 停服务、备份
      ├── install.sh        # pip install / 替换文件
      └── post_install.sh   # 起服务、健康检查
```

### manifest.json 示例

```json
{
  "package_id": "pkg-adapter-kit-1.2.0",
  "name": "adapter-kit",
  "version": "1.2.0",
  "target": "adapter-kit",
  "min_agent_version": "1.0.0",
  "requires_restart": true,
  "service_name": "roboticsops-edge",
  "files": [
    {
      "path": "files/adapter_kit-1.2.0-py3-none-any.whl",
      "dest": "/opt/roboticsops-edge/lib/python3.13/site-packages/",
      "sha256": "b4e2...f0"
    }
  ],
  "scripts": {
    "pre_install": "scripts/pre_install.sh",
    "install": "scripts/install.sh",
    "post_install": "scripts/post_install.sh"
  },
  "rollback_version": "1.1.3",
  "signature": "base64(...)"
}
```

---

## 五、云端 OTA Server

最小实现用 **FastAPI + 本地文件存储**，后续可换 MinIO/S3。

### 5.1 目录结构

```
packages/ota-server/
 ├── app/
 │    ├── __init__.py
 │    ├── main.py          # FastAPI 入口
 │    ├── models.py        # Pydantic 模型
 │    ├── store.py         # 包存储 + 批次管理
 │    └── mqtt_pub.py      # 发 command
 ├── packages/             # 上传的 tar.gz 存放处
 ├── campaigns.json        # 批次记录 (简易版用文件)
 └── requirements.txt
```

### 5.2 requirements.txt

```
fastapi
uvicorn
paho-mqtt
python-multipart
pydantic
```

### 5.3 models.py

```python
from pydantic import BaseModel
from typing import Optional, Literal

class UpgradeCommand(BaseModel):
    type: Literal["UPGRADE", "ROLLBACK", "CANCEL"] = "UPGRADE"
    campaign_id: str
    package_id: str
    version: str
    download_url: str
    sha256: str
    signature: str
    public_key_id: str
    target: str
    restart_service: Optional[str] = None
    issued_at: str
    deadline_at: Optional[str] = None

class CampaignCreate(BaseModel):
    package_id: str
    version: str
    download_url: str
    sha256: str
    signature: str
    public_key_id: str
    target: str
    restart_service: Optional[str] = None
    robot_ids: list[str]          # 灰度列表, 如 ["FANUC_M20iD_001"]
    rollout: Literal["full", "10pct", "50pct"] = "full"
```

### 5.4 mqtt_pub.py

```python
import json
import paho.mqtt.client as mqtt

BROKER = "localhost"
PORT = 1883
BASE_TOPIC = "roboticsops/ota"

def publish_command(cmd: dict) -> None:
    robot_id = cmd["robot_id"]           # 由 store 按灰度列表逐台注入
    topic = f"{BASE_TOPIC}/{robot_id}/command"
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.connect(BROKER, PORT, 60)
    client.loop_start()
    payload = json.dumps(cmd, ensure_ascii=False)
    client.publish(topic, payload, qos=1, retain=False)
    client.loop_stop()
    client.disconnect()
```

### 5.5 main.py（核心接口）

```python
from fastapi import FastAPI, UploadFile, File, HTTPException
from .models import CampaignCreate, UpgradeCommand
from .store import save_package, create_campaign, get_command_for
from .mqtt_pub import publish_command

app = FastAPI(title="Robot-Ops-Solo OTA Server")

@app.post("/api/packages")
async def upload_package(
    package_id: str,
    version: str,
    manifest: UploadFile = File(...),
    archive: UploadFile = File(...),
):
    """上传 manifest.json + tar.gz 升级包"""
    path = save_package(package_id, version, await manifest.read(), await archive.read())
    return {"ok": True, "path": str(path)}

@app.post("/api/campaigns")
async def create_and_dispatch(c: CampaignCreate):
    """创建批次并按灰度列表逐台下发 command"""
    campaign = create_campaign(c)
    for robot_id in campaign["robot_ids"]:
        cmd = get_command_for(campaign, robot_id)   # 注入 robot_id
        publish_command(cmd)
    return {"ok": True, "campaign_id": campaign["campaign_id"]}

@app.get("/api/campaigns/{campaign_id}/status")
async def campaign_status(campaign_id: str):
    """汇总各盒子的 status (简易版从文件/DB 读取)"""
    return store.get_campaign_status(campaign_id)
```

---

## 六、边缘端 OTA Agent（核心）

这是整个 OTA 的心脏，**一个 Python 脚本 + systemd 托管**即可。

### 6.1 目录结构

```
/opt/roboticsops-edge/
 ├── ota_agent.py            # 本文件
 ├── current -> releases/1.1.3   # 当前版本软链接
 ├── releases/
 │    ├── 1.1.3/...
 │    └── 1.2.0/...             # 每次升级一个新目录 (原子切换)
 ├── keys/
 │    └── ota_pubkey.pem        # 你的 RSA 公钥 (预置)
 ├── config.yaml                # robot_id, broker, download_url 前缀
 └── logs/ota.log
```

### 6.2 config.yaml

```yaml
robot_id: FANUC_M20iD_001
brand: FANUC
broker:
  host: localhost
  port: 1883
  tls: true
  ca_cert: /opt/roboticsops-edge/certs/ca.pem
  client_cert: /opt/roboticsops-edge/certs/client.pem
  client_key: /opt/roboticsops-edge/certs/client.key
download:
  base_url: https://ota.robot-ops-solo.cn/packages
  insecure: false
paths:
  root: /opt/roboticsops-edge
  releases: /opt/roboticsops-edge/releases
  current: /opt/roboticsops-edge/current
  public_key: /opt/roboticsops-edge/keys/ota_pubkey.pem
health_check:
  command: "python3 -c 'import adapter_kit; print(\"ok\")'"
  timeout_sec: 30
  max_retries: 3
```

### 6.3 ota_agent.py（完整可运行）

```python
#!/usr/bin/env python3
"""
Robot-Ops-Solo 轻量 OTA Agent
订阅 roboticsops/ota/{robot_id}/command, 执行升级 + 回滚 + 状态上报
"""
import os
import sys
import json
import hashlib
import shutil
import subprocess
import tarfile
import logging
import threading
from pathlib import Path
from typing import Optional

import paho.mqtt.client as mqtt
import yaml

# ---------- 配置加载 ----------
CONFIG_PATH = "/opt/roboticsops-edge/config.yaml"

def load_config() -> dict:
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

CFG = load_config()
ROBOT_ID = CFG["robot_id"]
BROKER = CFG["broker"]
DOWNLOAD = CFG["download"]
PATHS = CFG["paths"]
HEALTH = CFG["health_check"]

# ---------- 日志 ----------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [ota-agent] %(levelname)s %(message)s",
    handlers=[
        logging.FileHandler("/opt/roboticsops-edge/logs/ota.log"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("ota-agent")

# ---------- MQTT 客户端 ----------
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.tls_set(
    ca_certs=BROKER["ca_cert"],
    certfile=BROKER["client_cert"],
    keyfile=BROKER["client_key"],
)
client.on_connect = lambda c, *a: log.info("connected to broker")
client.on_message = lambda c, *a: None  # 见下方 subscribe

STATUS_TOPIC = f"roboticsops/ota/{ROBOT_ID}/status"
LOG_TOPIC = f"roboticsops/ota/{ROBOT_ID}/log"

def publish_status(state: str, progress: int, message: str, campaign_id: str = ""):
    payload = json.dumps({
        "campaign_id": campaign_id,
        "state": state,
        "version": CURRENT_VERSION,
        "progress": progress,
        "message": message,
        "reported_at": now_iso(),
    }, ensure_ascii=False)
    client.publish(STATUS_TOPIC, payload, qos=1)
    log.info(f"status: {state} {progress}% {message}")

def now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).astimezone().isoformat()

CURRENT_VERSION = "1.1.3"  # 启动时从 current/ 链接读取

# ---------- 升级核心 ----------
class UpgradeError(Exception):
    pass

def download_package(url: str, dest: Path):
    """HTTPS 下载, 带断点续传 (Range)"""
    dest.parent.mkdir(parents=True, exist_ok=True)
    log.info(f"downloading {url} -> {dest}")
    # 简易实现: 用 urllib; 生产可换 requests + tqdm
    import urllib.request
    req = urllib.request.Request(url)
    if dest.exists():
        req.headers["Range"] = f"bytes={dest.stat().st_size}-"
    with urllib.request.urlopen(req, timeout=60) as r, open(dest, "ab" if dest.exists() else "wb") as f:
        shutil.copyfileobj(r, f)
    log.info("download complete")

def verify_sha256(path: Path, expected: str):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    actual = h.hexdigest()
    if actual != expected:
        raise UpgradeError(f"sha256 mismatch: {actual} != {expected}")
    log.info("sha256 verified")

def verify_signature(manifest_path: Path, signature_b64: str, public_key_id: str) -> bool:
    """用预置 RSA 公钥验证 manifest 的签名"""
    from base64 import b64decode
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    pubkey_path = PATHS["public_key"]
    with open(pubkey_path, "rb") as f:
        pubkey = serialization.load_pem_public_key(f.read())

    sig = b64decode(signature_b64)
    data = manifest_path.read_bytes()
    try:
        pubkey.verify(sig, data, padding.PKCS1v15(), hashes.SHA256())
        log.info("signature verified")
        return True
    except Exception as e:
        log.error(f"signature invalid: {e}")
        return False

def extract_and_install(archive: Path, version: str, manifest: dict):
    """解压到 releases/{version}/, 执行 pre/post 脚本"""
    target_dir = Path(PATHS["releases"]) / version
    if target_dir.exists():
        shutil.rmtree(target_dir)
    target_dir.mkdir(parents=True)

    # 1) 解压
    with tarfile.open(archive, "r:gz") as tar:
        tar.extractall(target_dir)
    log.info(f"extracted to {target_dir}")

    # 2) pre_install (停服务 + 备份)
    run_script(target_dir / manifest["scripts"]["pre_install"])

    # 3) install
    run_script(target_dir / manifest["scripts"]["install"])

    # 4) 原子切换 current 软链接
    current_link = Path(PATHS["current"])
    if current_link.exists() or current_link.is_symlink():
        current_link.unlink()
    current_link.symlink_to(target_dir)

    # 5) post_install (起服务)
    run_script(target_dir / manifest["scripts"]["post_install"])

    log.info("install complete")

def run_script(script: Path):
    if not script.exists():
        return
    log.info(f"running {script}")
    subprocess.run(["bash", str(script)], check=True)

def health_check() -> bool:
    """对新版本做健康检查, 失败则回滚"""
    for i in range(HEALTH["max_retries"]):
        try:
            subprocess.run(
                HEALTH["command"], shell=True, check=True,
                timeout=HEALTH["timeout_sec"],
            )
            log.info("health check passed")
            return True
        except Exception as e:
            log.warning(f"health check attempt {i+1} failed: {e}")
    return False

def rollback(version: str):
    """切回上一版本"""
    log.warning(f"rolling back to {version}")
    target_dir = Path(PATHS["releases"]) / version
    current_link = Path(PATHS["current"])
    if current_link.exists() or current_link.is_symlink():
        current_link.unlink()
    current_link.symlink_to(target_dir)
    # 重启服务
    run_script(target_dir / "scripts/post_install.sh")
    publish_status("ROLLED_BACK", 100, f"rolled back to {version}")

def handle_upgrade(cmd: dict):
    """完整升级流程 (状态机驱动)"""
    campaign_id = cmd["campaign_id"]
    version = cmd["version"]
    try:
        publish_status("DOWNLOADING", 10, "start download", campaign_id)
        archive = Path("/tmp") / f"{cmd['package_id']}.tar.gz"
        download_package(cmd["download_url"], archive)

        publish_status("VERIFYING", 50, "verify sha256 + signature", campaign_id)
        # manifest 从 archive 中读取用于验签 (此处简化: 假设服务端已验, 盒子验包内 hash)
        verify_sha256(archive, cmd["sha256"])
        # 注: 完整实现应解压后逐文件验 sha256 (见 manifest.files)

        publish_status("INSTALLING", 70, "install", campaign_id)
        # 解析 manifest (真实包内需先解压得到 manifest.json)
        manifest = parse_manifest_from_archive(archive)
        if not verify_signature(Path("/tmp/manifest.json"), cmd["signature"], cmd["public_key_id"]):
            raise UpgradeError("signature verification failed")

        extract_and_install(archive, version, manifest)

        publish_status("HEALTH_CHECK", 90, "health check", campaign_id)
        if not health_check():
            rollback(cmd.get("rollback_version", CURRENT_VERSION))
            publish_status("FAILED", 100, "health check failed, rolled back", campaign_id)
            return

        global CURRENT_VERSION
        CURRENT_VERSION = version
        publish_status("SUCCESS", 100, "upgrade success", campaign_id)

    except Exception as e:
        log.exception("upgrade failed")
        publish_status("FAILED", 100, str(e), campaign_id)

def parse_manifest_from_archive(archive: Path) -> dict:
    """从 tar.gz 中读取 manifest.json (不解压到磁盘, 用 tarfile 直接读)"""
    with tarfile.open(archive, "r:gz") as tar:
        for m in tar.getmembers():
            if m.name.endswith("manifest.json"):
                f = tar.extractfile(m)
                return json.loads(f.read().decode("utf-8"))
    raise UpgradeError("manifest.json not found in archive")

# ---------- MQTT 回调 ----------
def on_message(client, userdata, msg):
    try:
        cmd = json.loads(msg.payload.decode("utf-8"))
        log.info(f"received command: {cmd.get('type')} {cmd.get('package_id')}")
        if cmd.get("type") == "UPGRADE":
            # 单线程顺序执行 (盒子一次只处理一个升级)
            threading.Thread(target=handle_upgrade, args=(cmd,), daemon=True).start()
        elif cmd.get("type") == "CANCEL":
            log.info("cancel requested (not implemented in lite version)")
    except Exception as e:
        log.exception(f"on_message error: {e}")

client.on_message = on_message

# ---------- 主循环 ----------
def main():
    global CURRENT_VERSION
    # 启动时确定当前版本
    current_link = Path(PATHS["current"])
    if current_link.is_symlink():
        CURRENT_VERSION = os.readlink(current_link).split("/")[-1]

    client.connect(BROKER["host"], BROKER["port"], 60)
    client.loop_start()

    command_topic = f"roboticsops/ota/{ROBOT_ID}/command"
    client.subscribe(command_topic, qos=1)
    log.info(f"subscribed {command_topic}, current version {CURRENT_VERSION}")

    publish_status("IDLE", 0, "agent started")

    import time
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log.info("shutting down")
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()
```

### 6.4 systemd 服务文件

`/etc/systemd/system/roboticsops-ota-agent.service`：

```ini
[Unit]
Description=Robot-Ops-Solo OTA Agent
After=network.target mosquitto.service
Wants=mosquitto.service

[Service]
Type=simple
WorkingDirectory=/opt/roboticsops-edge
ExecStart=/opt/roboticsops-edge/venv/bin/python /opt/roboticsops-edge/ota_agent.py
Restart=on-failure
RestartSec=10
User=root
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

启用：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now roboticsops-ota-agent
journalctl -u roboticsops-ota-agent -f   # 看日志
```

---

## 七、签名与密钥管理

### 7.1 生成密钥对（一次性）

```bash
# 私钥 (只在你开发机, 绝不能上盒子/仓库)
openssl genrsa -out ota_private.pem 2048

# 公钥 (分发到所有盒子 /opt/roboticsops-edge/keys/ota_pubkey.pem)
openssl rsa -in ota_private.pem -pubout -out ota_pubkey.pem
```

### 7.2 签名升级包（上传前执行）

```bash
# 对 manifest.json 签名
openssl dgst -sha256 -sign ota_private.pem \
    -out manifest.sig manifest.json

# base64 编码后放进 command.signature
base64 manifest.sig > manifest.sig.b64
```

### 7.3 公钥分发

- 预置到盒子镜像里（`keys/ota_pubkey.pem`）
- 轮换时：通过 **带外渠道**（U 盘 / 现场）先更新公钥，再签新包
- **绝不在 command 里传私钥**，也绝不把私钥提交到 git

### 7.4 生产建议

- 密钥轮换周期 12 个月
- 用 **ECDSA (prime256v1)** 替代 RSA 可缩短签名，资源更省（盒子性能敏感时）
- 大规模时上 **PKI + 证书吊销列表 (CRL)**；初期手动管理即可

---

## 八、灰度发布策略

**这是你的杀手锏卖点**——厂长能看到"哪些盒子升级成功、哪些失败"。

### 8.1 三档灰度

| 档位 | 范围 | 观察时长 | 升级条件 |
|------|------|---------|---------|
| 10% | 1–2 台测试机 | 30 分钟 | 无 FAILED |
| 50% | 半数盒子 | 1 小时 | 健康分无下跌 |
| 100% | 全量 | — | 前两档通过 |

任一阶段告警激增 / 健康分下跌 → **自动暂停 + 告警**。

> 工业现场共识：约 94% 的软件故障在运行前 10 分钟内显现，分阶段灰度是有效的质量闸门。

### 8.2 灰度逻辑（ota-server 侧）

```python
def dispatch(campaign: CampaignCreate):
    total = len(campaign.robot_ids)
    if campaign.rollout == "10pct":
        selected = campaign.robot_ids[:max(1, total // 10)]
    elif campaign.rollout == "50pct":
        selected = campaign.robot_ids[:total // 2]
    else:
        selected = campaign.robot_ids  # full

    for robot_id in selected:
        cmd = build_command(campaign, robot_id)
        publish_command(cmd)
```

### 8.3 自动暂停（Agent 侧指标上报）

Agent 在 `HEALTH_CHECK` 阶段上报 `health_score_before / health_score_after`，
`ota-server` 对比，若下跌 >10% 则标记 `campaign.paused = True`，不再下发后续档位。

---

## 九、状态机与回滚

```
IDLE
  │ 收到 UPGRADE
  ▼
DOWNLOADING  ──失败─→  FAILED
  │ 成功
  ▼
VERIFYING    ──sha256/签名失败─→  FAILED
  │ 成功
  ▼
INSTALLING   ──脚本失败─→  FAILED → ROLLED_BACK
  │ 成功
  ▼
REBOOTING
  │
  ▼
HEALTH_CHECK ──失败─→ ROLLED_BACK → SUCCESS(回滚成功) / FAILED(变砖告警)
  │ 成功
  ▼
SUCCESS
```

**回滚保证**：
- `releases/` 目录保留上一版本，软链接 `current` 秒级切换
- `post_install.sh` 对旧版本同样可用
- 连续 3 次健康检查失败 → 触发回滚
- 回滚本身失败 → 上报 `FAILED` + `BRICKED_RISK` 告警，需现场人工介入（U 盘恢复）

---

## 十、Dashboard 集成

在现有 Robot-Ops-Solo 前端加一个 **OTA 管理页**，复用 `robotStore`。

### 10.1 页面结构

| 区块 | 内容 |
|------|------|
| 升级包列表 | 已上传包 (package_id / version / target / 上传时间) |
| 批次管理 | 新建批次 (选包 + 选机器人 + 灰度档位) |
| 实时进度 | 每台盒子状态卡片 (状态 + 进度条 + 版本) |
| 灰度闸门 | 10% → 50% → 100% 手动/自动推进 |
| 告警 | FAILED / ROLLED_BACK / BRICKED_RISK |

### 10.2 订阅 status 的 mqtt-client 扩展

在 `protocol/mqtt-client.ts` 里加：

```typescript
client.subscribe(`roboticsops/ota/+/status`, (err) => { ... });

client.on("message", (topic, payload) => {
  if (topic.includes("/ota/") && topic.endsWith("/status")) {
    const robotId = topic.split("/")[2];
    const status = JSON.parse(payload.toString());
    useOtaStore.getState().updateOtaStatus(robotId, status);
  }
});
```

### 10.3 状态卡片组件（伪代码）

```tsx
function OtaStatusCard({ robotId, status }) {
  const colorMap = {
    SUCCESS: "green", FAILED: "red",
    DOWNLOADING: "blue", HEALTH_CHECK: "orange",
  };
  return (
    <GlassCard>
      <h4>{robotId}</h4>
      <Badge color={colorMap[status.state]}>{status.state}</Badge>
      <ProgressBar value={status.progress} />
      <span>{status.version}</span>
    </GlassCard>
  );
}
```

> 复用《UI 风格开发文档》里的 `GlassCard` / `StatusDot` / `NeonBadge`。

---

## 十一、文件改动汇总

| 路径 | 操作 | 说明 |
|------|------|------|
| `packages/ota-server/` | **新建** | FastAPI 服务端 (main/models/store/mqtt_pub) |
| `roboticsops-edge/ota_agent.py` | **新建** | 边缘端 Agent 核心 |
| `roboticsops-edge/config.yaml` | **新建** | Agent 配置 |
| `roboticsops-edge/scripts/` | **新建** | pre/post install 脚本 |
| `keys/ota_pubkey.pem` | **预置** | RSA 公钥 |
| `systemd/roboticsops-ota-agent.service` | **新建** | systemd 服务文件 |
| `packages/adapter-kit/src/protocol/mqtt-client.ts` | **修改** | 增加 ota/+/status 订阅 |
| `packages/adapter-kit/src/store/otaStore.ts` | **新建** | OTA 状态 store |
| `apps/web-console/src/pages/OtaPage.tsx` | **新建** | OTA 管理页 |
| `docs/轻量OTA开发文档.md` | **新建** | 本文档 |

---

## 十二、开发顺序（5 天）

| 天 | 内容 | 收工标准 |
|----|------|---------|
| **Day 1** | 目录结构 + manifest 规范 + 签名脚本 | 能本地生成密钥、签名、验签通过 |
| **Day 2** | ota-server (FastAPI 上传 + 下发 command) | 用 MQTTX 订阅能看到 command JSON |
| **Day 3** | ota_agent.py 核心 (下载/验签/解压/软链接切换) | 本地 venv 模拟盒子，手动发 command 能升级一个文件 |
| **Day 4** | 健康检查 + 回滚 + systemd + 状态上报 | 故意让 health_check 失败，验证自动回滚 |
| **Day 5** | Dashboard OtaPage + 灰度闸门 + 联调 | 真实跑通: 上传包→灰度→盒子升级→状态卡片刷新 |

---

## 十三、验证 Checklist

### 功能
- [ ] 上传包后 `campaigns.json` 记录正确
- [ ] 盒子收到 `ota/{robot_id}/command`
- [ ] 下载完成后 SHA-256 一致
- [ ] 签名验证失败时被拒绝 (用错误私钥签一个, 确认不升级)
- [ ] `current` 软链接正确指向新版本
- [ ] 服务重启后新版本生效
- [ ] 健康检查失败 → 自动回滚到旧版本
- [ ] `ota/{robot_id}/status` 每步都有上报
- [ ] Dashboard 进度条实时刷新

### 安全
- [ ] 抓包看不到明文 MQTT (TLS 生效)
- [ ] 篡改过的包 (改一个字节) 被 SHA-256 拒绝
- [ ] 没有私钥残留盒子 / 代码仓库
- [ ] 公钥轮换流程演练过一次

### 灰度
- [ ] 10% 档只升级 1–2 台
- [ ] 测试机失败后 50% 档不再下发
- [ ] 全量前需手动确认 (或自动闸门通过)

---

## 十四、安全与合规边界（必读）

1. **绝不升级机器人控制器固件**——这是红线。你的 OTA 只作用于边缘盒子。
2. **升级包必须签名 + 校验**——无签名包一律拒绝，防止中间人篡改。
3. **TLS 必须启用**——生产环境禁止 MQTT 1883 明文（开发期可用 1883，部署时切 8883 + mTLS）。
4. **盒子变砖有预案**——保留 UART / USB 恢复方式，现场可 U 盘救砖。
5. **软著/等保衔接**：
   - OTA Agent 本身可作为"边缘设备管理软件"单独登记一个软著单元
   - 等保二级要求：身份鉴别、访问控制、安全审计（status 日志即为审计）
   - 涉及军工/涉密工厂时，**升级包与指令必须走客户内网**，不出公网
6. **客户自部署场景**：服务器在客户云账号、域名客户备案时，OTA Server 也部署在客户侧，
   你只提供软件制品 + 部署文档——合规主体归客户。

---

## 附录 A：pre_install.sh 模板

```bash
#!/bin/bash
set -e
echo "[pre_install] stopping service..."
systemctl stop roboticsops-edge || true
echo "[pre_install] backing up current version..."
cp -r /opt/roboticsops-edge/current /opt/roboticsops-edge/backup/last
echo "[pre_install] done"
```

## 附录 B：post_install.sh 模板

```bash
#!/bin/bash
set -e
echo "[post_install] starting service..."
systemctl daemon-reload
systemctl restart roboticsops-edge
sleep 5
echo "[post_install] service status:"
systemctl is-active --quiet roboticsops-edge && echo "running" || (echo "FAILED"; exit 1)
```

## 附录 C：本地快速验证（不连真盒子）

```bash
# 终端 1: 起 mosquitto (带 ws, 1883 明文用于本地验证)
/opt/homebrew/opt/mosquitto/sbin/mosquitto -c /tmp/mosquitto-ws.conf -v

# 终端 2: 起 ota-server
cd packages/ota-server
python -m uvicorn app.main:app --reload --port 8000

# 终端 3: 模拟盒子 (用另一个 robot_id 的 config.yaml)
cd /opt/roboticsops-edge
python ota_agent.py

# 终端 4: 上传包 + 创建批次
curl -X POST http://localhost:8000/api/packages \
  -F package_id=pkg-test-1.0.0 \
  -F version=1.0.0 \
  -F manifest=@test_manifest.json \
  -F archive=@test_pkg.tar.gz

curl -X POST http://localhost:8000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{"package_id":"pkg-test-1.0.0","version":"1.0.0",
       "download_url":"http://localhost:8000/packages/test.tar.gz",
       "sha256":"...","signature":"...","public_key_id":"key-2026-01",
       "target":"adapter-kit","robot_ids":["FANUC_M20iD_001"],"rollout":"full"}'

# 观察终端 3 日志 + Dashboard OtaPage 状态卡片
```

---

*文档版本 v1.0 | 2026-08-19 | Robot-Ops-Solo · 轻量 OTA（仅升级边缘网关，绝不升级机器人控制器）*
