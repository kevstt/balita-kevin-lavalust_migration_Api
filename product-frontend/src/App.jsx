import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownUp,
  ArrowRight,
  Boxes,
  Check,
  ChevronDown,
  CircleAlert,
  CircleDollarSign,
  Eye,
  EyeOff,
  LayoutDashboard,
  LogOut,
  Moon,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Trash2,
  X,
} from 'lucide-react'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV
  ? 'http://127.0.0.1:3000/api'
  : `${window.location.origin}/api`)
const SESSION_KEY = 'fieldnote_session'

function readSession() {
  let session
  try {
    session = JSON.parse(localStorage.getItem(SESSION_KEY))
  } catch {
    session = null
  }

  if (!session?.user || !session?.tokens?.access_token) {
    localStorage.removeItem(SESSION_KEY)
    return null
  }

  return session
}

function currency(value) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0))
}

function normalizeProducts(rows) {
  if (!Array.isArray(rows)) return []

  return rows.filter((row) => row && typeof row === 'object').map((row) => ({
    id: row.id,
    product_name: String(row.product_name ?? 'Untitled product'),
    description: String(row.description ?? ''),
    price: Number(row.price) || 0,
    quantity: Number(row.quantity) || 0,
    created_at: row.created_at ? String(row.created_at) : '',
  }))
}

