import { useMemo } from 'react';
import { calculateDistance, formatDistance, calculateBearing } from '../utils/geoUtils';
import { indexToLetters } from '../utils/labels';
import useGeolocation from '../hooks/useGeolocation';
import useDeviceOrientation from '../hooks/useDeviceOrientation';
import useLocations from '../hooks/useLocations';
import useEventFeed from '../hooks/useEventFeed';
import StatusBar from './StatusBar';
import TargetPanel from './TargetPanel';
import CompassDial from './CompassDial';
import LocationList from './LocationList';
import CoordsPanel from './CoordsPanel';
import EventFeed from './EventFeed';

export default function Compass() {
  const { coords, error: geoError, isLoading: isGeoLoading } = useGeolocation();
  const { subscribe: subscribeHeading, isPermissionGranted, requestPermission, error: orientError } = useDeviceOrientation();
  const { savedLocations, selectedLocation, addLocation, deleteLocation, selectLocation } = useLocations();
  const { events, push } = useEventFeed();

  // Буквы, дистанции и азимут пересчитываются только при изменении позиции или списка, не при повороте
  const items = useMemo(() => savedLocations.map((loc, index) => ({
    ...loc,
    label: indexToLetters(index),
    distance: coords ? formatDistance(calculateDistance(coords.lat, coords.lon, loc.lat, loc.lon)) : null
  })), [savedLocations, coords]);

  const selectedItem = items.find((item) => item.id === selectedLocation?.id) ?? null;

  const bearing = useMemo(() => {
    if (!coords || !selectedLocation) return null;
    return calculateBearing(coords.lat, coords.lon, selectedLocation.lat, selectedLocation.lon);
  }, [coords, selectedLocation]);

  const handleAdd = (name, lat, lon) => {
    if (addLocation(name, lat, lon)) push(`Точка «${name}» добавлена`, 'ok');
  };

  const handleSaveHere = (name, lat, lon) => {
    if (addLocation(name, lat, lon)) push('Текущее место сохранено', 'ok');
  };

  const handleDelete = (id) => {
    deleteLocation(id);
    push('Точка удалена');
  };

  return (
    <main className="app">
      <StatusBar
        coords={coords}
        isGeoLoading={isGeoLoading}
        geoError={geoError}
        isSensorOn={isPermissionGranted}
        sensorError={orientError}
      />

      <div className="layout">
        <div className="layout__target">
          <TargetPanel
            location={selectedItem}
            label={selectedItem?.label}
            distance={selectedItem?.distance}
            bearing={bearing}
          />
        </div>

        <div className="layout__dial">
          {!isPermissionGranted && (
            <button type="button" className="btn btn--block" onClick={requestPermission}>
              Включить компас
            </button>
          )}
          {orientError && <p role="alert" className="error">{orientError}</p>}
          <CompassDial
            subscribeHeading={subscribeHeading}
            bearing={bearing}
            targetLabel={selectedItem?.label ?? ''}
          />
        </div>

        <div className="layout__list">
          <LocationList
            items={items}
            selectedId={selectedLocation?.id ?? null}
            onSelect={selectLocation}
            onAdd={handleAdd}
            onDelete={handleDelete}
          />
        </div>

        <div className="layout__coords">
          <CoordsPanel coords={coords} isLoading={isGeoLoading} error={geoError} onSave={handleSaveHere} />
        </div>
      </div>

      <p className="version">Alpha v{import.meta.env.VITE_APP_VERSION}</p>
      <EventFeed events={events} />
    </main>
  );
}
