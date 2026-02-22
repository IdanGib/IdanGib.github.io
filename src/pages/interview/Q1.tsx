import "./Q1.css";

const Q1 = () => (
  <div className="q1-page">
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
        <span>&#x1F50D;</span>
        <span>&#x2661;</span>
        <span>&#x2610; 2</span>
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
      {/* SIDEBAR */}
      <aside className="sidebar">
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
            <div style={{ fontSize: "10px", color: "#888" }}>
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
              <span className="price-sep">—</span>
              <input className="price-input" value="$5k" readOnly />
            </div>
          </div>
        </div>

        <div className="filter-actions">
          <div className="btn-apply">Apply Filters</div>
          <div className="btn-clear">Clear All</div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main">
        <div className="toolbar">
          <div className="toolbar-left">
            <select className="sort-select">
              <option>Sort: Price Low → High</option>
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
            <div className="card-img s1"></div>
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
            <div className="card-img s3"></div>
            <div className="card-body">
              <div className="card-name">Pavé Band Ring</div>
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
            <div className="card-img s4"></div>
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
            <div className="card-img s2"></div>
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
            <div className="card-img s1"></div>
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
            <div className="card-img s3"></div>
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
            <div className="card-img s2"></div>
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
          <div className="pg dots">&#x2026;</div>
          <div className="pg">12</div>
          <div className="pg arrow">&#x203A;</div>
        </div>
      </main>
    </div>
  </div>
);

export default Q1;
