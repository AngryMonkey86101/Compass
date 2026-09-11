import { useState } from 'react';
import JSZip from 'jszip';
import { kml } from '@tmcw/togeojson';

const useKMZParser = () => {
  const [parsedPoints, setParsedPoints] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

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

          const geomType = feature.geometry.type;
          const name = feature.properties?.name || 'Без названия';

          if (geomType === 'Point') {
            const lon = feature.geometry.coordinates[0];
            const lat = feature.geometry.coordinates[1];

            // Валидация координат
            if (typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90 &&
                typeof lon === 'number' && !isNaN(lon) && lon >= -180 && lon <= 180) {
              points.push({ name, lat, lon });
            } else {
              console.warn('KMZ Пропущена точка с невалидными координатами:', name, lat, lon);
            }
          } else if (geomType === 'LineString' || geomType === 'Polygon') {
            // Для линий и полигонов берем первую точку как ориентир
            const coords = Array.isArray(feature.geometry.coordinates) ? feature.geometry.coordinates : [feature.geometry.coordinates];
            const firstCoord = coords[0];
            const lon = firstCoord[0];
            const lat = firstCoord[1];

            // Валидация координат
            if (typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90 &&
                typeof lon === 'number' && !isNaN(lon) && lon >= -180 && lon <= 180) {
              console.log('KMZ Найдена геометрия', geomType, 'используем первую точку для:', name);
              points.push({ name, lat, lon });
            } else {
              console.warn('KMZ Пропущена точка с невалидными координатами:', name, lat, lon);
            }
          } else {
            console.log('KMZ Неизвестный тип геометрии', geomType, 'для объекта:', name);
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

  return { parsedPoints, error, isLoading, parseKMZFile };
};

export default useKMZParser;
