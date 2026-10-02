import React, { useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  Copy,
  Heart,
  Plus,
  Search,
  Sparkles,
  Star,
  Tag,
  Trash2,
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
  onRequestDeleteThought,
  onAddThought,
  onCopyThought,
}) {
  const [copiedId, setCopiedId] = useState(null);
  const normalizedQuery = collectionSearchQuery.trim().toLowerCase();

  const handleQuickCopy = (e, thought) => {
    e.stopPropagation();
    if (onCopyThought) {
      onCopyThought(thought);
      setCopiedId(thought.id);
      setTimeout(() => setCopiedId(null), 1800);
    }
  };

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

  // Count thoughts per category
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

  const renderThoughtCard = (thought) => {
    const cardColorClass = `card-color-${thought.cardColor || 'default'}`;

    return (
      <div
        key={thought.id}
        className={`article-card ${cardColorClass}`}
        onClick={() => setSelectedThought(thought)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setSelectedThought(thought);
          }
        }}
      >
        <div className="card-top-row">
          <span className="article-meta">
            <CalendarDays size={13} /> {formatDate(thought.entryDate || thought.createdAt || thought.timestamp)}
          </span>
          <div className="card-quick-actions">
            <button
              type="button"
              className={`card-quick-btn copy-btn ${copiedId === thought.id ? 'active' : ''}`}
              onClick={(e) => handleQuickCopy(e, thought)}
              title={copiedId === thought.id ? 'Copied!' : 'Copy post'}
              aria-label="Copy post"
            >
              {copiedId === thought.id ? <Check size={14} className="copied-check" /> : <Copy size={14} />}
            </button>
            <button
              type="button"
              className={`card-quick-btn fav-btn ${thought.favorite ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(thought.id);
              }}
              title={thought.favorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-label="Toggle favorite"
            >
              <Star size={15} className={thought.favorite ? 'filled' : ''} />
            </button>
            <button
              type="button"
              className="card-quick-btn del-btn"
              onClick={(e) => {
                e.stopPropagation();
                onRequestDeleteThought(thought);
              }}
              title="Delete thought"
              aria-label="Delete thought"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Enhanced Heading with generous padding */}
        <strong className="article-title">{thought.subject || 'Untitled thought'}</strong>

        <p
          className="article-excerpt"
          dir="auto"
          style={{
            textAlign: thought.descriptionAlign || 'right',
            color: thought.textColor || undefined,
            fontWeight: thought.isBold ? '700' : undefined,
            fontStyle: thought.isItalic ? 'italic' : undefined,
          }}
        >
          {summarizeText(thought.description, 160)}
        </p>

        <div className="card-bottom-row">
          <span className="article-category-badge">
            <Tag size={11} /> {thought.category}
          </span>
          <span className="article-open">
            Open full view <ChevronLeft size={14} />
          </span>
        </div>
      </div>
    );
  };

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
          <button type="button" className="primary-button" onClick={onAddThought}>
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
        /* ── All categories: grouped sections, 2 thoughts each then ...more ── */
        <div className="collection-section-grid">
          {groupedCollections.map((group) => {
            const displayedItems = group.items.slice(0, 2);
            const remainingCount = group.items.length - 2;

            return (
              <section key={group.category} className="collection-section">
                <div className="collection-title-row">
                  <h2>{group.category}</h2>
                  <span>
                    {group.items.length} {group.items.length === 1 ? 'thought' : 'thoughts'}
                  </span>
                </div>
                <div className="article-grid">
                  {displayedItems.map((thought) => renderThoughtCard(thought))}
                </div>
                {remainingCount > 0 && (
                  <div className="category-more-row">
                    <button
                      type="button"
                      className="category-more-link"
                      onClick={() => {
                        setCollectionSelectedCategory(group.category);
                        setCollectionFavoritesOnly(false);
                      }}
                    >
                      ...more ({remainingCount} more)
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
