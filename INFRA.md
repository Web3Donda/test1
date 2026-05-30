# Инфраструктура сайта Цветы Елизавета

Все провайдеры и куда что лежит. Пароли тут НЕ хранятся — держи в менеджере паролей (Bitwarden / 1Password).

---

## Где живёт код (3 копии)

```
1. У тебя на компе:  C:\Users\larry\Downloads\google\
2. На GitHub:        https://github.com/Web3Donda/test1
3. На сервере:       /opt/elizaveta/   (работающая копия)
```

Если потерял локальную папку — восстанови с GitHub:

```bash
cd C:\Users\larry\Downloads
git clone https://github.com/Web3Donda/test1.git google
cd google
npm install
```

---

## Домен

**reg.ru** — https://www.reg.ru/
- Зарегистрирован: `elizaveta-flower74.ru`
- ИНН владельца: 743203379680 (хозяйки)
- Автопродление: ~700₽/год (включить чтоб не забывать)
- DNS-записи: 2 штуки, обе A → `91.230.94.68`

Старый домен с опечаткой: `ellizaveta-flower74.ru` (двойная L) — не используется, автопродление выключить, через год отвалится.

---

## Сервер (хостинг + БД)

**lite.host** — https://lite.host/
- VDS «Индивидуальный» — Ubuntu 22.04, 1 CPU, 1 ГБ RAM, 10 ГБ SSD
- IP: `91.230.94.68`
- Цена: 285₽/мес
- Регион: Москва (физически)
- Поддерживает автосписание с баланса

### Что на нём крутится:

```
/opt/elizaveta/        — код сайта (git clone)
/opt/elizaveta/.env    — секреты (DATABASE_URL, ADMIN_PIN, ЮKassa, Timeweb S3)
/opt/elizaveta/dist/   — собранный фронтенд
/opt/elizaveta/dist-server/server.mjs — собранный бэкенд

PostgreSQL 14:
  пользователь: elizaveta
  база:         elizaveta
  пароль:       (см. /opt/elizaveta/.env → DATABASE_URL)

Node.js приложение:
  systemd unit: /etc/systemd/system/elizaveta.service
  логи:         journalctl -u elizaveta -n 50

nginx:
  конфиг:       /etc/nginx/sites-available/elizaveta
  ssl:          /etc/letsencrypt/live/elizaveta-flower74.ru/

certbot:
  сертификат автоматически продлевается каждые 3 мес.
```

### SSH вход
```
ssh root@91.230.94.68
# пароль в менеджере паролей
```

### Команды для дебага
```bash
# статус сайта
systemctl status elizaveta

# перезапуск сайта (например после смены .env)
systemctl restart elizaveta

# логи в реальном времени
journalctl -u elizaveta -f

# подключиться к БД
PGPASSWORD=... psql -h localhost -U elizaveta -d elizaveta

# посмотреть товары
PGPASSWORD=... psql -h localhost -U elizaveta -d elizaveta -c "SELECT id, name, price FROM products;"
```

---

## Файловое хранилище (фото товаров)

**Timeweb Cloud** — https://timeweb.cloud/
- Раздел: «Хранилище S3»
- Bucket: `elizaveta` (публичный)
- Endpoint: `https://s3.twcstorage.ru`
- Регион: `ru-1` (Санкт-Петербург)
- Тариф: 1 ГБ за 1₽/мес
- Публичный URL фото: `https://elizaveta.s3.twcstorage.ru/products/<filename>`
- Доступы: «S3 Access Key» + «S3 Secret Access Key» в панели

Фото уходят туда автоматически когда добавляешь товар в админке.

---

## Оплата

**ЮKassa** — https://yookassa.ru/
- Shop ID: `1368642`
- Текущие ключи: **тестовые** (`test_...`) — реальных денег не принимают
- После верификации хозяйки → выдадут live-ключи
- Webhook для уведомлений: `https://elizaveta-flower74.ru/api/yookassa/webhook`
- Комиссия: 2.8% (самозанятый) / 3.5% (ИП)

---

## Админка сайта

URL: `https://elizaveta-flower74.ru/` → раздел «Войти для персонала»

Пароль: хранится в env-переменной `ADMIN_PIN` на сервере (не в коде!). Сменить:
```bash
ssh root@91.230.94.68
sed -i 's/^ADMIN_PIN=.*/ADMIN_PIN=новый_пароль/' /opt/elizaveta/.env
systemctl restart elizaveta
```

Текущий: `admin1010` (запомнить или сменить на что-то посильнее).

---

## Деплой нового кода

Когда меняешь код (через AI):

```bash
# на твоей машине
cd C:\Users\larry\Downloads\google
git add . && git commit -m "что изменил" && git push

# на сервере
ssh root@91.230.94.68
cd /opt/elizaveta
git pull
npm run build           # пересобрать фронт
npm run build:server    # пересобрать бэк
systemctl restart elizaveta
```

---

## Чекаут при «всё сломалось»

| Что не работает | Куда смотреть |
|---|---|
| Сайт не открывается совсем | `systemctl status nginx elizaveta` — есть ли «active» |
| Открывается, но «502 Bad Gateway» | Node-сервис упал → `journalctl -u elizaveta -n 50` |
| Каталог пустой / фото битые | API проверка: `curl https://elizaveta-flower74.ru/api/products` |
| Оплата не проходит | Проверь YOOKASSA_* в `.env`, перезапусти |
| Админка пишет «неверный код» | Проверь `grep ADMIN_PIN /opt/elizaveta/.env` |
| Совсем ничего не понятно | Открой issue в чате AI и брось эту шпаргалку |

---

## Месячные расходы

| Сервис | Сколько |
|---|---|
| VDS lite.host | 285₽/мес |
| Домен reg.ru | ~58₽/мес (700₽/год амортизация) |
| Timeweb S3 | 1₽/мес |
| Let's Encrypt | бесплатно |
| Supabase | не используется |
| Vercel | не используется |
| **Итого** | **~345₽/мес = 4140₽/год** |

ЮKassa берёт 2.8-3.5% с каждой оплаты — отдельно платить ничего не надо.
