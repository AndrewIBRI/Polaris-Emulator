package polaris.messages.incoming.catalog;

import polaris.Emulator;
import polaris.hotel.catalog.CatalogItem;
import polaris.hotel.catalog.CatalogManager;
import polaris.hotel.catalog.CatalogPage;
import polaris.hotel.catalog.CatalogPageAccessPolicy;
import polaris.messages.incoming.MessageHandler;
import polaris.messages.outgoing.catalog.CatalogSearchResultComposer;

/**
 * GetProductOffer (2594): the offer behind a catalogue search result. Only offers of a page the user may open are
 * answered, the rule a purchase is checked with, so a search never shows furni of a page closed to them (rank, club,
 * disabled). AIR's client leaves those out of its results already (HabboCatalog.createSearchResultOffer).
 */
public class CatalogSearchedItemEvent extends MessageHandler {
    @Override
    public void handle() throws Exception {
        int offerId = this.packet.readInt();

        CatalogManager catalogManager = Emulator.getGameEnvironment().getCatalogManager();

        // Catalogue search sends the FURNI id (furnidata item id), which is a
        // different id space from catalog offers. Resolve by furni first and
        // fall back to the offer id; resolving a furni id through offerDefs
        // collided with unrelated catalog rows (classic furni ids like 63 are
        // also valid catalog item ids) and returned a different furni.
        int catalogItemId = catalogManager.furniDefs.get(offerId);
        boolean resolvedByFurni = catalogItemId != 0;

        if (!resolvedByFurni) {
            catalogItemId = catalogManager.offerDefs.get(offerId);
        }

        if (catalogItemId != 0) {
            CatalogItem requestedItem =
                    catalogManager.getCatalogItem(catalogItemId);
            if (requestedItem == null) {
                return;
            }

            CatalogPage page =
                    Emulator.getGameEnvironment().getCatalogManager().getCatalogPage(requestedItem.getPageId());

            if (page != null
                    && mayShow(
                            page,
                            this.client.getUser().getUserInfo().getRank().getId(),
                            this.client.getUser().getUserStats().hasActiveClub())) {
                for (CatalogItem item : page.getCatalogItems().values()) {
                    if (resolvedByFurni ? item.getId() == catalogItemId : item.getSearchOfferId() == offerId) {
                        this.client.sendResponse(new CatalogSearchResultComposer(item));
                        return;
                    }
                }
            }
        }
    }

    /** A search result is shown only when its page is open to the user, as a purchase from it would be. */
    static boolean mayShow(CatalogPage page, int userRank, boolean hasActiveClub) {
        return CatalogPageAccessPolicy.canAccess(page, userRank, hasActiveClub);
    }
}
