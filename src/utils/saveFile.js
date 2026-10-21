import { isNativeApp } from './platform';

// Отдаёт файл пользователю: на телефоне — меню «Поделиться» (сохранить в «Файлы», отправить
// в мессенджер), иначе — обычное скачивание. На iOS в установленном приложении скачивание по ссылке
// работает плохо, поэтому «Поделиться» в приоритете. Если браузер не умеет делиться файлом
// такого типа (canShare вернёт false), файл скачивается. Вызывать прямо в обработчике нажатия,
// без ожиданий перед вызовом.
// В APK (Android WebView) нет ни navigator.share для файлов, ни скачивания по blob-ссылке —
// там файл записывается во временную папку приложения и отдаётся системному «Поделиться».
// Возвращает 'shared' | 'downloaded' | 'cancelled'.
async function saveFile(file) {
  if (isNativeApp) return saveFileNative(file);
  let canShare = false;
  try {
    canShare = typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] }) === true;
  } catch {
    canShare = false;
  }

  if (canShare) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return 'shared';
    } catch (err) {
      // пользователь закрыл меню — это не ошибка, и скачивание вместо него не нужно
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }

  downloadFile(file);
  return 'downloaded';
}

// Плагины грузятся только в APK: в веб-сборке их код не нужен
async function saveFileNative(file) {
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share')
  ]);
  const { uri } = await Filesystem.writeFile({
    path: file.name,
    data: await file.text(),
    directory: Directory.Cache,
    encoding: Encoding.UTF8
  });
  try {
    await Share.share({ title: file.name, files: [uri] });
    return 'shared';
  } catch (err) {
    // пользователь закрыл меню «Поделиться» — не ошибка
    if (/cancel/i.test(err?.message ?? '')) return 'cancelled';
    throw err;
  }
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // ссылку освобождаем не сразу: часть браузеров начинает чтение после возврата из click()
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export { saveFile };
