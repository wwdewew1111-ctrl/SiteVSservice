#!/bin/sh
# Install the prebuilt site on a static Apache host; Node.js is not required.
set -eu

REPO_URL="https://github.com/wwdewew1111-ctrl/SiteVSservice.git"
DEFAULT_ROOT="$HOME/www/kabanyesports.online"
TARGET=${1:-$DEFAULT_ROOT}

fail() { printf '\nОшибка: %s\n' "$*" >&2; exit 1; }
command -v git >/dev/null 2>&1 || fail 'Не найден git.'
command -v mktemp >/dev/null 2>&1 || fail 'Не найден mktemp.'
[ -d "$TARGET" ] || fail "Папка сайта не найдена: $TARGET. Укажите правильный путь первым параметром."
[ -w "$TARGET" ] || fail "Нет прав на запись в $TARGET."
TARGET=$(cd -P -- "$TARGET" && pwd -P) || fail 'Не удалось открыть папку сайта.'

printf 'Скачиваем готовую сборку из GitHub...\n'
WORK=$(mktemp -d "${TMPDIR:-/tmp}/sitevsservice.XXXXXXXX") || fail 'Не удалось создать временную папку.'
trap 'rm -rf -- "$WORK"' EXIT HUP INT TERM
git clone --quiet --depth 1 --branch main "$REPO_URL" "$WORK/repo" || fail 'Не удалось скачать репозиторий.'
SOURCE="$WORK/repo/reg-ru-site"
[ -f "$SOURCE/index.html" ] && [ -f "$SOURCE/.htaccess" ] && [ -d "$SOURCE/assets" ] || fail 'В репозитории нет готовой сборки reg-ru-site.'

printf '\nПапка сайта: %s\n' "$TARGET"
printf 'Существующие файлы:\n'
ls -la "$TARGET"
printf '\nФайлы с совпадающими именами будут перезаписаны.\n'
printf 'Для продолжения введите YES: '
IFS= read -r answer || fail 'Подтверждение не получено.'
[ "$answer" = YES ] || fail 'Установка отменена; файлы сайта не изменены.'

BACKUP=$(mktemp -d "$HOME/site-backup-XXXXXXXX") || fail 'Не удалось создать папку резервной копии.'
printf '\nСохраняем резервную копию в %s ...\n' "$BACKUP"
cp -Rp "$TARGET/." "$BACKUP/" || fail "Резервная копия не создана полностью: $BACKUP. Файлы сайта не изменены."
printf 'Копируем сборку...\n'
cp -Rp "$SOURCE/." "$TARGET/" || fail "Ошибка копирования. Восстановите файлы из $BACKUP."
printf '\nГотово! Сайт: %s\nРезервная копия: %s\n' "$TARGET" "$BACKUP"
printf 'Проверьте главную страницу и /admin.\n'
