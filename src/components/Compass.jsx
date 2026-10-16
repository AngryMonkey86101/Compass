import { useMemo } from 'react';
import { calculateDistance, formatDistance, calculateBearing } from '../utils/geoUtils';
import useGeolocation from '../hooks/useGeolocation';
import useDeviceOrientation from '../hooks/useDeviceOrientation';
import useLocations from '../hooks/useLocations';
import CompassDial from './CompassDial';
import LocationPicker from './LocationPicker';
import AddLocationForm from './AddLocationForm';
import CoordsPanel from './CoordsPanel';

export default function Compass() {
  const { coords, error: geoError, isLoading: isGeoLoading } = useGeolocation();
  const { unwrappedHeading, isPermissionGranted, requestPermission, error: orientError } = useDeviceOrientation();
  const { savedLocations, selectedLocation, addLocation, deleteLocation, selectLocation } = useLocations();

  // Пересчитываем только при изменении позиции или выбранной точки, а не при каждом повороте
  const { bearing, distance } = useMemo(() => {
    if (!coords || !selectedLocation) return { bearing: null, distance: '—' };
    const { lat, lon } = selectedLocation;
    return {
      bearing: calculateBearing(coords.lat, coords.lon, lat, lon),
      distance: formatDistance(calculateDistance(coords.lat, coords.lon, lat, lon))
    };
  }, [coords, selectedLocation]);

  return (
    <main className="app">
      {!isPermissionGranted && (
        <button type="button" className="btn btn--large" onClick={requestPermission}>
          Включить компас
        </button>
      )}

      {orientError && <p role="alert" className="error">{orientError}</p>}
      {geoError && <p role="alert" className="error">{geoError}</p>}

      <LocationPicker
        locations={savedLocations}
        selectedId={selectedLocation?.id ?? null}
        onSelect={selectLocation}
        onDelete={() => selectedLocation && deleteLocation(selectedLocation.id)}
      />

      {selectedLocation ? (
        <>
          <p className="distance">Дистанция: {distance}</p>
          <CompassDial heading={unwrappedHeading} bearing={bearing} />
        </>
      ) : (
        <p className="muted">Добавьте точку для навигации</p>
      )}

      <AddLocationForm onAdd={addLocation} />
      <CoordsPanel coords={coords} isLoading={isGeoLoading} onSave={addLocation} />

      <p className="version">Alpha v{import.meta.env.VITE_APP_VERSION}</p>
    </main>
  );
}
