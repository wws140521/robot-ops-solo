// 2026-08-29 高德地图 + Three.js 融合渲染器
// 使用 AMap.GLCustomLayer 在地图上承载 three 场景
//
// 放在 web-console 里（因为依赖 getAMap + robotStore）
// mapCoords.ts 放在 digital-twin 里（纯坐标转换）

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { getAMap } from '../../lib/amap'
import { lngLatToWorld, routeToWorld, loadG1ForScene } from 'digital-twin'
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

export function MapRobotViewer({ center, route = [], zoom = 20 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const ctxRef = useRef<any>(null)
  const robotGroupRef = useRef<THREE.Group>()
  const rendererRef = useRef<THREE.WebGLRenderer>()
  const smoothPosRef = useRef<[number, number, number] | null>(null)
  // ★ React StrictMode 双 mount 防护：用 DOM dataset 标记，简洁可靠
  const STRICT_FLAG = 'data-amap-initialized'

  useEffect(() => {
    const c = containerRef.current
    if (!c) return
    // 第二次 mount（StrictMode 或 react 重挂载）— 跳过 init，保留已创建的 map
    if (c.hasAttribute(STRICT_FLAG)) return

    let destroyed = false
    const init = async () => {
      try {
        const AMap = await getAMap()
        if (destroyed || !containerRef.current) return

        const map = new AMap.Map(containerRef.current, {
          viewMode: '3D',
          // 2026-08-29 视角优化：正北朝上 + 平缓俯视 + 路线全貌
          pitch: 40,
          rotation: 0,
          zoom,
          center: [center.lng, center.lat],
          mapStyle: 'amap://styles/dark',
          showLabel: true,
          showBuildingBlock: true,
        })

        const customCoords = map.customCoords
        customCoords.setCenter([center.lng, center.lat])

        // ★ 全部 three 初始化延迟到 map complete 后，避免 customCoords 在瓦片加载前返回 NaN
        map.on('complete', () => {
          if (destroyed) return

          const scene = new THREE.Scene()
          const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1 << 30)

          // 基础光源
          scene.add(new THREE.AmbientLight(0xffffff, 1.0))
          scene.add(new THREE.DirectionalLight(0xffffff, 1.0))

          // ─── Renderer：优先共享 GL context，否则独立 canvas overlay ───
          let gl: WebGLRenderingContext | null = null
          try { gl = map.getGLContext ? map.getGLContext() : null } catch (_) { /* noop */ }

          let renderer: THREE.WebGLRenderer
          if (gl) {
            renderer = new THREE.WebGLRenderer({ context: gl as any, antialias: true })
            renderer.autoClear = false
          } else {
            const mapCanvas = containerRef.current!.querySelector('canvas') as HTMLCanvasElement | null
            const overlay = document.createElement('canvas')
            overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;'
            containerRef.current!.appendChild(overlay)
            renderer = new THREE.WebGLRenderer({ canvas: overlay, antialias: true, alpha: true })
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
            if (mapCanvas) {
              const syncSize = () => renderer.setSize(mapCanvas.clientWidth, mapCanvas.clientHeight, false)
              syncSize()
              new ResizeObserver(syncSize).observe(mapCanvas)
            }
          }

          ctxRef.current = { map, customCoords, center: { ...center } }
          containerRef.current!.setAttribute(STRICT_FLAG, 'true')

          // ─── 绘制路线折线（光晕双层：地面发光 + 主线高亮） ───
          if (route.length >= 2) {
            const points = routeToWorld(ctxRef.current, route, 0.5)
            const validPoints = points.filter(([x, y, z]) => Number.isFinite(x + y + z))
            if (validPoints.length >= 2) {
              const worldPts = validPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z))

              // ① 地面发光层（宽 halo + 低透明度，Y 略高于地面避免 z-fighting）
              const haloGeom = new THREE.BufferGeometry().setFromPoints(
                worldPts.map((p) => new THREE.Vector3(p.x, 0.05, p.z))
              )
              scene.add(new THREE.Line(haloGeom, new THREE.LineBasicMaterial({
                color: 0x00f0ff, transparent: true, opacity: 0.35,
              })))

              // ② 主色层（悬浮 2m + 实线）
              const mainGeom = new THREE.BufferGeometry().setFromPoints(
                worldPts.map((p) => new THREE.Vector3(p.x, p.y + 2.0, p.z))
              )
              scene.add(new THREE.Line(mainGeom, new THREE.LineBasicMaterial({
                color: 0x00f0ff, transparent: true, opacity: 1.0,
              })))

              // ③ 虚线辅助层（地面半透明 + 虚线感）
              // three.js LineBasicMaterial 不能设 dash，用 shaderMaterial 太复杂
              // 简化：再加一条更低的亮青色线增强立体感
              const accentGeom = new THREE.BufferGeometry().setFromPoints(
                worldPts.map((p) => new THREE.Vector3(p.x, 0.08, p.z))
              )
              scene.add(new THREE.Line(accentGeom, new THREE.LineBasicMaterial({
                color: 0x88ffff, transparent: true, opacity: 0.6,
              })))

              // 起终点 marker（放大 + halo）
              ;[
                { p: validPoints[0], color: 0x00e676, label: '起点' },
                { p: validPoints[validPoints.length - 1], color: 0xff3d71, label: '终点' },
              ].forEach(({ p, color }) => {
                const m = new THREE.Mesh(
                  new THREE.SphereGeometry(2.8, 16, 16),
                  new THREE.MeshBasicMaterial({ color })
                )
                m.position.set(p[0], p[1] + 2.2, p[2])
                scene.add(m)
                const halo = new THREE.Mesh(
                  new THREE.RingGeometry(2.8, 3.6, 32),
                  new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
                )
                halo.rotation.x = -Math.PI / 2
                halo.position.set(p[0], p[1] + 0.02, p[2])
                scene.add(halo)
              })
            }
          }

          // ─── 室外机器人：先放占位，异步加载真实 G1 ───
          const rob = new THREE.Group()
          rob.name = 'outdoor-robot'
          // 临时占位（G1 加载完成后自动替换成真实人形）
          rob.add(new THREE.Mesh(
            new THREE.CapsuleGeometry(0.4, 1.2, 6, 24),
            new THREE.MeshStandardMaterial({
              color: 0x00f0ff, metalness: 0.4, roughness: 0.3,
              emissive: 0x00f0ff, emissiveIntensity: 0.5,
            })
          ))
          const arrow = new THREE.Mesh(
            new THREE.ConeGeometry(0.15, 0.5, 10),
            new THREE.MeshBasicMaterial({ color: 0xffff00 })
          )
          arrow.position.set(0, 0.6, -0.35)
          arrow.rotation.x = Math.PI / 2
          rob.add(arrow)

          // 异步加载真实 G1 URDF + STL
          loadG1ForScene(scene).then(({ anchor }) => {
            // anchor 已加到 scene，让它成为 rob 的子节点
            rob.clear()
            rob.add(anchor)
            // 1.3m 真实身高在 zoom=18 地图上太小 → 放大 3 倍（视觉上 4m，仍然合理）
            anchor.scale.setScalar(3.0)
            // 给 G1 加光环 + 方向箭头
            const halo = new THREE.Mesh(
              new THREE.RingGeometry(2.0, 2.5, 32),
              new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
            )
            halo.rotation.x = -Math.PI / 2
            halo.position.y = 0.03
            rob.add(halo)
            const g1Arrow = new THREE.Mesh(
              new THREE.ConeGeometry(0.4, 1.2, 10),
              new THREE.MeshBasicMaterial({ color: 0xffff00 })
            )
            g1Arrow.position.set(0, 2.2, -0.7)
            g1Arrow.rotation.x = Math.PI / 2
            rob.add(g1Arrow)
            console.log('[MapRobotViewer] ✅ 真实 G1 人形模型已加载')
          }).catch((err) => {
            console.warn('[MapRobotViewer] G1 加载失败，保留 Capsule 占位:', err)
          })

          // 初始位置：路线起点或中心
          const start = route.length >= 2
            ? routeToWorld(ctxRef.current, [route[0]], 1.0)[0]
            : lngLatToWorld(ctxRef.current, center.lng, center.lat, 1.0)
          if (Number.isFinite(start[0] + start[1] + start[2])) {
            rob.position.set(start[0], start[1], start[2])
          }
          scene.add(rob)
          robotGroupRef.current = rob

          // ─── GLCustomLayer 桥接渲染 ───
          map.add(new AMap.GLCustomLayer({
            zIndex: 200,
            render: () => {
              const params = customCoords.getCameraParams()
              if (!params) return
              if (!Number.isFinite(params.position[0] + params.position[1] + params.position[2])) return
              camera.near = params.near
              camera.far = params.far
              camera.fov = params.fov
              camera.position.set(params.position[0], params.position[1], params.position[2])
              camera.up.set(params.up[0], params.up[1], params.up[2])
              camera.lookAt(params.lookAt[0], params.lookAt[1], params.lookAt[2])
              // aspect: AMap params 里没 width/height，从 three overlay canvas 取
              const canvasEl = renderer.domElement
              if (canvasEl) {
                camera.aspect = canvasEl.width / canvasEl.height || 1
              } else if (params.width && params.height) {
                camera.aspect = params.width / params.height
              }
              camera.updateProjectionMatrix()
              renderer.resetState()
              renderer.render(scene, camera)
              renderer.resetState()
            },
          }))

          // 地图移动时重置 customCoords 中心
          map.on('moveend', () => {
            const c = map.getCenter()
            customCoords.setCenter([c.lng, c.lat])
            ctxRef.current.center = { lng: c.lng, lat: c.lat }
            smoothPosRef.current = null
          })

          rendererRef.current = renderer
          setReady(true)
        })
      } catch (err: any) {
        setErr(err.message ?? String(err))
        console.error('[MapRobotViewer] init failed:', err)
      }
    }

    init()
    return () => {
      destroyed = true
      try { ctxRef.current?.map?.destroy?.() } catch (_) { /* noop */ }
      try { rendererRef.current?.dispose?.() } catch (_) { /* noop */ }
      try { containerRef.current?.removeAttribute?.(STRICT_FLAG) } catch (_) { /* noop */ }
      ctxRef.current = null
      rendererRef.current = undefined
      robotGroupRef.current = undefined
      smoothPosRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lng, center.lat, zoom])

  // 订阅 robotStore → 实时移动 G1 + 朝向
  useEffect(() => {
    if (!ready) return
    return useRobotStore.subscribe((state) => {
      if (!ctxRef.current || !robotGroupRef.current) return
      const robot = Object.values(state.robots).find((r) => r.mode === 'outdoor')
      if (!robot) return

      // 2026-08-29 修复：优先用 state.gps.lng/lat（GPS 专用字段），
      // 因为 /state 广播会用室内坐标覆盖 position.x/y
      const lng = robot.gps?.lng ?? robot.position.x
      const lat = robot.gps?.lat ?? robot.position.y
      const headingRad = robot.gps
        ? (robot.gps.heading ?? 0) * Math.PI / 180
        : robot.position.theta

      const [x, y, z] = lngLatToWorld(ctxRef.current, lng, lat, 0)
      const target: [number, number, number] = [x, y + 0.8, z]
      const prev = smoothPosRef.current ?? target
      const smoothed = lowPass3(target, prev, 0.25)
      smoothPosRef.current = smoothed

      robotGroupRef.current.position.set(smoothed[0], smoothed[1], smoothed[2])
      // heading(theta) 弧度 → three -Z 朝前
      robotGroupRef.current.rotation.y = -headingRad
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
