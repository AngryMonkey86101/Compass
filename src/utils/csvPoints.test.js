import { describe, it, expect } from 'vitest';
import { parseDelimited, detectDelimiter, pointsFromCsv } from './csvPoints';

describe('parseDelimited', () => {
  it('кавычки, удвоенная кавычка, перевод строки внутри поля и номера строк записей', () => {
    const records = parseDelimited('a;"b;c";"say ""hi"""\r\n"много\nстрок";2;3\n\n4;5;6', ';');
    expect(records).toEqual([
      { fields: ['a', 'b;c', 'say "hi"'], line: 1 },
      { fields: ['много\nстрок', '2', '3'], line: 2 },
      { fields: ['4', '5', '6'], line: 5 }
    ]);
  });

  it('разделитель по первой строке', () => {
    expect(detectDelimiter('a;b,c\n')).toBe(';');
    expect(detectDelimiter('\n\na,b,c')).toBe(',');
    expect(detectDelimiter('a\tb;c')).toBe('\t');
  });
});

describe('pointsFromCsv', () => {
  it('ручная таблица с русским заголовком и дробной запятой', () => {
    const r = pointsFromCsv('Название;Широта;Долгота\nПлотинка;56,838;60,6035\nГанина Яма;56.9425;60.4718\n');
    expect(r.points).toEqual([
      { name: 'Плотинка', lat: 56.838, lon: 60.6035 },
      { name: 'Ганина Яма', lat: 56.9425, lon: 60.4718 }
    ]);
    expect(r.recognized).toBe(true);
  });

  it('экспорт Конструктора карт Яндекса: широта, долгота, описание, подпись, номер', () => {
    const csv = 'Широта;Долгота;Описание;Подпись;Номер метки\n' +
      '56.838;60.6035;"Исторический сквер;\nплотина пруда";Плотинка;1\n' +
      '56.9425;60.4718;Монастырь;;2\n';
    expect(pointsFromCsv(csv).points).toEqual([
      { name: 'Плотинка', lat: 56.838, lon: 60.6035 },
      { name: 'Монастырь', lat: 56.9425, lon: 60.4718 }
    ]);
  });

  it('английский заголовок с другим порядком столбцов и столбец координат', () => {
    expect(pointsFromCsv('lon,lat,name\n60.6035,56.838,Dam\n').points).toEqual([{ name: 'Dam', lat: 56.838, lon: 60.6035 }]);
    expect(pointsFromCsv('Название;Координаты\nДом;"56.838, 60.6035"\n').points)
      .toEqual([{ name: 'Дом', lat: 56.838, lon: 60.6035 }]);
  });

  it('без заголовка: «название, широта, долгота»', () => {
    expect(pointsFromCsv('Плотинка,56.838,60.6035\nГанина Яма,56.9425,60.4718').points).toEqual([
      { name: 'Плотинка', lat: 56.838, lon: 60.6035 },
      { name: 'Ганина Яма', lat: 56.9425, lon: 60.4718 }
    ]);
  });

  it('без заголовка, разделитель «;»: широта и долгота первыми', () => {
    expect(pointsFromCsv('56.9425;60.4718;Ганина Яма\n56.838;60.6035;Плотинка').points).toEqual([
      { name: 'Ганина Яма', lat: 56.9425, lon: 60.4718 },
      { name: 'Плотинка', lat: 56.838, lon: 60.6035 }
    ]);
  });

  it('ошибочные строки пропускаются с номерами строк, пустые — не считаются', () => {
    const r = pointsFromCsv('Название;Широта;Долгота\nДом;56.8;60.6\n\nПлохая;abc;60\nДалеко;95;60\n');
    expect(r.points).toHaveLength(1);
    expect(r.skipped).toBe(2);
    expect(r.skipNotes).toEqual(['ошибка в координатах (строка 4) — 1', 'координаты вне диапазона (строка 5) — 1']);
  });

  it('список Google Takeout: координаты из ссылок, где они есть, иначе подсказка про My Maps', () => {
    const csv = 'Title,Note,URL,Tags,Comment\n' +
      'Плотинка,,"https://www.google.com/maps/search/56.838,60.6035",,\n' +
      'Ельцин Центр,,https://www.google.com/maps/search/56.8447,60.5911,,\n' +
      'Кафе,,https://www.google.com/maps/place/Cafe/data=!4m2!3m1!1s0x43c1:0x1,,\n';
    const r = pointsFromCsv(csv);
    expect(r.points).toEqual([
      { name: 'Плотинка', lat: 56.838, lon: 60.6035 },
      { name: 'Ельцин Центр', lat: 56.8447, lon: 60.5911 }
    ]);
    expect(r.skipNotes).toEqual(['ссылка без координат (строка 4) — 1']);
    expect(r.hint).toBeNull();

    const onlyLinks = pointsFromCsv('Title,Note,URL\nКафе,,https://www.google.com/maps/place/Cafe/data=!4m2!3m1!1s0x1:0x2\n');
    expect(onlyLinks.points).toEqual([]);
    expect(onlyLinks.hint).toMatch(/My Maps/);
  });

  it('обычный текст без координат не считается CSV', () => {
    expect(pointsFromCsv('Привет, это просто заметка.\nВторая строка').recognized).toBe(false);
    expect(pointsFromCsv('').recognized).toBe(false);
  });
});

describe('исправления после ревью', () => {
  it('номер или код рядом с координатами не принимается за широту', () => {
    expect(pointsFromCsv('1;56.838;60.6035;Плотинка').points).toEqual([{ name: 'Плотинка', lat: 56.838, lon: 60.6035 }]);
    expect(pointsFromCsv('Плотинка;2;56.838;60.6035').points).toEqual([{ name: 'Плотинка', lat: 56.838, lon: 60.6035 }]);
  });

  it('точка с названием «Name» в первой строке файла без заголовка не теряется', () => {
    expect(pointsFromCsv('Name;56.8;60.6\nB;56.9;60.7').points).toEqual([
      { name: 'Name', lat: 56.8, lon: 60.6 },
      { name: 'B', lat: 56.9, lon: 60.7 }
    ]);
  });

  it('апостроф защиты от формул снимается при импорте', () => {
    expect(pointsFromCsv('Широта;Долгота;Описание;Подпись\n56.8;60.6;;\'=СУММ(A1)\n').points[0].name).toBe('=СУММ(A1)');
  });
});
