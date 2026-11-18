/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../hooks', () => ({
    useCatalogData: () => ({ currentOffer: null, roomPreviewer: null }),
    useCatalogUiState: () => ({ setCurrentOffer: vi.fn() }),
    useCatalogActions: () => ({ requestOfferToMover: null }),
    useInventoryFurni: () => ({ isVisible: false })
}));

vi.mock('../widgets/CatalogAddOnBadgeWidgetView', () => ({ CatalogAddOnBadgeWidgetView: () => null }));
vi.mock('../widgets/CatalogLimitedItemWidgetView', () => ({ CatalogLimitedItemWidgetView: () => null }));
vi.mock('../widgets/CatalogPreviewControls', () => ({ CatalogPreviewControls: () => null }));
vi.mock('../widgets/CatalogPurchaseWidgetView', () => ({ CatalogPurchaseWidgetView: () => null }));
vi.mock('../widgets/CatalogSpinnerWidgetView', () => ({ CatalogSpinnerWidgetView: () => null }));
vi.mock('../widgets/CatalogTotalPriceWidget', () => ({ CatalogTotalPriceWidget: () => null }));
vi.mock('../widgets/CatalogViewProductWidgetView', () => ({ CatalogViewProductWidgetView: () => null }));

import { CatalogLayoutColorGroupingView } from './CatalogLayoutColorGroupingView';

const makeOffer = (id: number, className: string | null, colorIndex = 0) =>
    ({
        offerId: id,
        localizationName: `offer${id}`,
        activate: vi.fn(),
        product: {
            productType: 's',
            productClassId: `${id}`,
            furnitureData: className === null
                ? null
                : {
                    className,
                    colorIndex,
                    hasIndexedColor: true,
                    colors: [0xffffff, (colorIndex % 16) * 0x111111],
                    fullName: `${className}*${colorIndex}`
                }
        }
    }) as unknown as never;

const makePage = (offers: unknown[]): unknown => ({
    pageId: 117,
    layoutCode: 'default_3x3_color_grouping',
    localization: { getImage: () => '', getText: () => '' },
    acceptSeasonCurrencyAsCredits: false,
    mode: 'default',
    offers,
    text: 'x',
    textDetails: 'y',
    textTeaser: 'z',
    icon: 'i'
});

describe('CatalogLayoutColorGroupingView', () =>
{
    afterEach(cleanup);

    it('does not crash when an offer has no furnitureData (page 117 regression)', () =>
    {
        const offers = [
            makeOffer(1, 'bc_alpha1', 1),
            makeOffer(2, null), // item missing from furnidata -> furnitureData null
            makeOffer(3, 'bc_alpha1', 2)
        ];

        const { container } = render(<CatalogLayoutColorGroupingView {...({ page: makePage(offers), hideNavigation: false } as any)} />);

        expect(container).not.toBeNull();
        expect(container.children.length).toBeGreaterThan(0);
    });
});
