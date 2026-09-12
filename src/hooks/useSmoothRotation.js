import { useState, useEffect, useRef } from 'react';

export default function useSmoothRotation(targetRotation, smoothingFactor = 0.15) {
  const [smoothRotation, setSmoothRotation] = useState(targetRotation);
  const previousRef = useRef(targetRotation);

  useEffect(() => {
    let diff = targetRotation - previousRef.current;
    
    // Нормализуем разницу для кратчайшего пути (избегаем скачков через 360°)
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    
    const smoothed = previousRef.current + diff * smoothingFactor;
    
    // Нормализуем результат в диапазон [-180, 180)
    let normalized = smoothed;
    if (normalized > 180) normalized -= 360;
    if (normalized < -180) normalized += 360;
    
    previousRef.current = normalized;
    setSmoothRotation(normalized);
  }, [targetRotation, smoothingFactor]);

  return smoothRotation;
}
