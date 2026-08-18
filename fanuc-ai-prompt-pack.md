# FANUC 工业驱动 — AI Prompt 完整包

> **用途**：把这个文件的内容分段复制给 AI（Claude / GPT / Cursor / 通义千问都行），让它一次性产出可运行的 Python 代码。
> **目标读者**：0 基础，不懂 Python，但能复制粘贴命令。
> **最终效果**：边缘盒子上跑一个 Python 脚本 → 每 5 秒读 FANUC 机器人数据 → 输出 UDM JSON → 发到 MQTT → 你的 React 前端收到数据。

---

## 第一部分：发给 AI 的主 Prompt

> 复制下面**从 `---BEGIN PROMPT---` 到 `---END PROMPT---` 之间的全部内容**，发给 AI。

---BEGIN PROMPT---

我要写一个 Python 3.10+ 脚本，运行在 Linux 边缘网关（可能是 x86_64 或 ARM64 Ubuntu 22.04）上，功能是采集 FANUC 工业机器人的运行数据并推送到 MQTT。

## 硬件环境
- 边缘网关：Ubuntu 22.04（可能 x86_64 也可能 ARM64）
- 机器人：FANUC M-20iD/25，控制器 R-30iB Plus
- 网络：边缘网关和机器人在同一局域网（192.168.1.0/24）
- 机器人 FOCAS 端口：8193
- 机器人 Data Server HTTP 端口：80

## 功能需求
1. 连接 FANUC 机器人，读取：
   - 6 个关节的转矩负载率（%）
   - 6 个关节的电机温度（℃）
   - 当前所有活跃报警码
   - 通电总时长（小时）
   - 运行周期计数
2. 每 5 秒采集一次
3. 输出统一 JSON 格式（见下方）
4. 通过 MQTT 发布到 `roboticsops/telemetry` 主题
5. MQTT Broker 地址：localhost:1883（也支持远程 IP 配置）
6. 断线自动重连（MQTT 和机器人都要）
7. 支持通过环境变量或 .env 文件配置所有参数

## 输出 JSON 格式（UDM Schema）
```json
{
  "schema_version": "1.0",
  "robot_id": "FANUC_M20iD_001",
  "brand": "FANUC",
  "model": "M-20iD/25",
  "protocol": "FOCAS",
  "timestamp": "2026-08-18T10:00:00+08:00",
  "joints": [
    {"j": 1, "load_pct": 62, "temp_c": 41, "current_a": 3.1, "health_score": 88},
    {"j": 2, "load_pct": 118, "temp_c": 67, "current_a": 5.4, "health_score": 54}
  ],
  "alarms": [
    {
      "raw_code": "SRVO-023",
      "udm_code": "OVER_TEMP_J2",
      "severity": "warn",
      "zh_desc": "2轴伺服过热",
      "occurred_at": "2026-08-18T09:24:10+08:00",
      "cleared": false
    }
  ],
  "runtime": {
    "power_on_hours": 18432,
    "cycle_count": 120321
  }
}
```

## 报警码字典（至少包含以下映射）
| raw_code | udm_code | severity | zh_desc |
|-----------|----------|----------|---------|
| SRVO-023 | OVER_TEMP_J2 | warn | 2轴伺服过热 |
| SRVO-050 | BREAKER_OPEN | error | 伺服断开/断路器打开 |
| SRVO-062 | IMPROPER_CABLE | error | 编码器电缆异常 |
| SYST-001 | SYSTEM_ERROR | critical | 系统严重错误 |
| INTP-001 | PROGRAM_ERROR | error | 程序执行错误 |

## 双模式采集（重要）
请实现**两种采集方式**，自动检测哪个可用：

### 方式 A：FOCAS（首选）
- 使用 ctypes 调用 fwlib32.dll / libfwlib32.so
- 函数：cnc_allclibhndl3（建连）、cnc_rdalarm（读报警）、cnc_freelibhndl（断连）
- 关节数据：通过读取 R 寄存器（机器人侧 KAREL 程序把温度/负载写入 R[100]-R[111]）
- 通电时长：cnc_rdparam 读系统参数

### 方式 B：HTTP Data Server（备选）
- FANUC 控制器自带 HTTP 接口
- GET http://IP/MD/MD2?_VAR=1 读取变量
- GET http://IP/karel/AlarmRd 读取报警
- 如果 FOCAS 连不上（库不存在或版本不兼容），自动降级到 HTTP 模式

## 文件结构
请生成以下文件，每个文件完整可运行：

1. `fanuc_poller.py` — 主程序（含 FOCAS 和 HTTP 双模式）
2. `requirements.txt` — Python 依赖
3. `.env.example` — 环境变量模板
4. `install.sh` — 一键安装脚本（apt 装依赖 + pip install + 创建 systemd 服务）
5. `fanuc-poll.service` — systemd 服务文件（开机自启 + 崩溃重启）
6. `test_mock.py` — 不连真机也能跑的模拟模式（用 mock 数据测试 MQTT 管道）
7. `README.md` — 完整使用说明（中文）

