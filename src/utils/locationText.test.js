import { describe, it, expect } from 'vitest';
import { parseLocationText, parseMapUrl, parseDms } from './locationText';

// Плотинка, Екатеринбург: широта 56.838, долгота 60.6035. Порядок проверяется точно —
// перепутанные координаты тоже «валидны», ошибка была бы незаметной.
const LAT = 56.838;
const LON = 60.6035;

describe('parseLocationText — текст', () => {
  it('десятичные градусы, как копируют Google и Яндекс', () => {
    expect(parseLocationText('56.838, 60.6035')).toEqual({ lat: LAT, lon: LON });
    expect(parseLocationText('56.838000, 60.603500')).toEqual({ lat: LAT, lon: LON });
    expect(parseLocationText('56,838; 60,6035')).toEqual({ lat: LAT, lon: LON });
  });

  it('градусы, минуты, секунды', () => {
    const r = parseLocationText('56°50\'16.8"N 60°36\'12.6"E');
    expect(r.lat).toBeCloseTo(56.838, 6);
    expect(r.lon).toBeCloseTo(60.6035, 6);
  });

  it('типографские штрихи iOS и русские обозначения полушарий', () => {
    const r = parseLocationText('56°50′16.8″ с.ш. 60°36′12.6″ в.д.');
    expect(r.lat).toBeCloseTo(56.838, 6);
    expect(r.lon).toBeCloseTo(60.6035, 6);
  });

  it('градусы с десятичными минутами, буква полушария впереди, южное и западное полушария', () => {
    const r = parseDms('N 56°50.28\' E 60°36.21\'');
    expect(r.lat).toBeCloseTo(56.838, 6);
    expect(r.lon).toBeCloseTo(60.6035, 6);
    const sw = parseDms('33°52\'S 151°12\'W');
    expect(sw.lat).toBeCloseTo(-33.8667, 3);
    expect(sw.lon).toBeCloseTo(-151.2, 3);
    const leading = parseDms('N 40°45\' W 73°59\'');
    expect(leading.lat).toBeCloseTo(40.75, 6);
    expect(leading.lon).toBeCloseTo(-73.9833, 3);
    const south = parseDms('S 33°52\' E 151°12\'');
    expect(south.lat).toBeCloseTo(-33.8667, 3);
    expect(south.lon).toBeCloseTo(151.2, 3);
  });

  it('долгота первой — переставляется по буквам полушарий', () => {
    const r = parseDms('60°36\'12.6"E 56°50\'16.8"N');
    expect(r.lat).toBeCloseTo(56.838, 6);
    expect(r.lon).toBeCloseTo(60.6035, 6);
  });

  it('ошибки: пусто, мусор, вне диапазона', () => {
    expect(parseLocationText('').error).toBeTruthy();
    expect(parseLocationText('дом').error).toMatch(/Не удалось/);
    expect(parseLocationText('91, 10').error).toMatch(/Широта/);
    expect(parseDms('56°70\'N 60°E')).toBeNull();
  });
});

describe('parseMapUrl — Google', () => {
  it('!3d…!4d… — координаты места, а не центра экрана (@)', () => {
    const url = 'https://www.google.com/maps/place/%D0%9F%D0%BB%D0%BE%D1%82%D0%B8%D0%BD%D0%BA%D0%B0/@56.84,60.60,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d56.838!4d60.6035';
    expect(parseMapUrl(url)).toEqual({ lat: LAT, lon: LON, name: 'Плотинка' });
  });

  it('параметры q, query, destination — «широта,долгота»', () => {
    expect(parseMapUrl('https://maps.google.com/?q=56.838,60.6035')).toEqual({ lat: LAT, lon: LON });
    expect(parseMapUrl('https://www.google.com/maps/search/?api=1&query=56.838%2C60.6035')).toEqual({ lat: LAT, lon: LON });
    expect(parseMapUrl('https://www.google.com/maps/dir/?api=1&destination=56.838,60.6035')).toEqual({ lat: LAT, lon: LON });
    expect(parseMapUrl('https://maps.google.com/?q=loc:56.838,60.6035')).toEqual({ lat: LAT, lon: LON });
  });

  it('координаты в пути и центр экрана как запасной вариант', () => {
    expect(parseMapUrl('https://www.google.com/maps/search/56.838,+60.6035?entry=tts')).toEqual({ lat: LAT, lon: LON });
    expect(parseMapUrl('https://www.google.ru/maps/@56.838,60.6035,15z')).toEqual({ lat: LAT, lon: LON });
  });

  it('ссылка без координат (cid) — null, короткая — понятная ошибка', () => {
    expect(parseMapUrl('http://maps.google.com/?cid=1234567890')).toBeNull();
    expect(parseMapUrl('https://maps.app.goo.gl/AbCdEf123').error).toMatch(/Короткую ссылку/);
    expect(parseMapUrl('https://goo.gl/maps/AbCdEf').error).toMatch(/Короткую ссылку/);
  });
});

