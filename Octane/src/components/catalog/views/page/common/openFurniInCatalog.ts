import { GetSessionDataManager, IFurnitureData } from '@octane/renderer';
import { CatalogPage, FurnitureOffer, ICatalogNode, IPurchasableOffer, LocalizeText, PageLocalization, SearchResult } from '../../../../../api';
import { useCatalogStore } from '../../../../../hooks/catalog/catalogStore';
import { FilterCatalogNode } from '../../../../../api';
import { findCatalogFurnitureMatches, normalizeCatalogSearchText } from './catalogSearch.helpers';
import { readCatalogIndex } from '../../../../../hooks/catalog/useCatalogQueries';

/**
 * The infostand's "buy" used to deep-link `catalog/open/offerId/<furnidata offerid>`, but this hotel's
 * catalogue index does not carry the official furnidata offer ids (and the furni editor writes
 * `offerid:-1`), so the link resolved to no offer and the catalogue opened showing a different item.
 * Instead, resolve the furni by its exact class name through the client-side catalogue search, which
 * only returns furniture the user's index actually lists - the item shown is always the right one.
 */
export const openFurniInCatalog = (furnitureData: IFurnitureData | null): boolean => {
    if (!furnitureData) return false;

    const catalog = useCatalogStore.getState();

    catalog.openCatalogByType();

    const currentType = catalog.currentType;
    const furnitureDatas = GetSessionDataManager().getAllFurnitureData();

    if (!furnitureDatas || !furnitureDatas.length) return false;

    const className = normalizeCatalogSearchText(furnitureData.className);
    const isListed = (offerId: number) => offerId > -1 && !!catalog.getNodesByOfferId(offerId, true)?.length;

    const { furniture: found } = findCatalogFurnitureMatches(furnitureDatas, className, currentType, undefined, isListed);

    let matches = found.filter((item) => normalizeCatalogSearchText(item.className) === className);

    if (!matches.length) {
        const name = normalizeCatalogSearchText(furnitureData.name || '');

        matches = found.filter((item) => name && normalizeCatalogSearchText(item.name) === name);
    }

    const rootNode = readCatalogIndex(catalog.currentType)?.rootNode ?? null;

    if (!rootNode) return false;

    const furniLines = [...new Set(matches.map((furniture) => furniture.furniLine).filter(Boolean))];

    const offers: IPurchasableOffer[] = matches.map((furniture) => new FurnitureOffer(furniture));

    let nodes: ICatalogNode[] = [];

    FilterCatalogNode(className, furniLines, rootNode, nodes);

    catalog.setSearchResult(
        new SearchResult(className, offers, nodes.filter((node) => node.isVisible))
    );
    catalog.setCurrentPage(
        new CatalogPage(
            -1,
            'default_3x3',
            new PageLocalization([], [LocalizeText('catalog.search.results', ['count', 'needle'], [String(offers.length), className])]),
            offers,
            false,
            1
        )
    );

    return offers.length > 0;
};
