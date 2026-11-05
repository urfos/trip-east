// All visible and screen-reader text, per language. TripTexts[lang] -> { key: string | function }.
// Elements in index.html name their key in data-t (text) or data-t-aria (aria-label); app.js fills
// them in. City keys are the English names used in map.json and the photo manifest.
(function () {
  const en = {
    title: "Going East!",
    date: "October 2026",
    chooseLanguage: "Choose a language",
    mapLabel: "Map of Europe with the trip route",
    credit: "Map: Natural Earth",
    city: (c) => c,
    goTo: (c) => `Tap to go to ${c}`,
    inCity: (c) => `In ${c}. `,
    theEnd: "The end. Tap to start over",
    tapToContinue: "Tap to continue",
    roadPhoto: "Photo from the road",
    photos: "Photos",
    backToMap: "← Back to map",
    backToMapLabel: "Back to map",
    prevPhoto: "Previous photo",
    nextPhoto: "Next photo",
    photoAlt: (c, i, n) => `${c}, photo ${i} of ${n}`,
    mute: "Mute music",
    unmute: "Unmute music",
  };

  // Russian city names change with grammatical case: nominative (labels), "to" (accusative after
  // "в") and "in" (prepositional after "в").
  const RU_CITY = {
    Paris:      { name: "Париж",      to: "в Париж",      in: "в Париже" },
    Lausanne:   { name: "Лозанна",    to: "в Лозанну",    in: "в Лозанне" },
    Weisendorf: { name: "Вайзендорф", to: "в Вайзендорф", in: "в Вайзендорфе" },
    Prague:     { name: "Прага",      to: "в Прагу",      in: "в Праге" },
  };
  const ru = {
    title: "На восток!",
    date: "Октябрь 2026",
    chooseLanguage: "Выберите язык",
    mapLabel: "Карта Европы с маршрутом поездки",
    credit: "Карта: Natural Earth",
    city: (c) => (RU_CITY[c] || { name: c }).name,
    goTo: (c) => `Нажмите, чтобы поехать ${RU_CITY[c].to}`,
    inCity: (c) => `Мы ${RU_CITY[c].in}. `,
    theEnd: "Конец. Нажмите, чтобы начать сначала",
    tapToContinue: "Нажмите, чтобы продолжить",
    roadPhoto: "Фото в пути",
    photos: "Фотографии",
    backToMap: "← К карте",
    backToMapLabel: "Вернуться к карте",
    prevPhoto: "Предыдущее фото",
    nextPhoto: "Следующее фото",
    photoAlt: (c, i, n) => `${c}, фото ${i} из ${n}`,
    mute: "Выключить музыку",
    unmute: "Включить музыку",
  };

  window.TripTexts = { en, ru };
})();
