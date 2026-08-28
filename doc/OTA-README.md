# Robot-Ops-Solo · 轻量 OTA 配套文件说明

> 本文档配套 `robot-ops-solo-轻量OTA开发文档.md`（以下简称"主文档"）。
> 主文档含完整架构、Topic 规范、OTA Server / Agent 代码、签名、灰度、回滚、Dashboard 集成、Checklist 等，
> 本文件只说明**怎么把主文档里的代码跑起来验证**。

---

## 一、配套文件清单

| 文件 | 作用 | 对应主文档章节 |
|------|------|--------------|
| `robot-ops-solo-轻量OTA开发文档.md` | 完整开发文档（974 行，14 章 + 3 附录） | 全文 |
| `mock_ota_demo.py` | **本地 Mock 验证脚本**：不连真机，模拟 ota-server + 3 个盒子 + Dashboard，验证全链路 | 十二、十三 |
| `requirements-ota-mock.txt` | Mock 验证所需依赖 | 附录 C |

---

## 二、Mock 验证脚本做了什么

`mock_ota_demo.py` **不实现真实下载/验签/安装**（那是盒子侧生产逻辑），而是用本地进程模拟：

1. 创建一个真实存在的假升级包 `pkg-adapter-kit-1.2.0.tar.gz` 并计算 SHA-256
2. 启动一个 MQTT 订阅者模拟 **Dashboard**（订阅 `roboticsops/ota/+/status`）
3. 启动 3 个 `MockBox` 模拟盒子（其中 `FANUC_M20iD_001` 会模拟健康检查失败 → 演示回滚）
4. 模拟 `ota-server`：把 command 逐台下发到 `roboticsops/ota/{robot_id}/command`
5. 各盒子按状态机上报 `DOWNLOADING → VERIFYING → INSTALLING → HEALTH_CHECK → SUCCESS/FAILED → ROLLED_BACK`
6. 终端打印每台最终版本，**预期**：KUKA + ESTUN = SUCCESS v1.2.0，FANUC = ROLLED_BACK v1.1.3

> 用途：在**写真实 ota_agent.py 之前**，先用这个脚本把 **MQTT 指令流 + 状态机 + 灰度/回滚逻辑** 跑通、可视化，确保主文档设计可行。

---

## 三、前置条件

```bash
# 1. Python 3.13 venv（沿用你 roboticsops-edge 项目）
cd ~/Desktop/robot-ops-solo/roboticsops-edge
source venv/bin/activate

# 2. 装依赖
pip install -r requirements-ota-mock.txt

# 3. 本地 MQTT broker（Mosquitto，带 ws 端口也可）
#    用你之前跑通的启动方式：
/opt/homebrew/opt/mosquitto/sbin/mosquitto -c /tmp/mosquitto-ws.conf -v
# （若没 ws 配置，纯 1883 也够 mock 用）
```

---

## 四、运行步骤

```bash
# 确保 Mosquitto 在跑（终端 A）
/opt/homebrew/opt/mosquitto/sbin/mosquitto -v

# 终端 B：跑 mock 验证
cd ~/Desktop/robot-ops-solo/roboticsops-edge
source venv/bin/activate
python mock_ota_demo.py
```

预期终端输出（节选）：

```
[ota-server] package=pkg-adapter-kit-1.2.0.tar.gz sha256=a3f5...c1...
[ota-server] -> KUKA_KR210_002 command sent
[ota-server] -> ESTUN_ER3A_001 command sent
[ota-server] -> FANUC_M20iD_001 command sent

[Dashboard] KUKA_KR210_002: DOWNLOADING     10  v1.1.3 - start download
[Dashboard] KUKA_KR210_002: VERIFYING        50  v1.1.3 - verify sha256
...
[Dashboard] KUKA_KR210_002: SUCCESS        100  v1.2.0 - upgrade success
[Dashboard] FANUC_M20iD_001: FAILED         100  health check failed (simulated)
[Dashboard] FANUC_M20iD_001: ROLLED_BACK    100  rolled back to 1.1.3

验证结果:
  KUKA_KR210_002: 最终版本 = 1.2.0
  ESTUN_ER3A_001: 最终版本 = 1.2.0
  FANUC_M20iD_001: 最终版本 = 1.1.3
预期: KUKA + ESTUN -> SUCCESS v1.2.0 ; FANUC -> FAILED -> ROLLED_BACK v1.1.3
```

看到上述输出 = **OTA 状态机 + 灰度 + 回滚设计验证通过**。

---

## 五、从 Mock 到生产的迁移路径

| Mock 里的简化 | 主文档里的生产实现 | 你要做的 |
|--------------|------------------|---------|
| `MockBox._handle` 模拟流程 | `ota_agent.py` 的 `handle_upgrade` | 照主文档第六章实现真实下载/验签/软链接切换 |
| SHA-256 校验（不验签） | RSA/ECDSA 数字签名 + SHA-256 | 第七章生成密钥对，`signature` 字段真验 |
| 无真实文件部署 | `extract_and_install` + pre/post 脚本 | 写真实 `pre_install.sh` / `post_install.sh` |
| 无 Dashboard 页面 | `OtaPage.tsx` + `otaStore` | 第十章集成到 React 前端 |
| 无灰度闸门 | `rollout` 10%/50%/100% + 健康分对比暂停 | 在 ota-server 实现自动暂停 |

---

## 六、⚠️ 重要提醒（合规红线）

1. **此 OTA 只升级边缘网关盒子，绝不升级机器人控制器固件**——详见主文档开篇"范围声明"
2. Mock 脚本里 `signature` 字段是 `"MOCK_SIGNATURE"`，**生产环境必须替换为真实 RSA 签名验证**
3. 生产部署必须用 MQTT over TLS（8883 + mTLS），本地 mock 用 1883 明文仅用于验证
4. 任何涉及军工/涉密工厂，升级包与指令走**客户内网**，不出公网

---

## 七、推荐开发顺序（对照主文档第十二章）

```
Day 1: 跑通本 mock_ota_demo.py → 理解状态机
Day 2: 按主文档第五章建 ota-server（FastAPI 上传 + 下发 command）
Day 3: 按第六章实现真实 ota_agent.py（下载/验签/软链接切换）
Day 4: 健康检查 + 回滚 + systemd + status 上报
Day 5: 第十章 Dashboard OtaPage + 灰度闸门 + 联调
```

---

*配套说明 v1.0 | 2026-08-19 | Robot-Ops-Solo · 轻量 OTA（仅升级边缘网关，绝不升级机器人控制器）*
