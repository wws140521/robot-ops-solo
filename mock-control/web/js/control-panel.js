// mock-control/web/js/control-panel.js
// 控制面板：生命周期按钮 + 电量/关节温度滑块 + 告警注入/清空 + 高级操作
// 指令走 api-client → REST → Control Service → mock-ws-server，telemetry 回流后 SSE 校正显示

const JOINT_TEMP_MIN = 20
const JOINT_TEMP_MAX = 95

export class ControlPanel {
  constructor(container, api, logger) {
    this.container = container
    this.api = api
    this.logger = logger
    this.currentDevice = null // MockDeviceState
    this.sliderLocks = new Set() // 拖动中的滑块不接受遥测回写（防抖动）
  }

  init() {
    window.addEventListener('device:select', (e) => {
      this.currentDevice = null
      this.api.getDevice(e.detail.robotId).then((d) => {
        this.currentDevice = d
        this.render()
      }).catch(() => {
        this.logger.log(`读取设备 ${e.detail.robotId} 失败`, 'error')
      })
    })
    this.bindActions()
    this.bindSliders()
  }

  render() {
    const empty = this.container.querySelector('#control-empty')
    const body = this.container.querySelector('#control-body')
    const target = this.container.querySelector('#control-target')

    if (!this.currentDevice) { empty.hidden = false; body.hidden = true; return }
    empty.hidden = true
    body.hidden = false

    const d = this.currentDevice
    target.textContent = `${d.name}（${d.robotId}）`

    // 商用显示电量滑块，工业显示关节温度滑块
    this.container.querySelector('#group-battery').style.display = d.deviceClass === 'ground_robot' ? '' : 'none'
    this.container.querySelector('#group-joints').style.display = d.deviceClass === 'industrial_arm' ? '' : 'none'
    this.container.querySelector('#group-alarms').style.display = d.deviceClass === 'industrial_arm' ? '' : 'none'

    if (d.deviceClass === 'ground_robot' && d.battery !== null && d.battery !== undefined) {
      const slider = this.container.querySelector('[data-param="battery"]')
      if (!this.sliderLocks.has('battery')) slider.value = Math.round(d.battery)
      this.container.querySelector('#battery-value').textContent = `${Math.round(d.battery)}%`
    }

    if (d.deviceClass === 'industrial_arm') {
      this.renderJointSliders(d)
      this.renderActiveAlarms(d)
    }
  }

  renderJointSliders(d) {
    const wrap = this.container.querySelector('#joint-sliders')
    if (!wrap.children.length) {
      // 首次渲染骨架（6 行）
      for (let axis = 1; axis <= 6; axis++) {
        const row = document.createElement('div')
        row.className = 'joint-row'
        row.dataset.axis = axis
        row.innerHTML = `
          <span class="joint-row__name">J${axis}</span>
          <input type="range" min="${JOINT_TEMP_MIN}" max="${JOINT_TEMP_MAX}" step="1" data-param="temp-j${axis}" />
          <span class="joint-row__value">—</span>
        `
        wrap.appendChild(row)
      }
    }

    d.joints?.forEach((j) => {
      const row = wrap.querySelector(`[data-axis="${j.axis}"]`)
      if (!row) return
      const valueEl = row.querySelector('.joint-row__value')
      valueEl.textContent = `${j.temperature.toFixed(0)}℃${j.status !== 'normal' ? (j.status === 'fault' ? '⛔' : '⚠️') : ''}`
      row.classList.toggle('joint-row--warning', j.status === 'warning')
      row.classList.toggle('joint-row--fault', j.status === 'fault')

      const slider = row.querySelector('input[type="range"]')
      if (!this.sliderLocks.has(`temp-j${j.axis}`)) slider.value = Math.round(j.temperature)
    })
  }

  renderActiveAlarms(d) {
    const wrap = this.container.querySelector('#active-alarms')
    const alarms = d.alarms || []
    wrap.innerHTML = alarms.length
      ? alarms.map((a) => `<span class="alarm-tag alarm-tag--${a.severity === 'error' ? 'error' : a.severity === 'warn' ? 'warn' : 'info'}">${a.code} ${a.zh_desc || ''}</span>`).join('')
      : '<span style="color:var(--text-tertiary);font-size:12px">无活动告警</span>'
  }

