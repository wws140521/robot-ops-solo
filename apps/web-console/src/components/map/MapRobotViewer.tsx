// 2026-08-29 高德地图 + Three.js 融合渲染器
// 使用 AMap.GLCustomLayer 在地图上承载 three 场景
//
// 放在 web-console 里（因为依赖 getAMap + robotStore）
// mapCoords.ts 放在 digital-twin 里（纯坐标转换）

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { getAMap } from '../../lib/amap'
import { lngLatToWorld, routeToWorld } from 'digital-twin'
import { useRobotStore } from '../../stores/robotStore'

interface RoutePoint { lng: number; lat: number }

interface Props {
  center: { lng: number; lat: number }
  route?: RoutePoint[]
  zoom?: number
}

/** 低通滤波平滑位置 */
function lowPass3(current: [number, number, number], prev: [number, number, number], alpha = 0.2): [number, number, number] {
  return [
    prev[0] + alpha * (current[0] - prev[0]),
    prev[1] + alpha * (current[1] - prev[1]),
    prev[2] + alpha * (current[2] - prev[2]),
  ]
}

export function MapRobotViewer({ center, route = [], zoom = 18 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const ctxRef = useRef<any>(null)
  const robotGroupRef = useRef<THREE.Group>()
  const sceneRef = useRef<THREE.Scene>()
  const cameraRef = useRef<THREE.PerspectiveCamera>()
  const rendererRef = useRef<THREE.WebGLRenderer>()
  const smoothPosRef = useRef<[number, number, number] | null>(null)

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        if (!containerRef.current || cancelled) return

        const AMap = await getAMap()
        if (cancelled) return

        const map = new AMap.Map(containerRef.current, {
          viewMode: '3D',
          pitch: 55,
          rotation: -35,
          zoom,
          center: [center.lng, center.lat],
          mapStyle: 'amap://styles/dark',
          showLabel: true,
          showBuildingBlock: true,
        })

        const customCoords = map.customCoords
        customCoords.setCenter([center.lng, center.lat])

        // Three 场景
        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1 << 30)

        // 尝试用地图共享 GL context，不行则独立 canvas 叠层
        let gl: WebGLRenderingContext | null = null
        try { gl = map.getGLContext ? map.getGLContext() : null } catch (_) { /* noop */ }

        let renderer: THREE.WebGLRenderer
        if (gl) {
          renderer = new THREE.WebGLRenderer({ context: gl as any, antialias: true })
          renderer.autoClear = false
        } else {
          const mapCanvas = containerRef.current.querySelector('canvas') as HTMLCanvasElement | null
          const overlay = document.createElement('canvas')
          overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;'
          containerRef.current.appendChild(overlay)
          renderer = new THREE.WebGLRenderer({ canvas: overlay, antialias: true, alpha: true })
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
          if (mapCanvas) {
            const syncSize = () => renderer.setSize(mapCanvas.clientWidth, mapCanvas.clientHeight, false)
            syncSize()
            const ro = new ResizeObserver(syncSize)
            ro.observe(mapCanvas)
          }
        }

        sceneRef.current = scene
        cameraRef.current = camera
        rendererRef.current = renderer
        ctxRef.current = { map, customCoords, center: { ...center } }

        // ─── 绘制路线折线 ───
        if (route.length >= 2) {
          const points = routeToWorld(ctxRef.current, route, 0.5)
          const geom = new THREE.BufferGeometry().setFromPoints(
            points.map(([x, y, z]) => new THREE.Vector3(x, y, z))
          )
          const mat = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.85,
          })
          scene.add(new THREE.Line(geom, mat))

          // 起点绿 / 终点红
          ;[
            { p: points[0], color: 0x00e676 },
            { p: points[points.length - 1], color: 0xff3d71 },
          ].forEach(({ p, color }) => {
            const m = new THREE.Mesh(
              new THREE.SphereGeometry(0.6, 16, 16),
              new THREE.MeshBasicMaterial({ color })
            )
            m.position.set(p[0], p[1] + 0.5, p[2])
            scene.add(m)
          })
        }

        // ─── 占位机器人（Capsule + 方向箭头）──────────
        const rob = new THREE.Group()
        rob.name = 'outdoor-robot'
        rob.add(new THREE.Mesh(
          new THREE.CapsuleGeometry(0.4, 1.2, 4, 16),
          new THREE.MeshStandardMaterial({
            color: 0x00f0ff,
            metalness: 0.6, roughness: 0.25,
            emissive: 0x00f0ff, emissiveIntensity: 0.3,
          })
        ))
        const arrow = new THREE.Mesh(
          new THREE.ConeGeometry(0.18, 0.5, 12),
          new THREE.MeshBasicMaterial({ color: 0xffff00 })
        )
        arrow.position.set(0, 0.75, -0.55)
        arrow.rotation.x = Math.PI / 2
        rob.add(arrow)

        const start = route.length >= 2
          ? routeToWorld(ctxRef.current, [route[0]], 1.0)[0]
          : lngLatToWorld(ctxRef.current, center.lng, center.lat, 1.0)
        rob.position.set(start[0], start[1], start[2])
        scene.add(rob)
        robotGroupRef.current = rob

        // ─── GLCustomLayer 桥接 ───
        map.add(new AMap.GLCustomLayer({
          zIndex: 200,
          render: () => {
            const params = customCoords.getCameraParams()
            if (!params) return
            camera.near = params.near
            camera.far = params.far
            camera.fov = params.fov
            camera.position.set(params.position[0], params.position[1], params.position[2])
            camera.up.set(params.up[0], params.up[1], params.up[2])
            camera.lookAt(params.lookAt[0], params.lookAt[1], params.lookAt[2])
            camera.updateProjectionMatrix()
            renderer.resetState()
            renderer.render(scene, camera)
            renderer.resetState()
          },
        }))

        // 地图移动时重置 customCoords 中心，避免浮点精度问题
        map.on('moveend', () => {
          const c = map.getCenter()
          customCoords.setCenter([c.lng, c.lat])
          ctxRef.current.center = { lng: c.lng, lat: c.lat }
          // 重新设置胶囊位置
          smoothPosRef.current = null
        })

        setReady(true)
      } catch (err: any) {
        setErr(err.message ?? String(err))
        console.error('[MapRobotViewer] 初始化失败:', err)
      }
    }

    init()
    return () => { /* 保留实例便于调试 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lng, center.lat, zoom])

  // 订阅 robotStore → 实时移动胶囊 + 朝向
  useEffect(() => {
    if (!ready) return
    return useRobotStore.subscribe((state) => {
      if (!ctxRef.current || !robotGroupRef.current) return
      const robot = Object.values(state.robots).find((r) => r.mode === 'outdoor')
      if (!robot) return
      const [x, y, z] = lngLatToWorld(
        ctxRef.current,
        robot.position.x,   // 经度
        robot.position.y,   // 纬度
        0,
      )
      const target: [number, number, number] = [x, y + 0.8, z]
      const prev = smoothPosRef.current ?? target
      const smoothed = lowPass3(target, prev, 0.25)
      smoothPosRef.current = smoothed

      robotGroupRef.current.position.set(smoothed[0], smoothed[1], smoothed[2])
      // heading(theta) 弧度 → 胶囊旋转，three -Z 朝前
      robotGroupRef.current.rotation.y = -robot.position.theta
    })
  }, [ready])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%', minHeight: 600,
        background: '#0a0e1a', position: 'relative',
      }}
    >
      {err && (
        <div style={{
          position: 'absolute', top: 16, left: 16, zIndex: 1000,
          background: 'rgba(255,60,120,0.9)', color: 'white',
          padding: '8px 14px', borderRadius: 8, fontSize: 13,
        }}>⚠️ {err}</div>
      )}
      {!ready && !err && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)', zIndex: 1000,
          color: '#00f0ff', fontSize: 14, fontFamily: 'var(--font-mono)',
        }}>加载高德地图中...</div>
      )}
    </div>
  )
}
