import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  Heart,
  Plus,
  Search,
  Sparkles,
  Star,
  Tag,
} from 'lucide-react';

export default function CollectionsView({
  categories,
  thoughts,
  collectionSearchQuery,
  setCollectionSearchQuery,
  collectionSelectedCategory,
  setCollectionSelectedCategory,
  collectionFavoritesOnly,
  setCollectionFavoritesOnly,
  formatDate,
  summarizeText,
  setSelectedThought,
  toggleFavorite,
  deleteThought,
  onAddThought,
}) {
  const normalizedQuery = collectionSearchQuery.trim().toLowerCase();

  // Apply search + favorites filter (category is handled by tabs)
  const baseFiltered = [...thoughts]
    .sort((left, right) => Number(right.createdAt || right.timestamp || 0) - Number(left.createdAt || left.timestamp || 0))
    .filter((thought) => {
      const haystack = `${thought.subject} ${thought.description} ${thought.category}`.toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      const matchesFavorite = !collectionFavoritesOnly || thought.favorite;
      return matchesQuery && matchesFavorite;
    });

  // Apply category filter
  const visibleThoughts = collectionSelectedCategory === 'All'
    ? baseFiltered
    : baseFiltered.filter((thought) => thought.category === collectionSelectedCategory);

  // Count thoughts per category (from baseFiltered so counts respect search/fav filters)
  const categoryCounts = {};
  for (const cat of categories) {
    categoryCounts[cat] = baseFiltered.filter((t) => t.category === cat).length;
  }
  const favoritesCount = baseFiltered.filter((t) => t.favorite).length;

  // Group by category for "All" view
  const groupedCollections = categories
    .map((category) => {
      const items = visibleThoughts.filter((thought) => thought.category === category);
      return { category, items };
    })
    .filter((group) => group.items.length > 0);

  const totalFavorites = thoughts.filter((thought) => thought.favorite).length;

  const renderThoughtCard = (thought) => (
    <button key={thought.id} type="button" className="article-card" onClick={() => setSelectedThought(thought)}>
      <span className="article-meta">
        <CalendarDays size={13} /> {formatDate(thought.entryDate || thought.createdAt || thought.timestamp)}
        {thought.favorite && <Heart size={13} className="favorite-mark" />}
      </span>
      <strong>{thought.subject || 'Untitled thought'}</strong>
      <p dir="auto" style={{ textAlign: thought.descriptionAlign || 'right' }}>
        {summarizeText(thought.description, 180)}
      </p>
      <span className="article-category-badge">
        <Tag size={11} /> {thought.category}
      </span>
      <span className="article-open">
        Open full view <ChevronLeft size={14} />
      </span>
    </button>
  );

  return (
    <section className="collections-page">
      <div className="collections-heading">
        <div>
          <p className="eyebrow">Home</p>
          <h2>Thought collections</h2>
        </div>
        <div className="collection-counts" aria-label="Collection counts">
          <span>
            <BookOpen size={15} /> {thoughts.length} thoughts
          </span>
          <span>
            <Tag size={15} /> {categories.length} collections
          </span>
          <span>
            <Heart size={15} /> {totalFavorites} favorites
          </span>
        </div>
      </div>

      {/* ── Category Tabs ── */}
      <div className="category-tabs" role="tablist" aria-label="Filter by category">
        <button
          type="button"
          role="tab"
          aria-selected={collectionSelectedCategory === 'All' && !collectionFavoritesOnly}
          className={`category-tab ${collectionSelectedCategory === 'All' && !collectionFavoritesOnly ? 'active' : ''}`}
          onClick={() => { setCollectionSelectedCategory('All'); setCollectionFavoritesOnly(false); }}
        >
          <BookOpen size={15} />
          All
          <span className="tab-count">{baseFiltered.length}</span>
        </button>

        {categories.map((category) => (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={collectionSelectedCategory === category && !collectionFavoritesOnly}
            className={`category-tab ${collectionSelectedCategory === category && !collectionFavoritesOnly ? 'active' : ''}`}
            onClick={() => { setCollectionSelectedCategory(category); setCollectionFavoritesOnly(false); }}
          >
            <Tag size={14} />
            {category}
            <span className="tab-count">{categoryCounts[category] || 0}</span>
          </button>
        ))}

        <button
          type="button"
          role="tab"
          aria-selected={collectionFavoritesOnly}
          className={`category-tab tab-favorites ${collectionFavoritesOnly ? 'active' : ''}`}
          onClick={() => { setCollectionFavoritesOnly(true); setCollectionSelectedCategory('All'); }}
        >
          <Star size={14} />
          Favorites
          <span className="tab-count">{favoritesCount}</span>
        </button>
      </div>

      {/* ── Search Bar ── */}
      <div className="collections-toolbar">
        <label className="search-box">
          <Search size={16} />
          <input
            value={collectionSearchQuery}
            onChange={(event) => setCollectionSearchQuery(event.target.value)}
            placeholder="Search thoughts..."
            dir="auto"
          />
        </label>
      </div>

      {/* ── Content ── */}
      {thoughts.length === 0 ? (
        <div className="empty-state">
          <Sparkles size={20} />
          <p>No thoughts saved yet.</p>
          <button type="button" className="secondary-button" onClick={onAddThought}>
            <Plus size={14} /> Add Thought
          </button>
        </div>
      ) : visibleThoughts.length === 0 ? (
        <div className="empty-state">
          <Search size={20} />
          <p>No thoughts match this view.</p>
        </div>
      ) : collectionSelectedCategory !== 'All' || collectionFavoritesOnly ? (
        /* ── Single category or favorites: flat grid, ALL thoughts ── */
        <section className="single-category-view">
          <div className="section-title-row">
            <h2>
              {collectionFavoritesOnly ? '★ Favorites' : collectionSelectedCategory}
            </h2>
            <span>{visibleThoughts.length} {visibleThoughts.length === 1 ? 'thought' : 'thoughts'}</span>
          </div>
          <div className="article-list">
            {visibleThoughts.map((thought) => renderThoughtCard(thought))}
          </div>
        </section>
      ) : (
        /* ── All categories: grouped sections, ALL thoughts per group ── */
        <div className="collection-section-grid">
          {groupedCollections.map((group) => (
            <section key={group.category} className="collection-section">
              <div className="collection-title-row">
                <h2>{group.category}</h2>
                <span>
                  {group.items.length} {group.items.length === 1 ? 'thought' : 'thoughts'}
                </span>
              </div>
              <div className="article-grid">
                {group.items.map((thought) => renderThoughtCard(thought))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