## 代码要求
- 所有配置从环境变量读取（用 python-dotenv）
- 日志用 logging 模块，输出到 stdout（systemd 会接管）
- 异常捕获要细粒度（区分网络错误、FOCAS 错误、MQTT 错误）
- 用 paho-mqtt v2 的 API（不是 v1）
- 支持 --mock 命令行参数，不连真机只发模拟数据
- 支持 --once 命令行参数，只采集一次就退出（用于调试）
- 类型注解完整
- 中文注释

## 关于 FOCAS 库兼容性
FANUC FOCAS 官方库 libfwlib32.so 是 **32 位 x86** 的。如果运行在 ARM64 或 x86_64 上：
- 检测当前架构
- 如果是 64 位，尝试用 `libfwlib64.so`（如果有的话）
- 如果都失败，自动降级到 HTTP Data Server 模式
- 在日志里明确报告当前使用的模式

请输出全部 7 个文件的**完整代码**，不要省略任何部分。每个文件用 `=== FILENAME ===` 作为分隔标记。

---END PROMPT---

---

## 第二部分：运行环境准备（0 基础跟着做）

### Step 1：在边缘盒子上装 Python

```bash
# 连接边缘盒（SSH 或接显示器键盘）
ssh yourname@192.168.1.50

# 更新系统
sudo apt update && sudo apt upgrade -y

# 装 Python 3.10+
sudo apt install -y python3 python3-pip python3-venv

# 验证
python3 --version
# 应输出 Python 3.10.x 或更高
```

### Step 2：创建项目目录

```bash
mkdir -p ~/roboticsops/fanuc
cd ~/roboticsops/fanuc
```

### Step 3：让 AI 生成代码

