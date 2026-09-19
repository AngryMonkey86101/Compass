import { createClient } from '@supabase/supabase-js';

// Замени эти значения на свои из Supabase Dashboard → Settings → API
const supabaseUrl = 'https://joxehmlgvcskzetjriok.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpveGVobWxndmNza3pldGpyaW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MDQyMDcsImV4cCI6MjEwNTM4MDIwN30.3FVyOjSjGWPL9UBVWyhioZeiyIMSquO41yzX_75UYnk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Генерация уникального ID устройства
export const getDeviceId = () => {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
};
