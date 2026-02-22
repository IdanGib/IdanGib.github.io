import { useCallback, useRef, useState } from "react";
import "./CollectionPage.css";

type SortOption =
  | "price-asc"
  | "price-desc"
  | "newest"
  | "best-selling"
  | "name-asc"
  | "name-desc";

const CollectionPage = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sort, setSort] = useState<SortOption>("price-asc");
  const drawerRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const openDrawer = useCallback(() => {
    const overlay = overlayRef.current;
    const drawer = drawerRef.current;
    if (!overlay || !drawer) return;

    overlay.classList.add("active");
    drawer.classList.add("showing");
    // Force reflow before adding open class for animation
    drawer.offsetHeight;
    setDrawerOpen(true);
    overlay.classList.add("visible");
    document.body.style.overflow = "hidden";
  }, []);

  const closeDrawer = useCallback(() => {
    const overlay = overlayRef.current;
    const drawer = drawerRef.current;
    if (!overlay || !drawer) return;

    setDrawerOpen(false);
    overlay.classList.remove("visible");
    document.body.style.overflow = "";
    setTimeout(() => {
      drawer.classList.remove("showing");
      overlay.classList.remove("active");
    }, 350);
  }, []);

  return (
    <div className="collection-page">
      {/* NAV */}
      <nav>
        <div className="nav-logo">Keyzar</div>
        <div className="nav-links">
          <span>Rings</span>
          <span>Bands</span>
          <span>Necklaces</span>
          <span>Earrings</span>
          <span>About</span>
        </div>
        <div className="nav-icons">
          <button className="nav-icon-btn" aria-label="Search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </button>
          <button className="nav-icon-btn" aria-label="Wishlist">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.3l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>
          </button>
          <button className="nav-icon-btn" aria-label="Cart">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <span className="cart-count">2</span>
          </button>
        </div>
        <div className="nav-hamburger">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </nav>

      {/* BREADCRUMB */}
      <div className="breadcrumb">
        Home &nbsp;/&nbsp; <span>Engagement Rings</span>
      </div>

      {/* PAGE HEADER */}
      <div className="page-header">
        <h1>Engagement Rings</h1>
        <span className="count">48 results</span>
      </div>

      {/* BODY */}
      <div className="page-body">
        {/* Filter overlay (mobile) */}
        <div
          className="filter-overlay"
          ref={overlayRef}
          onClick={closeDrawer}
        />

        {/* SIDEBAR */}
        <aside
          className={`sidebar${drawerOpen ? " open" : ""}`}
          ref={drawerRef}
        >
          <div className="drawer-header">
            Filters
            <button className="drawer-close" onClick={closeDrawer}>
              &times;
            </button>
          </div>

          <div className="active-filters">
            <div className="active-pill">
              Yellow Gold <span className="x">&times;</span>
            </div>
            <div className="active-pill">
              Diamond <span className="x">&times;</span>
            </div>
            <div className="active-pill">
              $1k – $5k <span className="x">&times;</span>
            </div>
          </div>

          <div className="filter-group">
            <div className="filter-group-header">
              Metal <span className="chevron">&#x25BE;</span>
            </div>
            <div className="filter-group-body">
              <div className="swatch-row">
                <div className="swatch-circle yg selected"></div>
                <div className="swatch-circle wg"></div>
                <div className="swatch-circle rg"></div>
                <div className="swatch-circle pt"></div>
              </div>
              <div className="swatch-label">
                Yellow Gold selected
              </div>
            </div>
          </div>

          <div className="filter-group">
            <div className="filter-group-header">
              Stone Type <span className="chevron">&#x25BE;</span>
            </div>
            <div className="filter-group-body">
              <div className="filter-option">
                <div className="cb on">&#x2713;</div> Diamond{" "}
                <span className="filter-count">312</span>
              </div>
              <div className="filter-option">
                <div className="cb"></div> Sapphire{" "}
                <span className="filter-count">84</span>
              </div>
              <div className="filter-option">
                <div className="cb"></div> Moissanite{" "}
                <span className="filter-count">56</span>
              </div>
              <div className="filter-option">
                <div className="cb"></div> Ruby{" "}
                <span className="filter-count">29</span>
              </div>
              <div className="filter-option">
                <div className="cb"></div> Emerald{" "}
                <span className="filter-count">17</span>
              </div>
            </div>
          </div>

          <div className="filter-group">
            <div className="filter-group-header">
              Price <span className="chevron">&#x25BE;</span>
            </div>
            <div className="filter-group-body">
              <div className="price-slider">
                <div className="slider-track">
                  <div className="slider-fill"></div>
                  <div className="slider-handle l"></div>
                  <div className="slider-handle r"></div>
                </div>
              </div>
              <div className="price-inputs">
                <input className="price-input" value="$1k" readOnly />
                <span className="price-sep">&mdash;</span>
                <input className="price-input" value="$5k" readOnly />
              </div>
            </div>
          </div>

          <div className="filter-actions">
            <div className="btn-apply" onClick={closeDrawer}>
              Apply Filters
            </div>
            <div className="btn-clear">Clear All</div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="main">
          <div className="toolbar">
            <div className="toolbar-left">
              <button className="mobile-filter-btn" onClick={openDrawer}>
                <span className="filter-icon">&#x2630;</span> Filters
              </button>
              <select
                className="sort-select"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
              >
                <option value="price-asc">Sort: Price Low → High</option>
                <option value="price-desc">Sort: Price High → Low</option>
                <option value="newest">Sort: Newest</option>
                <option value="best-selling">Sort: Best Selling</option>
                <option value="name-asc">Sort: Name A → Z</option>
                <option value="name-desc">Sort: Name Z → A</option>
              </select>
              <div className="view-toggle">
                <div className="view-btn active">&#x229E;</div>
                <div className="view-btn">&#x2261;</div>
              </div>
            </div>
          </div>

          <div className="product-grid">
            <div className="product-card">
              <div className="card-img s2">
                <div className="badge-new">New</div>
                <button className="card-wishlist" aria-label="Add to wishlist">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.3l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>
                </button>
              </div>
              <div className="card-body">
                <div className="card-name">Classic Solitaire Ring</div>
                <div className="card-price">$2,400</div>
                <div className="card-swatches">
                  <div className="cswatch yg sel"></div>
                  <div className="cswatch wg"></div>
                  <div className="cswatch rg"></div>
                </div>
              </div>
            </div>

            <div className="product-card">
              <div className="card-img s1">
                <button className="card-wishlist" aria-label="Add to wishlist">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.3l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>
                </button>
              </div>
              <div className="card-body">
                <div className="card-name">Halo Engagement Ring</div>
                <div className="card-price">$3,800</div>
                <div className="card-swatches">
                  <div className="cswatch yg sel"></div>
                  <div className="cswatch pt"></div>
                </div>
              </div>
            </div>

            <div className="product-card">
              <div className="card-img s3">
                <button className="card-wishlist" aria-label="Add to wishlist">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.3l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>
                </button>
              </div>
              <div className="card-body">
                <div className="card-name">Pav&eacute; Band Ring</div>
                <div className="card-price">$1,900</div>
                <div className="card-swatches">
                  <div className="cswatch yg sel"></div>
                  <div className="cswatch wg"></div>
                  <div className="cswatch rg"></div>
                  <div className="cswatch pt"></div>
                </div>
              </div>
            </div>

            <div className="product-card">
              <div className="card-img s4">
                <button className="card-wishlist" aria-label="Add to wishlist">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.3l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>
                </button>
              </div>
              <div className="card-body">
                <div className="card-name">Three Stone Ring</div>
                <div className="card-price">$4,200</div>
                <div className="card-swatches">
                  <div className="cswatch yg sel"></div>
                  <div className="cswatch wg"></div>
                </div>
              </div>
            </div>

            <div className="product-card">
              <div className="card-img s2">
                <button className="card-wishlist" aria-label="Add to wishlist">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.3l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>
                </button>
              </div>
              <div className="card-body">
                <div className="card-name">Cathedral Setting Ring</div>
                <div className="card-price">$3,100</div>
                <div className="card-swatches">
                  <div className="cswatch yg sel"></div>
                  <div className="cswatch rg"></div>
                  <div className="cswatch pt"></div>
                </div>
              </div>
            </div>

            <div className="product-card">
              <div className="card-img s1">
                <button className="card-wishlist" aria-label="Add to wishlist">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.3l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>
                </button>
              </div>
              <div className="card-body">
                <div className="card-name">Eternity Band</div>
                <div className="card-price">$2,750</div>
                <div className="card-swatches">
                  <div className="cswatch yg sel"></div>
                  <div className="cswatch wg"></div>
                  <div className="cswatch pt"></div>
                </div>
              </div>
            </div>

            <div className="product-card">
              <div className="card-img s3">
                <button className="card-wishlist" aria-label="Add to wishlist">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.3l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>
                </button>
              </div>
              <div className="card-body">
                <div className="card-name">Vintage Milgrain Ring</div>
                <div className="card-price">$3,400</div>
                <div className="card-swatches">
                  <div className="cswatch yg sel"></div>
                  <div className="cswatch rg"></div>
                </div>
              </div>
            </div>

            <div className="product-card">
              <div className="card-img s2">
                <button className="card-wishlist" aria-label="Add to wishlist">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.3l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>
                </button>
              </div>
              <div className="card-body">
                <div className="card-name">Split Shank Ring</div>
                <div className="card-price">$2,900</div>
                <div className="card-swatches">
                  <div className="cswatch yg sel"></div>
                  <div className="cswatch wg"></div>
                  <div className="cswatch rg"></div>
                </div>
              </div>
            </div>

            <div className="product-card card-loading">
              <div className="card-img"></div>
              <div className="card-body">
                <div className="skeleton s-name"></div>
                <div className="skeleton s-price"></div>
                <div className="skeleton s-sw"></div>
              </div>
            </div>
          </div>

          <div className="pagination">
            <div className="pg arrow">&#x2039;</div>
            <div className="pg active">1</div>
            <div className="pg">2</div>
            <div className="pg">3</div>
            <div className="pg dots">&hellip;</div>
            <div className="pg">12</div>
            <div className="pg arrow">&#x203A;</div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CollectionPage;
