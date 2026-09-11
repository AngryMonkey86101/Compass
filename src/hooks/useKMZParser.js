import { useState } from 'react';
import JSZip from 'jszip';
import { kml } from '@tmcw/togeojson';

const useKMZParser = () => {
  const [parsedPoints, setParsedPoints] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Универсальная функция для извлечения первых координат из любой геометрии GeoJSON
  const extractFirstCoordinate = (geometry) => {
    if (!geometry || !geometry.coordinates) return null;

    const coords = geometry.coordinates;

    // Рекурсивно ищем первые два числа в массиве
    const findFirstNumbers = (arr) => {
      if (Array.isArray(arr)) {
        // Если это массив чисел (например, lon, lat)
        if (arr.length === 2 && typeof arr[0] === 'number' && typeof arr[1] === 'number') {
          return { lon: arr[0], lat: arr[1] };
        }

        // Иначе рекурсивно идем глубже
        for (const item of arr) {
          const result = findFirstNumbers(item);
          if (result) return result;
        }
      }

      return null;
    };

    return findFirstNumbers(coords);
  };

  const parseKMZFile = async (file) => {
    try {
      console.log('KMZ Начало парсинга, установка isLoading=true');
      setIsLoading(true);
      setError(null);
      setParsedPoints([]);

      if (!file || !file.name.toLowerCase().endsWith('.kmz')) {
        console.log('KMZ Ошибка: неверное расширение файла');
        setError('Неверный формат файла. Ожидается файл с расширением .kmz');
        setIsLoading(false);
        return;
      }

      console.log('KMZ Чтение файла как ArrayBuffer...');
      const arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e.target.error);
        reader.readAsArrayBuffer(file);
      });
      console.log('KMZ ArrayBuffer получен, размер:', arrayBuffer.byteLength);

      console.log('KMZ Распаковка JSZip...');
      const zip = await JSZip.loadAsync(arrayBuffer);
      console.log('KMZ Архив распакован, файлы:', Object.keys(zip.files));

      let kmlFile;
      for (const name in zip.files) {
        if (name.endsWith('.kml')) {
          kmlFile = zip.file(name);
          console.log('KMZ Найден KML файл:', name);
          break;
        }
      }

      if (!kmlFile) {
        console.log('KMZ Ошибка: KML файл не найден внутри архива');
        setError('Файл .kml не найден внутри архива .kmz');
        setIsLoading(false);
        return;
      }

      console.log('KMZ Чтение содержимого KML как текст...');
      const kmlText = await kmlFile.async('text');
      console.log('KMZ KML текст получен, длина:', kmlText.length);

      console.log('KMZ Парсинг XML через DOMParser...');
      const xmlDoc = new DOMParser().parseFromString(kmlText, 'text/xml');

      console.log('KMZ Конвертация в GeoJSON через tmcw/togeojson...');
      const geojson = kml(xmlDoc);
      console.log('KMZ GeoJSON получен, количество features:', geojson.features ? geojson.features.length : 0);

      const points = [];
      if (geojson && geojson.features) {
        for (const feature of geojson.features) {
          if (!feature.geometry) {
            console.log('KMZ Пропущен объект без геометрии:', feature.properties?.name);
            continue;
          }

          const name = feature.properties?.name || 'Без названия';
          const geomType = feature.geometry.type;
          console.log('KMZ Обработка объекта:', name, 'типа геометрии:', geomType);

          const coord = extractFirstCoordinate(feature.geometry);

          if (coord && 
              typeof coord.lat === 'number' && !isNaN(coord.lat) &&
              typeof coord.lon === 'number' && !isNaN(coord.lon) &&
              coord.lat >= -90 && coord.lat <= 90 &&
              coord.lon >= -180 && coord.lon <= 180) {
            points.push({ name, lat: coord.lat, lon: coord.lon });
            console.log('KMZ Добавлена точка:', name, '(coord.lat, coord.lon)');
          } else {
            console.warn('KMZ Пропущена точка с невалидными координатами:', name, coord);
          }
        }
      }

      console.log('KMZ Успешно извлечено точек:', points.length);
      setParsedPoints(points);

    } catch (err) {
      console.error('KMZ КРИТИЧЕСКАЯ ОШИБКА при парсинге:', err);
      setError(`Ошибка при чтении файла: ${err.message || 'Неизвестная ошибка'}`);
    } finally {
      console.log('KMZ Завершение парсинга, установка isLoading=false');
      setIsLoading(false);
    }
  };

  const clearParsedPoints = () => {
    setParsedPoints([]);
    setError(null);
  };

  return { parsedPoints, error, isLoading, parseKMZFile, clearParsedPoints };
};

export default useKMZParser;
