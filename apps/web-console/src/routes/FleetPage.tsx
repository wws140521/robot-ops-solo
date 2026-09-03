// 异构设备总览页，同屏展示地面机器人 / 无人机机巢 / eVTOL 起降场 / 边缘网关
import { RobotCards } from '../components/RobotCards'

export function FleetPage() {
  return (
    <div style={{ animation: 'fadeInUp 0.4s var(--ease-out)' }}>
      <div className="page-header">
        <h1 className="page-title">设备总览</h1>
      </div>
      <RobotCards />
    </div>
  )
}
