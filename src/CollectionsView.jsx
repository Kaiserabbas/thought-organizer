import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  Filter,
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
  onAddThought,
}) {
  const normalizedQuery = collectionSearchQuery.trim().toLowerCase();
  const visibleThoughts = [...thoughts]
    .sort((left, right) => Number(right.createdAt || right.timestamp || 0) - Number(left.createdAt || left.timestamp || 0))
    .filter((thought) => {
      const haystack = `${thought.subject} ${thought.description} ${thought.category}`.toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      const matchesCategory = collectionSelectedCategory === 'All' || thought.category === collectionSelectedCategory;
      const matchesFavorite = !collectionFavoritesOnly || thought.favorite;
      return matchesQuery && matchesCategory && matchesFavorite;
    });

  const groupedCollections = categories
    .map((category) => {
      const items = visibleThoughts.filter((thought) => thought.category === category);

      return {
        category,
        items,
        favoriteCount: items.filter((thought) => thought.favorite).length,
      };
    })
    .filter((group) => group.items.length > 0);

  const featuredThoughts = visibleThoughts.slice(0, 5);
  const totalFavorites = thoughts.filter((thought) => thought.favorite).length;

  const renderThoughtCard = (thought, className = 'article-card', excerptLength = 92) => (
    <button key={thought.id} type="button" className={className} onClick={() => setSelectedThought(thought)}>
      <span className="article-meta">
        <CalendarDays size={13} /> {formatDate(thought.entryDate || thought.createdAt || thought.timestamp)}
        {thought.favorite && <Heart size={13} className="favorite-mark" />}
      </span>
      <strong>{thought.subject || 'Untitled thought'}</strong>
      <p>{summarizeText(thought.description, excerptLength)}</p>
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

      <div className="collections-toolbar">
        <label className="search-box">
          <Search size={16} />
          <input
            value={collectionSearchQuery}
            onChange={(event) => setCollectionSearchQuery(event.target.value)}
            placeholder="Search thoughts"
            dir="auto"
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
      ) : (
        <>
          <section className="featured-section">
            <div className="section-title-row">
              <h2>Featured thoughts</h2>
              <span>{featuredThoughts.length} latest</span>
            </div>
            <div className="featured-grid">
              {featuredThoughts.map((thought, index) => renderThoughtCard(
                thought,
                index === 0 ? 'article-card feature-card-large' : 'article-card feature-card',
                index === 0 ? 180 : 86,
              ))}
            </div>
          </section>

          <div className="collection-section-grid">
            {groupedCollections.map((group) => (
              <section key={group.category} className="collection-section">
                <div className="collection-title-row">
                  <h2>{group.category}</h2>
                  <span>
                    {group.items.length} thoughts
                    {group.favoriteCount > 0 ? ` / ${group.favoriteCount} favorites` : ''}
                  </span>
                </div>
                <div className="article-grid">
                  {group.items.slice(0, 4).map((thought) => renderThoughtCard(thought))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
