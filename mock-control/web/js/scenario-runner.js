// mock-control/web/js/scenario-runner.js
// 场景执行器：剧本列表渲染 + 一键触发 + 进度条（执行在服务端，这里只展示）

export class ScenarioRunner {
  constructor(api, logger) {
    this.api = api
    this.logger = logger
    this.scenarios = []
    this.progressWrap = document.getElementById('scenario-progress-wrap')
    this.progressFill = document.getElementById('scenario-progress-fill')
    this.progressText = document.getElementById('scenario-progress-text')
  }

  async init() {
    const { scenarios } = await this.api.getScenarios()
    this.scenarios = scenarios
    this.renderButtons()
  }

  renderButtons() {
    const wrap = document.getElementById('scenario-buttons')
    wrap.innerHTML = ''
    this.scenarios.forEach((s) => {
      const btn = document.createElement('button')
      btn.className = 'btn'
      btn.textContent = s.label
      btn.title = s.description
      btn.onclick = () => this.run(s.name)
      wrap.appendChild(btn)
    })
  }

  async run(name) {
    try {
      this.progressWrap.hidden = false
      this.progressFill.style.width = '0%'
      this.progressText.textContent = `启动中: ${name}`
      this.logger.log(`🎬 开始场景: ${name}`, 'info')

      const result = await this.api.startScenario(name)
      if (result.aborted) {
        this.logger.log(`⏹ 场景已中止: ${name}`, 'warn')
      } else {
        this.logger.log(`✅ 场景完成: ${name}`, 'success')
        this.progressFill.style.width = '100%'
      }
    } catch (err) {
      this.logger.log(`场景 ${name} 启动失败: ${err.message}`, 'error')
    }
  }

  // SSE scenario 事件回调
  handleProgress(p) {
    this.progressWrap.hidden = false
    const pct = p.total > 0 ? Math.round((p.phase / p.total) * 100) : 100
    this.progressFill.style.width = `${pct}%`
    this.progressText.textContent = `${p.name} · Phase ${p.phase}/${p.total} · ${p.label}`
  }
}
