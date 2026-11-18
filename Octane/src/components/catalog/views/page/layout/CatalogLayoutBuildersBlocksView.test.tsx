/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    page: null as unknown
}));

vi.mock('../../../../../api', async (importOriginal) =>
    ({
        ...(await importOriginal<Record<string, unknown>>()),
        localizeWithFallback: (_k: string, fallback: unknown) => fallback
    }));

vi.mock('../../../../../hooks', () => ({
    useCatalogData: () => ({ currentOffer: null, roomPreviewer: null, currentType: 'BUILDERS_CLUB' }),
    useCatalogUiState: () => ({ setCurrentOffer: vi.fn(), currentType: 'BUILDERS_CLUB' }),
    useCatalogActions: () => ({ requestOfferToMover: null }),
    useInventoryFurni: () => ({ isVisible: false })
}));

vi.mock('../widgets/CatalogPreviewControls', () => ({ CatalogPreviewControls: () => null }));
vi.mock('../widgets/CatalogPurchaseWidgetView', () => ({ CatalogPurchaseWidgetView: () => null }));
vi.mock('../widgets/CatalogViewProductWidgetView', () => ({ CatalogViewProductWidgetView: () => null }));

import { CatalogLayoutBuildersBlocksView } from './CatalogLayoutBuildersBlocksView';

const makeOffer = (className: string, colorIndex: number, id: number) =>
    ({
        offerId: id,
        localizationName: `${className}*${colorIndex}`,
        activate: vi.fn(),
        product: {
            productType: 's',
            productClassId: `${id}`,
            furnitureData: {
                className,
                colorIndex,
                hasIndexedColor: true,
                colors: [0xffffff, colorIndex % 16 ? (colorIndex % 16) * 0x111111 : 0x222222],
                fullName: `${className}*${colorIndex}`
            }
        }
    }) as unknown as never;

const makePage = (families = 20, colorsPerFamily = 19) =>
{
    const offers: unknown[] = [];
    let id = 1;

    for (let f = 0; f < families; f++)
    {
        for (let c = 0; c < colorsPerFamily; c++)
        {
            offers.push(makeOffer(`bc_alpha${f}`, c, id++));
        }
    }

    return ({ offers, text: 'x', textDetails: 'y', textTeaser: 'z', icon: 'i' }) as any;
};

describe('CatalogLayoutBuildersBlocksView (page 117 - Blocos do Alfabeto)', () =>
{
    afterEach(cleanup);

    it('renders the Builders Club page without crashing or looping', () =>
    {
        state.page = makePage();

        const start = Date.now();
        const { container } = render(<CatalogLayoutBuildersBlocksView {...({ page: state.page, hideNavigation: false } as any)} />);

        expect(container).not.toBeNull();
        // renders all families
        expect(container.querySelectorAll('.octane-catalog-builders-blocks').length).toBeGreaterThan(0);
        expect(Date.now() - start).toBeLessThan(5000);
    });

    it('renders with an empty page', () =>
    {
        render(<CatalogLayoutBuildersBlocksView page={makePage(0, 0)} hideNavigation={ () => {} } />);

        expect(document.querySelector('.octane-catalog-builders-blocks')).not.toBeNull();
    });
});
