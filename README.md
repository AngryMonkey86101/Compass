# Compass

Оффлайн-навигатор (PWA): стрелка на экране указывает на выбранную точку и показывает расстояние до неё. Работает по GPS и датчикам ориентации телефона.

## Возможности

- выбор, добавление и удаление точек (хранятся в `localStorage`)
- ввод координат в форматах `55.7535, 37.6210` и `55,75; 37,62`
- сохранение текущего места как точки
- установка на телефон как PWA, работа без сети
- уведомление о новой версии вместо автоматической перезагрузки

## Запуск

```bash
npm install
npm run dev       # разработка
npm run build     # сборка в dist/
npm run preview   # просмотр сборки
npm test          # тесты (vitest)
npm run lint      # oxlint
```

Датчики и геолокация требуют HTTPS (на `localhost` работают и по HTTP). На iOS компас включается кнопкой «Включить компас», так как система запрашивает разрешение.

## Структура

```
src/
  components/   Compass, CompassDial, LocationPicker, AddLocationForm, CoordsPanel, ErrorBoundary, UpdatePrompt
  hooks/        useGeolocation, useDeviceOrientation, useLocations
  utils/        geoUtils (расстояние, азимут, разбор координат) + тесты
  data/         locations.json — точки по умолчанию
```

Версия в интерфейсе берётся из `package.json`.

Анализ найденных проблем и план работ: [problems.md](problems.md).
