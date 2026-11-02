import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { collection as makeCollection } from '../core/test-helpers';
import type { Collection } from '../core/types';
import { CollectionProvider } from './context';

/** Renderiza dentro do provedor da coleção e expõe a coleção atual depois das interações. */
export function renderWith(ui: ReactElement, initial: Collection = makeCollection()) {
  let current = initial;
  const user = userEvent.setup();
  const utils = render(
    <CollectionProvider initial={initial} onChange={(c) => (current = c)}>
      {ui}
    </CollectionProvider>,
  );
  return {
    ...utils,
    user,
    get collection() {
      return current;
    },
  };
}
