import React, { useState, useEffect } from 'react';
import { Sparkles, Dices } from 'lucide-react';
import ControlPanel from './components/ControlPanel';
import TicketGrid from './components/TicketGrid';
import { DEFAULT_THEMES, generateTicket } from './utils/tambolaEngine';

export default function App() {
  const [language, setLanguage] = useState('en');
  const [theme, setTheme] = useState('food');
  const [items, setItems] = useState([]);
  const [customTitle, setCustomTitle] = useState('');
  const [ticketsCount, setTicketsCount] = useState(6);
  const [ticketsPerPage, setTicketsPerPage] = useState(6);
  const [ticketStyle, setTicketStyle] = useState('royal-gold');
  const [tickets, setTickets] = useState([]);

  // Load default food theme on mount
  useEffect(() => {
    if (DEFAULT_THEMES.food) {
      setItems([...DEFAULT_THEMES.food.items]);
    }
  }, []);

  // Auto-generate initial set of tickets once items are loaded
  useEffect(() => {
    if (items.length >= 15 && tickets.length === 0) {
      handleGenerate();
    }
  }, [items]);

  // Handle generating new tickets
  const handleGenerate = () => {
    if (items.length < 15) return;
    
    const newTickets = [];
    for (let i = 0; i < ticketsCount; i++) {
      try {
        const ticket = generateTicket(items, i);
        newTickets.push(ticket);
      } catch (err) {
        console.error('Failed to generate ticket:', err);
      }
    }
    setTickets(newTickets);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header (hidden on print) */}
      <header className="no-print" style={{
        padding: '20px 40px',
        borderBottom: '1px solid var(--border-color)',
        background: 'rgba(19, 18, 36, 0.4)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(138, 43, 226, 0.3)'
          }}>
            <Dices color="white" size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>
              Lekho Tambola <span style={{ color: 'var(--accent-secondary)' }}>AI</span>
            </h1>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
              Themed Housie Ticket Generator
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <Sparkles size={14} color="var(--accent-secondary)" />
          <span>Gujarati | Hindi | English Supported</span>
        </div>
      </header>

      {/* Main Container */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        padding: '30px 40px',
        gap: '30px',
        maxWidth: '1600px',
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box'
      }}>
        
        {/* Left Side: Control Panel (no-print) */}
        <div className="no-print" style={{ width: '420px', flexShrink: 0 }}>
          <ControlPanel
            language={language}
            setLanguage={setLanguage}
            theme={theme}
            setTheme={setTheme}
            items={items}
            setItems={setItems}
            ticketsCount={ticketsCount}
            setTicketsCount={setTicketsCount}
            ticketsPerPage={ticketsPerPage}
            setTicketsPerPage={setTicketsPerPage}
            ticketStyle={ticketStyle}
            setTicketStyle={setTicketStyle}
            onGenerate={handleGenerate}
            customTitle={customTitle}
            setCustomTitle={setCustomTitle}
          />
        </div>

        {/* Right Side: Printable Tickets area */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          {tickets.length > 0 ? (
            <TicketGrid
              tickets={tickets}
              language={language}
              theme={theme}
              ticketStyle={ticketStyle}
              ticketsPerPage={ticketsPerPage}
              customTitle={customTitle}
              setTickets={setTickets}
            />
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px',
              textAlign: 'center',
              width: '100%'
            }} className="glass-panel">
              <Dices size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: '600' }}>No Tickets Generated</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '400px', marginTop: '4px' }}>
                Add at least 15 items in the list and click "Generate Tambola Tickets" to view your themed print sheet.
              </p>
            </div>
          )}
        </div>

      </main>

      {/* Footer (no-print) */}
      <footer className="no-print" style={{
        padding: '20px 40px',
        textAlign: 'center',
        borderTop: '1px solid var(--border-color)',
        fontSize: '12px',
        color: 'var(--text-muted)',
        marginTop: 'auto'
      }}>
        Lekho Tambola AI © 2026. Custom layout engines complying to official Tambola column occupancy constraints.
      </footer>

    </div>
  );
}
