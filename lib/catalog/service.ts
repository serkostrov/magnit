import { catalogRepository } from "./repository";
import type { CatalogFilters } from "./repository";
import type { CatalogCategory, CatalogPage, Product } from "./types";

export interface CatalogService {
  getAll(): Promise<Product[]>;
  getCategories(): Promise<CatalogCategory[]>;
  getFilterDefinitions(): ReturnType<typeof catalogRepository.getFilterDefinitions>;
}

export const catalogService: CatalogService = {
  getAll: () => catalogRepository.getAll(),
  getCategories: () => catalogRepository.getCategories(),
  getFilterDefinitions: () => catalogRepository.getFilterDefinitions(),
};

export const getAllProducts = () => catalogService.getAll();
export const getCatalogCategories = () => catalogService.getCategories();
export const getCatalogFilterDefinitions = () => catalogService.getFilterDefinitions();

export type { CatalogFilters, CatalogPage, Product };
