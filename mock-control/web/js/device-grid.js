// mock-control/web/js/device-grid.js
// 设备卡片网格：实时状态渲染（SSE 驱动，只更新变化的 DOM 节点避免闪烁）

const BRAND_ICONS = {
  unitree: '🤖', keenon: '🍜', pudutech: '🛵', agibot: '🤖',
  fanuc: '🏭', kuka: '🏭', estun: '🏭', yaskawa: '🏭',
  dji: '🛫', autel: '🛫', vertiport: '🛫',
}

const STATUS_ZH = {
  idle: '空闲', moving: '移动中', working: '作业中',
  charging: '充电中', error: '故障', offline: '离线',
}

export class DeviceGrid {
  constructor(container) {
    this.container = container
    this.devices = new Map()
    this.selectedId = null
  }

  init(devices) {
    devices.forEach((d) => this.devices.set(d.robotId, d))
    this.render()
  }

  render() {
    this.container.innerHTML = ''
    this.devices.forEach((device) => {
      this.container.appendChild(this.createCard(device))
    })
    if (this.selectedId) this.highlight(this.selectedId)
  }

  createCard(device) {
    const card = document.createElement('div')
    card.className = 'device-card'
    card.dataset.robotId = device.robotId
    card.dataset.status = device.status
    card.dataset.online = String(device.online)
    card.innerHTML = `
      <div class="device-card__header">
        <span class="device-card__icon">${BRAND_ICONS[device.brand] || '🦾'}</span>
        <span class="device-card__id">${device.robotId}</span>
        <span class="status-dot status-dot--${device.online ? 'online' : 'offline'}"></span>
      </div>
      <div class="device-card__name">${device.name}</div>
      <div class="device-card__metrics">
        ${device.battery !== null && device.battery !== undefined
          ? `<span class="metric-battery${device.battery < 20 ? ' err' : ''}">⚡ ${Math.round(device.battery)}%</span>` : ''}
        <span class="metric-health${device.healthScore < 60 ? ' err' : device.healthScore < 75 ? ' warn' : ''}">❤️ ${Math.round(device.healthScore)}</span>
        <span class="status-text ${device.status}">${STATUS_ZH[device.status] || device.status}</span>
      </div>
    `
    card.onclick = () => this.selectDevice(device.robotId)
    return card
  }

  selectDevice(robotId) {
    this.selectedId = robotId
    this.highlight(robotId)
    // 通知 ControlPanel 切换控制目标
    window.dispatchEvent(new CustomEvent('device:select', { detail: { robotId } }))
  }

  highlight(robotId) {
    this.container.querySelectorAll('.device-card').forEach((el) => el.classList.remove('selected'))
    this.container.querySelector(`[data-robot-id="${CSS.escape(robotId)}"]`)?.classList.add('selected')
  }

  // SSE state 增量更新（不整卡重绘，避免点击丢焦点/闪烁）
  updateCard(device) {
    this.devices.set(device.robotId, { ...this.devices.get(device.robotId), ...device })
    const card = this.container.querySelector(`[data-robot-id="${CSS.escape(device.robotId)}"]`)
    if (!card) return

    card.dataset.status = device.status
    card.dataset.online = String(device.online)

    const dot = card.querySelector('.status-dot')
    if (dot) dot.className = `status-dot status-dot--${device.online ? 'online' : 'offline'}`

    const batteryEl = card.querySelector('.metric-battery')
    if (batteryEl && device.battery !== null && device.battery !== undefined) {
      batteryEl.textContent = `⚡ ${Math.round(device.battery)}%`
      batteryEl.classList.toggle('err', device.battery < 20)
    }

    const healthEl = card.querySelector('.metric-health')
    if (healthEl && device.healthScore !== undefined) {
      healthEl.textContent = `❤️ ${Math.round(device.healthScore)}`
      healthEl.classList.toggle('err', device.healthScore < 60)
      healthEl.classList.toggle('warn', device.healthScore >= 60 && device.healthScore < 75)
    }

    const statusEl = card.querySelector('.status-text')
    if (statusEl) {
      statusEl.className = `status-text ${device.status}`
      statusEl.textContent = STATUS_ZH[device.status] || device.status
    }
  }
}
