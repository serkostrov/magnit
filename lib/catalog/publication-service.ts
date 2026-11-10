import { catalogRepository, type CatalogFilters } from "./repository";
import type { CatalogPage, Product } from "./types";

export interface PublicationService {
  getPage(filters?: CatalogFilters): Promise<CatalogPage>;
  getBySlug(slug: string): Promise<Product | null>;
  getBestsellers(limit?: number): Promise<Product[]>;
  getNewProducts(limit?: number): Promise<Product[]>;
}

export const publicationService: PublicationService = {
  getPage: (filters) => catalogRepository.getPage(filters),
  getBySlug: (slug) => catalogRepository.getBySlug(slug),
  getBestsellers: (limit) => catalogRepository.getBestsellers(limit),
  getNewProducts: (limit) => catalogRepository.getNewProducts(limit),
};

export const getCatalogPage = (filters: CatalogFilters = {}) => publicationService.getPage(filters);
export const getProductBySlug = (slug: string) => publicationService.getBySlug(slug);
export const getBestsellers = (limit = 8) => publicationService.getBestsellers(limit);
export const getNewProducts = (limit = 4) => publicationService.getNewProducts(limit);
export const getCatalogFilterDefinitions = () => catalogRepository.getFilterDefinitions();

export type { CatalogFilters, CatalogPage, Product };