1. 打开 [Claude.ai](https://claude.ai) 或 [ChatGPT](https://chat.openai.com)
2. 把上面 **第一部分** 的 prompt 完整复制粘贴
3. AI 会输出 7 个文件
4. 把每个文件的内容复制出来，在边缘盒上创建对应文件：

```bash
# 用 nano 创建文件（最简单的编辑器）
nano fanuc_poller.py
# 粘贴 AI 给的代码 → Ctrl+O 保存 → Ctrl+X 退出

nano requirements.txt
# 粘贴...

nano .env.example
# 粘贴...
```

### Step 4：一键安装

```bash
# 给安装脚本执行权限
chmod +x install.sh

# 运行
./install.sh
```

安装脚本会自动：
- 创建 Python 虚拟环境
- 安装 pip 依赖
- 复制 `.env.example` 为 `.env`（你改里面的 IP 地址）
- 注册 systemd 服务

### Step 5：配置机器人 IP

```bash
nano .env
```

改成你的真实配置：
```env
FANUC_HOST=192.168.1.100
FANUC_PORT=8193
MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_TOPIC=roboticsops/telemetry
POLL_INTERVAL=5
ROBOT_ID=FANUC_M20iD_001
```

### Step 6：先跑 mock 模式验证管道

```bash
# 不连真机，发模拟数据，验证 MQTT 通不通
source venv/bin/activate
python3 fanuc_poller.py --mock

# 另开一个终端，订阅 MQTT 看有没有数据
mosquitto_sub -h localhost -t 'roboticsops/telemetry' -v
```

如果看到 JSON 数据不断打印 → 管道通了 ✅

### Step 7：连真机测试

```bash
# 先单次测试（连一次就退出，方便看报错）
python3 fanuc_poller.py --once

# 如果成功，正式启动
sudo systemctl start fanuc-poll
sudo systemctl status fanuc-poll

# 看日志
journalctl -u fanuc-poll -f
```

---

## 第三部分：调试常见问题的 Prompt

### 问题 1：FOCAS 库找不到

> 复制发给 AI：
>
> 我的边缘盒是 Ubuntu 22.04 ARM64（树莓派 4B / 香橙派 / 瑞芯微 RK3588）。
> 运行 fanuc_poller.py 报错：
> ```
> OSError: libfwlib32.so: cannot open shared object file
> ```
> 我知道 FANUC FOCAS 官方库是 32 位 x86 的，ARM 上跑不了。
> 请帮我：
> 1. 写一个纯 HTTP 模式的 fanuc_http_poller.py（不依赖任何 FOCAS 库）
> 2. 用 Python 标准库 urllib 或 requests 调 FANUC Data Server
> 3. 解析 XML/HTML 响应提取 R 寄存器值和报警码
> 4. 输出同样的 UDM JSON 格式
> 5. 给我 FANUC 控制器上需要开启 Data Server 的设置步骤（菜单路径）

### 问题 2：连不上机器人 IP

> 复制发给 AI：
>
> 我的边缘盒 ping 不通 FANUC 机器人（192.168.1.100）。
> 请给我一份排查清单：
> 1. Linux 上怎么查网卡 IP 和网段
> 2. 怎么测机器人端口 8193 是否开放（telnet / nc / nmap）
> 3. FANUC 控制器上怎么查自己的 IP 地址（示教器菜单路径）
> 4. 怎么配静态 IP 让边缘盒和机器人在同一网段
> 5. 如果工厂有 VLAN 隔离怎么办

### 问题 3：KAREL 程序怎么写

> 复制发给 AI：
>
> 我需要写一个 FANUC KAREL 程序，功能是把 6 个关节的当前负载率（%）
> 和电机温度（℃）写入 R 寄存器（R[100]-R[111]），每 2 秒更新一次。
> 请给我：
> 1. 完整的 .kl 源代码
> 2. 编译和加载到 FANUC 控制器的步骤
> 3. 需要用到的系统变量名（如 $MOR_GRP[1].$CUR_TORQUE 等）
> 4. 怎么设置自动循环执行（不用手动每次触发）
> 5. 注意事项（比如 R 寄存器的范围限制）

---

## 第四部分：MQTT Broker 安装（边缘盒上）

如果边缘盒上还没装 MQTT Broker：

```bash
# 安装 Mosquitto
sudo apt install -y mosquitto mosquitto-clients

# 启动并设置开机自启
sudo systemctl enable mosquitto
sudo systemctl start mosquitto

# 测试：发一条消息
mosquitto_pub -h localhost -t test -m "hello"

# 另开终端收消息
mosquitto_sub -h localhost -t test
```

---

## 第五部分：和你的 React 前端对接

你的 `mqtt-client.ts` 已经存在，只需要确认：

1. **连接地址**：边缘盒的 IP（不是 localhost，因为前端在用户浏览器里）
2. **主题**：`roboticsops/telemetry`
3. **消息格式**：就是 UDM JSON，和你 adapter-fanuc.ts 期望的格式一致

```typescript
// 你的 mqtt-client.ts 里加一个订阅
client.subscribe('roboticsops/telemetry');
client.on('message', (topic, payload) => {
  const udm = JSON.parse(payload.toString());
  // 传给 adaptByBrand('FANUC', udm)
  const { state, alerts } = adaptByBrand('FANUC', udm);
  robotStore.getState().updateRobot(state);
});
```

---

## 第六部分：文件清单（AI 生成后你应有这些）

```
~/roboticsops/fanuc/
├── fanuc_poller.py       # 主程序（FOCAS + HTTP 双模式）
├── fanuc_http_poller.py  # 纯 HTTP 备选（如果 FOCAS 不兼容）
├── requirements.txt       # pip 依赖
├── .env.example          # 环境变量模板
├── .env                  # 你的真实配置（改 IP 后）
├── install.sh            # 一键安装脚本
├── fanuc-poll.service    # systemd 服务文件
├── test_mock.py          # 模拟数据测试
└── README.md             # 使用说明
```

---

## 第七部分：0 基础速查命令表

| 场景 | 命令 |
|------|------|
| 查边缘盒 IP | `ip addr show` |
| 测机器人通不通 | `ping 192.168.1.100` |
| 测端口开没开 | `nc -zv 192.168.1.100 8193` |
| 看 Python 版本 | `python3 --version` |
| 装 pip 包 | `pip3 install paho-mqtt python-dotenv` |
| 运行脚本 | `python3 fanuc_poller.py --mock` |
| 看服务状态 | `systemctl status fanuc-poll` |
| 看实时日志 | `journalctl -u fanuc-poll -f` |
| 重启服务 | `systemctl restart fanuc-poll` |
| 停服务 | `systemctl stop fanuc-poll` |
| 订阅 MQTT | `mosquitto_sub -h localhost -t 'roboticsops/telemetry' -v` |
| 编辑文件 | `nano 文件名` （Ctrl+O 保存，Ctrl+X 退出） |

---

## 第八部分：成功标志

当你做到以下 3 步，说明全链路通了：

1. ✅ `mosquitto_sub -t 'roboticsops/telemetry'` 能看到 JSON 数据不断打印
2. ✅ 浏览器打开你的 React 前端 → RobotsPage → 看到 FANUC_M20iD_001 在线
3. ✅ 关节负载仪表盘有数字跳动、告警卡片有内容

做到这 3 步 → 你已经有了一个**能跑的工业机器人运维中台 MVP**，可以拿去星火模力谷路演了。

---

## 总结：你的完整工作流

```
第 1 天：边缘盒装 Ubuntu → 装 Python → 装 Mosquitto → 跑通 mock 模式
第 2 天：把 Prompt 丢给 AI → 拿到 7 个文件 → 配置 .env → 连真机测试
第 3 天：调试（遇到问题把报错丢给 AI）→ 稳定后 systemctl enable 开机自启
第 4 天：确认 React 前端收到 MQTT 数据 → Dashboard 显示 FANUC 数据
第 5 天：录 2 分钟 demo 视频 → 写进 BP → 投星火模力谷
```

**全程你写的代码行数：0。全程你复制粘贴的命令数：约 20 条。全程你花的时间：3–5 天。**