function App() {
  const [session, setSession] = useState(readSession)
  const [theme, setTheme] = useState(() => localStorage.getItem('fieldnote_theme') === 'dark' ? 'dark' : 'light')
  const [activeView, setActiveView] = useState(() => window.location.hash === '#products' ? 'products' : 'overview')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(Boolean(readSession()))
  const [pageError, setPageError] = useState('')
  const [notice, setNotice] = useState('')
  const [noticeId, setNoticeId] = useState(0)
  const [query, setQuery] = useState('')
  const [sortOrder, setSortOrder] = useState('newest')
  const [modal, setModal] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  function showNotice(message) {
    setNotice(message)
    setNoticeId((current) => current + 1)
  }

  function saveSession(next) {
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next))
    else localStorage.removeItem(SESSION_KEY)
    setSession(next)
  }

  function toggleTheme() {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      localStorage.setItem('fieldnote_theme', next)
      return next
    })
  }

  useEffect(() => {
    document.documentElement.style.colorScheme = theme
  }, [theme])

  useEffect(() => {
    if (!notice) return undefined

    const timeoutId = window.setTimeout(() => setNotice(''), 10000)
    return () => window.clearTimeout(timeoutId)
  }, [notice, noticeId])

  useEffect(() => {
    function syncView() {
      setActiveView(window.location.hash === '#products' ? 'products' : 'overview')
    }

    window.addEventListener('hashchange', syncView)
    return () => window.removeEventListener('hashchange', syncView)
  }, [])

  async function request(path, { method = 'GET', body, retry = true } = {}) {
    const current = readSession()
    const send = (accessToken) => fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })

    let response = await send(current?.tokens?.access_token)
    if (response.status === 401 && retry && current?.tokens?.refresh_token) {
      const refreshed = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: current.tokens.refresh_token }),
      })
      if (refreshed.ok) {
        const result = await refreshed.json()
        const next = { ...current, tokens: result.tokens }
        saveSession(next)
        response = await send(next.tokens.access_token)
      } else {
        saveSession(null)
        throw new Error('Your session has expired. Please sign in again.')
      }
    }

    if (response.status === 401 && current) {
      saveSession(null)
      throw new Error('Your session has expired. Please sign in again.')
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      throw new Error('The API returned an unexpected response. Check the LavaLust database connection.')
    }

    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'The request could not be completed.')
    return result
  }

  useEffect(() => {
    if (!session) {
      setProducts([])
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setPageError('')
    request('/products')
      .then((result) => { if (active) setProducts(normalizeProducts(result.data)) })
      .catch((error) => { if (active) setPageError(error.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [session?.tokens?.access_token])

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const result = products.filter((product) =>
      `${product.product_name} ${product.description}`.toLowerCase().includes(normalized),
    )
    if (sortOrder === 'name') result.sort((a, b) => a.product_name.localeCompare(b.product_name))
    if (sortOrder === 'price') result.sort((a, b) => Number(a.price) - Number(b.price))
    return result
  }, [products, query, sortOrder])

  const summary = useMemo(() => ({
    units: products.reduce((total, product) => total + Number(product.quantity), 0),
    value: products.reduce((total, product) => total + Number(product.price) * Number(product.quantity), 0),
    low: products.filter((product) => Number(product.quantity) < 5).length,
  }), [products])

  async function authenticate(mode, values) {
    const result = await request(`/auth/${mode}`, { method: 'POST', body: values, retry: false })
    saveSession({ user: result.user, tokens: result.tokens })
    showNotice(mode === 'register' ? 'Your account is ready.' : 'Welcome back.')
  }

  async function signOut() {
    try {
      await request('/auth/logout', {
        method: 'POST',
        body: { refresh_token: session?.tokens?.refresh_token },
      })
    } catch {
      // Local sign-out still completes when the API is unavailable.
    }
    setShowLogoutConfirm(false)
    saveSession(null)
    showNotice('You have signed out.')
  }

  async function saveProduct(values) {
    const editing = modal?.product
    await request(editing ? `/products/${editing.id}` : '/products', {
      method: editing ? 'PUT' : 'POST',
      body: values,
    })
    const refreshed = await request('/products')
    setProducts(normalizeProducts(refreshed.data))
    setModal(null)
    showNotice(editing ? 'Product details updated.' : 'Product added to inventory.')
  }

  async function deleteProduct() {
    if (!pendingDelete) return
    await request(`/products/${pendingDelete.id}`, { method: 'DELETE' })
    setProducts((current) => current.filter((product) => product.id !== pendingDelete.id))
    showNotice(`${pendingDelete.product_name} was removed.`)
    setPendingDelete(null)
  }

  if (!session) {
    return <AuthScreen onAuthenticate={authenticate} theme={theme} onToggleTheme={toggleTheme} />
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <aside className="sidebar">
        <a className="brand" href="#inventory" aria-label="Fieldnote inventory home">
          <span className="brand-mark"><ShoppingBag size={18} strokeWidth={2.2} /></span>
          <span>fieldnote<span className="brand-period">.</span></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a className={`nav-link ${activeView === 'overview' ? 'active' : ''}`} href="#inventory" aria-current={activeView === 'overview' ? 'page' : undefined}><LayoutDashboard size={17} /> Overview</a>
          <a className={`nav-link ${activeView === 'products' ? 'active' : ''}`} href="#products" aria-current={activeView === 'products' ? 'page' : undefined}><Boxes size={17} /> Products <span className="nav-count">{products.length}</span></a>
        </nav>
        <div className="sidebar-bottom">
          <div className="secure-note"><span><ShieldCheck size={16} /></span><div><strong>Private workspace</strong><small>Signed in securely</small></div></div>
          <button className="profile-button" type="button" onClick={() => setShowLogoutConfirm(true)} title="Sign out">
            <span className="avatar">{session.user?.username?.slice(0, 1)?.toUpperCase() || 'F'}</span>
            <span className="profile-copy"><strong>{session.user?.username || 'Account'}</strong><small>{session.user?.email || 'Inventory manager'}</small></span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="main-content" id="inventory">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activeView === 'overview' ? 'Overview' : 'Products'}</strong></div>
          <div className="topbar-right"><span className="live-indicator"><i /> Connected</span><ThemeButton theme={theme} onToggle={toggleTheme} /><button className="top-avatar" type="button" title="Sign out" aria-label="Sign out" onClick={() => setShowLogoutConfirm(true)}>{session.user?.username?.slice(0, 1)?.toUpperCase() || 'F'}</button></div>
        </header>

        {activeView === 'overview' ? (
          <OverviewPage
            products={products}
            summary={summary}
            loading={loading}
            error={pageError}
            notice={notice}
            noticeId={noticeId}
            onDismissNotice={() => setNotice('')}
            onAddProduct={() => setModal({ product: null })}
          />
        ) : <section className="page-content" id="products">
          <div className="page-heading">
            <div><p className="eyebrow">INVENTORY / {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}</p><h1>Product inventory</h1><p className="heading-subtitle">A considered view of what you have, and what needs attention.</p></div>
            <button className="primary-button" type="button" onClick={() => setModal({ product: null })}><Plus size={17} /> Add product</button>
          </div>

          <div className="summary-grid">
            <SummaryCard label="Products listed" value={products.length.toLocaleString()} detail="Across your inventory" icon={<Boxes size={19} />} color="green" />
            <SummaryCard label="Units in stock" value={summary.units.toLocaleString()} detail="Total available quantity" icon={<PackagePlus size={19} />} color="blue" />
            <SummaryCard label="Stock value" value={currency(summary.value)} detail="Based on current price" icon={<CircleDollarSign size={19} />} color="amber" />
            <SummaryCard label="Low stock" value={summary.low.toLocaleString()} detail="Fewer than 5 units" icon={<CircleAlert size={19} />} color="rose" />
          </div>

          <section className="inventory-panel" aria-labelledby="inventory-title">
            <div className="panel-heading"><div><h2 id="inventory-title">All products <span>{products.length}</span></h2><p>Review and manage your catalog.</p></div><div className="panel-actions"><label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" aria-label="Search products" /><kbd>/</kbd></label><button className="filter-button" type="button" onClick={() => setSortOrder((current) => current === 'newest' ? 'name' : current === 'name' ? 'price' : 'newest')} title="Change product sorting"><ArrowDownUp size={16} /><span>{sortOrder === 'newest' ? 'Newest' : sortOrder === 'name' ? 'Name' : 'Price'}</span><ChevronDown size={14} /></button></div></div>

            {pageError && <div className="inline-error" role="alert">{pageError}<button type="button" onClick={() => window.location.reload()}>Retry</button></div>}
            {notice && <div key={noticeId} className="notice" role="status"><Check size={15} />{notice}<button type="button" title="Dismiss" onClick={() => setNotice('')}><X size={15} /></button></div>}

            {loading ? <div className="table-state"><span className="spinner" /> Loading your inventory</div> : visibleProducts.length === 0 ? (
              <div className="empty-state"><span className="empty-icon"><PackagePlus size={22} /></span><h3>{query ? 'No matching products' : 'A clean slate.'}</h3><p>{query ? 'Try a different name or description.' : 'Add your first item and your inventory will take shape here.'}</p>{!query && <button className="secondary-button" type="button" onClick={() => setModal({ product: null })}><Plus size={16} /> Add first product</button>}</div>
            ) : (
              <div className="table-wrap"><table><thead><tr><th>PRODUCT</th><th>UNIT PRICE</th><th>QUANTITY</th><th>STOCK STATUS</th><th>ADDED</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleProducts.map((product, index) => <tr key={product.id} style={{ '--row-index': index }}>
                <td><div className="product-cell"><span className="product-symbol">{product.product_name.slice(0, 1).toUpperCase()}</span><span className="product-copy"><strong>{product.product_name}</strong><small>{product.description || 'No description'}</small></span></div></td>
                <td className="price-cell">{currency(product.price)}</td><td>{Number(product.quantity).toLocaleString()} <span className="muted">units</span></td>
                <td><span className={`stock-pill ${Number(product.quantity) < 5 ? 'low' : Number(product.quantity) < 15 ? 'watch' : 'healthy'}`}><i />{Number(product.quantity) < 5 ? 'Low stock' : Number(product.quantity) < 15 ? 'Monitor' : 'In stock'}</span></td>
                <td className="date-cell">{product.created_at ? new Date(`${product.created_at.replace(' ', 'T')}Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                <td><div className="row-actions"><button className="icon-button" type="button" title={`Edit ${product.product_name}`} aria-label={`Edit ${product.product_name}`} onClick={() => setModal({ product })}><Pencil size={15} /></button><button className="icon-button danger" type="button" title={`Delete ${product.product_name}`} aria-label={`Delete ${product.product_name}`} onClick={() => setPendingDelete(product)}><Trash2 size={15} /></button></div></td>
              </tr>)}</tbody></table></div>
            )}
            <footer className="panel-footer"><span>Showing <strong>{visibleProducts.length}</strong> of <strong>{products.length}</strong> products</span><span className="sync-copy"><i /> Synced with LavaLust API</span></footer>
          </section>
          <footer className="page-footer"><span>FIELDNOTE INVENTORY</span><span>Thoughtfully organized, securely stored.</span></footer>
        </section>}
      </main>

      {modal && <ProductModal product={modal.product} onClose={() => setModal(null)} onSave={saveProduct} />}
      {pendingDelete && <ConfirmModal product={pendingDelete} onCancel={() => setPendingDelete(null)} onConfirm={deleteProduct} />}
      {showLogoutConfirm && <LogoutConfirmModal onCancel={() => setShowLogoutConfirm(false)} onConfirm={signOut} />}
    </div>
  )
}

function OverviewPage({ products, summary, loading, error, notice, noticeId, onDismissNotice, onAddProduct }) {
  const lowStock = products.filter((product) => Number(product.quantity) < 5)
  const recentProducts = [...products]
    .sort((first, second) => new Date(second.created_at) - new Date(first.created_at))
    .slice(0, 5)

  return <section className="page-content overview-content" id="overview">
    <div className="page-heading">
      <div><p className="eyebrow">WORKSPACE / OVERVIEW</p><h1>Overview</h1><p className="heading-subtitle">A quick read on your inventory and the products that need attention.</p></div>
      <button className="primary-button" type="button" onClick={onAddProduct}><Plus size={17} /> Add product</button>
    </div>

    <div className="summary-grid">
      <SummaryCard label="Products listed" value={products.length.toLocaleString()} detail="Across your inventory" icon={<Boxes size={19} />} color="green" />
      <SummaryCard label="Units in stock" value={summary.units.toLocaleString()} detail="Total available quantity" icon={<PackagePlus size={19} />} color="blue" />
      <SummaryCard label="Stock value" value={currency(summary.value)} detail="Based on current price" icon={<CircleDollarSign size={19} />} color="amber" />
      <SummaryCard label="Low stock" value={summary.low.toLocaleString()} detail="Fewer than 5 units" icon={<CircleAlert size={19} />} color="rose" />
    </div>

    {error && <div className="inline-error" role="alert">{error}<button type="button" onClick={() => window.location.reload()}>Retry</button></div>}
    {notice && <div key={noticeId} className="notice overview-notice" role="status"><Check size={15} />{notice}<button type="button" title="Dismiss" onClick={onDismissNotice}><X size={15} /></button></div>}

    <div className="overview-grid">
      <section className="inventory-panel overview-panel" aria-labelledby="recent-products-title">
        <header className="overview-panel-heading"><div><h2 id="recent-products-title">Recent products</h2><p>Your latest additions to the catalog.</p></div><a className="view-all-link" href="#products">View all <ArrowRight size={14} /></a></header>
        {loading ? <div className="table-state"><span className="spinner" /> Loading inventory</div> : recentProducts.length ? <div className="overview-product-list">{recentProducts.map((product) => <div className="overview-product-row" key={product.id}>
          <span className="product-symbol">{product.product_name.slice(0, 1).toUpperCase()}</span>
          <span className="overview-product-name"><strong>{product.product_name}</strong><small>{product.description || 'No description'}</small></span>
          <span className="overview-product-stock">{Number(product.quantity).toLocaleString()} <small>units</small></span>
          <strong className="overview-product-price">{currency(product.price)}</strong>
        </div>)}</div> : <div className="overview-empty"><PackagePlus size={21} /><span>No products yet</span><a href="#products">Go to products</a></div>}
        <footer className="overview-panel-footer"><span>{products.length} products in your catalog</span><a href="#products">Manage products <ArrowRight size={13} /></a></footer>
      </section>

      <section className="inventory-panel overview-panel attention-panel" aria-labelledby="stock-attention-title">
        <header className="overview-panel-heading"><div><h2 id="stock-attention-title">Stock attention <span className="attention-count">{lowStock.length}</span></h2><p>Items with fewer than 5 units available.</p></div><CircleAlert size={18} className="attention-mark" /></header>
        {loading ? <div className="table-state"><span className="spinner" /> Checking stock</div> : lowStock.length ? <div className="low-stock-list">{lowStock.slice(0, 5).map((product) => <div className="low-stock-row" key={product.id}><span className="low-stock-dot" /><span><strong>{product.product_name}</strong><small>{currency(product.price)} per unit</small></span><b>{Number(product.quantity).toLocaleString()} left</b></div>)}</div> : <div className="stock-clear"><span><Check size={17} /></span><div><strong>All clear</strong><small>No products are running low.</small></div></div>}
        <footer className="overview-panel-footer"><span>Low stock threshold: 5 units</span><a href="#products">Review stock <ArrowRight size={13} /></a></footer>
      </section>
    </div>

    <footer className="page-footer"><span>FIELDNOTE INVENTORY</span><span>Thoughtfully organized, securely stored.</span></footer>
  </section>
}

function SummaryCard({ label, value, detail, icon, color }) {
  return <article className="summary-card"><span className={`summary-icon ${color}`}>{icon}</span><div className="summary-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div><ArrowRight className="summary-arrow" size={15} /></article>
}

function ThemeButton({ theme, onToggle }) {
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  const Icon = theme === 'dark' ? Sun : Moon

  return <button className="theme-toggle" type="button" onClick={onToggle} aria-label={label} title={label}><Icon size={17} /></button>
}

function AuthScreen({ onAuthenticate, theme, onToggleTheme }) {
  const [mode, setMode] = useState('login')
  const [values, setValues] = useState({ username: '', identity: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onAuthenticate(mode, mode === 'login'
        ? { identity: values.identity, password: values.password }
        : { username: values.username, email: values.email, password: values.password })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-screen" data-theme={theme}>
    <section className="auth-story"><a className="brand light" href="#signin"><span className="brand-mark"><ShoppingBag size={18} /></span><span>fieldnote<span className="brand-period">.</span></span></a><div className="story-copy"><span className="story-kicker"><i /> INVENTORY, WITH INTENTION</span><h1>Make room<br />for <em>what matters.</em></h1><p>A quieter, clearer way to keep track of the things you make and sell.</p><div className="story-rule" /><div className="story-foot"><span>01 / PRODUCT WORKSPACE</span><span>BUILT FOR SMALL BUSINESS</span></div></div><div className="story-orbit orbit-one" /><div className="story-orbit orbit-two" /><span className="story-leaf">✳</span></section>
    <section className="auth-side" id="signin"><ThemeButton theme={theme} onToggle={onToggleTheme} /><div className="auth-form-wrap"><div className="auth-mobile-brand"><span className="brand-mark"><ShoppingBag size={17} /></span> fieldnote<span className="brand-period">.</span></div><div className="auth-heading"><p className="eyebrow">YOUR WORKSPACE AWAITS</p><h2>{mode === 'login' ? 'Welcome back.' : 'Start with the basics.'}</h2><p>{mode === 'login' ? 'Sign in to pick up where you left off.' : 'Create an account to manage your product catalog.'}</p></div><form className="auth-form" onSubmit={submit}>
      {mode === 'register' && <label>Username<input required maxLength="100" autoComplete="username" value={values.username} onChange={(event) => setValues({ ...values, username: event.target.value })} placeholder="Your name" /></label>}
      {mode === 'register' ? <label>Email address<input required type="email" autoComplete="email" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} placeholder="you@studio.com" /></label> : <label>Email or username<input required autoComplete="username" value={values.identity} onChange={(event) => setValues({ ...values, identity: event.target.value })} placeholder="you@studio.com" /></label>}
      <label>Password<span className="password-input-wrap"><input required type={showPassword ? 'text' : 'password'} minLength="8" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })} placeholder="At least 8 characters" /><button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} title={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}<ArrowRight size={17} /></button>
    </form><div className="auth-switch">{mode === 'login' ? 'New to Fieldnote?' : 'Already have an account?'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></div><div className="auth-security"><ShieldCheck size={16} /><span>Protected with encrypted access tokens</span></div></div></section>
  </main>
}

function ProductModal({ product, onClose, onSave }) {
  const [values, setValues] = useState({ product_name: product?.product_name || '', description: product?.description || '', price: product?.price || '', quantity: product?.quantity ?? '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSave({ ...values, price: Number(values.price), quantity: Number(values.quantity) })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title"><header className="modal-header"><div><p className="eyebrow">PRODUCT DETAILS</p><h2 id="product-modal-title">{product ? 'Edit product' : 'Add a product'}</h2></div><button className="icon-button" type="button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></header><form onSubmit={submit} className="product-form">
    <label>Product name<input required maxLength="100" autoFocus value={values.product_name} onChange={(event) => setValues({ ...values, product_name: event.target.value })} placeholder="e.g. Ceramic pour-over" /></label>
    <label>Description <span className="optional">OPTIONAL</span><textarea rows="3" value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} placeholder="A few details about this product" /></label>
    <div className="form-row"><label>Unit price <span className="input-prefix">₱</span><input required type="number" min="0" step="0.01" value={values.price} onChange={(event) => setValues({ ...values, price: event.target.value })} placeholder="0.00" /></label><label>Quantity<input required type="number" min="0" step="1" value={values.quantity} onChange={(event) => setValues({ ...values, quantity: event.target.value })} placeholder="0" /></label></div>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : product ? 'Save changes' : 'Add product'}</button></div>
  </form></section></div>
}

function ConfirmModal({ product, onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function confirm() {
    setBusy(true)
    setError('')
    try { await onConfirm() } catch (requestError) { setError(requestError.message); setBusy(false) }
  }
  return <div className="modal-backdrop"><section className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title"><span className="confirm-icon"><Trash2 size={20} /></span><h2 id="delete-title">Remove this product?</h2><p><strong>{product.product_name}</strong> will be permanently removed from your catalog.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={onCancel}>Keep product</button><button className="delete-button" type="button" onClick={confirm} disabled={busy}>{busy ? 'Removing…' : 'Remove product'}</button></div></section></div>
}

function LogoutConfirmModal({ onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setBusy(true)
    await onConfirm()
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel() }}><section className="modal confirm-modal logout-modal" role="alertdialog" aria-modal="true" aria-labelledby="logout-title"><span className="confirm-icon logout-icon"><LogOut size={19} /></span><h2 id="logout-title">Sign out of Fieldnote?</h2><p>Your product data is saved. You can sign back in whenever you’re ready.</p><div className="modal-actions"><button className="secondary-button" type="button" onClick={onCancel} disabled={busy}>Stay signed in</button><button className="primary-button" type="button" onClick={confirm} disabled={busy}><LogOut size={15} />{busy ? 'Signing out…' : 'Sign out'}</button></div></section></div>
}

export default App