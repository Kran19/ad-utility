import { UtilityAdapter } from '../contracts/utility';
import {
  JsonFormatterAdapter,
  WordCounterAdapter,
  TextHashAdapter,
  AiSummarizerPlaceholderAdapter,
} from './reference-adapters';

export class UtilityRegistry {
  private readonly adapters = new Map<string, UtilityAdapter>();

  /**
   * Register an executable utility adapter into application memory.
   * Throws if an adapter with the same slug is already registered.
   */
  register(adapter: UtilityAdapter): void {
    if (!adapter || !adapter.slug) {
      throw new Error('Cannot register an invalid adapter: missing slug');
    }
    const normalizedSlug = adapter.slug.toLowerCase().trim();
    if (this.adapters.has(normalizedSlug)) {
      throw new Error(`Duplicate utility adapter registration: slug "${normalizedSlug}" is already registered`);
    }
    this.adapters.set(normalizedSlug, adapter);
  }

  /**
   * Get an adapter by slug.
   */
  get<TInput = any, TOutput = any>(slug: string): UtilityAdapter<TInput, TOutput> | undefined {
    return this.adapters.get(slug.toLowerCase().trim()) as UtilityAdapter<TInput, TOutput> | undefined;
  }

  /**
   * Check if an adapter exists in the registry.
   */
  has(slug: string): boolean {
    return this.adapters.has(slug.toLowerCase().trim());
  }

  /**
   * List all registered adapters.
   */
  list(): UtilityAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Clear registry (used for test isolation).
   */
  clear(): void {
    this.adapters.clear();
  }

  /**
   * Create a default pre-populated registry with core initial adapters.
   */
  static createDefault(): UtilityRegistry {
    const registry = new UtilityRegistry();
    registry.register(new JsonFormatterAdapter());
    registry.register(new WordCounterAdapter());
    registry.register(new TextHashAdapter());
    registry.register(new AiSummarizerPlaceholderAdapter());
    return registry;
  }
}

// Global default singleton instance
export const defaultUtilityRegistry = UtilityRegistry.createDefault();
