# Profile Tabs - Expo SDK 54 + Reanimated 4

Решение для отрисовки профиля пользователя с множеством табов, переключаемых свайпами, с навигацией по URL.

## Структура

- **Header** — анимированно уходит при скролле (`revealHeaderOnScroll`)
- **Tabs bar** — статичная панель табов
- **Content** — контент по табу (FlatList, FlashList, SectionList)

Для пользователя всё выглядит как одна скролящаяся страница.

## Стек

- Expo SDK 54
- React Native Reanimated 4
- react-native-collapsible-tab-view
- @shopify/flash-list v2.2 (без estimatedItemSize)
- Expo Router (URL-навигация)

## URL маршруты

- `/profile` — по умолчанию таб "posts"
- `/profile/posts`
- `/profile/media`
- `/profile/likes`

## Запуск

```bash
npm install
npx expo start
```

## FlashList v2

FlashList v2.2 не имеет `estimatedItemSize` и использует другой внутренний API. Для совместимости с `react-native-collapsible-tab-view` добавлен patch в `patches/` — после `npm install` он применяется автоматически.

## Компоненты табов

- **Tabs.FlatList** — для списков
- **Tabs.FlashList** — для виртуализированных списков (с patch)
- **Tabs.SectionList** — для контента с секциями
