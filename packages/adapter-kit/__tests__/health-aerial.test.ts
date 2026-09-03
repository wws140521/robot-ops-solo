import { describe, it, expect } from 'vitest'
import { calcDockHealthScore, calcVertiportHealthScore } from '../src/health'
import type { DockTelemetry, UAVTelemetry, VertiportTelemetry } from '../src/types/unified'

describe('aerial health score', () => {
  it('正常机巢应得到较高健康分', () => {
    const dock: DockTelemetry = {
      dockState: 'idle',
      chargerTempC: 40,
      chargerVoltageV: 24,
      chargerCurrentA: 2,
      doorState: 'closed',
      liftPlatform: 'down',
      weather: { windSpeedMps: 3, windGustMps: 5, rainfallMm: 0, temperatureC: 25, humidityPct: 60 },
      hasUavInside: true,
    }
    const uav: UAVTelemetry = {
      batteryPct: 80,
      batteryCycles: 50,
      signalRssi: -60,
      gpsSatellites: 12,
      motorTemps: [40, 41],
      propellerRpm: [7000, 7000],
    }
    expect(calcDockHealthScore(dock, uav)).toBeGreaterThan(80)
  })

  it('过温机巢应显著降低健康分', () => {
    const dock: DockTelemetry = {
      dockState: 'fault',
      chargerTempC: 80,
      chargerVoltageV: 24,
      chargerCurrentA: 0,
      doorState: 'jammed',
      liftPlatform: 'down',
      weather: { windSpeedMps: 12, windGustMps: 15, rainfallMm: 5, temperatureC: 25, humidityPct: 60 },
      hasUavInside: false,
    }
    const uav: UAVTelemetry = {
      batteryPct: 10,
      batteryCycles: 300,
      signalRssi: -92,
      gpsSatellites: 4,
      motorTemps: [80, 82],
      propellerRpm: [6000, 6000],
    }
    expect(calcDockHealthScore(dock, uav)).toBeLessThan(50)
  })

  it('正常起降场应得到较高健康分', () => {
    const v: VertiportTelemetry = {
      chargingPadState: 'available',
      chargingCurrentA: 0,
      fireSuppression: 'armed',
      lighting: 'auto',
      groundPowerVoltageV: 400,
    }
    expect(calcVertiportHealthScore(v)).toBeGreaterThan(90)
  })
})
