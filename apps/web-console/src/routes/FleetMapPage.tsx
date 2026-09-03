// 室外总览页：高德真实路线 + 3D 机器人 + 实时 GPS 轨迹
import { MapRobotViewer } from '../components/map/MapRobotViewer'

// 朝阳大悦城周边真实道路折线，GCJ-02 坐标
// 后面可以替换成高德 Walking API 规划的真实人行道路径
const OUTDOOR_ROUTE = [
  { lng: 116.519942, lat: 39.924677 }, // 起点
  { lng: 116.520200, lat: 39.924900 },
  { lng: 116.520500, lat: 39.925100 },
  { lng: 116.520800, lat: 39.925300 }, // 取餐点 A
  { lng: 116.521100, lat: 39.925100 },
  { lng: 116.521400, lat: 39.924800 }, // 充电柜
]

const CENTER = { lng: 116.520672, lat: 39.924989 } // 路线几何中心

export function FleetMapPage() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* 顶部 HUD */}
      <div style={{
        position: 'absolute', top: 16, left: 16, zIndex: 999,
        background: 'rgba(10,14,26,0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(0,240,255,0.3)',
        borderRadius: 12, padding: '12px 18px',
        color: '#00f0ff', fontFamily: 'var(--font-mono)',
        fontSize: 13, minWidth: 280,
      }}>
        <div style={{ fontSize: 11, color: '#889', marginBottom: 4 }}>
          FLEET · 室外真实路线
        </div>
        <div>📍 中心: {CENTER.lng.toFixed(6)}, {CENTER.lat.toFixed(6)}</div>
        <div>🛣  折点数: {OUTDOOR_ROUTE.length}</div>
        <div>🤖 品牌: Unitree G1</div>
        <div style={{ marginTop: 6, fontSize: 11, color: '#889' }}>
          模式: <span style={{ color: '#00f0ff' }}>GCJ-02 高德坐标系</span>
        </div>
      </div>

      {/* 右下说明 */}
      <div style={{
        position: 'absolute', bottom: 16, right: 16, zIndex: 999,
        background: 'rgba(10,14,26,0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(0,240,255,0.2)',
        borderRadius: 8, padding: '8px 12px',
        color: '#889', fontSize: 11,
      }}>
        {import.meta.env.VITE_AMAP_JS_KEY ? '✅ AMap Key 已配置' : '⚠️ AMap Key 未配置（地图不会加载）'}
        <br/>
        {import.meta.env.VITE_AMAP_SECURITY_CODE ? '✅ securityJsCode 已配置' : '⚠️ securityJsCode 未配置'}
      </div>

      {/* 3D 地图 + 机器人 */}
      <MapRobotViewer center={CENTER} route={OUTDOOR_ROUTE} zoom={18} />
    </div>
  )
}
