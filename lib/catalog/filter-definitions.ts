export type CatalogFilterOption = { slug: string; value: string };

export type CatalogFilterDefinition = {
  key: string;
  label: string;
  sourceLabel: string;
  enabled: boolean;
  options: CatalogFilterOption[];
};

export const applicationOptions: CatalogFilterOption[] = [
  { slug: "kalendari", value: "Магниты для календарей" },
  { slug: "korobki-i-shkatulki", value: "Магниты для коробок и шкатулок" },
  { slug: "reklamnye-paneli", value: "Магниты для рекламных панелей" },
  { slug: "gps-trekery-i-mayaki", value: "Магниты для GPS-трекеров и маяков" },
  { slug: "beydzhi-i-propuska", value: "Магниты для бейджей и пропусков" },
  { slug: "derzhateli-telefonov-v-avto", value: "Магниты для держателей телефонов в авто" },
  { slug: "markernye-doski", value: "Магниты для маркерных досок" },
  { slug: "detskie-konstruktory", value: "Магниты для детских конструкторов" },
  { slug: "avto-nakleyki", value: "Магниты для авто-наклеек" },
  { slug: "dveri-shkafov-i-kuhon", value: "Магниты для дверей шкафов и кухонь" },
];

export const industryOptions: CatalogFilterOption[] = [
  { slug: "mebelnaya-furnitura", value: "Мебельная фурнитура" },
  { slug: "upakovka-i-poligrafiya", value: "Упаковка и полиграфия" },
  { slug: "reklama-i-suvenirka", value: "Реклама и сувенирка" },
  { slug: "elektronika-i-pribory", value: "Электроника и приборы" },
  { slug: "svarka-i-metalloobrabotka", value: "Сварка и металлообработка" },
  { slug: "poiskovaya-rybalka", value: "Поисковая рыбалка" },
  { slug: "magnitnye-derzhateli", value: "Магнитные держатели" },
  { slug: "promyshlennost-i-osnastka", value: "Промышленность и оснастка" },
];

export const builtInCatalogFilters: CatalogFilterDefinition[] = [
  { key: "application", label: "Применение", sourceLabel: "Применение", enabled: true, options: applicationOptions },
  { key: "industry", label: "Отрасль", sourceLabel: "Отрасль", enabled: true, options: industryOptions },
];

export function normalizeFilterKey(label: string) {
  const normalized = label.trim().toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return normalized || "property";
}

export function optionBySlug(filter: CatalogFilterDefinition, slug: string) {
  return filter.options.find((option) => option.slug === slug);
}
