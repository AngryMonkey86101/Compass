import { useState, useRef } from 'react';
import { readPointsFile } from '../utils/importPoints';

const IDLE = { status: 'idle', fileName: '', fileSize: 0, format: '', points: [], skipped: 0, skipNotes: [], error: null };

// Состояние импорта точек из файла: idle → loading → ready | error.
// Если пользователь выбрал новый файл, пока не дочитан предыдущий, побеждает последний.
const useFileImport = () => {
  const [state, setState] = useState(IDLE);
  const requestRef = useRef(0);

  const parse = async (file) => {
    if (!file) return;
    const request = ++requestRef.current;
    // имя и размер показываются сразу — видно, что выбор файла дошёл до приложения
    const fileInfo = { fileName: file.name || 'без имени', fileSize: file.size || 0 };
    setState({ ...IDLE, ...fileInfo, status: 'loading' });
    try {
      const { points, skipped, skipNotes, format } = await readPointsFile(file);
      if (request !== requestRef.current) return;
      setState({ ...IDLE, ...fileInfo, status: 'ready', format, points, skipped, skipNotes });
    } catch (err) {
      if (request !== requestRef.current) return;
      setState({ ...IDLE, ...fileInfo, status: 'error', error: err?.message || 'Не удалось прочитать файл' });
    }
  };

  const clear = () => {
    requestRef.current += 1;
    setState(IDLE);
  };

  return { ...state, parse, clear };
};

export default useFileImport;
