import React, { useState } from 'react';
import { Plus, Trash2, RotateCcw, AlertTriangle, Eye, Download, Printer } from 'lucide-react';
import { DEFAULT_THEMES } from '../utils/tambolaEngine';

export default function ControlPanel({
  language,
  setLanguage,
  theme,
  setTheme,
  items,
  setItems,
  ticketsCount,
  setTicketsCount,
  ticketsPerPage,
  setTicketsPerPage,
  ticketStyle,
  setTicketStyle,
  onGenerate,
  customTitle,
  setCustomTitle
}) {
  const [newEmoji, setNewEmoji] = useState('🍿');
  const [newEnName, setNewEnName] = useState('');
  const [newHiName, setNewHiName] = useState('');
  const [newGuName, setNewGuName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Handle adding a new item
  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newEnName.trim()) return;

    const newItem = {
      id: `custom-${Date.now()}`,
      emoji: newEmoji,
      name: {
        en: newEnName.trim(),
        hi: newHiName.trim() || newEnName.trim(),
        gu: newGuName.trim() || newEnName.trim()
      }
    };

    setItems([newItem, ...items]);
    setNewEnName('');
    setNewHiName('');
    setNewGuName('');
  };

  // Reset theme items to original state
  const handleResetItems = () => {
    if (DEFAULT_THEMES[theme]) {
      setItems([...DEFAULT_THEMES[theme].items]);
    } else {
      setItems([]);
    }
  };

  // Remove an item
  const handleRemoveItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  // Filter items based on search query
  const filteredItems = items.filter(item => {
    const q = searchQuery.toLowerCase();
    return (
      item.name.en.toLowerCase().includes(q) ||
      (item.name.hi && item.name.hi.toLowerCase().includes(q)) ||
      (item.name.gu && item.name.gu.toLowerCase().includes(q))
    );
  });

  return (
    <div className="glass-panel no-print" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Title */}
      <div>
        <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px', background: 'linear-gradient(135deg, #fff, #9f9bbd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Configurator
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Configure theme rules, item names and ticket layout.
        </p>
      </div>

      {/* Title settings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>
          Ticket Custom Title / Banner
        </label>
        <input
          type="text"
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          className="form-input"
          placeholder={`Default: ${DEFAULT_THEMES[theme]?.name[language] || 'Custom Tambola'}`}
        />
      </div>

      {/* Grid: Theme + Language */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Theme Template</label>
          <select
            value={theme}
            onChange={(e) => {
              const val = e.target.value;
              setTheme(val);
              if (DEFAULT_THEMES[val]) {
                setItems([...DEFAULT_THEMES[val].items]);
              } else {
                setItems([]);
              }
              setCustomTitle(''); // Reset override to fallback to translated title
            }}
            className="form-input"
          >
            <option value="food">🍕 Food Fiesta</option>
            <option value="kitty">💄 Kitty Party</option>
            <option value="custom">✨ Create Custom</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Display Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="form-input"
          >
            <option value="en">English</option>
            <option value="hi">Hindi (हिंदी)</option>
            <option value="gu">Gujarati (ગુજરાતી)</option>
          </select>
        </div>
      </div>

      {/* Grid: Ticket Style + Count */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Ticket Skin/Design</label>
          <select
            value={ticketStyle}
            onChange={(e) => setTicketStyle(e.target.value)}
            className="form-input"
          >
            <option value="royal-gold">👑 Royal Gold</option>
            <option value="neon-party">⚡ Neon Party</option>
            <option value="fresh-mint">🍃 Fresh Mint</option>
            <option value="classic-retro">📜 Classic Retro</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Tickets Count</label>
          <input
            type="number"
            min="1"
            max="120"
            value={ticketsCount}
            onChange={(e) => setTicketsCount(Math.max(1, parseInt(e.target.value) || 1))}
            className="form-input"
          />
        </div>
      </div>

      {/* Print Layout: Density */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Tickets per A4 Sheet</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {[1, 2, 4, 6].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => setTicketsPerPage(num)}
              className={`btn ${ticketsPerPage === num ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 0', fontSize: '13px' }}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      <hr style={{ border: '0', borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

      {/* Items Section Header */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Theme Item List
            <span style={{
              marginLeft: '8px',
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '20px',
              backgroundColor: items.length >= 15 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: items.length >= 15 ? '#10b981' : '#ef4444'
            }}>
              {items.length} Items ({items.length >= 15 ? 'Valid' : 'Needs 15'})
            </span>
          </h3>
          {theme !== 'custom' && (
            <button
              onClick={handleResetItems}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: 'none', border: 'none', color: 'var(--accent-secondary)', cursor: 'pointer' }}
              title="Reset items list"
            >
              <RotateCcw size={12} /> Reset
            </button>
          )}
        </div>

        {items.length < 15 && (
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            padding: '10px',
            borderRadius: '8px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#fbbf24',
            fontSize: '12px',
            marginBottom: '12px'
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>You need at least 15 items in the list to generate tickets. Add {15 - items.length} more!</span>
          </div>
        )}

        {/* Add New Item Form */}
        <form onSubmit={handleAddItem} className="glass-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
              placeholder="Emoji"
              style={{ width: '50px', textAlign: 'center' }}
              className="form-input"
            />
            <input
              type="text"
              value={newEnName}
              onChange={(e) => setNewEnName(e.target.value)}
              placeholder="Name (English)"
              className="form-input"
            />
            <button
              type="submit"
              disabled={!newEnName.trim()}
              className="btn btn-primary"
              style={{ padding: '0 12px', flexShrink: 0 }}
            >
              <Plus size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <input
              type="text"
              value={newHiName}
              onChange={(e) => setNewHiName(e.target.value)}
              placeholder="Hindi (optional)"
              className="form-input"
              style={{ fontSize: '12px' }}
            />
            <input
              type="text"
              value={newGuName}
              onChange={(e) => setNewGuName(e.target.value)}
              placeholder="Gujarati (optional)"
              className="form-input"
              style={{ fontSize: '12px' }}
            />
          </div>
        </form>

        {/* Search bar */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Search items..."
          className="form-input"
          style={{ marginBottom: '8px', padding: '6px 12px', fontSize: '13px' }}
        />

        {/* Scrollable list of items */}
        <div style={{
          maxHeight: '220px',
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '6px',
          paddingRight: '4px'
        }}>
          {filteredItems.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>{item.emoji}</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500' }}>{item.name.en}</span>
                  {(item.name.hi !== item.name.en || item.name.gu !== item.name.en) && (
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                      {item.name.hi} / {item.name.gu}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveItem(item.id)}
                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '4px' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {filteredItems.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              No items matched search.
            </div>
          )}
        </div>
      </div>

      {/* Main Generate Button */}
      <button
        onClick={onGenerate}
        disabled={items.length < 15}
        className="btn btn-primary"
        style={{
          width: '100%',
          padding: '14px 20px',
          fontSize: '16px',
          fontWeight: '700',
          marginTop: '10px',
          opacity: items.length < 15 ? 0.5 : 1,
          cursor: items.length < 15 ? 'not-allowed' : 'pointer'
        }}
      >
        ✨ Generate Tambola Tickets
      </button>
    </div>
  );
}
