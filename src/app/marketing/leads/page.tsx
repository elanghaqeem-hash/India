import {redirect} from 'next/navigation';
/** Compatibility alias for old PR18 bookmarks. Canonical Marketing UI is a single implementation. */
export default function MarketingRouteAlias(){redirect('/sales/leads');}
