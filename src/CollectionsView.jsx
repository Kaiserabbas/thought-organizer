import { Search, Filter, Star, Sparkles, Tag, Heart, ChevronRight, CalendarDays } from 'lucide-react';

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
}) {
  const groupedCollections = categories
    .map((category) => {
      const items = thoughts
        .filter((thought) => thought.category === category)
        .sort((left, right) => Number(right.createdAt || right.timestamp || 0) - Number(left.createdAt || left.timestamp || 0));

      return {
        category,
        items,
        favoriteCount: items.filter((thought) => thought.favorite).length,
      };
    })
    .filter((group) => group.items.length > 0);

  const visibleCollections = groupedCollections.filter((group) => {
    const haystack = `${group.category} ${group.items.map((thought) => `${thought.subject} ${thought.description}`).join(' ')}`.toLowerCase();
    const matchesQuery = haystack.includes(collectionSearchQuery.toLowerCase());
    const matchesCategory = collectionSelectedCategory === 'All' || group.category === collectionSelectedCategory;
    const matchesFavorite = !collectionFavoritesOnly || group.favoriteCount > 0;
    return matchesQuery && matchesCategory && matchesFavorite;
  });

  return (
    <section className="collections-page">
      <div className="collections-toolbar">
        <label className="search-box">
          <Search size={16} />
          <input
            value={collectionSearchQuery}
            onChange={(event) => setCollectionSearchQuery(event.target.value)}
            placeholder="Search collections"
          />
        </label>

        <div className="toolbar-controls">
          <label className="filter-pill">
            <Filter size={14} />
            <select value={collectionSelectedCategory} onChange={(event) => setCollectionSelectedCategory(event.target.value)}>
              <option value="All">All collections</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`toggle-pill ${collectionFavoritesOnly ? 'active' : ''}`}
            onClick={() => setCollectionFavoritesOnly((current) => !current)}
          >
            <Star size={14} /> Favorites only
          </button>
        </div>
      </div>

      <div className="collections-grid">
        {visibleCollections.length === 0 ? (
          <div className="empty-state subtle">
            <Sparkles size={18} />
            <p>No collections match this view yet.</p>
          </div>
        ) : (
          visibleCollections.map((group) => (
            <article key={group.category} className="collection-card">
              <div className="collection-card-header">
                <div>
                  <p className="eyebrow">Collection</p>
                  <h3>{group.category}</h3>
                </div>
                <div className="chip">{group.items.length} notes</div>
              </div>

              <div className="collection-summary-row">
                <span>
                  <Tag size={12} /> {group.category}
                </span>
                <span>{group.favoriteCount} favorites</span>
              </div>

              <div className="collection-preview-list">
                {group.items.slice(0, 3).map((thought) => (
                  <button key={thought.id} type="button" className="highlight-card" onClick={() => setSelectedThought(thought)}>
                    <div className="highlight-card-meta">
                      <span>
                        <CalendarDays size={12} /> {formatDate(thought.entryDate || thought.createdAt || thought.timestamp)}
                      </span>
                      {thought.favorite && <Heart size={12} />}
                    </div>
                    <strong>{thought.subject || 'Untitled thought'}</strong>
                    <p>{summarizeText(thought.description, 88)}</p>
                    <span className="highlight-card-footer">
                      Open full view <ChevronRight size={14} />
                    </span>
                  </button>
                ))}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
