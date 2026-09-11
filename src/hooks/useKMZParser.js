import { useState } from 'react';
import JSZip from 'jszip';
import kml from 'togeojson';

const useKMZParser = () => {
  const [parsedPoints, setParsedPoints] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const parseKMZFile = async (file) => {
    try {
      setIsLoading(true);
      setError(null);
      setParsedPoints([]);

      if (!file || file.type !== 'application/vnd.google-earth.kmz') {
        setError('Неверный формат файла. Ожидается .kmz');
        setIsLoading(false);
        return;
      }

      const arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e.target.error);
        reader.readAsArrayBuffer(file);
      });

      const zip = await JSZip.loadAsync(arrayBuffer);

      let kmlFile;
      for (const name in zip.files) {
        if (name.endsWith('.kml')) {
          kmlFile = zip.file(name);
          break;
        }
      }

      if (!kmlFile) {
        setError('Файл .kml не найден внутри архива .kmz');
        setIsLoading(false);
        return;
      }

      const kmlText = await kmlFile.async('text');
      const xmlDoc = new DOMParser().parseFromString(kmlText, 'text/xml');
      const geojson = kml(xmlDoc);

      const points = [];
      for (const feature of geojson.features) {
        if (feature.geometry.type === 'Point') {
          const name = feature.properties.name || '';
          const lon = feature.geometry.coordinates[0];
          const lat = feature.geometry.coordinates[1];
          points.push({ name, lat, lon });
        }
      }

      setParsedPoints(points);
    } catch (err) {
      setError(`Ошибка при чтении файла: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return { parsedPoints, error, isLoading, parseKMZFile };
};

export default useKMZParser;
