import { useState, useEffect, useRef } from 'react';

export default function useSmoothRotation(targetRotation, duration = 150) {
  const [smoothRotation, setSmoothRotation] = useState(targetRotation);
  const animationRef = useRef(null);
  const startTimeRef = useRef(null);
  const startValueRef = useRef(targetRotation);

  useEffect(() => {
    const startValue = startValueRef.current;
    const diff = targetRotation - startValue;
    
    // Нормализуем разницу для кратчайшего пути
    let normalizedDiff = diff;
    if (diff > 180) normalizedDiff -= 360;
    if (diff < -180) normalizedDiff += 360;
    
    const endValue = startValue + normalizedDiff;
    
    if (Math.abs(normalizedDiff) < 0.1) {
      setSmoothRotation(targetRotation);
      startValueRef.current = targetRotation;
      return;
    }

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = startValue + normalizedDiff * easeOut;
      setSmoothRotation(currentValue);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        startValueRef.current = targetRotation;
        startTimeRef.current = null;
      }
    };

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    startTimeRef.current = null;
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetRotation, duration]);

  return smoothRotation;
}
