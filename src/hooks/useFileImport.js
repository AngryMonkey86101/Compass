import { useState, useRef } from 'react';
import { readPointsFile } from '../utils/importPoints';

const IDLE = { status: 'idle', fileName: '', format: '', points: [], skipped: 0, error: null };

// Состояние импорта точек из KMZ/KML: idle → loading → ready | error.
// Если пользователь выбрал новый файл, пока не дочитан предыдущий, побеждает последний.
const useFileImport = () => {
  const [state, setState] = useState(IDLE);
  const requestRef = useRef(0);

  const parse = async (file) => {
    if (!file) return;
    const request = ++requestRef.current;
    setState({ ...IDLE, status: 'loading', fileName: file.name });
    try {
      const { points, skipped, format } = await readPointsFile(file);
      if (request !== requestRef.current) return;
      setState({ ...IDLE, status: 'ready', fileName: file.name, format, points, skipped });
    } catch (err) {
      if (request !== requestRef.current) return;
      setState({ ...IDLE, status: 'error', fileName: file.name, error: err?.message || 'Не удалось прочитать файл' });
    }
  };

  const clear = () => {
    requestRef.current += 1;
    setState(IDLE);
  };

  return { ...state, parse, clear };
};

export default useFileImport;