describe('parseMapUrl — Яндекс', () => {
  it('ll и pt — «долгота,широта»', () => {
    expect(parseMapUrl('https://yandex.ru/maps/54/yekaterinburg/?ll=60.6035%2C56.838&z=17')).toEqual({ lat: LAT, lon: LON });
    expect(parseMapUrl('https://yandex.ru/maps/?pt=60.6035,56.838,pm2rdm&z=15')).toEqual({ lat: LAT, lon: LON });
  });

  it('whatshere[point] важнее центра карты ll', () => {
    const url = 'https://yandex.ru/maps/?ll=60.5%2C56.8&whatshere%5Bpoint%5D=60.6035%2C56.838&whatshere%5Bzoom%5D=17&z=17';
    expect(parseMapUrl(url)).toEqual({ lat: LAT, lon: LON });
  });

  it('маршрут rtext — «широта,долгота», берётся конечная точка', () => {
    const url = 'https://yandex.ru/maps/?rtext=56.80,60.50~56.838,60.6035&rtt=auto';
    expect(parseMapUrl(url)).toEqual({ lat: LAT, lon: LON });
    expect(parseMapUrl('https://yandex.ru/maps/?rtext=~56.838%2C60.6035')).toEqual({ lat: LAT, lon: LON });
  });

  it('Яндекс Навигатор и короткая ссылка', () => {
    expect(parseMapUrl('yandexnavi://show_point_on_map?lat=56.838&lon=60.6035&zoom=12')).toEqual({ lat: LAT, lon: LON });
    expect(parseMapUrl('yandexnavi://build_route_on_map?lat_to=56.838&lon_to=60.6035')).toEqual({ lat: LAT, lon: LON });
    expect(parseMapUrl('https://yandex.ru/maps/-/CDqZaB~3').error).toMatch(/Короткую ссылку/);
    expect(parseMapUrl('https://yandex.ru/navi/?whatshere%5Bpoint%5D=60.6035%2C56.838')).toEqual({ lat: LAT, lon: LON });
  });
});

describe('parseMapUrl — прочие', () => {
  it('geo: из приложений Android и OpenStreetMap', () => {
    expect(parseMapUrl('geo:56.838,60.6035')).toEqual({ lat: LAT, lon: LON });
    expect(parseMapUrl('geo:0,0?q=56.838,60.6035(Плотинка)')).toEqual({ lat: LAT, lon: LON, name: 'Плотинка' });
    expect(parseMapUrl('https://www.openstreetmap.org/?mlat=56.838&mlon=60.6035#map=17/56.838/60.6035')).toEqual({ lat: LAT, lon: LON });
    expect(parseMapUrl('https://www.openstreetmap.org/#map=17/56.838/60.6035')).toEqual({ lat: LAT, lon: LON });
  });

  it('название из ссылки: geo: с меткой в скобках, место Google; щелчок по карте Google названием не считается', () => {
    expect(parseLocationText('geo:0,0?q=56.838,60.6035(Плотинка)')).toEqual({ lat: LAT, lon: LON, name: 'Плотинка' });
    expect(parseLocationText('Точка: geo:0,0?q=56.9425,60.4718(Ганина Яма)')).toEqual({ lat: 56.9425, lon: 60.4718, name: 'Ганина Яма' });
    expect(parseLocationText('(см. https://yandex.ru/maps/?pt=60.6035,56.838)')).toEqual({ lat: LAT, lon: LON });
    const clicked = 'https://www.google.com/maps/place/56%C2%B050\'16.8%22N+60%C2%B036\'12.6%22E/@56.838,60.6035,17z/data=!4m4!3m3!8m2!3d56.838!4d60.6035';
    expect(parseLocationText(clicked)).toEqual({ lat: LAT, lon: LON });
  });

  it('ссылка внутри текста, как её отдаёт «Поделиться»', () => {
    expect(parseLocationText('Плотинка — https://yandex.ru/maps/?pt=60.6035,56.838.')).toEqual({ lat: LAT, lon: LON });
    expect(parseLocationText('https://example.com/page').error).toMatch(/нет координат/);
  });
});

describe('исправления после ревью', () => {
  it('буква полушария не берётся из конца слова перед градусами', () => {
    const moscow = parseLocationText('Moscow 55°45′N 37°37′E');
    expect(moscow.lat).toBeCloseTo(55.75, 6);
    expect(moscow.lon).toBeCloseTo(37.6167, 3);
    const times = parseLocationText('Times Square 40°45′29″N 73°59′08″W');
    expect(times.lat).toBeCloseTo(40.758, 3);
    expect(times.lon).toBeCloseTo(-73.9856, 3);
    expect(parseLocationText('Lisbon 38°43′N 9°08′W').lon).toBeCloseTo(-9.1333, 3);
  });

  it('минус в градусах и полушарие без пробела перед следующим числом', () => {
    const r = parseDms('-33°52\'10" 151°12\'30"');
    expect(r.lat).toBeCloseTo(-33.8694, 3);
    expect(r.lon).toBeCloseTo(151.2083, 3);
    const tight = parseDms('56°50\'16.8"N60°36\'12.6"E');
    expect(tight.lat).toBeCloseTo(56.838, 6);
    expect(tight.lon).toBeCloseTo(60.6035, 6);
  });

  it('маршрут Google: цель — последняя точка, начало маршрута целью не считается', () => {
    expect(parseMapUrl('https://www.google.com/maps/dir/56.1,60.1/%D0%93%D0%B0%D0%BD%D0%B8%D0%BD%D0%B0+%D0%AF%D0%BC%D0%B0/@56.9,60.5,12z/data=!4m2')).toBeNull();
    expect(parseMapUrl('https://www.google.com/maps/dir/Home/56.838,60.6035/@56.9,60.5,12z')).toEqual({ lat: LAT, lon: LON });
  });

  it('длинный ввод не подвешивает разбор', () => {
    const started = Date.now();
    expect(parseLocationText('https://x.ru/' + ')'.repeat(1900)).error).toBeTruthy();
    expect(parseLocationText('a ' + '1'.repeat(1900) + 'x°').error).toBeTruthy();
    expect(parseLocationText('x'.repeat(5000)).error).toMatch(/длинный/);
    expect(Date.now() - started).toBeLessThan(500);
  });
});