  bindActions() {
    // 生命周期 + 高级按钮（data-action）
    this.container.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action
        const params = this.buildParams(action, btn)
        if (params === null) return // 用户取消输入 / JSON 解析失败
        this.sendCommand(action, params)
      })
    })
  }

  buildParams(action, btn) {
    switch (action) {
      case 'simulate_offline': return { duration_ms: Number(btn.dataset.duration || 30000) }
      case 'inject_fault':     return { type: btn.dataset.fault || 'servo_overheat' }
      case 'set_mode':         return { mode: btn.dataset.mode || 'auto' }
      case 'custom_telemetry': {
        // 调试用：弹窗输入 JSON patch，直接覆盖设备展示字段
        const raw = window.prompt(
          '输入要覆盖的 telemetry 字段（JSON）：\n可覆盖：name / status / battery / healthScore / mode / online / position / heading',
          '{"status":"charging","battery":66}',
        )
        if (!raw) return null // 用户取消 → 不发指令
        try {
          const patch = JSON.parse(raw)
          if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
            throw new Error('必须是 JSON 对象')
          }
          return { patch }
        } catch (e) {
          this.logger.log(`自定义 telemetry JSON 解析失败: ${e.message}`, 'error')
          return null
        }
      }
      case 'trigger_alarm': {
        const code = this.container.querySelector('#alarm-code')?.value || 'SRVO-001'
        const severity = this.container.querySelector('#alarm-severity')?.value || 'warn'
        return { code, severity }
      }
      default: return {}
    }
  }

  bindSliders() {
    // 电量滑块：松手才发指令（input 太密集）
    const battery = this.container.querySelector('[data-param="battery"]')
    battery?.addEventListener('input', (e) => {
      this.sliderLocks.add('battery')
      this.container.querySelector('#battery-value').textContent = `${e.target.value}%`
    })
    battery?.addEventListener('change', (e) => {
      this.sendCommand('set_battery', { level: Number(e.target.value) })
      // 松手 800ms 后解除锁，让遥测接管回显
      setTimeout(() => this.sliderLocks.delete('battery'), 800)
    })

    // 关节温度滑块：骨架是 renderJointSliders 动态渲染的，用事件委托绑定
    const jointWrap = this.container.querySelector('#joint-sliders')
    jointWrap?.addEventListener('input', (e) => {
      const m = e.target.dataset.param?.match(/^temp-j(\d)$/)
      if (!m) return
      this.sliderLocks.add(`temp-j${m[1]}`)
      const row = e.target.closest('.joint-row')
      row.querySelector('.joint-row__value').textContent = `${e.target.value}℃`
    })
    jointWrap?.addEventListener('change', (e) => {
      const m = e.target.dataset.param?.match(/^temp-j(\d)$/)
      if (!m) return
      this.sendCommand('set_joint_temperature', { axis: Number(m[1]), temperature: Number(e.target.value) })
      setTimeout(() => this.sliderLocks.delete(`temp-j${m[1]}`), 800)
    })
  }

  async sendCommand(type, params = {}) {
    if (!this.currentDevice) {
      this.logger.log('⚠️ 请先选择设备', 'warn')
      return
    }
    const robotId = this.currentDevice.robotId
    const paramsStr = Object.keys(params).length ? JSON.stringify(params) : ''
    try {
      const result = await this.api.sendCommand(robotId, type, params)
      this.logger.log(`→ ${robotId}: ${type}(${paramsStr}) ✅`, 'success')
      // 发布链路提示：让评审直观看到指令走了哪条通道（MQTT topic / WS 直连）
      const d = result.delivery
      if (d?.transport === 'mqtt') {
        this.logger.log(`📤 MQTT 发布 → ${d.topic}`, 'info')
      } else if (d?.transport === 'ws') {
        this.logger.log(`📤 WS 直连 → ${d.topic}`, 'info')
      }
      if (result.state) {
        this.currentDevice = result.state
        this.render()
      }
    } catch (err) {
      this.logger.log(`→ ${robotId}: ${type}(${paramsStr}) ❌ ${err.message}`, 'error')
    }
  }

  // SSE state 事件回调：同步当前选中设备的面板显示
  handleState(device) {
    if (!this.currentDevice || device.robotId !== this.currentDevice.robotId) return
    this.currentDevice = { ...this.currentDevice, ...device }
    if (device.alarms !== undefined || device.joints !== undefined) {
      this.render()
    } else if (device.battery !== undefined && device.deviceClass !== 'industrial_arm') {
      // 轻量更新电量显示
      const el = this.container.querySelector('#battery-value')
      if (el && !this.sliderLocks.has('battery')) {
        el.textContent = `${Math.round(device.battery)}%`
        this.container.querySelector('[data-param="battery"]').value = Math.round(device.battery)
      }
    }
  }
}
