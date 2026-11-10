import type { ProductCharacteristic } from "./types";

export type ProductCharacteristicGroup = {
  key: string;
  label: string;
  values: ProductCharacteristic[];
};

const groupedLabels = new Set(["применение", "отрасль"]);

export function groupProductCharacteristics(
  characteristics: ProductCharacteristic[],
): ProductCharacteristicGroup[] {
  const groups: ProductCharacteristicGroup[] = [];
  const groupedIndexes = new Map<string, number>();

  characteristics.forEach((characteristic, index) => {
    const label = characteristic.label.trim();
    const normalizedLabel = label.toLowerCase();

    if (!groupedLabels.has(normalizedLabel)) {
      groups.push({
        key: `characteristic-${index}`,
        label,
        values: [characteristic],
      });
      return;
    }

    const existingIndex = groupedIndexes.get(normalizedLabel);
    if (existingIndex === undefined) {
      groupedIndexes.set(normalizedLabel, groups.length);
      groups.push({
        key: `group-${normalizedLabel}`,
        label,
        values: [characteristic],
      });
      return;
    }

    const values = groups[existingIndex].values;
    const isDuplicate = values.some(
      (value) =>
        value.value === characteristic.value &&
        value.filterKey === characteristic.filterKey &&
        value.filterSlug === characteristic.filterSlug,
    );
    if (!isDuplicate) values.push(characteristic);
  });

  return groups;
}
