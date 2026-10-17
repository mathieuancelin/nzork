// French resources: catalog (texts) and input translator.
import type { Catalog } from './presenter'
import type { InputTranslator } from '../game'
import { FrenchInput } from '../input/french'
import catalogData from './fr/catalog.json'

export function loadFrench(): { catalog: Catalog; input: InputTranslator } {
  const catalog = catalogData as unknown as Catalog
  return { catalog, input: new FrenchInput(catalog.objects as never) }
}
