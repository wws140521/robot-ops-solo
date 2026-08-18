"""
FANUC FOCAS 客户端最小封装
依赖：ctypes + fwlib32.dll（Windows）或 libfwlib32.so（Linux x86）
备选：fanucpy（高层 API，用于建连/运动）
"""
import ctypes
import time
from typing import Optional

class FocasClient:
    """FANUC FOCAS1/2 以太网客户端"""

    def __init__(self, host: str, port: int = 8193, timeout: int = 10):
        self.host = host
        self.port = port
        self.timeout = timeout
        self._h = ctypes.c_ushort(0)
        self._fw = ctypes.CDLL("fwlib32.dll")  # Linux: "libfwlib32.so"
        self.connected = False

    def connect(self) -> bool:
        """建立 FOCAS 连接"""
        ret = self._fw.cnc_allclibhndl3(
            ctypes.c_char_p(self.host.encode()),
            ctypes.c_ushort(self.port),
            ctypes.c_ushort(self.timeout),
            ctypes.byref(self._h),
        )
        self.connected = (ret == 0)
        return self.connected

    def disconnect(self):
        """断开连接"""
        if self._h.value:
            self._fw.cnc_freelibhndl(self._h)
            self._h.value = 0
            self.connected = False

    def read_r_register(self, reg: int) -> Optional[float]:
        """读 R 寄存器（KAREL 桥接的温度/负载）"""
        # 使用 cnc_rdparam 或 cnc_rdpmcrng
        # 简化：返回模拟值（实际对接 fanucpy 的 read_register）
        try:
            import fanucpy
            # fanucpy 高层 API
            return float(reg * 1.5 + time.time() % 10)
        except ImportError:
            return None

    def read_alarms(self) -> list:
        """读当前报警列表（cnc_rdalarm / cnc_alarm2）"""
        # 实际实现需按 FOCAS 版本选 API
        return []  # 占位

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, *args):
        self.disconnect()
