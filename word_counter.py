#!/usr/bin/env python3
"""Подсчёт количества слов в текстовом файле.

Использование:
    python word_counter.py <путь_к_файлу>
"""

import argparse
import sys


def count_words(file_path):
    """Читает файл и возвращает количество слов в нём."""
    with open(file_path, "r", encoding="utf-8") as f:
        text = f.read()
    return len(text.split())


def main():
    parser = argparse.ArgumentParser(
        description="Подсчитывает количество слов в текстовом файле."
    )
    parser.add_argument("file", help="путь к текстовому файлу")
    args = parser.parse_args()

    try:
        words = count_words(args.file)
    except FileNotFoundError:
        print(f"Ошибка: файл не найден: {args.file}", file=sys.stderr)
        sys.exit(1)
    except IsADirectoryError:
        print(f"Ошибка: указанный путь является директорией: {args.file}", file=sys.stderr)
        sys.exit(1)
    except PermissionError:
        print(f"Ошибка: нет прав на чтение файла: {args.file}", file=sys.stderr)
        sys.exit(1)
    except UnicodeDecodeError:
        print(
            f"Ошибка: не удалось прочитать файл {args.file} в кодировке UTF-8",
            file=sys.stderr,
        )
        sys.exit(1)
    except OSError as err:
        print(f"Ошибка при чтении файла: {err}", file=sys.stderr)
        sys.exit(1)

    print(f"Количество слов: {words}")


if __name__ == "__main__":
    main()
